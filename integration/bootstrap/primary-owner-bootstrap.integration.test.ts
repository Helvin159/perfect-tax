import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runPrimaryOwnerBootstrap } from '../support/auth';
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
    expect(result?.stdout).toBe(
      'Primary owner created. Sign in normally to enroll MFA.\n',
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
  });
});
