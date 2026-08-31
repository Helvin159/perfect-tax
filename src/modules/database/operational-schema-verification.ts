import type { QueryResult, QueryResultRow } from 'pg';

import {
  DATABASE_ROLES,
  OPERATIONAL_MIGRATION_COMMENT,
  OPERATIONAL_TABLE_NAMES,
  PAYLOAD_DATABASE_SCHEMA,
} from './operational-schema';

type Queryable = Readonly<{
  query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<Row>>;
}>;

export type OperationalDatabaseRoles = Readonly<{
  payloadMigration: string;
  payloadRuntime: string;
}>;

const REQUIRED_CONSTRAINTS = Object.freeze([
  'staff_owner_marker_check',
  'staff_primary_owner_active_check',
  'clients_client_number_format_check',
  'portal_identities_auth_user_id_check',
  'portal_identities_client_id_clients_id_fk',
  'portal_identities_staff_id_staff_id_fk',
  'portal_identities_subject_check',
  'security_events_action_shape_check',
  'security_events_actor_check',
  'security_events_correlation_id_check',
  'security_events_metadata_check',
  'security_events_target_check',
] as const);

const REQUIRED_INDEXES = Object.freeze([
  'clients_client_number_idx',
  'portal_identities_auth_user_id_idx',
  'portal_identities_client_idx',
  'portal_identities_staff_idx',
  'security_events_action_idx',
  'security_events_correlation_id_idx',
  'security_events_occurred_at_idx',
  'staff_primary_owner_unique_idx',
  'staff_work_email_lower_idx',
] as const);

const REQUIRED_TRIGGERS = Object.freeze([
  'clients_protect_client_number_trigger',
  'portal_identities_immutable_row_trigger',
  'portal_identities_immutable_truncate_trigger',
  'security_events_immutable_row_trigger',
  'security_events_immutable_truncate_trigger',
  'staff_protect_primary_owner_trigger',
] as const);

function exactSet(actual: readonly string[], expected: readonly string[]) {
  const actualSet = new Set(actual);
  return (
    actualSet.size === expected.length &&
    expected.every((value) => actualSet.has(value))
  );
}

function assertContract(condition: boolean): asserts condition {
  if (!condition) throw new Error('operational-schema-unavailable');
}

