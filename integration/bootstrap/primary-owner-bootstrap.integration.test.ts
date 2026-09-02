import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  AGENT15_OWNER_PASSWORD,
  closePortalAuthRuntime,
  createPortalAuthHandler,
  enrollAndVerifyMfa,
  login,
  portalAuthRequest,
  quiescePostgresPool,
  responseCookie,
  runPrimaryOwnerBootstrap,
} from '../support/auth';
import {
  activateAgent15Environment,
  createAgent15Database,
  type Agent15Database,
} from '../support/database';

let database: Agent15Database;
let payloadMigration: Client;
let authMigration: Client;

beforeAll(async () => {
  database = await createAgent15Database('bootstrap');
  activateAgent15Environment(database);
  payloadMigration = new Client({
    connectionString: database.payloadMigrationURL,
  });
  authMigration = new Client({ connectionString: database.authMigrationURL });
  await Promise.all([payloadMigration.connect(), authMigration.connect()]);
});

afterAll(async () => {
  await Promise.all([payloadMigration?.end(), authMigration?.end()]);
  await database?.destroy();
});

async function persistedState() {
  const application = await payloadMigration.query<{
    events: string;
    identities: string;
    owners: string;
    staff: string;
  }>(`SELECT
        (SELECT count(*)::text FROM public.staff) AS staff,
        (SELECT count(*)::text FROM public.staff WHERE role = 'owner' OR is_primary_owner) AS owners,
        (SELECT count(*)::text FROM public.portal_identities) AS identities,
        (SELECT count(*)::text FROM public.security_events) AS events`);
  const credentials = await authMigration.query<{
    accounts: string;
    sessions: string;
    users: string;
  }>(`SELECT
        (SELECT count(*)::text FROM portal_auth."user") AS users,
        (SELECT count(*)::text FROM portal_auth.account) AS accounts,
        (SELECT count(*)::text FROM portal_auth.session) AS sessions`);
  return Object.freeze({
    ...application.rows[0]!,
    ...credentials.rows[0]!,
  });
}

describe('real primary-owner bootstrap', () => {
  it('creates one credential, Owner, binding, and mandatory success event', async () => {
    let failure: unknown;
    let result:
      Awaited<ReturnType<typeof runPrimaryOwnerBootstrap>> | undefined;
    try {
      result = await runPrimaryOwnerBootstrap(database);
    } catch (error) {
      failure = error;
    }

    const state = await persistedState();
    if (failure) {
      // This proves the actual failure is fail-closed while retaining the
      // expected-success assertion as a blocking regression.
      expect(state).toEqual({
        accounts: '0',
        events: '1',
        identities: '0',
        owners: '0',
        sessions: '0',
        staff: '0',
        users: '0',
      });
    }

    expect(
      failure,
      'HIGH A15-H01: real bootstrap rolls back after Staff creation and before PortalIdentity creation',
    ).toBeUndefined();
    expect(result?.stdout.trimEnd()).toMatch(
      /(?:^|\n)Primary owner created\. Sign in normally to enroll MFA\.$/,
    );
    await expect(persistedState()).resolves.toEqual({
      accounts: '1',
      events: '1',
      identities: '1',
      owners: '1',
      sessions: '0',
      staff: '1',
      users: '1',
    });

    const initialAssurance = await authMigration.query<{
      enabled: boolean | null;
      factors: string;
    }>(`SELECT
          (SELECT "twoFactorEnabled" FROM portal_auth."user" LIMIT 1) AS enabled,
          (SELECT count(*)::text FROM portal_auth."twoFactor") AS factors`);
    expect(initialAssurance.rows[0]).toEqual({ enabled: false, factors: '0' });

    for (const overrides of [
      {},
      { PRIMARY_OWNER_BOOTSTRAP_LOGIN_EMAIL: 'different-login@example.test' },
      { PRIMARY_OWNER_BOOTSTRAP_FIRST_NAME: 'Different' },
      {
        PRIMARY_OWNER_BOOTSTRAP_FIRST_NAME: 'Different',
        PRIMARY_OWNER_BOOTSTRAP_LAST_NAME: 'Person',
        PRIMARY_OWNER_BOOTSTRAP_LOGIN_EMAIL: 'another-login@example.test',
        PRIMARY_OWNER_BOOTSTRAP_WORK_EMAIL: 'another-work@example.test',
      },
    ]) {
      await expect(
        runPrimaryOwnerBootstrap(database, overrides),
      ).rejects.toBeDefined();
    }

    await expect(persistedState()).resolves.toMatchObject({
      accounts: '1',
      identities: '1',
      owners: '1',
      staff: '1',
      users: '1',
    });
    const audit = await payloadMigration.query<{
      action: string;
      metadata: Record<string, unknown>;
    }>('SELECT action::text, metadata FROM public.security_events ORDER BY id');
    expect(audit.rows.map(({ action }) => action)).toEqual([
      'primary-owner.bootstrap.succeeded',
      'primary-owner.bootstrap.failed',
      'primary-owner.bootstrap.failed',
      'primary-owner.bootstrap.failed',
      'primary-owner.bootstrap.failed',
    ]);
    expect(JSON.stringify(audit.rows).toLowerCase()).not.toMatch(
      /password|session.?token|totp|backup.?code|capability|raw.?request|agent15-owner-password/,
    );

    const handler = await createPortalAuthHandler();
    const signIn = await login(
      handler,
      'owner-login@example.test',
      AGENT15_OWNER_PASSWORD,
    );
    expect(signIn.status).toBe(200);
    const cookie = responseCookie(signIn, 'session_token');
    const principalModule =
      await import('@/modules/auth/portal-principal-composition');
    await expect(
      principalModule.resolveCanonicalPortalPrincipalFromSession(
        new Headers({ cookie }),
      ),
    ).resolves.toMatchObject({
      outcome: 'enrollment-only',
      principal: { kind: 'staff-enrollment' },
    });

    const assurance = await enrollAndVerifyMfa(
      handler,
      cookie,
      AGENT15_OWNER_PASSWORD,
    );
    await expect(
      principalModule.resolveCanonicalPortalPrincipalFromSession(
        new Headers({ cookie: assurance.cookie }),
      ),
    ).resolves.toMatchObject({
      outcome: 'authorized',
      principal: { kind: 'staff', role: 'owner' },
    });
    await handler(portalAuthRequest('/sign-out', {}, assurance.cookie));

    const [{ getPayload }, { default: config }] = await Promise.all([
      import('payload'),
      import('@payload-config'),
    ]);
    const runtimePayload = await getPayload({ config });
    const pool = (runtimePayload as unknown as { db?: { pool?: unknown } }).db
      ?.pool;
    const payloadClosed = quiescePostgresPool(pool).catch(() => undefined);
    const authClosed = closePortalAuthRuntime().catch(() => undefined);
    void payloadClosed;
    void authClosed;
    await runtimePayload.destroy();
  });
});
