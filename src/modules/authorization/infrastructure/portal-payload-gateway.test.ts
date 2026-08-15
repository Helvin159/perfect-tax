import { createLocalReq, type Payload } from 'payload';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  parsePortalPrincipal,
  type PortalPrincipal,
} from '@/modules/portal-identity/domain/principal';

import {
  authorizePortalClientFieldRead,
  authorizePortalClientRead,
  composePortalPayloadGatewayWithPrincipalResolver,
  PortalPayloadAuthorizationError,
  portalClientCollectionAccess,
  portalClientFieldAccess,
  requireAttestedPortalRequest,
  resolveAttestedPortalRequest,
  type PortalPayloadUser,
} from './portal-payload-gateway';

type PrincipalSource = Readonly<{ opaque: string }>;

const clientRecords = [
  {
    clientNumber: 'CL-7F4K-92MX',
    contactEmail: 'client-a@example.test',
    firstName: 'Ada',
    id: 101,
    lastName: 'Lovelace',
    relatedClient: 202,
    secretTaxValue: 'must-not-leak',
    status: 'active',
  },
  {
    clientNumber: 'CL-8G5M-93NX',
    contactEmail: 'client-b@example.test',
    firstName: 'Grace',
    id: 202,
    lastName: 'Hopper',
    relatedClient: 101,
    secretTaxValue: 'must-not-leak-either',
    status: 'active',
  },
] as const;

function requiredPrincipal(value: unknown): PortalPrincipal {
  const principal = parsePortalPrincipal(value);
  if (!principal) throw new Error('Invalid test principal');
  return principal;
}

function createHarness() {
  const bindings = new WeakMap<object, PortalPrincipal>();
  const requests: Array<Record<string, unknown>> = [];
  const hookPrincipals: PortalPrincipal[] = [];
  const requestObservers: Array<(req: Record<string, unknown>) => void> = [];
  let requestNumber = 0;

  const find = vi.fn(async (options: Record<string, unknown>) => {
    requestNumber += 1;
    const req = {
      context: { ...(options.context as Record<string, unknown>) },
      payloadDataLoader: new Map<string, unknown>(),
      transactionID: `transaction-${requestNumber}`,
      user: options.user,
    };
    requests.push(req);

    const access = await authorizePortalClientRead({ req } as never);
    if (access === false) throw new Error('Forbidden');
    if (!(await authorizePortalClientFieldRead({ req } as never))) {
      throw new Error('Forbidden field');
    }
    hookPrincipals.push(requireAttestedPortalRequest(req as never).principal);
    for (const observer of requestObservers) observer(req);

    const docs =
      access === true
        ? clientRecords
        : clientRecords.filter(
            (record) =>
              record.id === (access as { id: { equals: number } }).id.equals,
          );
    return { docs };
  });

  const findByID = vi.fn(async (options: Record<string, unknown>) => {
    requestNumber += 1;
    const req = {
      context: { ...(options.context as Record<string, unknown>) },
      payloadDataLoader: new Map<string, unknown>(),
      transactionID: `transaction-${requestNumber}`,
      user: options.user,
    };
    requests.push(req);

    const access = await authorizePortalClientRead({ req } as never);
    if (access === false) throw new Error('Forbidden');
    if (!(await authorizePortalClientFieldRead({ req } as never))) {
      throw new Error('Forbidden field');
    }
    hookPrincipals.push(requireAttestedPortalRequest(req as never).principal);
    for (const observer of requestObservers) observer(req);

    const record = clientRecords.find(
      (candidate) => candidate.id === options.id,
    );
    if (!record) throw new Error('Not found');
    if (
      access !== true &&
      record.id !== (access as { id: { equals: number } }).id.equals
    ) {
      throw new Error('Forbidden');
    }
    return record;
  });

  const gateway = composePortalPayloadGatewayWithPrincipalResolver(
    { find, findByID } as unknown as Pick<Payload, 'find' | 'findByID'>,
    {
      resolveCanonicalPrincipal: (source: PrincipalSource) =>
        bindings.get(source),
    },
  );

  function trust(principal: PortalPrincipal): PrincipalSource {
    const source = Object.freeze({ opaque: crypto.randomUUID() });
    bindings.set(source, principal);
    return source;
  }

  return {
    bindings,
    find,
    findByID,
    gateway,
    hookPrincipals,
    requestObservers,
    requests,
    trust,
  };
}

