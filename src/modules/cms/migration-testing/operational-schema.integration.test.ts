import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { promisify } from 'node:util';

import { Client } from 'pg';
import { expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { OPERATIONAL_MIGRATION_NAME } from '../../database/operational-schema';
import { verifyOperationalDatabaseContract } from '../../database/operational-schema-verification';

const execFileAsync = promisify(execFile);
const testDatabaseUrl = process.env.CMS_TEST_DATABASE_URL;
const postgresTest = testDatabaseUrl ? it : it.skip;
const rolePassword = `agent14-role-${randomBytes(12).toString('hex')}`;

function quoteIdentifier(value: string) {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(value)) {
    throw new Error('Unsafe PostgreSQL test identifier.');
  }
  return `"${value}"`;
}

function databaseUrl(base: string, database: string, role?: string) {
  const url = new URL(base);
  url.pathname = `/${database}`;
  if (role) {
    url.username = role;
    url.password = rolePassword;
  }
  return url.toString();
}

function psqlConnection(connectionString: string) {
  const url = new URL(connectionString);
  return {
    args: [
      '--host',
      url.hostname,
      '--port',
      url.port || '5432',
      '--username',
      decodeURIComponent(url.username),
      '--dbname',
      decodeURIComponent(url.pathname.slice(1)),
    ],
    password: decodeURIComponent(url.password),
  };
}

async function runPsql(
  connectionString: string,
  script: string,
  variables: Readonly<Record<string, string>>,
) {
  const connection = psqlConnection(connectionString);
  const variableArguments = Object.entries(variables).flatMap(
    ([name, value]) => ['--set', `${name}=${value}`],
  );

  await execFileAsync(
    'psql',
    [...connection.args, ...variableArguments, '--file', script],
    {
      cwd: process.cwd(),
      env: { ...process.env, PGPASSWORD: connection.password },
    },
  );
}

