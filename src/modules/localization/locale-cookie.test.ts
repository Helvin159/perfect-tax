import { describe, expect, it } from 'vitest';

import {
  getLocaleCookieOptions,
  LOCALE_COOKIE_NAME,
  readLocaleCookie,
} from './locale-cookie';

describe('locale cookie contract', () => {
  it('uses a dedicated non-personal locale cookie name', () => {
    expect(LOCALE_COOKIE_NAME).toBe('CLIENT_SERVICES_LOCALE');
  });

  it('accepts only supported locale values', () => {
    expect(readLocaleCookie('es')).toBe('es');
    expect(readLocaleCookie('en')).toBe('en');
    expect(readLocaleCookie('fr')).toBeUndefined();
  });

  it('uses server-only, same-site cookie defaults', () => {
    expect(getLocaleCookieOptions(true)).toEqual({
      httpOnly: true,
      maxAge: 31_536_000,
      path: '/',
      sameSite: 'lax',
      secure: true,
    });
  });
});
