import { getSupportedLocale, type Locale } from './locales';

export const LOCALE_COOKIE_NAME = 'CLIENT_SERVICES_LOCALE';

export type LocaleCookieOptions = Readonly<{
  httpOnly: true;
  maxAge: number;
  path: '/';
  sameSite: 'lax';
  secure: boolean;
}>;

export function readLocaleCookie(value: unknown): Locale | undefined {
  return getSupportedLocale(value);
}

export function getLocaleCookieOptions(
  secure = process.env.NODE_ENV === 'production',
): LocaleCookieOptions {
  return Object.freeze({
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
    sameSite: 'lax',
    secure,
  });
}
