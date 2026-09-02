import { readdir, readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { REQUIRED_CMS_MIGRATIONS } from '@/modules/cms/required-migrations';
import {
  AUTH_MIGRATIONS,
  AUTH_MIGRATION_LEDGER,
} from '@/modules/auth/migrations';

import {
  DATABASE_ROLES,
  OPERATIONAL_MIGRATION_COMMENT,
  OPERATIONAL_MIGRATION_NAME,
  OPERATIONAL_TABLES,
  PAYLOAD_DATABASE_SCHEMA,
  PAYLOAD_MIGRATION_LEDGER,
} from './operational-schema';

const repositoryFile = (path: string) =>
  new URL(`../../../${path}`, import.meta.url);

describe('operational database ownership architecture', () => {
  it('declares one Payload owner, schema, ledger, and least-privilege runtime contract for every table', () => {
    expect(PAYLOAD_DATABASE_SCHEMA).toBe('public');
    expect(PAYLOAD_MIGRATION_LEDGER).toBe('payload_migrations');
    expect(OPERATIONAL_TABLES).toEqual([
      {
        collection: 'staff',
        payloadOwnsDDL: true,
        runtimeGrants: ['SELECT', 'INSERT'],
        table: 'staff',
      },
      {
        collection: 'clients',
        payloadOwnsDDL: true,
        runtimeGrants: ['SELECT'],
        table: 'clients',
      },
      {
        collection: 'portal-identities',
        payloadOwnsDDL: true,
        runtimeGrants: ['SELECT', 'INSERT'],
        table: 'portal_identities',
      },
      {
        collection: 'security-events',
        payloadOwnsDDL: true,
        runtimeGrants: ['EXECUTE(perfect_tax_append_security_event)'],
        table: 'security_events',
      },
    ]);
    expect(new Set(OPERATIONAL_TABLES.map(({ table }) => table)).size).toBe(4);
    expect(OPERATIONAL_MIGRATION_COMMENT).toContain(
      `migration=${OPERATIONAL_MIGRATION_NAME}`,
    );
  });

  it('keeps migration ordering deterministic and each physical table in exactly one migration', async () => {
    const migrationDirectory = repositoryFile('src/modules/cms/migrations/');
    const files = (await readdir(migrationDirectory)).filter((file) =>
      file.endsWith('.ts'),
    );
    const sources = await Promise.all(
      files.map(async (file) => ({
        file,
        source: await readFile(new URL(file, migrationDirectory), 'utf8'),
      })),
    );

    expect(REQUIRED_CMS_MIGRATIONS).toEqual([
      '20260718_213559_initial_cms',
      '20260718_223444_task_5_public_content',
      OPERATIONAL_MIGRATION_NAME,
    ]);

    for (const { table } of OPERATIONAL_TABLES) {
      expect(
        sources
          .filter(({ source }) => source.includes(`CREATE TABLE "${table}"`))
          .map(({ file }) => file),
      ).toEqual([`${OPERATIONAL_MIGRATION_NAME}.ts`]);
    }

    expect(sources.map(({ source }) => source).join('\n')).not.toMatch(
      /CREATE SCHEMA\s+"?portal_identity"?/i,
    );
  });

  it('keeps Payload generation as the base DDL and layers the reviewed physical controls in the same owner migration', async () => {
    const [migration, snapshot] = await Promise.all([
      readFile(
        repositoryFile(
          `src/modules/cms/migrations/${OPERATIONAL_MIGRATION_NAME}.ts`,
        ),
        'utf8',
      ),
      readFile(
        repositoryFile(
          `src/modules/cms/migrations/${OPERATIONAL_MIGRATION_NAME}.json`,
        ),
        'utf8',
      ),
    ]);

    for (const required of [
      'staff_primary_owner_unique_idx',
      'staff_work_email_lower_idx',
      'staff_protect_primary_owner_trigger',
      'clients_protect_client_number_trigger',
      'portal_identities_subject_check',
      'portal_identities_immutable_truncate_trigger',
      'security_events_action_shape_check',
      'security_events_immutable_truncate_trigger',
      'perfect_tax_append_security_event',
      OPERATIONAL_MIGRATION_COMMENT,
    ]) {
      expect(migration).toContain(required);
    }
    expect(migration).toContain('ON DELETE restrict');
    expect(migration).not.toContain('payload_locked_documents_rels');

    const generated = JSON.parse(snapshot) as {
      tables?: Record<string, unknown>;
    };
    expect(Object.keys(generated.tables ?? {})).toEqual(
      expect.arrayContaining(
        OPERATIONAL_TABLES.map(({ table }) => `public.${table}`),
      ),
    );
  });

  it('keeps schema push disabled so runtime Payload cannot become a second DDL owner', async () => {
    const payloadConfig = await readFile(
      repositoryFile('payload.config.ts'),
      'utf8',
    );

    expect(payloadConfig).toContain('migrationDir:');
    expect(payloadConfig).toContain('PAYLOAD_DATABASE_SCHEMA_PUSH = false');
    expect(payloadConfig).toContain('push: PAYLOAD_DATABASE_SCHEMA_PUSH');
  });

  it('separates migration/runtime roles and never grants cross-schema DDL', async () => {
    const [roles, payloadGrants, authGrants] = await Promise.all([
      readFile(repositoryFile('scripts/database/provision-roles.sql'), 'utf8'),
      readFile(
        repositoryFile('scripts/database/apply-payload-runtime-grants.sql'),
        'utf8',
      ),
      readFile(
        repositoryFile('scripts/database/apply-auth-runtime-grants.sql'),
        'utf8',
      ),
    ]);

    expect(new Set(Object.values(DATABASE_ROLES)).size).toBe(4);
    expect(roles).toContain('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
    expect(roles).toContain(
      'REVOKE ALL ON SCHEMA portal_auth FROM :"payload_migration_role"',
    );
    expect(payloadGrants).toContain(
      'REVOKE ALL ON TABLE public.security_events',
    );
    expect(payloadGrants).toContain(
      'GRANT EXECUTE ON FUNCTION public.perfect_tax_append_security_event',
    );
    expect(payloadGrants).not.toMatch(/GRANT\s+CREATE|GRANT\s+TRUNCATE/i);
    expect(authGrants).toContain('IN SCHEMA portal_auth');
    expect(authGrants).not.toContain('IN SCHEMA public');
  });

  it('keeps Better Auth in its own deterministic ledger and schema', async () => {
    const authMigration = await readFile(
      repositoryFile(`src/modules/auth/migrations/${AUTH_MIGRATIONS[0].file}`),
      'utf8',
    );

    expect(AUTH_MIGRATION_LEDGER).toBe(
      'portal_auth.perfect_tax_auth_migrations',
    );
    expect(AUTH_MIGRATIONS.map(({ name }) => name)).toEqual([
      '20260831_172000_agent_14_better_auth_core_mfa',
    ]);
    expect(authMigration).toContain('create table "user"');
    expect(authMigration).toContain('create table "twoFactor"');
    expect(authMigration).not.toMatch(/create schema\s+portal_identity/i);
  });
});
