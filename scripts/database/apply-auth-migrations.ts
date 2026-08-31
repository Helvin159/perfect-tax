import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { Client } from 'pg';

import { getPortalAuthEnvironment } from '../../src/modules/auth/config/environment';
import {
  AUTH_MIGRATIONS,
  AUTH_MIGRATION_LEDGER,
} from '../../src/modules/auth/migrations';

const advisoryLock = 1_617_731_882;
const environment = getPortalAuthEnvironment();
const client = new Client({ connectionString: environment.databaseURL });

await client.connect();
try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock($1)', [advisoryLock]);
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${AUTH_MIGRATION_LEDGER} (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.query(`
    COMMENT ON TABLE ${AUTH_MIGRATION_LEDGER} IS
      'perfect-tax:migration-owner=better-auth;ledger=${AUTH_MIGRATION_LEDGER}'
  `);

  const applied = await client.query<{ name: string }>(
    `SELECT name FROM ${AUTH_MIGRATION_LEDGER} ORDER BY name`,
  );
  const knownNames = new Set<string>(AUTH_MIGRATIONS.map(({ name }) => name));
  if (applied.rows.some(({ name }) => !knownNames.has(name))) {
    throw new Error('unknown-auth-migration-ledger-entry');
  }
  const appliedNames = new Set(applied.rows.map(({ name }) => name));

  for (const migration of AUTH_MIGRATIONS) {
    if (appliedNames.has(migration.name)) continue;
    const migrationSql = await readFile(
      path.resolve('src/modules/auth/migrations', migration.file),
      'utf8',
    );
    await client.query('SET LOCAL search_path TO portal_auth, public');
    await client.query(migrationSql);
    await client.query(
      `INSERT INTO ${AUTH_MIGRATION_LEDGER} (name) VALUES ($1)`,
      [migration.name],
    );
  }

  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
