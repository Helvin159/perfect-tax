import { describe, expect, it } from 'vitest';

import {
  CmsBootstrapValidationError,
  parseCmsBootstrapCredentials,
} from './credentials';

describe('CMS bootstrap credential validation', () => {
  it('normalizes a valid email and preserves a strong password', () => {
    const credentials = parseCmsBootstrapCredentials({
      email: ' Admin@Example.COM ',
      password: 'Long-local-only!Passphrase-2026',
    });

    expect(credentials).toEqual({
      email: 'admin@example.com',
      password: 'Long-local-only!Passphrase-2026',
    });
    expect(Object.isFrozen(credentials)).toBe(true);
  });

  it.each([
    { email: '', password: '' },
    { email: 'not-an-email', password: 'Long-local-only!Passphrase-2026' },
    { email: 'admin@example.com', password: 'short' },
    { email: 'admin@example.com', password: 'alllowercaseandlong' },
    { email: 'admin@example.com', password: 'Admin-account!Password-2026' },
  ])('rejects missing or weak credentials', (credentials) => {
    expect(() => parseCmsBootstrapCredentials(credentials)).toThrow(
      CmsBootstrapValidationError,
    );
  });

  it('does not include a rejected password in validation errors', () => {
    const password = 'sensitive-rejected-value';

    expect(() =>
      parseCmsBootstrapCredentials({ email: 'admin@example.com', password }),
    ).toThrowError(expect.not.stringContaining(password));
  });
});
