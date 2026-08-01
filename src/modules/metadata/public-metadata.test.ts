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
  getPublicHomepageContent: vi.fn(),
}));

import { buildPublicPageMetadata } from './public-metadata';

const identity = {
  schemaVersion: 1,
  locale: 'en',
  displayName: 'Configurable Name',
  shortName: 'Config Name',
} as const;

describe('public metadata', () => {
  it('builds localized titles and descriptions from identity-driven naming', () => {
    const metadata = buildPublicPageMetadata({
      identity,
      locale: 'es',
      page: 'sign-in',
      siteUrl: 'https://example.com',
      title: 'Iniciar sesión',
      description: 'Descripción localizada.',
    });

    expect(metadata.title).toBe('Iniciar sesión | Configurable Name');
    expect(metadata.description).toBe('Descripción localizada.');
    expect(metadata.applicationName).toBe('Configurable Name');
    expect(metadata.openGraph?.siteName).toBe('Configurable Name');
  });

  it('uses canonical URLs and hreflang alternates for every supported locale', () => {
    const metadata = buildPublicPageMetadata({
      identity,
      locale: 'en',
      page: 'privacy',
      siteUrl: 'https://example.com',
      title: 'Privacy notice',
      description: 'Privacy metadata.',
    });

    expect(metadata.alternates?.canonical).toBe(
      'https://example.com/en/privacy',
    );
    expect(metadata.alternates?.languages).toEqual({
      en: 'https://example.com/en/privacy',
      es: 'https://example.com/es/privacy',
      'x-default': 'https://example.com/en/privacy',
    });
    expect(metadata.openGraph?.url).toBe('https://example.com/en/privacy');
    expect(metadata.openGraph?.locale).toBe('en_US');
    expect(metadata.openGraph?.alternateLocale).toEqual(['es_ES']);
  });

  it('does not bake the initial public brand into the helper fallback behavior', () => {
    const metadata = buildPublicPageMetadata({
      identity: { ...identity, displayName: 'Another Public Brand' },
      locale: 'en',
      page: 'home',
      siteUrl: 'https://example.com',
      title: 'Service support | Another Public Brand',
      description: 'Safe fallback copy.',
    });

    expect(JSON.stringify(metadata)).not.toContain('Perfect Tax');
    expect(metadata.openGraph?.siteName).toBe('Another Public Brand');
  });
});
