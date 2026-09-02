import { describe, expect, it } from 'vitest';

import {
  parsePortalAuthEnvironment,
  PortalAuthEnvironmentError,
} from './environment';

const validEnvironment = {
  BETTER_AUTH_SECRET: 'auth-test-only-secret-0123456789abcdef',
  NODE_ENV: 'production',
  PORTAL_AUTH_DATABASE_URL:
    'postgresql://portal_auth:test@localhost:5432/client_services_portal',
  SITE_URL: 'https://portal.example.com',
};

describe('portal auth environment', () => {
  it('derives secure cookies and the one canonical trusted origin', () => {
    expect(parsePortalAuthEnvironment(validEnvironment)).toEqual({
      baseURL: 'https://portal.example.com',
      databaseURL:
        'postgresql://portal_auth:test@localhost:5432/client_services_portal',
      secret: 'auth-test-only-secret-0123456789abcdef',
      secureCookies: true,
    });
  });

  it.each([
    ['PORTAL_AUTH_DATABASE_URL', 'mysql://portal_auth:test@localhost/app'],
    ['PORTAL_AUTH_DATABASE_URL', 'not-a-url'],
    ['BETTER_AUTH_SECRET', 'too-short'],
    ['SITE_URL', 'https://portal.example.com/auth'],
    ['SITE_URL', 'http://portal.example.com'],
  ] as const)('rejects an invalid production %s', (name, value) => {
    expect(() =>
      parsePortalAuthEnvironment({
        ...validEnvironment,
        [name]: value,
      }),
    ).toThrow(PortalAuthEnvironmentError);
  });

  it('permits insecure loopback development while rejecting ambient origins', () => {
    expect(
      parsePortalAuthEnvironment({
        ...validEnvironment,
        NODE_ENV: 'development',
        SITE_URL: 'http://localhost:3001',
      }).secureCookies,
    ).toBe(false);

    expect(() =>
      parsePortalAuthEnvironment({
        ...validEnvironment,
        BETTER_AUTH_TRUSTED_ORIGINS: 'https://attacker.example',
      }),
    ).toThrow(/complete trusted-origin allowlist/);
  });
});
