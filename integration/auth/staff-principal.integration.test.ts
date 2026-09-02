import { Client } from 'pg';
import type { Payload, PayloadRequest } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  AGENT15_STAFF_PASSWORD,
  closePortalAuthRuntime,
  createPortalAuthHandler,
  enrollAndVerifyMfa,
  login,
  portalAuthRequest,
  provisionStaffFixture,
  provisionUnboundCredential,
  quiescePostgresPool,
  responseCookie,
  totpCode,
  type StaffFixture,
} from '../support/auth';
import {
  activateAgent15Environment,
  createAgent15Database,
  type Agent15Database,
} from '../support/database';

let database: Agent15Database;
let payload: Payload;
let payloadMigration: Client;
let authRuntime: Client;

function headers(cookie: string, extra: Record<string, string> = {}) {
  return new Headers({ cookie, ...extra });
}

beforeAll(async () => {
  database = await createAgent15Database('authflow');
  activateAgent15Environment(database);
  payloadMigration = new Client({
    connectionString: database.payloadMigrationURL,
  });
  authRuntime = new Client({ connectionString: database.authRuntimeURL });
  await Promise.all([payloadMigration.connect(), authRuntime.connect()]);
});

afterAll(async () => {
  const payloadPool = (
    payload as unknown as { db?: { pool?: { end(): Promise<void> } } }
  )?.db?.pool;
  const payloadClosed = quiescePostgresPool(payloadPool).catch(() => undefined);
  const authClosed = closePortalAuthRuntime().catch(() => undefined);
  void payloadClosed;
  void authClosed;
  await payload?.destroy();
  await Promise.all([
    payloadMigration?.end().catch(() => undefined),
    authRuntime?.end().catch(() => undefined),
  ]);
  await database?.destroy();
});

