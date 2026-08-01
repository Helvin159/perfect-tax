import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { SanitizedConfig } from 'payload';

let config: SanitizedConfig;
let databaseSchemaPush: boolean;

describe('Payload configuration', () => {
  beforeAll(async () => {
    vi.stubEnv(
      'DATABASE_URL',
      'postgresql://cms_test:cms_test@localhost:5432/client_services_portal_test',
    );
    vi.stubEnv(
      'PAYLOAD_SECRET',
      'configuration-test-only-secret-0123456789abcdef',
    );
    vi.stubEnv('SITE_URL', 'http://localhost:3000');

    const configModule = await import('../../../payload.config');
    config = await configModule.default;
    databaseSchemaPush = configModule.PAYLOAD_DATABASE_SCHEMA_PUSH;
  });

  it('uses the dedicated auth collection and required routes', () => {
    expect(config.admin.user).toBe('cms-users');
    expect(config.routes.admin).toBe('/admin');
    expect(config.routes.api).toBe('/api/cms');
    expect(config.admin.routes.createFirstUser).toBe('/bootstrap-required');
    expect(config.admin.routes.forgot).toBe('/recovery-unavailable');
  });

  it('configures English and Spanish without content fallback', () => {
    expect(config.localization).toMatchObject({
      defaultLocale: 'en',
      fallback: false,
      localeCodes: ['en', 'es'],
    });
  });

  it('disables GraphQL and PostgreSQL schema push', () => {
    expect(config.graphQL.disable).toBe(true);
    expect(config.db.name).toBe('postgres');
    expect(databaseSchemaPush).toBe(false);
    expect(config.typescript.autoGenerate).toBe(false);
  });

  it('enables lockout behavior for CmsUsers', () => {
    const collection = config.collections.find(
      ({ slug }) => slug === 'cms-users',
    );

    expect(collection?.auth).toMatchObject({
      lockTime: 30 * 60 * 1000,
      maxLoginAttempts: 5,
      removeTokenFromResponses: true,
      useAPIKey: false,
    });
  });

  it('registers only the focused Task 5 public CMS objects', () => {
    expect(config.globals.map(({ slug }) => slug)).toEqual([
      'business-identity',
      'contact-settings',
      'portal-settings',
      'homepage-content',
    ]);
    expect(config.collections.map(({ slug }) => slug)).toEqual(
      expect.arrayContaining(['cms-users', 'services', 'public-media']),
    );
    expect(config.collections.map(({ slug }) => slug)).not.toEqual(
      expect.arrayContaining(['documents', 'client-documents']),
    );
  });

  it('uses Payload drafts and versions for public content history', () => {
    for (const slug of ['services', 'public-media']) {
      const collection = config.collections.find(
        (entry) => entry.slug === slug,
      );
      expect(collection?.versions).toMatchObject({ drafts: {} });
    }
    for (const slug of [
      'business-identity',
      'contact-settings',
      'portal-settings',
      'homepage-content',
    ]) {
      const global = config.globals.find((entry) => entry.slug === slug);
      expect(global?.versions).toMatchObject({ drafts: {} });
    }
  });
});
