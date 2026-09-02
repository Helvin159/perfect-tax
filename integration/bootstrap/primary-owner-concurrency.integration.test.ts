import { Client } from 'pg';
import { describe, expect, it } from 'vitest';

import { runPrimaryOwnerBootstrap } from '../support/auth';
import {
  createAgent15Database,
  type Agent15Database,
} from '../support/database';

describe('real concurrent primary-owner bootstrap', () => {
  it('serializes two production CLI attempts and leaves one effective owner', async () => {
    let database: Agent15Database | undefined;
    let payloadMigration: Client | undefined;
    let authMigration: Client | undefined;
    try {
      database = await createAgent15Database('concurrent');
      payloadMigration = new Client({
        connectionString: database.payloadMigrationURL,
      });
      authMigration = new Client({
        connectionString: database.authMigrationURL,
      });
      await Promise.all([payloadMigration.connect(), authMigration.connect()]);

      const attempts = await Promise.allSettled([
        runPrimaryOwnerBootstrap(database),
        runPrimaryOwnerBootstrap(database, {
          PRIMARY_OWNER_BOOTSTRAP_FIRST_NAME: 'Rival',
          PRIMARY_OWNER_BOOTSTRAP_LAST_NAME: 'Owner',
          PRIMARY_OWNER_BOOTSTRAP_LOGIN_EMAIL: 'rival-login@example.test',
          PRIMARY_OWNER_BOOTSTRAP_WORK_EMAIL: 'rival-work@example.test',
        }),
      ]);
      expect(
        attempts.filter(({ status }) => status === 'fulfilled'),
      ).toHaveLength(1);

      const application = await payloadMigration.query<{
        events: string;
        identities: string;
        owners: string;
      }>(`SELECT
          (SELECT count(*)::text FROM public.staff WHERE role = 'owner' AND is_primary_owner) AS owners,
          (SELECT count(*)::text FROM public.portal_identities) AS identities,
          (SELECT count(*)::text FROM public.security_events) AS events`);
      const credentials = await authMigration.query<{
        accounts: string;
        users: string;
      }>(`SELECT
          (SELECT count(*)::text FROM portal_auth."user") AS users,
          (SELECT count(*)::text FROM portal_auth.account) AS accounts`);
      expect({ ...application.rows[0], ...credentials.rows[0] }).toEqual({
        accounts: '1',
        events: '2',
        identities: '1',
        owners: '1',
        users: '1',
      });
    } finally {
      await Promise.all([
        payloadMigration?.end().catch(() => undefined),
        authMigration?.end().catch(() => undefined),
      ]);
      await database?.destroy();
    }
  });
});
