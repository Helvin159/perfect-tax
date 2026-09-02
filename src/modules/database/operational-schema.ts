export const PAYLOAD_DATABASE_SCHEMA = 'public' as const;
export const PAYLOAD_MIGRATION_LEDGER = 'payload_migrations' as const;
export const OPERATIONAL_MIGRATION_NAME =
  '20260831_171654_agent_14_operational_schema' as const;

export const DATABASE_ROLES = Object.freeze({
  authMigration: 'perfect_tax_auth_migrator',
  authRuntime: 'perfect_tax_auth_runtime',
  payloadMigration: 'perfect_tax_payload_migrator',
  payloadRuntime: 'perfect_tax_payload_runtime',
} as const);

export const OPERATIONAL_TABLES = Object.freeze([
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
] as const);

export const OPERATIONAL_TABLE_NAMES = Object.freeze(
  OPERATIONAL_TABLES.map(({ table }) => table),
);

export const OPERATIONAL_MIGRATION_COMMENT =
  `perfect-tax:migration-owner=payload;ledger=${PAYLOAD_DATABASE_SCHEMA}.${PAYLOAD_MIGRATION_LEDGER};migration=${OPERATIONAL_MIGRATION_NAME}` as const;