describe('Better Auth to attested Payload composition', () => {
  it('enforces canonical binding, MFA clocks, role provenance, live state, and request isolation', async () => {
    // The production bootstrap has its own blocking regression test. This
    // fixture is deliberately migration-owned so the rest of the security
    // chain remains testable without minting or weakening system capability.
    const ownerCredential = await provisionUnboundCredential(
      'owner-login@example.test',
      'Olivia Owner',
    );
    const ownerInsert = await payloadMigration.query<{ id: number }>(
      `INSERT INTO public.staff
         (first_name, last_name, work_email, role, status, is_primary_owner)
       VALUES ('Olivia', 'Owner', 'owner-work@example.test', 'owner', 'active', true)
       RETURNING id`,
    );
    await payloadMigration.query(
      `INSERT INTO public.portal_identities
         (auth_user_id, subject_type, staff_id)
       VALUES ($1, 'staff', $2)`,
      [ownerCredential.authUserId, ownerInsert.rows[0]!.id],
    );

    const [{ getPayload }, { default: config }] = await Promise.all([
      import('payload'),
      import('@payload-config'),
    ]);
    payload = await getPayload({ config });

    const ownerRows = await payload.find({
      collection: 'staff',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: { isPrimaryOwner: { equals: true } },
    });
    const ownerRecord = ownerRows.docs[0] as unknown as {
      id: number;
      role: 'owner';
      workEmail: string;
    };
    const ownerBindingRows = await payload.find({
      collection: 'portal-identities',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: { staff: { equals: ownerRecord.id } },
    });
    const ownerBinding = ownerBindingRows.docs[0] as unknown as {
      authUserId: string;
    };
    const owner: StaffFixture = Object.freeze({
      authUserId: ownerBinding.authUserId,
      email: 'owner-login@example.test',
      password: AGENT15_STAFF_PASSWORD,
      role: 'owner',
      staffId: ownerRecord.id,
      workEmail: ownerRecord.workEmail,
    });

    const administrator = await provisionStaffFixture(payloadMigration, {
      email: 'administrator-login@example.test',
      firstName: 'Ada',
      lastName: 'Administrator',
      role: 'administrator',
      workEmail: 'administrator-work@example.test',
    });
    const caseWorker = await provisionStaffFixture(payloadMigration, {
      email: 'case-worker-login@example.test',
      firstName: 'Casey',
      lastName: 'Worker',
      role: 'case-worker',
      workEmail: 'case-worker-work@example.test',
    });
    const intake = await provisionStaffFixture(payloadMigration, {
      email: 'intake-login@example.test',
      firstName: 'Ivy',
      lastName: 'Intake',
      role: 'intake',
      workEmail: 'intake-work@example.test',
    });

    const clients = await payloadMigration.query<{ id: number }>(
      `INSERT INTO public.clients
         (client_number, first_name, last_name, contact_email, status)
       VALUES
         ('CL-A15A-0001', 'Bound', 'Client', 'bound-client@example.test', 'active'),
         ('CL-A15A-0002', 'Unbound', 'Client', 'unbound-client@example.test', 'active')
       RETURNING id`,
    );
    const boundClientCredential = await provisionUnboundCredential(
      'bound-client@example.test',
      'Bound Client',
    );
    await payloadMigration.query(
      `INSERT INTO public.portal_identities
         (auth_user_id, subject_type, client_id)
       VALUES ($1, 'client', $2)`,
      [boundClientCredential.authUserId, clients.rows[0]!.id],
    );

    // Email equality alone is intentionally insufficient in both directions.
    await provisionUnboundCredential(
      administrator.workEmail,
      'Staff Email Twin',
    );
    await provisionUnboundCredential(
      'unbound-client@example.test',
      'Client Email Twin',
    );

    const handler = await createPortalAuthHandler();
    const principalModule =
      await import('@/modules/auth/portal-principal-composition');
    const sessionModule = await import('@/modules/auth/session');
    const gatewayModule =
      await import('@/modules/authorization/infrastructure/portal-payload-gateway');
    const systemModule =
      await import('@/modules/authorization/infrastructure/system-payload-gateway');

    const staff = [owner, administrator, caseWorker, intake] as const;
    const credentialCookies = new Map<StaffFixture, string>();
    for (const subject of staff) {
      const response = await login(handler, subject.email, subject.password);
      expect(response.status).toBe(200);
      const cookie = responseCookie(response, 'session_token');
      credentialCookies.set(subject, cookie);
      await expect(
        principalModule.resolveCanonicalPortalPrincipalFromSession(
          headers(cookie),
        ),
      ).resolves.toMatchObject({
        outcome: 'enrollment-only',
        principal: {
          authUserId: subject.authUserId,
          kind: 'staff-enrollment',
          staffId: subject.staffId,
        },
      });
    }

    const ownerInitial = await sessionModule.readAuthenticatedPortalSession(
      headers(credentialCookies.get(owner)!),
    );
    expect(ownerInitial).not.toBeNull();
    const ownerCreatedAt = new Date(Date.now() - 20 * 60_000);
    const ownerDeadline = new Date(Date.now() + (8 * 60 - 20) * 60_000);
    await authRuntime.query(
      `UPDATE portal_auth.session
          SET "createdAt" = $1, "expiresAt" = $2
        WHERE id = $3`,
      [ownerCreatedAt, ownerDeadline, ownerInitial!.sessionId],
    );
    await expect(
      principalModule.resolveCanonicalPortalPrincipalFromSession(
        headers(credentialCookies.get(owner)!),
      ),
    ).resolves.toMatchObject({
      outcome: 'enrollment-only',
      session: { fresh: false },
    });

    const intakeInitial = await sessionModule.readAuthenticatedPortalSession(
      headers(credentialCookies.get(intake)!),
    );
    expect(intakeInitial).not.toBeNull();
    const intakeCreatedAt = new Date(Date.now() - (8 * 60 - 5) * 60_000);
    const intakeDeadline = new Date(Date.now() + 5 * 60_000);
    await authRuntime.query(
      `UPDATE portal_auth.session
          SET "createdAt" = $1, "expiresAt" = $2
        WHERE id = $3`,
      [intakeCreatedAt, intakeDeadline, intakeInitial!.sessionId],
    );

    const verified = new Map<
      StaffFixture,
      Awaited<ReturnType<typeof enrollAndVerifyMfa>>
    >();
    for (const subject of staff) {
      const assurance = await enrollAndVerifyMfa(
        handler,
        credentialCookies.get(subject)!,
        subject.password,
      );
      verified.set(subject, assurance);
      await expect(
        principalModule.resolveCanonicalPortalPrincipalFromSession(
          headers(assurance.cookie),
        ),
      ).resolves.toMatchObject({
        outcome: 'authorized',
        principal: {
          authUserId: subject.authUserId,
          kind: 'staff',
          role: subject.role,
          staffId: subject.staffId,
        },
      });
    }

    const ownerAfterMfa = await sessionModule.readAuthenticatedPortalSession(
      headers(verified.get(owner)!.cookie),
    );
    expect(ownerAfterMfa!.createdAt.getTime()).toBe(ownerCreatedAt.getTime());
    expect(ownerAfterMfa!.expiresAt.getTime()).toBeLessThanOrEqual(
      ownerDeadline.getTime(),
    );
    await expect(
      principalModule.resolveCanonicalPortalPrincipalFromSession(
        headers(verified.get(owner)!.cookie),
      ),
    ).resolves.toMatchObject({
      outcome: 'authorized',
      session: { fresh: false },
    });
    const intakeAfterMfa = await sessionModule.readAuthenticatedPortalSession(
      headers(verified.get(intake)!.cookie),
    );
    expect(intakeAfterMfa!.expiresAt.getTime()).toBeLessThanOrEqual(
      intakeDeadline.getTime(),
    );

    // Canonical Staff state wins over every request/provider-shaped role claim.
    await expect(
      principalModule.resolveCanonicalPortalPrincipalFromSession(
        headers(verified.get(intake)!.cookie, {
          'x-auth-user-id': owner.authUserId,
          'x-mfa-verified': 'true',
          'x-provider-role': 'owner',
          'x-request-role': 'owner',
          'x-staff-id': String(owner.staffId),
        }),
      ),
    ).resolves.toMatchObject({
      outcome: 'authorized',
      principal: { role: 'intake', staffId: intake.staffId },
    });

    const actualFind = payload.find.bind(payload);
    const findArguments: Array<Record<string, unknown>> = [];
    (payload as unknown as { find: typeof payload.find }).find = (async (
      options: Record<string, unknown>,
    ) => {
      findArguments.push(options);
      return actualFind(options as never);
    }) as typeof payload.find;

    const clientCollection = payload.collections.clients as unknown as {
      config: {
        access: {
          read: (args: { req: PayloadRequest }) => unknown | Promise<unknown>;
        };
      };
    };
    const actualClientRead = clientCollection.config.access.read;
    const observedRequests: PayloadRequest[] = [];
    const copiedRequestDenied: boolean[] = [];
    clientCollection.config.access.read = async (args) => {
      const decision = await actualClientRead(args);
      observedRequests.push(args.req);
      copiedRequestDenied.push(
        gatewayModule.resolveAttestedPortalRequest({
          ...args.req,
          context: args.req.context,
        }) === undefined,
      );
      expect(
        gatewayModule.resolveAttestedPortalRequest({
          context: args.req.context,
          user: { ...(args.req.user as object), role: 'owner' },
        }),
      ).toBeUndefined();
      return decision;
    };

    try {
      const ownerClients =
        await gatewayModule.portalPayloadGateway.listClientSummaries(
          headers(verified.get(owner)!.cookie),
        );
      const administratorClients =
        await gatewayModule.portalPayloadGateway.listClientSummaries(
          headers(verified.get(administrator)!.cookie),
        );
      const intakeClients =
        await gatewayModule.portalPayloadGateway.listClientSummaries(
          headers(verified.get(intake)!.cookie),
        );
      expect(ownerClients).toEqual(administratorClients);
      expect(intakeClients).toEqual(ownerClients);
      expect(ownerClients).toHaveLength(2);
      expect(JSON.stringify(ownerClients)).not.toContain('contactEmail');
      expect(JSON.stringify(ownerClients)).not.toContain('isPrimaryOwner');
      expect(JSON.stringify(ownerClients)).not.toContain('portalIdentity');
      expect(JSON.stringify(ownerClients)).not.toContain('authUserId');

      await expect(
        gatewayModule.portalPayloadGateway.listClientSummaries(
          headers(verified.get(caseWorker)!.cookie),
        ),
      ).rejects.toMatchObject({ code: 'assignment-required' });

      await gatewayModule.portalPayloadGateway.listClientSummaries(
        headers(verified.get(owner)!.cookie),
      );
    } finally {
      (payload as unknown as { find: typeof payload.find }).find = actualFind;
      clientCollection.config.access.read = actualClientRead;
    }

    const clientFindArguments = findArguments.filter(
      (call) => call.collection === 'clients' && call.overrideAccess === false,
    );
    expect(clientFindArguments).not.toHaveLength(0);
    for (const call of clientFindArguments) {
      expect(call).toMatchObject({
        collection: 'clients',
        depth: 0,
        limit: 100,
        overrideAccess: false,
        page: 1,
        select: {
          clientNumber: true,
          firstName: true,
          lastName: true,
          status: true,
        },
      });
      expect(call).not.toHaveProperty('req');
    }
    expect(observedRequests.length).toBeGreaterThanOrEqual(4);
    expect(observedRequests[0]).not.toBe(observedRequests.at(-1));
    expect(observedRequests[0]!.context).not.toBe(
      observedRequests.at(-1)!.context,
    );
    expect(observedRequests[0]!.payloadDataLoader).not.toBe(
      observedRequests.at(-1)!.payloadDataLoader,
    );
    expect(copiedRequestDenied.every(Boolean)).toBe(true);
    for (const request of observedRequests) {
      expect(
        gatewayModule.resolveAttestedPortalRequest(request),
      ).toBeUndefined();
    }

    // Runtime shape is not trust, and neither exported boundary exposes an issuer.
    const ownerResolution =
      await principalModule.resolveCanonicalPortalPrincipalFromSession(
        headers(verified.get(owner)!.cookie),
      );
    expect(ownerResolution.outcome).toBe('authorized');
    if (ownerResolution.outcome !== 'authorized') {
      throw new Error('Expected the verified Owner fixture to resolve.');
    }
    const { parsePortalPrincipal } =
      await import('@/modules/portal-identity/domain/principal');
    const serializedOwner = JSON.parse(
      JSON.stringify(ownerResolution.principal),
    ) as unknown;
    const parsedOwner = parsePortalPrincipal(serializedOwner);
    expect(parsedOwner).toBeDefined();
    for (const fake of [
      ownerResolution.principal,
      parsedOwner,
      serializedOwner,
      Object.freeze({ ...ownerResolution.principal }),
      {
        authUserId: owner.authUserId,
        kind: 'staff',
        mfaAssurance: 'verified',
        role: 'owner',
        staffId: owner.staffId,
        status: 'active',
      },
      Object.freeze({
        authUserId: administrator.authUserId,
        kind: 'staff',
        mfaAssurance: 'verified',
        role: 'administrator',
        staffId: administrator.staffId,
        status: 'active',
      }),
      JSON.parse(
        JSON.stringify({
          authUserId: 'auth-client-fake',
          clientId: clients.rows[0]!.id,
          kind: 'client',
          status: 'active',
        }),
      ),
      new Headers({ authorization: 'Bearer fake-owner' }),
      {},
    ]) {
      await expect(
        gatewayModule.portalPayloadGateway.listClientSummaries(fake as never),
      ).rejects.toMatchObject({ code: 'invalid-principal' });
    }
    expect(
      gatewayModule.resolveAttestedPortalRequest({
        context: { portalPayloadCapability: {} },
        user: {
          collection: 'portal-principals',
          id: `staff:${owner.staffId}`,
          kind: 'staff',
          role: 'owner',
          staffId: owner.staffId,
        },
      }),
    ).toBeUndefined();
    expect(
      systemModule.authorizePrimaryOwnerBootstrapRequest({
        context: { portalSystemCapability: {} },
        req: { context: { portalSystemCapability: {} } },
        systemOperation: 'primary-owner-bootstrap',
      } as never),
    ).toBe(false);
    expect(Object.keys(gatewayModule)).not.toContain(
      'composePortalPayloadGatewayWithPrincipalResolver',
    );
    expect(Object.keys(systemModule)).not.toContain(
      'composePrimaryOwnerBootstrapSystemGateway',
    );

    // Client credentials remain fail-closed even with a trusted test binding.
    const boundClientLogin = await login(
      handler,
      'bound-client@example.test',
      AGENT15_STAFF_PASSWORD,
    );
    const boundClientCookie = responseCookie(boundClientLogin, 'session_token');
    await expect(
      principalModule.resolveCanonicalPortalPrincipalFromSession(
        headers(boundClientCookie),
      ),
    ).resolves.toEqual({ outcome: 'denied' });

    for (const emailTwin of [
      administrator.workEmail,
      'unbound-client@example.test',
    ]) {
      const unboundLogin = await login(
        handler,
        emailTwin,
        AGENT15_STAFF_PASSWORD,
      );
      const unboundCookie = responseCookie(unboundLogin, 'session_token');
      await expect(
        principalModule.resolveCanonicalPortalPrincipalFromSession(
          headers(unboundCookie),
        ),
      ).resolves.toEqual({ outcome: 'denied' });
    }

    // Expiration, revocation, and live domain status are re-evaluated.
    const administratorSession =
      await sessionModule.readAuthenticatedPortalSession(
        headers(verified.get(administrator)!.cookie),
      );
    await authRuntime.query(
      `UPDATE portal_auth.session SET "expiresAt" = now() - interval '1 second' WHERE id = $1`,
      [administratorSession!.sessionId],
    );
    await expect(
      principalModule.resolveCanonicalPortalPrincipalFromSession(
        headers(verified.get(administrator)!.cookie),
      ),
    ).resolves.toEqual({ outcome: 'denied' });

    const caseSession = await sessionModule.readAuthenticatedPortalSession(
      headers(verified.get(caseWorker)!.cookie),
    );
    await authRuntime.query('DELETE FROM portal_auth.session WHERE id = $1', [
      caseSession!.sessionId,
    ]);
    await expect(
      principalModule.resolveCanonicalPortalPrincipalFromSession(
        headers(verified.get(caseWorker)!.cookie),
      ),
    ).resolves.toEqual({ outcome: 'denied' });

    await payloadMigration.query(
      `UPDATE public.staff SET status = 'disabled' WHERE id = $1`,
      [intake.staffId],
    );
    await expect(
      principalModule.resolveCanonicalPortalPrincipalFromSession(
        headers(verified.get(intake)!.cookie),
      ),
    ).resolves.toEqual({ outcome: 'denied' });

    // A genuinely new post-enrollment login creates a new authentication epoch.
    const signedOut = await handler(
      portalAuthRequest('/sign-out', {}, verified.get(owner)!.cookie),
    );
    expect(signedOut.status).toBe(200);
    const challengedLogin = await login(handler, owner.email, owner.password);
    expect(challengedLogin.status).toBe(200);
    const challengeCookie = responseCookie(challengedLogin, 'two_factor');
    const completedLogin = await handler(
      portalAuthRequest(
        '/two-factor/verify-totp',
        { code: totpCode(verified.get(owner)!.totpURI) },
        challengeCookie,
      ),
    );
    expect(completedLogin.status).toBe(200);
    const newOwnerCookie = responseCookie(completedLogin, 'session_token');
    const newOwnerSession = await sessionModule.readAuthenticatedPortalSession(
      headers(newOwnerCookie),
    );
    expect(newOwnerSession).not.toBeNull();
    expect(Date.now() - newOwnerSession!.createdAt.getTime()).toBeLessThan(
      60_000,
    );
    expect(
      newOwnerSession!.expiresAt.getTime() -
        newOwnerSession!.createdAt.getTime(),
    ).toBeGreaterThan(7 * 60 * 60_000);
    await expect(
      principalModule.resolveCanonicalPortalPrincipalFromSession(
        headers(newOwnerCookie),
      ),
    ).resolves.toMatchObject({
      outcome: 'authorized',
      principal: { role: 'owner' },
      session: { fresh: true },
    });

    await handler(portalAuthRequest('/sign-out', {}, newOwnerCookie));
    await expect(
      gatewayModule.portalPayloadGateway.listClientSummaries(
        headers(newOwnerCookie),
      ),
    ).rejects.toMatchObject({ code: 'invalid-principal' });
  });
});
