import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { Client } from 'pg';
import { expect, it } from 'vitest';

import { REQUIRED_CMS_MIGRATIONS } from '../required-migrations';

const execFileAsync = promisify(execFile);
const testDatabaseUrl = process.env.CMS_TEST_DATABASE_URL;
const postgresTest = testDatabaseUrl ? it : it.skip;

function getTestDatabaseDetails(connectionString: string) {
  const targetUrl = new URL(connectionString);
  const databaseName = decodeURIComponent(targetUrl.pathname.slice(1));

  if (!/^[a-zA-Z0-9_]+_test$/.test(databaseName)) {
    throw new Error('CMS_TEST_DATABASE_URL database name must end in _test.');
  }

  const adminUrl = new URL(targetUrl);
  adminUrl.pathname = '/postgres';

  return { adminUrl: adminUrl.toString(), databaseName };
}

postgresTest(
  'applies committed Payload migrations idempotently to a clean PostgreSQL database',
  async () => {
    const { adminUrl, databaseName } = getTestDatabaseDetails(testDatabaseUrl!);
    const adminClient = new Client({ connectionString: adminUrl });
    const quotedDatabaseName = `"${databaseName}"`;

    await adminClient.connect();

    try {
      await adminClient.query(
        `DROP DATABASE IF EXISTS ${quotedDatabaseName} WITH (FORCE)`,
      );
      await adminClient.query(`CREATE DATABASE ${quotedDatabaseName}`);

      const migrationEnvironment = {
        ...process.env,
        DATABASE_URL: testDatabaseUrl!,
        EMAIL_ADDRESS: 'migration-test@example.test',
        EMAIL_NAME: 'Perfect Tax',
        EMAIL_PASSWORD: 'migration-test-only',
        PAYLOAD_SECRET: 'migration-test-secret-only-0123456789abcdef',
        SITE_URL: 'http://localhost:3000',
      };

      await execFileAsync('pnpm', ['cms:migrate'], {
        cwd: process.cwd(),
        env: migrationEnvironment,
      });
      await execFileAsync('pnpm', ['cms:migrate'], {
        cwd: process.cwd(),
        env: migrationEnvironment,
      });

      const verificationClient = new Client({
        connectionString: testDatabaseUrl,
      });
      await verificationClient.connect();

      try {
        const tables = await verificationClient.query<{ table_name: string }>(
          `SELECT table_name
            FROM information_schema.tables
           WHERE table_schema = 'public'
              AND table_name IN (
                'business_identity',
                'clients',
                'cms_users',
                'contact_settings',
                'homepage_content',
                'payload_migrations',
                'portal_settings',
                'public_media',
                'security_events',
                'services',
                'staff',
                'portal_identities'
              )
            ORDER BY table_name`,
        );
        const appliedMigrations = await verificationClient.query<{
          name: string;
        }>('SELECT name FROM payload_migrations ORDER BY name');

        expect(tables.rows.map(({ table_name }) => table_name)).toEqual([
          'business_identity',
          'clients',
          'cms_users',
          'contact_settings',
          'homepage_content',
          'payload_migrations',
          'portal_identities',
          'portal_settings',
          'public_media',
          'security_events',
          'services',
          'staff',
        ]);
        expect(appliedMigrations.rows.map(({ name }) => name)).toEqual(
          REQUIRED_CMS_MIGRATIONS,
        );
      } finally {
        await verificationClient.end();
      }
    } finally {
      await adminClient.query(
        `DROP DATABASE IF EXISTS ${quotedDatabaseName} WITH (FORCE)`,
      );
      await adminClient.end();
    }
  },
  60_000,
);