postgresTest(
  'upgrades populated Payload state and enforces ownership, grants, immutability, append-only audit, transactions, and locks in PostgreSQL',
  async () => {
    const source = new URL(testDatabaseUrl!);
    const sourceDatabase = decodeURIComponent(source.pathname.slice(1));
    if (!/^[a-zA-Z0-9_]+_test$/.test(sourceDatabase)) {
      throw new Error('CMS_TEST_DATABASE_URL database name must end in _test.');
    }

    const suffix = `${process.pid}_${randomBytes(4).toString('hex')}`;
    const databaseName = `agent14_${suffix}_test`;
    const roles = {
      authMigration: `a14_${suffix}_am`,
      authRuntime: `a14_${suffix}_ar`,
      payloadMigration: `a14_${suffix}_pm`,
      payloadRuntime: `a14_${suffix}_pr`,
    };
    const adminUrl = databaseUrl(testDatabaseUrl!, 'postgres');
    const migrationUrl = databaseUrl(
      testDatabaseUrl!,
      databaseName,
      roles.payloadMigration,
    );
    const authMigrationUrl = databaseUrl(
      testDatabaseUrl!,
      databaseName,
      roles.authMigration,
    );
    const runtimeUrl = databaseUrl(
      testDatabaseUrl!,
      databaseName,
      roles.payloadRuntime,
    );
    const authRuntimeUrl = databaseUrl(
      testDatabaseUrl!,
      databaseName,
      roles.authRuntime,
    );
    const targetAdminUrl = databaseUrl(testDatabaseUrl!, databaseName);
    const admin = new Client({ connectionString: adminUrl });

    await admin.connect();
    try {
      for (const role of Object.values(roles)) {
        await admin.query(
          `CREATE ROLE ${quoteIdentifier(role)} LOGIN PASSWORD '${rolePassword}'`,
        );
      }
      await admin.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);

      await runPsql(
        targetAdminUrl,
        path.resolve('scripts/database/provision-roles.sql'),
        {
          auth_migration_role: roles.authMigration,
          auth_runtime_role: roles.authRuntime,
          payload_migration_role: roles.payloadMigration,
          payload_runtime_role: roles.payloadRuntime,
        },
      );

      await execFileAsync(
        process.execPath,
        [
          '--conditions=react-server',
          '--import',
          'tsx',
          'scripts/database/apply-baseline-migrations.ts',
        ],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            DATABASE_URL: migrationUrl,
            EMAIL_ADDRESS: 'agent14-upgrade@example.test',
            EMAIL_NAME: 'Perfect Tax',
            EMAIL_PASSWORD: 'agent14-upgrade-only',
            PAYLOAD_SECRET: 'agent-14-upgrade-fixture-secret-0123456789abcdef',
            SITE_URL: 'http://localhost:3000',
          },
        },
      );

      const migrationClient = new Client({ connectionString: migrationUrl });
      await migrationClient.connect();
      try {
        for (const [index, role] of [
          'editor',
          'bilingual-reviewer',
          'publisher',
          'cms-admin',
        ].entries()) {
          await migrationClient.query(
            `INSERT INTO cms_users (email, role)
             VALUES ($1, $2::enum_cms_users_role)`,
            [`preserved-${index}@example.test`, role],
          );
        }
        await migrationClient.query(
          `INSERT INTO services (
             stable_identifier,
             translation_workflow_en_reviewed_by_id,
             translation_workflow_es_last_edited_by_id
           ) VALUES ('preserved-service', 3, 2)`,
        );
      } finally {
        await migrationClient.end();
      }

      const migrationEnvironment = {
        ...process.env,
        DATABASE_URL: migrationUrl,
        EMAIL_ADDRESS: 'agent14-upgrade@example.test',
        EMAIL_NAME: 'Perfect Tax',
        EMAIL_PASSWORD: 'agent14-upgrade-only',
        PAYLOAD_SECRET: 'agent-14-upgrade-cli-secret-0123456789abcdef',
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

      const authMigrationEnvironment = {
        ...process.env,
        BETTER_AUTH_SECRET: 'agent-14-auth-migration-secret-0123456789abcdef',
        PORTAL_AUTH_DATABASE_URL: authMigrationUrl,
        SITE_URL: 'http://localhost:3000',
      };
      await execFileAsync('pnpm', ['auth:migrate'], {
        cwd: process.cwd(),
        env: authMigrationEnvironment,
      });
      await runPsql(
        authMigrationUrl,
        path.resolve('scripts/database/apply-auth-runtime-grants.sql'),
        { auth_runtime_role: roles.authRuntime },
      );

      await runPsql(
        migrationUrl,
        path.resolve('scripts/database/apply-payload-runtime-grants.sql'),
        { payload_runtime_role: roles.payloadRuntime },
      );

      const runtime = new Client({ connectionString: runtimeUrl });
      const owner = new Client({ connectionString: migrationUrl });
      const authRuntime = new Client({ connectionString: authRuntimeUrl });
      const authOwner = new Client({ connectionString: authMigrationUrl });
      await Promise.all([
        runtime.connect(),
        owner.connect(),
        authRuntime.connect(),
        authOwner.connect(),
      ]);

      try {
        await verifyOperationalDatabaseContract(runtime, {
          payloadMigration: roles.payloadMigration,
          payloadRuntime: roles.payloadRuntime,
        });

        await expect(
          owner.query(
            'CREATE TABLE portal_auth.agent14_payload_cross_schema (id integer)',
          ),
        ).rejects.toMatchObject({ code: '42501' });
        await expect(
          authOwner.query(
            'CREATE TABLE public.agent14_auth_cross_schema (id integer)',
          ),
        ).rejects.toMatchObject({ code: '42501' });

        const preserved = await owner.query<{
          roles: string[];
          service_count: string;
        }>(`SELECT
              ARRAY(SELECT role::text FROM cms_users ORDER BY id) AS roles,
              (SELECT count(*)::text FROM services WHERE stable_identifier = 'preserved-service') AS service_count`);
        expect(preserved.rows[0]).toEqual({
          roles: ['editor', 'bilingual-reviewer', 'publisher', 'cms-admin'],
          service_count: '1',
        });

        const applied = await runtime.query<{ name: string }>(
          'SELECT name FROM payload_migrations ORDER BY name',
        );
        expect(applied.rows.map(({ name }) => name)).toContain(
          OPERATIONAL_MIGRATION_NAME,
        );

        const authTables = await authOwner.query<{
          ownership_comment: string | null;
          owner: string;
          table_name: string;
        }>(
          `SELECT tablename AS table_name,
                  tableowner AS owner,
                  obj_description(
                    format('%I.%I', schemaname, tablename)::regclass,
                    'pg_class'
                  ) AS ownership_comment
             FROM pg_tables
            WHERE schemaname = 'portal_auth'
              AND tablename <> 'perfect_tax_auth_migrations'
            ORDER BY tablename`,
        );
        expect(authTables.rows).toEqual(
          ['account', 'session', 'twoFactor', 'user', 'verification'].map(
            (table_name) => ({
              ownership_comment:
                'perfect-tax:migration-owner=better-auth;ledger=portal_auth.perfect_tax_auth_migrations;migration=20260831_172000_agent_14_better_auth_core_mfa',
              owner: roles.authMigration,
              table_name,
            }),
          ),
        );
        const authLedger = await authOwner.query<{ name: string }>(
          'SELECT name FROM portal_auth.perfect_tax_auth_migrations ORDER BY name',
        );
        expect(authLedger.rows.map(({ name }) => name)).toEqual([
          '20260831_172000_agent_14_better_auth_core_mfa',
        ]);

        const createdOwner = await runtime.query<{ id: number }>(
          `INSERT INTO staff (
             first_name, last_name, work_email, role, status, is_primary_owner
           ) VALUES (
             'Primary', 'Owner', 'owner@example.test', 'owner', 'active', true
           ) RETURNING id`,
        );
        const ownerId = createdOwner.rows[0]!.id;

        await expect(
          runtime.query(
            `INSERT INTO staff (
               first_name, last_name, work_email, role, status, is_primary_owner
             ) VALUES (
               'Second', 'Owner', 'second@example.test', 'owner', 'active', true
             )`,
          ),
        ).rejects.toMatchObject({ code: '23505' });
        await expect(
          owner.query(`UPDATE staff SET status = 'disabled' WHERE id = $1`, [
            ownerId,
          ]),
        ).rejects.toMatchObject({ code: '42501' });
        await expect(
          owner.query('DELETE FROM staff WHERE id = $1', [ownerId]),
        ).rejects.toMatchObject({ code: '42501' });

        await runtime.query(
          `INSERT INTO portal_identities (auth_user_id, subject_type, staff_id)
           VALUES ('auth-owner-integration', 'staff', $1)`,
          [ownerId],
        );
        await expect(
          runtime.query(
            `UPDATE portal_identities SET auth_user_id = 'changed'`,
          ),
        ).rejects.toMatchObject({ code: '42501' });
        await expect(
          owner.query('TRUNCATE portal_identities'),
        ).rejects.toMatchObject({ code: '42501' });

        await expect(
          runtime.query(
            `INSERT INTO security_events (
               occurred_at, action, actor_kind, correlation_id, metadata
             ) VALUES (
               now(), 'primary-owner.bootstrap.failed', 'system',
               '3ca85f64-5717-4562-b3fc-2c963f66afa6', '{}'::jsonb
             )`,
          ),
        ).rejects.toMatchObject({ code: '42501' });
        await expect(
          owner.query(
            `INSERT INTO security_events (
               occurred_at, action, actor_kind, metadata
             ) VALUES (
               now(), 'authentication.succeeded', 'auth-user', '{}'::jsonb
             )`,
          ),
        ).rejects.toMatchObject({ code: '23514' });

        await runtime.query('BEGIN');
        const appended = await runtime.query<{ id: number }>(
          `SELECT public.perfect_tax_append_security_event(
             now(),
             'primary-owner.bootstrap.failed',
             'system',
             NULL,
             NULL,
             NULL,
             '018f47a8-7b2c-7f35-8c11-7bb91f934d22',
             '{"operation":"primary-owner-bootstrap","reasonCode":"initial-primary-owner-provisioning"}'::jsonb
           ) AS id`,
        );
        expect(appended.rows[0]?.id).toBeTypeOf('number');
        await runtime.query('ROLLBACK');
        const rolledBack = await owner.query<{ count: string }>(
          `SELECT count(*)::text AS count
             FROM security_events
            WHERE correlation_id = '018f47a8-7b2c-7f35-8c11-7bb91f934d22'`,
        );
        expect(rolledBack.rows[0]?.count).toBe('0');
        await expect(
          runtime.query('SELECT metadata FROM security_events'),
        ).rejects.toMatchObject({ code: '42501' });

        const lockOne = new Client({ connectionString: runtimeUrl });
        const lockTwo = new Client({ connectionString: runtimeUrl });
        await Promise.all([lockOne.connect(), lockTwo.connect()]);
        try {
          await expect(
            lockOne.query<{ acquired: boolean }>(
              'SELECT pg_try_advisory_lock(1617731881) AS acquired',
            ),
          ).resolves.toMatchObject({ rows: [{ acquired: true }] });
          await expect(
            lockTwo.query<{ acquired: boolean }>(
              'SELECT pg_try_advisory_lock(1617731881) AS acquired',
            ),
          ).resolves.toMatchObject({ rows: [{ acquired: false }] });
          await lockOne.query('SELECT pg_advisory_unlock(1617731881)');
          await expect(
            lockTwo.query<{ acquired: boolean }>(
              'SELECT pg_try_advisory_lock(1617731881) AS acquired',
            ),
          ).resolves.toMatchObject({ rows: [{ acquired: true }] });
          await lockTwo.query('SELECT pg_advisory_unlock(1617731881)');
        } finally {
          await Promise.all([lockOne.end(), lockTwo.end()]);
        }
      } finally {
        await Promise.all([
          runtime.end(),
          owner.end(),
          authRuntime.end(),
          authOwner.end(),
        ]);
      }
    } finally {
      await admin.query(
        `DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)} WITH (FORCE)`,
      );
      for (const role of Object.values(roles).reverse()) {
        await admin.query(`DROP ROLE IF EXISTS ${quoteIdentifier(role)}`);
      }
      await admin.end();
    }
  },
  120_000,
);
