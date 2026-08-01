import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  parseServerEnvironment,
  ServerEnvironmentError,
} from '@/config/env/server';

const validEnvironment = {
  DATABASE_URL:
    'postgresql://client_services_portal:local-only@localhost:5432/client_services_portal',
  PAYLOAD_SECRET: 'unit-test-only-not-a-secret-0123456789abcdef',
  SITE_URL: 'http://localhost:3000',
};

describe('parseServerEnvironment', () => {
  it('returns an immutable, typed server configuration', () => {
    const environment = parseServerEnvironment(validEnvironment);

    expect(environment).toEqual(validEnvironment);
    expect(Object.isFrozen(environment)).toBe(true);
  });

  it.each([
    ['DATABASE_URL', 'mysql://localhost/client_services_portal'],
    ['DATABASE_URL', 'not-a-url'],
    ['PAYLOAD_SECRET', 'too-short'],
    ['PAYLOAD_SECRET', 'replace-with-output-of-openssl-rand-base64-48'],
    ['SITE_URL', 'https://example.com/configuration'],
    ['SITE_URL', 'https://user:password@example.com'],
  ] as const)('rejects an invalid %s value', (name, value) => {
    expect(() =>
      parseServerEnvironment({ ...validEnvironment, [name]: value }),
    ).toThrow(ServerEnvironmentError);
  });

  it('reports all missing variables without including their values', () => {
    let error: unknown;

    try {
      parseServerEnvironment({});
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ServerEnvironmentError);
    expect((error as ServerEnvironmentError).issues).toEqual([
      'DATABASE_URL is required',
      'PAYLOAD_SECRET is required',
      'SITE_URL is required',
    ]);
  });
});
