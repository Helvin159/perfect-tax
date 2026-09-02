export const AUTH_MIGRATIONS = Object.freeze([
  {
    file: '20260831_172000_agent_14_better_auth_core_mfa.sql',
    name: '20260831_172000_agent_14_better_auth_core_mfa',
  },
] as const);

export const AUTH_MIGRATION_LEDGER =
  'portal_auth.perfect_tax_auth_migrations' as const;

type MigrationLedgerQueryable = Readonly<{
  query(
    text: string,
    values: readonly unknown[],
  ): Promise<Readonly<{ rows: readonly Readonly<{ name: string }>[] }>>;
}>;

/** A fixed, read-only proof that Better Auth's independently owned schema is current. */
export async function verifyPortalAuthMigrationLedger(
  database: MigrationLedgerQueryable,
): Promise<void> {
  const result = await database.query(
    `SELECT name
       FROM portal_auth.perfect_tax_auth_migrations
      WHERE name = ANY($1::text[])`,
    [AUTH_MIGRATIONS.map(({ name }) => name)],
  );
  const applied = new Set(result.rows.map(({ name }) => name));
  if (!AUTH_MIGRATIONS.every(({ name }) => applied.has(name))) {
    throw new Error('portal-auth-schema-unavailable');
  }
}