const owner = requiredPrincipal({
  authUserId: 'auth-owner',
  kind: 'staff',
  mfaAssurance: 'verified',
  role: 'owner',
  staffId: 11,
  status: 'active',
});
const clientA = requiredPrincipal({
  authUserId: 'auth-client-a',
  clientId: 101,
  kind: 'client',
  status: 'active',
});
const caseWorker = requiredPrincipal({
  authUserId: 'auth-case-worker',
  kind: 'staff',
  mfaAssurance: 'verified',
  role: 'case-worker',
  staffId: 22,
  status: 'active',
});
const enrollment = requiredPrincipal({
  allowedOperations: ['enroll-mfa', 'verify-mfa', 'sign-out'],
  authUserId: 'auth-enrollment',
  kind: 'staff-enrollment',
  staffId: 33,
});

describe('PortalPayloadGateway runtime attestation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('denies structurally perfect fake Staff, Owner, and Client sources before Payload', async () => {
    const harness = createHarness();

    for (const fake of [
      { ...owner },
      {
        authUserId: 'forged-owner',
        kind: 'staff',
        mfaAssurance: 'verified',
        role: 'owner',
        staffId: 11,
        status: 'active',
        verified: true,
      },
      { ...clientA },
    ]) {
      await expect(
        harness.gateway.listClientSummaries(fake as never),
      ).rejects.toMatchObject({ code: 'invalid-principal' });
    }

    expect(harness.find).not.toHaveBeenCalled();
  });

  it('denies missing sources, resolver failures, and enrollment principals before Payload', async () => {
    const harness = createHarness();
    await expect(
      harness.gateway.listClientSummaries(undefined as never),
    ).rejects.toMatchObject({ code: 'unauthenticated' });

    const enrollmentSource = harness.trust(enrollment);
    await expect(
      harness.gateway.listClientSummaries(enrollmentSource),
    ).rejects.toMatchObject({ code: 'invalid-principal' });

    const throwingGateway = composePortalPayloadGatewayWithPrincipalResolver(
      {
        find: harness.find,
        findByID: harness.findByID,
      } as unknown as Pick<Payload, 'find' | 'findByID'>,
      {
        resolveCanonicalPrincipal: () => {
          throw new Error('repository unavailable');
        },
      },
    );
    await expect(
      throwingGateway.listClientSummaries({ opaque: 'throws' }),
    ).rejects.toMatchObject({ code: 'invalid-principal' });
    expect(harness.find).not.toHaveBeenCalled();
  });

  it('loses trust after serialization and reconstruction', async () => {
    const harness = createHarness();
    const source = harness.trust(owner);
    const reconstructed = JSON.parse(JSON.stringify(source)) as PrincipalSource;
    const reconstructedPrincipal = JSON.parse(
      JSON.stringify(owner),
    ) as PrincipalSource;

    await expect(
      harness.gateway.listClientSummaries(reconstructed),
    ).rejects.toMatchObject({ code: 'invalid-principal' });
    await expect(
      harness.gateway.listClientSummaries(reconstructedPrincipal),
    ).rejects.toMatchObject({ code: 'invalid-principal' });
    expect(harness.find).not.toHaveBeenCalled();
  });

  it('uses explicit access control, depth zero, fixed selects, and no caller request passthrough', async () => {
    const harness = createHarness();
    const source = harness.trust(owner);

    await expect(
      (
        harness.gateway.listClientSummaries as unknown as (
          source: PrincipalSource,
          attack: Record<string, unknown>,
        ) => Promise<unknown>
      )(source, {
        context: { trusted: true },
        depth: 99,
        overrideAccess: true,
        req: { shared: true },
        select: { secretTaxValue: true },
        user: { role: 'owner' },
      }),
    ).rejects.toMatchObject({ code: 'invalid-principal' });
    expect(harness.find).not.toHaveBeenCalled();

    const result = await harness.gateway.listClientSummaries(source);

    expect(result).toEqual([
      {
        clientNumber: 'CL-7F4K-92MX',
        firstName: 'Ada',
        id: 101,
        lastName: 'Lovelace',
        status: 'active',
      },
      {
        clientNumber: 'CL-8G5M-93NX',
        firstName: 'Grace',
        id: 202,
        lastName: 'Hopper',
        status: 'active',
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('secretTaxValue');
    expect(JSON.stringify(result)).not.toContain('relatedClient');
    expect(JSON.stringify(result)).not.toContain('contactEmail');

    const call = harness.find.mock.calls[0]?.[0] as Record<string, unknown>;
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
      sort: 'clientNumber',
    });
    expect(call).not.toHaveProperty('req');
    expect(call).not.toHaveProperty('populate');
    expect(call).not.toHaveProperty('joins');
    expect(call.user).toEqual({
      collection: 'portal-principals',
      id: 'staff:11',
      kind: 'staff',
      role: 'owner',
      staffId: 11,
    });
    expect(JSON.stringify(call.user)).not.toContain('auth-owner');
    expect(JSON.stringify(call.user)).not.toContain('email');
  });

  it('derives Client self-ownership from the attested principal and never accepts a caller Client ID', async () => {
    const harness = createHarness();
    const source = harness.trust(clientA);

    await expect(harness.gateway.readOwnClientProfile(source)).resolves.toEqual(
      {
        clientNumber: 'CL-7F4K-92MX',
        contactEmail: 'client-a@example.test',
        firstName: 'Ada',
        id: 101,
        lastName: 'Lovelace',
        status: 'active',
      },
    );

    const call = harness.findByID.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call).toMatchObject({
      depth: 0,
      id: 101,
      overrideAccess: false,
      select: {
        clientNumber: true,
        contactEmail: true,
        firstName: true,
        lastName: true,
        status: true,
      },
    });
    expect(call).not.toHaveProperty('where');
  });

  it('denies a Case Worker with no canonical assignment source before Payload', async () => {
    const harness = createHarness();
    const source = harness.trust(caseWorker);

    await expect(
      (
        harness.gateway.listClientSummaries as unknown as (
          source: PrincipalSource,
          assignment: unknown,
        ) => Promise<unknown>
      )(source, {
        assignedStaffIds: [22],
        clientId: 101,
      }),
    ).rejects.toMatchObject({ code: 'invalid-principal' });
    await expect(
      harness.gateway.listClientSummaries(source),
    ).rejects.toMatchObject({ code: 'assignment-required' });
    expect(harness.find).not.toHaveBeenCalled();
  });

  it('denies direct Local API lookalikes with fake user, context, role, and IDs', async () => {
    const fakeReq = {
      context: {
        portalPayloadCapability: {},
        portalPrincipal: { ...owner },
        trusted: true,
      },
      user: {
        collection: 'portal-principals',
        id: 'staff:11',
        kind: 'staff',
        role: 'owner',
        staffId: 11,
      },
    };

    expect(await authorizePortalClientRead({ req: fakeReq } as never)).toBe(
      false,
    );
    expect(
      await authorizePortalClientFieldRead({ req: fakeReq } as never),
    ).toBe(false);
    expect(resolveAttestedPortalRequest(fakeReq)).toBeUndefined();
  });

  it('requires both the genuine capability and its exact narrow user', async () => {
    const harness = createHarness();
    harness.requestObservers.push((req) => {
      expect(resolveAttestedPortalRequest(req)?.principal).toEqual(owner);

      const ownerUser = req.user;
      req.user = {
        clientId: 202,
        collection: 'portal-principals',
        id: 'client:202',
        kind: 'client',
      } as unknown as PortalPayloadUser;
      expect(resolveAttestedPortalRequest(req)).toBeUndefined();
      req.user = ownerUser;

      expect(
        resolveAttestedPortalRequest({ context: req.context }),
      ).toBeUndefined();
      expect(
        resolveAttestedPortalRequest({ user: req.user, context: {} }),
      ).toBeUndefined();
      expect(
        resolveAttestedPortalRequest({
          context: req.context,
          user: { ...(req.user as PortalPayloadUser), extra: true },
        }),
      ).toBeUndefined();
      expect(
        resolveAttestedPortalRequest({
          context: JSON.parse(JSON.stringify(req.context)),
          user: req.user,
        }),
      ).toBeUndefined();
    });

    await harness.gateway.listClientSummaries(harness.trust(owner));
    const req = harness.requests[0];
    if (!req) throw new Error('Missing captured request');
    expect(resolveAttestedPortalRequest(req)).toBeUndefined();
  });

  it('creates a fresh top-level request, context, token, and DataLoader per operation', async () => {
    const harness = createHarness();
    const ownerSource = harness.trust(owner);
    const clientSource = harness.trust(clientA);

    await harness.gateway.listClientSummaries(ownerSource);
    await harness.gateway.listClientSummaries(clientSource);

    const first = harness.requests[0];
    const second = harness.requests[1];
    if (!first || !second) throw new Error('Missing captured requests');

    expect(first).not.toBe(second);
    expect(first.context).not.toBe(second.context);
    expect(first.payloadDataLoader).not.toBe(second.payloadDataLoader);
    expect(Object.values(first.context as object)[0]).not.toBe(
      Object.values(second.context as object)[0],
    );
    expect(Object.keys(first.context as object)).toEqual([
      'portalPayloadCapability',
    ]);

    (first.payloadDataLoader as Map<string, unknown>).set(
      'relationship:client-b',
      clientRecords[1],
    );
    expect(
      (second.payloadDataLoader as Map<string, unknown>).has(
        'relationship:client-b',
      ),
    ).toBe(false);
  });

  it('preserves the opaque token through Payload 3.86 createLocalReq context handling', async () => {
    let captured: Record<string, unknown> | undefined;
    let actualRequest: Awaited<ReturnType<typeof createLocalReq>> | undefined;
    let copiedRequestRejected = false;
    let resolvedDuringOperation: PortalPrincipal | undefined;
    const fakePayload = {
      config: {
        admin: { user: 'cms-users' },
        localization: false,
        serverURL: 'http://localhost:3001',
      },
    } as unknown as Payload;
    const requestSeed = {
      context: { existingRequestContext: true },
      i18n: { t: (key: string) => key },
      payloadDataLoader: new Map(),
    };
    const payloadPort = {
      find: vi.fn(async (options: Record<string, unknown>) => {
        captured = options;
        actualRequest = await createLocalReq(
          {
            context: options.context as never,
            depth: options.depth as number,
            req: requestSeed as never,
            user: options.user as never,
          },
          fakePayload,
        );
        resolvedDuringOperation =
          resolveAttestedPortalRequest(actualRequest)?.principal;

        const copiedRequest = await createLocalReq(
          {
            context: options.context as never,
            depth: 0,
            req: {
              i18n: requestSeed.i18n,
              payloadDataLoader: new Map(),
            } as never,
            user: options.user as never,
          },
          fakePayload,
        );
        copiedRequestRejected =
          resolveAttestedPortalRequest(copiedRequest) === undefined;
        return { docs: [] };
      }),
      findByID: vi.fn(),
    };
    const source = Object.freeze({ opaque: 'create-local-req-source' });
    const gateway = composePortalPayloadGatewayWithPrincipalResolver(
      payloadPort as unknown as Pick<Payload, 'find' | 'findByID'>,
      {
        resolveCanonicalPrincipal: (candidate: PrincipalSource) =>
          candidate === source ? owner : undefined,
      },
    );

    await gateway.listClientSummaries(source);
    if (!captured || !actualRequest) {
      throw new Error('Missing captured gateway operation');
    }

    expect(actualRequest.context).not.toBe(captured.context);
    expect(actualRequest.context.portalPayloadCapability).toBe(
      (captured.context as Record<string, unknown>).portalPayloadCapability,
    );
    expect(actualRequest.user).toBe(captured.user);
    expect(actualRequest.query.depth).toBe(0);
    expect(resolvedDuringOperation).toEqual(owner);
    expect(copiedRequestRejected).toBe(true);
    expect(resolveAttestedPortalRequest(actualRequest)).toBeUndefined();
  });

  it('retains trust for same-request hooks and transactions but rejects request or principal substitution', async () => {
    const harness = createHarness();
    await harness.gateway.listClientSummaries(harness.trust(owner));
    const req = harness.requests[0];
    if (!req) throw new Error('Missing captured request');

    expect(req.transactionID).toBe('transaction-1');
    expect(harness.hookPrincipals).toEqual([owner]);
    expect(resolveAttestedPortalRequest(req)).toBeUndefined();
    expect(await authorizePortalClientRead({ req } as never)).toBe(false);

    const reconstructedRequest = {
      ...req,
      context: req.context,
      transactionID: req.transactionID,
      user: req.user,
    };
    expect(resolveAttestedPortalRequest(reconstructedRequest)).toBeUndefined();

    req.user = {
      collection: 'portal-principals',
      id: 'client:101',
      kind: 'client',
      clientId: 101,
    };
    expect(resolveAttestedPortalRequest(req)).toBeUndefined();
  });

  it('exposes only reviewed operations and fail-closed Client access contracts', () => {
    const harness = createHarness();
    expect(Object.keys(harness.gateway).sort()).toEqual([
      'listClientSummaries',
      'readOwnClientProfile',
    ]);
    expect(harness.gateway).not.toHaveProperty('payload');
    expect(harness.gateway).not.toHaveProperty('localApi');
    expect(harness.gateway).not.toHaveProperty('getPayload');
    expect(harness.gateway).not.toHaveProperty('request');
    expect(harness.gateway).not.toHaveProperty('find');
    expect(harness.gateway).not.toHaveProperty('run');

    expect(portalClientCollectionAccess).toEqual({
      create: expect.any(Function),
      delete: expect.any(Function),
      read: authorizePortalClientRead,
      update: expect.any(Function),
    });
    expect(portalClientFieldAccess).toEqual({
      create: expect.any(Function),
      read: authorizePortalClientFieldRead,
      update: expect.any(Function),
    });
    expect(portalClientCollectionAccess.create({} as never)).toBe(false);
    expect(portalClientCollectionAccess.update({} as never)).toBe(false);
    expect(portalClientCollectionAccess.delete({} as never)).toBe(false);
  });

  it('does not let a Staff owner use the Client-only profile method', async () => {
    const harness = createHarness();
    await expect(
      harness.gateway.readOwnClientProfile(harness.trust(owner)),
    ).rejects.toEqual(new PortalPayloadAuthorizationError('forbidden-role'));
    expect(harness.findByID).not.toHaveBeenCalled();
  });
});
