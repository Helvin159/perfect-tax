import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  closePortalAuthRuntime,
  provisionUnboundCredential,
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
  database = await createAgent15Database('compensate');
  activateAgent15Environment(database);
  payloadMigration = new Client({
    connectionString: database.payloadMigrationURL,
  });
  authMigration = new Client({ connectionString: database.authMigrationURL });
  await Promise.all([payloadMigration.connect(), authMigration.connect()]);
});

afterAll(async () => {
  await closePortalAuthRuntime().catch(() => undefined);
  await Promise.all([
    payloadMigration?.end().catch(() => undefined),
    authMigration?.end().catch(() => undefined),
  ]);
  await database?.destroy();
});

async function authorityCounts() {
  const application = await payloadMigration.query<{
    identities: string;
    owners: string;
  }>(`SELECT
      (SELECT count(*)::text FROM public.staff WHERE role = 'owner' OR is_primary_owner) AS owners,
      (SELECT count(*)::text FROM public.portal_identities) AS identities`);
  const auth = await authMigration.query<{ accounts: string; users: string }>(
    `SELECT
      (SELECT count(*)::text FROM portal_auth."user") AS users,
      (SELECT count(*)::text FROM portal_auth.account) AS accounts`,
  );
  return { ...application.rows[0], ...auth.rows[0] };
}

async function failureEventCount() {
  const result = await payloadMigration.query<{ count: string }>(
    `SELECT count(*)::text AS count
       FROM public.security_events
      WHERE action = 'primary-owner.bootstrap.failed'`,
  );
  return result.rows[0]!.count;
}

async function runWithPostReadinessFault(
  overrides: Partial<Record<string, string>>,
  installFault: () => Promise<unknown>,
) {
  const lockId = 1_617_731_881;
  await payloadMigration.query('SELECT pg_advisory_lock($1)', [lockId]);
  const attempt = runPrimaryOwnerBootstrap(database, overrides);
  try {
    let waiting = false;
    for (let index = 0; index < 200; index += 1) {
      const locks = await payloadMigration.query<{ count: string }>(
        `SELECT count(*)::text AS count
           FROM pg_locks
          WHERE locktype = 'advisory'
            AND NOT granted`,
      );
      if (locks.rows[0]?.count !== '0') {
        waiting = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    if (!waiting) throw new Error('bootstrap-did-not-reach-serialization-lock');
    await installFault();
  } finally {
    await payloadMigration.query('SELECT pg_advisory_unlock($1)', [lockId]);
  }
  return attempt;
}

describe('real primary-owner bootstrap compensation', () => {
  it('leaves no privileged authority after credential, Staff, binding, or success-audit failure', async () => {
    await provisionUnboundCredential(
      'existing-login@example.test',
      'Existing Credential',
    );
    await closePortalAuthRuntime();
    await expect(
      runPrimaryOwnerBootstrap(database, {
        PRIMARY_OWNER_BOOTSTRAP_LOGIN_EMAIL: 'existing-login@example.test',
      }),
    ).rejects.toBeDefined();
    await expect(authorityCounts()).resolves.toEqual({
      accounts: '1',
      identities: '0',
      owners: '0',
      users: '1',
    });
    await expect(failureEventCount()).resolves.toBe('1');

    await payloadMigration.query(
      `INSERT INTO public.staff
         (first_name, last_name, work_email, role, status, is_primary_owner)
       VALUES ('Existing', 'Staff', 'duplicate-work@example.test', 'intake', 'active', false)`,
    );
    await expect(
      runPrimaryOwnerBootstrap(database, {
        PRIMARY_OWNER_BOOTSTRAP_LOGIN_EMAIL: 'staff-failure@example.test',
        PRIMARY_OWNER_BOOTSTRAP_WORK_EMAIL: 'duplicate-work@example.test',
      }),
    ).rejects.toBeDefined();
    await expect(authorityCounts()).resolves.toEqual({
      accounts: '1',
      identities: '0',
      owners: '0',
      users: '1',
    });
    await expect(failureEventCount()).resolves.toBe('2');

    await expect(
      runWithPostReadinessFault(
        {
          PRIMARY_OWNER_BOOTSTRAP_LOGIN_EMAIL: 'identity-failure@example.test',
          PRIMARY_OWNER_BOOTSTRAP_WORK_EMAIL: 'identity-failure@example.test',
        },
        async () => {
          await payloadMigration.query(`CREATE FUNCTION public.agent15_reject_identity()
            RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
              RAISE EXCEPTION 'agent15 injected identity failure';
            END $$`);
          await payloadMigration.query(`CREATE TRIGGER agent15_reject_identity
            BEFORE INSERT ON public.portal_identities
            FOR EACH ROW EXECUTE FUNCTION public.agent15_reject_identity()`);
        },
      ),
    ).rejects.toBeDefined();
    await payloadMigration.query(
      'DROP TRIGGER agent15_reject_identity ON public.portal_identities',
    );
    await payloadMigration.query(
      'DROP FUNCTION public.agent15_reject_identity()',
    );
    await expect(authorityCounts()).resolves.toEqual({
      accounts: '1',
      identities: '0',
      owners: '0',
      users: '1',
    });
    await expect(failureEventCount()).resolves.toBe('3');

    await expect(
      runWithPostReadinessFault(
        {
          PRIMARY_OWNER_BOOTSTRAP_LOGIN_EMAIL: 'audit-failure@example.test',
          PRIMARY_OWNER_BOOTSTRAP_WORK_EMAIL: 'audit-failure@example.test',
        },
        async () => {
          await payloadMigration.query(`CREATE FUNCTION public.agent15_reject_success_event()
            RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
              IF NEW.action::text = 'primary-owner.bootstrap.succeeded' THEN
                RAISE EXCEPTION 'agent15 injected success audit failure';
              END IF;
              RETURN NEW;
            END $$`);
          await payloadMigration.query(`CREATE TRIGGER agent15_reject_success_event
            BEFORE INSERT ON public.security_events
            FOR EACH ROW EXECUTE FUNCTION public.agent15_reject_success_event()`);
        },
      ),
    ).rejects.toBeDefined();
    await payloadMigration.query(
      'DROP TRIGGER agent15_reject_success_event ON public.security_events',
    );
    await payloadMigration.query(
      'DROP FUNCTION public.agent15_reject_success_event()',
    );
    await expect(authorityCounts()).resolves.toEqual({
      accounts: '1',
      identities: '0',
      owners: '0',
      users: '1',
    });

    const events = await payloadMigration.query<{
      action: string;
      metadata: Record<string, unknown>;
    }>('SELECT action::text, metadata FROM public.security_events ORDER BY id');
    expect(events.rows.map(({ action }) => action)).toEqual([
      'primary-owner.bootstrap.failed',
      'primary-owner.bootstrap.failed',
      'primary-owner.bootstrap.failed',
    ]);
    expect(JSON.stringify(events.rows).toLowerCase()).not.toMatch(
      /password|session.?token|totp|backup.?code|capability|raw.?request/,
    );
  });
});