export async function verifyOperationalDatabaseContract(
  database: Queryable,
  expectedRoles: OperationalDatabaseRoles = DATABASE_ROLES,
): Promise<void> {
  const role = await database.query<{
    can_create_public: boolean;
    can_use_portal_auth: boolean;
    rolbypassrls: boolean;
    rolcreatedb: boolean;
    rolcreaterole: boolean;
    rolreplication: boolean;
    rolsuper: boolean;
    runtime_role: string;
  }>(`SELECT current_user AS runtime_role,
            r.rolsuper,
            r.rolcreatedb,
            r.rolcreaterole,
            r.rolreplication,
            r.rolbypassrls,
            has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_public,
            CASE WHEN to_regnamespace('portal_auth') IS NULL THEN false
                 ELSE has_schema_privilege(current_user, 'portal_auth', 'USAGE')
             END AS can_use_portal_auth
       FROM pg_roles AS r
      WHERE r.rolname = current_user`);
  const runtime = role.rows[0];
  assertContract(
    runtime?.runtime_role === expectedRoles.payloadRuntime &&
      !runtime.rolsuper &&
      !runtime.rolcreatedb &&
      !runtime.rolcreaterole &&
      !runtime.rolreplication &&
      !runtime.rolbypassrls &&
      !runtime.can_create_public &&
      !runtime.can_use_portal_auth,
  );

  const tables = await database.query<{
    owner: string;
    ownership_comment: string | null;
    schema_name: string;
    table_name: string;
  }>(
    `SELECT n.nspname AS schema_name,
            c.relname AS table_name,
            owner.rolname AS owner,
            obj_description(c.oid, 'pg_class') AS ownership_comment
       FROM pg_class AS c
       JOIN pg_namespace AS n ON n.oid = c.relnamespace
       JOIN pg_roles AS owner ON owner.oid = c.relowner
      WHERE c.relkind IN ('r', 'p')
        AND c.relname = ANY($1::text[])
      ORDER BY c.relname`,
    [OPERATIONAL_TABLE_NAMES],
  );
  assertContract(
    tables.rows.length === OPERATIONAL_TABLE_NAMES.length &&
      exactSet(
        tables.rows.map(({ table_name }) => table_name),
        OPERATIONAL_TABLE_NAMES,
      ) &&
      tables.rows.every(
        ({ owner, ownership_comment, schema_name }) =>
          schema_name === PAYLOAD_DATABASE_SCHEMA &&
          owner === expectedRoles.payloadMigration &&
          ownership_comment === OPERATIONAL_MIGRATION_COMMENT,
      ),
  );

  const constraints = await database.query<{ name: string }>(
    `SELECT conname AS name
       FROM pg_constraint
      WHERE conrelid = ANY($1::regclass[])
        AND conname = ANY($2::text[])
      ORDER BY conname`,
    [
      OPERATIONAL_TABLE_NAMES.map((table) => `public.${table}`),
      REQUIRED_CONSTRAINTS,
    ],
  );
  assertContract(
    exactSet(
      constraints.rows.map(({ name }) => name),
      REQUIRED_CONSTRAINTS,
    ),
  );

  const foreignKeys = await database.query<{
    delete_action: string;
    name: string;
  }>(`SELECT conname AS name, confdeltype AS delete_action
       FROM pg_constraint
      WHERE conname IN (
        'portal_identities_staff_id_staff_id_fk',
        'portal_identities_client_id_clients_id_fk'
      )
      ORDER BY conname`);
  assertContract(
    foreignKeys.rows.length === 2 &&
      foreignKeys.rows.every(({ delete_action }) => delete_action === 'r'),
  );

  const indexes = await database.query<{ name: string }>(
    `SELECT indexname AS name
       FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = ANY($1::text[])
      ORDER BY indexname`,
    [REQUIRED_INDEXES],
  );
  assertContract(
    exactSet(
      indexes.rows.map(({ name }) => name),
      REQUIRED_INDEXES,
    ),
  );

  const triggers = await database.query<{ name: string }>(
    `SELECT tgname AS name
       FROM pg_trigger
      WHERE NOT tgisinternal
        AND tgrelid = ANY($1::regclass[])
      ORDER BY tgname`,
    [OPERATIONAL_TABLE_NAMES.map((table) => `public.${table}`)],
  );
  assertContract(
    exactSet(
      triggers.rows.map(({ name }) => name),
      REQUIRED_TRIGGERS,
    ),
  );

  const privileges = await database.query<{
    clients_delete: boolean;
    clients_insert: boolean;
    clients_select: boolean;
    clients_truncate: boolean;
    clients_update: boolean;
    events_delete: boolean;
    events_function_execute: boolean;
    events_insert: boolean;
    events_select: boolean;
    events_truncate: boolean;
    events_update: boolean;
    identities_delete: boolean;
    identities_insert: boolean;
    identities_select: boolean;
    identities_truncate: boolean;
    identities_update: boolean;
    staff_delete: boolean;
    staff_insert: boolean;
    staff_select: boolean;
    staff_sequence_select: boolean;
    staff_sequence_usage: boolean;
    staff_truncate: boolean;
    staff_update: boolean;
    identities_sequence_select: boolean;
    identities_sequence_usage: boolean;
  }>(`SELECT
      has_table_privilege(current_user, 'public.staff', 'SELECT') AS staff_select,
      has_table_privilege(current_user, 'public.staff', 'INSERT') AS staff_insert,
      has_table_privilege(current_user, 'public.staff', 'UPDATE') AS staff_update,
      has_table_privilege(current_user, 'public.staff', 'DELETE') AS staff_delete,
      has_table_privilege(current_user, 'public.staff', 'TRUNCATE') AS staff_truncate,
      has_sequence_privilege(current_user, 'public.staff_id_seq', 'SELECT') AS staff_sequence_select,
      has_sequence_privilege(current_user, 'public.staff_id_seq', 'USAGE') AS staff_sequence_usage,
      has_table_privilege(current_user, 'public.clients', 'SELECT') AS clients_select,
      has_table_privilege(current_user, 'public.clients', 'INSERT') AS clients_insert,
      has_table_privilege(current_user, 'public.clients', 'UPDATE') AS clients_update,
      has_table_privilege(current_user, 'public.clients', 'DELETE') AS clients_delete,
      has_table_privilege(current_user, 'public.clients', 'TRUNCATE') AS clients_truncate,
      has_table_privilege(current_user, 'public.portal_identities', 'SELECT') AS identities_select,
      has_table_privilege(current_user, 'public.portal_identities', 'INSERT') AS identities_insert,
      has_table_privilege(current_user, 'public.portal_identities', 'UPDATE') AS identities_update,
      has_table_privilege(current_user, 'public.portal_identities', 'DELETE') AS identities_delete,
      has_table_privilege(current_user, 'public.portal_identities', 'TRUNCATE') AS identities_truncate,
      has_sequence_privilege(current_user, 'public.portal_identities_id_seq', 'SELECT') AS identities_sequence_select,
      has_sequence_privilege(current_user, 'public.portal_identities_id_seq', 'USAGE') AS identities_sequence_usage,
      has_table_privilege(current_user, 'public.security_events', 'INSERT') AS events_insert,
      has_table_privilege(current_user, 'public.security_events', 'SELECT') AS events_select,
      has_table_privilege(current_user, 'public.security_events', 'UPDATE') AS events_update,
      has_table_privilege(current_user, 'public.security_events', 'DELETE') AS events_delete,
      has_table_privilege(current_user, 'public.security_events', 'TRUNCATE') AS events_truncate,
      has_function_privilege(
        current_user,
        'public.perfect_tax_append_security_event(timestamp with time zone, public.enum_security_events_action, public.enum_security_events_actor_kind, character varying, public.enum_security_events_target_type, character varying, character varying, jsonb)',
        'EXECUTE'
      ) AS events_function_execute`);
  const grants = privileges.rows[0];
  assertContract(
    grants?.staff_select &&
      grants.staff_insert &&
      !grants.staff_update &&
      !grants.staff_delete &&
      !grants.staff_truncate &&
      grants.staff_sequence_usage &&
      !grants.staff_sequence_select &&
      grants.clients_select &&
      !grants.clients_insert &&
      !grants.clients_update &&
      !grants.clients_delete &&
      !grants.clients_truncate &&
      grants.identities_select &&
      grants.identities_insert &&
      !grants.identities_update &&
      !grants.identities_delete &&
      !grants.identities_truncate &&
      grants.identities_sequence_usage &&
      !grants.identities_sequence_select &&
      !grants.events_insert &&
      !grants.events_select &&
      !grants.events_update &&
      !grants.events_delete &&
      !grants.events_truncate &&
      grants.events_function_execute,
  );
}
