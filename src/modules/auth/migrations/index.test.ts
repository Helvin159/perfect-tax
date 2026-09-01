import { describe, expect, it, vi } from 'vitest';

import { AUTH_MIGRATIONS, verifyPortalAuthMigrationLedger } from './index';

describe('Better Auth migration ledger readiness', () => {
  it('uses a fixed bound query and accepts precisely the required ledger state', async () => {
    const query = vi.fn(async () => ({
      rows: AUTH_MIGRATIONS.map(({ name }) => ({ name })),
    }));

    await expect(
      verifyPortalAuthMigrationLedger({ query }),
    ).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('FROM portal_auth.perfect_tax_auth_migrations'),
      [AUTH_MIGRATIONS.map(({ name }) => name)],
    );
  });

  it('fails closed when a required Better Auth migration is absent or inaccessible', async () => {
    await expect(
      verifyPortalAuthMigrationLedger({ query: async () => ({ rows: [] }) }),
    ).rejects.toThrow('portal-auth-schema-unavailable');
    await expect(
      verifyPortalAuthMigrationLedger({
        query: async () => {
          throw new Error('permission denied');
        },
      }),
    ).rejects.toThrow('permission denied');
  });
});
