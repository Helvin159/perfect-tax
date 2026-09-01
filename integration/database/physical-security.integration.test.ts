import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  activateAgent15Environment,
  createAgent15Database,
  type Agent15Database,
} from '../support/database';
import { expectPostgresError } from '../support/postgres';

let database: Agent15Database;
let payloadRuntime: Client;
let payloadMigration: Client;
let authRuntime: Client;
let authMigration: Client;

beforeAll(async () => {
  database = await createAgent15Database('physical');
  activateAgent15Environment(database);
  payloadRuntime = new Client({ connectionString: database.payloadRuntimeURL });
  payloadMigration = new Client({
    connectionString: database.payloadMigrationURL,
  });
  authRuntime = new Client({ connectionString: database.authRuntimeURL });
  authMigration = new Client({ connectionString: database.authMigrationURL });
  await Promise.all([
    payloadRuntime.connect(),
    payloadMigration.connect(),
    authRuntime.connect(),
    authMigration.connect(),
  ]);
});

afterAll(async () => {
  await Promise.all([
    payloadRuntime?.end(),
    payloadMigration?.end(),
    authRuntime?.end(),
    authMigration?.end(),
  ]);
  await database?.destroy();
});

describe('Agent 15 PostgreSQL security integration', () => {
  it('boots clean independent migration ledgers and initializes both owned schemas', async () => {
    const payloadLedger = await payloadRuntime.query<{ name: string }>(
      'SELECT name FROM public.payload_migrations ORDER BY name',
    );
    const authLedger = await authMigration.query<{ name: string }>(
      'SELECT name FROM portal_auth.perfect_tax_auth_migrations ORDER BY name',
    );
    const schemas = await payloadMigration.query<{ schema_name: string }>(
      `SELECT nspname AS schema_name
         FROM pg_namespace
        WHERE nspname IN ('public', 'portal_auth')
        ORDER BY nspname`,
    );

    expect(payloadLedger.rows.map(({ name }) => name)).toEqual([
      '20260718_213559_initial_cms',
      '20260718_223444_task_5_public_content',
      '20260831_171654_agent_14_operational_schema',
    ]);
    expect(authLedger.rows.map(({ name }) => name)).toEqual([
      '20260831_172000_agent_14_better_auth_core_mfa',
    ]);
    expect(schemas.rows).toEqual([
      { schema_name: 'portal_auth' },
      { schema_name: 'public' },
    ]);
  });

  it('enforces Staff, Client, and PortalIdentity invariants in the database', async () => {
    const owner = await payloadRuntime.query<{ id: number }>(
      `INSERT INTO public.staff
         (first_name, last_name, work_email, role, status, is_primary_owner)
       VALUES ('Primary', 'Owner', 'owner-physical@example.test', 'owner', 'active', true)
       RETURNING id`,
    );
    const staff = await payloadRuntime.query<{ id: number }>(
      `INSERT INTO public.staff
         (first_name, last_name, work_email, role, status, is_primary_owner)
       VALUES ('Ivy', 'Intake', 'intake-physical@example.test', 'intake', 'active', false)
       RETURNING id`,
    );
    const clientA = await payloadMigration.query<{ id: number }>(
      `INSERT INTO public.clients
         (client_number, first_name, last_name, contact_email, status)
       VALUES ('CL-AAAA-0001', 'Client', 'One', 'client-one@example.test', 'active')
       RETURNING id`,
    );
    const clientB = await payloadMigration.query<{ id: number }>(
      `INSERT INTO public.clients
         (client_number, first_name, last_name, contact_email, status)
       VALUES ('CL-AAAA-0002', 'Client', 'Two', 'client-two@example.test', 'active')
       RETURNING id`,
    );

    await expectPostgresError(
      payloadRuntime.query(
        `INSERT INTO public.staff
           (first_name, last_name, work_email, role, status, is_primary_owner)
         VALUES ('Second', 'Owner', 'second-owner@example.test', 'owner', 'active', true)`,
      ),
      '23505',
      'staff_primary_owner_unique_idx',
    );
    for (const mutation of [
      `UPDATE public.staff SET role = 'administrator', is_primary_owner = false WHERE id = ${owner.rows[0]!.id}`,
      `UPDATE public.staff SET status = 'disabled' WHERE id = ${owner.rows[0]!.id}`,
      `UPDATE public.staff SET is_primary_owner = false WHERE id = ${owner.rows[0]!.id}`,
      `DELETE FROM public.staff WHERE id = ${owner.rows[0]!.id}`,
    ]) {
      await expectPostgresError(payloadMigration.query(mutation), '42501');
    }
    await expectPostgresError(
      payloadMigration.query(
        `INSERT INTO public.staff
           (first_name, last_name, work_email, role, status, is_primary_owner)
         VALUES ('Bad', 'Role', 'bad-role@example.test', 'super-owner', 'active', false)`,
      ),
      '22P02',
    );
    await expectPostgresError(
      payloadMigration.query(
        `INSERT INTO public.staff
           (first_name, last_name, work_email, role, status, is_primary_owner)
         VALUES ('Bad', 'Status', 'bad-status@example.test', 'intake', 'suspended', false)`,
      ),
      '22P02',
    );

    await expectPostgresError(
      payloadMigration.query(
        `INSERT INTO public.clients
           (client_number, first_name, last_name, contact_email, status)
         VALUES ('CL-AAAA-0001', 'Duplicate', 'Number', 'duplicate@example.test', 'active')`,
      ),
      '23505',
      'clients_client_number_idx',
    );
    await expectPostgresError(
      payloadMigration.query(
        `UPDATE public.clients SET client_number = 'CL-BBBB-0001' WHERE id = $1`,
        [clientA.rows[0]!.id],
      ),
      '42501',
    );
    await expectPostgresError(
      payloadMigration.query(
        `INSERT INTO public.clients
           (client_number, first_name, last_name, contact_email, status)
         VALUES ('CL-AAAA-0003', 'Bad', 'Status', 'bad-client@example.test', 'disabled')`,
      ),
      '22P02',
    );

    await payloadRuntime.query(
      `INSERT INTO public.portal_identities (auth_user_id, subject_type, staff_id)
       VALUES ('auth-owner-physical', 'staff', $1)`,
      [owner.rows[0]!.id],
    );
    await payloadRuntime.query(
      `INSERT INTO public.portal_identities (auth_user_id, subject_type, client_id)
       VALUES ('auth-client-physical', 'client', $1)`,
      [clientA.rows[0]!.id],
    );
    await expectPostgresError(
      payloadRuntime.query(
        `INSERT INTO public.portal_identities (auth_user_id, subject_type, staff_id)
         VALUES ('auth-owner-physical', 'staff', $1)`,
        [staff.rows[0]!.id],
      ),
      '23505',
      'portal_identities_auth_user_id_idx',
    );
    await expectPostgresError(
      payloadRuntime.query(
        `INSERT INTO public.portal_identities (auth_user_id, subject_type, staff_id)
         VALUES ('other-auth', 'staff', $1)`,
        [owner.rows[0]!.id],
      ),
      '23505',
      'portal_identities_staff_idx',
    );
    await expectPostgresError(
      payloadRuntime.query(
        `INSERT INTO public.portal_identities (auth_user_id, subject_type, client_id)
         VALUES ('other-client-auth', 'client', $1)`,
        [clientA.rows[0]!.id],
      ),
      '23505',
      'portal_identities_client_idx',
    );
    for (const invalid of [
      `INSERT INTO public.portal_identities (auth_user_id, subject_type) VALUES ('zero-subject', 'staff')`,
      `INSERT INTO public.portal_identities (auth_user_id, subject_type, staff_id, client_id) VALUES ('dual-subject', 'staff', ${staff.rows[0]!.id}, ${clientB.rows[0]!.id})`,
      `INSERT INTO public.portal_identities (auth_user_id, subject_type, client_id) VALUES ('type-mismatch', 'staff', ${clientB.rows[0]!.id})`,
    ]) {
      await expectPostgresError(payloadRuntime.query(invalid), '23514');
    }
    await expectPostgresError(
      payloadRuntime.query(
        `UPDATE public.portal_identities SET auth_user_id = 'changed' WHERE auth_user_id = 'auth-owner-physical'`,
      ),
      '42501',
    );
    await expectPostgresError(
      payloadMigration.query(
        `DELETE FROM public.portal_identities WHERE auth_user_id = 'auth-owner-physical'`,
      ),
      '42501',
    );
  });

  it('retries only the real Client-number constraint collision', async () => {
    const { createWithClientNumberCollisionRetry } =
      await import('@/modules/clients/client-number-service');
    await payloadMigration.query(
      `INSERT INTO public.clients
         (client_number, first_name, last_name, contact_email, status)
       VALUES ('CL-RETR-Y001', 'Existing', 'Client', 'retry-existing@example.test', 'active')`,
    );
    let attempts = 0;
    const created = await createWithClientNumberCollisionRetry(async () => {
      attempts += 1;
      const clientNumber = attempts === 1 ? 'CL-RETR-Y001' : 'CL-RETR-Y002';
      return payloadMigration.query<{ client_number: string }>(
        `INSERT INTO public.clients
           (client_number, first_name, last_name, contact_email, status)
         VALUES ($1, 'Retried', 'Client', 'retry-created@example.test', 'active')
         RETURNING client_number`,
        [clientNumber],
      );
    });

    expect(attempts).toBe(2);
    expect(created.rows[0]?.client_number).toBe('CL-RETR-Y002');
  });

  it('keeps SecurityEvents append-only for the least-privilege runtime role', async () => {
    const appended = await payloadRuntime.query<{ id: number }>(
      `SELECT public.perfect_tax_append_security_event(
         now(),
         'primary-owner.bootstrap.failed',
         'system',
         NULL,
         NULL,
         NULL,
         '3ca85f64-5717-4562-b3fc-2c963f66afa6',
         '{"operation":"primary-owner-bootstrap","reasonCode":"initial-primary-owner-provisioning"}'::jsonb
       ) AS id`,
    );
    expect(appended.rows[0]?.id).toBeTypeOf('number');

    await expectPostgresError(
      payloadRuntime.query('SELECT metadata FROM public.security_events'),
      '42501',
    );
    await expectPostgresError(
      payloadRuntime.query(
        `INSERT INTO public.security_events
           (occurred_at, action, actor_kind, metadata)
         VALUES (now(), 'authentication.failed', 'anonymous', '{}'::jsonb)`,
      ),
      '42501',
    );
    await expectPostgresError(
      payloadRuntime.query(
        'UPDATE public.security_events SET metadata = metadata',
      ),
      '42501',
    );
    await expectPostgresError(
      payloadRuntime.query('DELETE FROM public.security_events'),
      '42501',
    );
    await expectPostgresError(
      payloadRuntime.query('TRUNCATE public.security_events'),
      '42501',
    );
  });

  it('separates Payload and Better Auth runtime and migration authority', async () => {
    await expectPostgresError(
      payloadRuntime.query('CREATE TABLE public.a15_payload_ddl (id integer)'),
      '42501',
    );
    await expectPostgresError(
      payloadRuntime.query('SELECT id FROM portal_auth."user"'),
      '42501',
    );
    await expectPostgresError(
      authRuntime.query('SELECT id FROM public.staff'),
      '42501',
    );
    await expectPostgresError(
      authRuntime.query('CREATE TABLE portal_auth.a15_auth_ddl (id integer)'),
      '42501',
    );
    await expectPostgresError(
      payloadMigration.query(
        'CREATE TABLE portal_auth.a15_payload_cross_schema (id integer)',
      ),
      '42501',
    );
    await expectPostgresError(
      authMigration.query(
        'CREATE TABLE public.a15_auth_cross_schema (id integer)',
      ),
      '42501',
    );

    const applicationColumns = await payloadMigration.query<{
      column_name: string;
    }>(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ('staff', 'clients', 'portal_identities', 'security_events')`,
    );
    const columnNames = applicationColumns.rows.map(({ column_name }) =>
      column_name.toLowerCase(),
    );
    expect(columnNames).not.toContain('password');
    expect(columnNames).not.toContain('token');
    expect(columnNames).not.toContain('secret');
    expect(columnNames).not.toContain('backupcodes');
  });
});
