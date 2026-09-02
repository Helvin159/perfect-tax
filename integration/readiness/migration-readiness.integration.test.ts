import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { REQUIRED_CMS_MIGRATIONS } from '@/modules/cms/required-migrations';
import { checkPostgresReachable } from '@/modules/operations/health';

import {
  activateAgent15Environment,
  createAgent15Database,
  type Agent15Database,
} from '../support/database';

const AUTH_MIGRATION = '20260831_172000_agent_14_better_auth_core_mfa';

let database: Agent15Database;
let payloadMigration: Client;
let authMigration: Client;

beforeAll(async () => {
  database = await createAgent15Database('readiness');
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

describe('migration-owned readiness', () => {
  it('accepts a fully migrated operational database', async () => {
    await expect(
      checkPostgresReachable(database.payloadRuntimeURL),
    ).resolves.toBeUndefined();
  });

  it('fails closed when the required operational migration is absent', async () => {
    const required = REQUIRED_CMS_MIGRATIONS.at(-1)!;
    await payloadMigration.query(
      `UPDATE public.payload_migrations
          SET name = name || '_missing'
        WHERE name = $1`,
      [required],
    );
    try {
      await expect(
        checkPostgresReachable(database.payloadRuntimeURL),
      ).rejects.toThrow('cms-schema-unavailable');
    } finally {
      await payloadMigration.query(
        `UPDATE public.payload_migrations
            SET name = $1
          WHERE name = $2`,
        [required, `${required}_missing`],
      );
    }
  });

  it('fails closed when the Better Auth migration ledger is absent', async () => {
    await authMigration.query(
      `UPDATE portal_auth.perfect_tax_auth_migrations
          SET name = name || '_missing'
        WHERE name = $1`,
      [AUTH_MIGRATION],
    );

    try {
      await expect(
        checkPostgresReachable(database.payloadRuntimeURL),
        'A15-M01 regression: readiness must verify the independent Better Auth ledger',
      ).rejects.toThrow('auth-schema-unavailable');
    } finally {
      await authMigration.query(
        `UPDATE portal_auth.perfect_tax_auth_migrations
            SET name = $1
          WHERE name = $2`,
        [AUTH_MIGRATION, `${AUTH_MIGRATION}_missing`],
      );
    }
  });

  it('fails closed within the bounded check when portal_auth is unavailable', async () => {
    const startedAt = Date.now();
    await expect(
      checkPostgresReachable(
        database.payloadRuntimeURL,
        'postgresql://unavailable:unavailable@127.0.0.1:1/unavailable',
      ),
    ).rejects.toThrow();
    expect(Date.now() - startedAt).toBeLessThan(3_000);
  });
});
