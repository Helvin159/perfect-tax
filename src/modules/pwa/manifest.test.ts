import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/config/env/server', () => ({
  getServerEnvironment: () => ({
    DATABASE_URL: 'postgresql://user:password@localhost:5432/app',
    PAYLOAD_SECRET: 'test-secret-that-is-long-enough-for-runtime',
    SITE_URL: 'https://example.com',
  }),
}));
vi.mock('@/modules/settings/public', () => ({
  getPublicBusinessIdentity: vi.fn(),
}));

import { buildWebManifest } from './manifest';

describe('web manifest', () => {
  it('uses configurable identity names and a stable neutral technical id', () => {
    const manifest = buildWebManifest({
      identity: {
        schemaVersion: 1,
        locale: 'en',
        displayName: 'Configured Public Name',
        shortName: 'Configured',
      },
      locale: 'en',
      siteUrl: 'https://example.com',
    });

    expect(manifest.id).toBe('client-services-portal');
    expect(manifest.name).toBe('Configured Public Name');
    expect(manifest.short_name).toBe('Configured');
    expect(JSON.stringify(manifest)).not.toContain('Perfect Tax');
  });

  it('localizes supported manifest description fallback and start URL', () => {
    const manifest = buildWebManifest({
      identity: {
        schemaVersion: 1,
        locale: 'es',
        displayName: 'Nombre Público',
      },
      locale: 'es',
      siteUrl: 'https://example.com',
    });

    expect(manifest.lang).toBe('es');
    expect(manifest.start_url).toBe('https://example.com/es');
    expect(manifest.description).toContain('Reciba ayuda práctica');
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: '/app-icon.svg', purpose: 'any' }),
        expect.objectContaining({
          src: '/app-icon-maskable.svg',
          purpose: 'maskable',
        }),
      ]),
    );
  });
});
