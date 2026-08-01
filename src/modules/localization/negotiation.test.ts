import { describe, expect, it } from 'vitest';

import {
  matchBestLocale,
  selectRequestLocale,
  selectRootRedirectLocale,
} from './negotiation';

describe('locale negotiation', () => {
  it('uses a supported profile preference before anonymous fallbacks', () => {
    expect(
      selectRootRedirectLocale({
        profileLocale: 'es',
        cookieLocale: 'en',
        acceptLanguage: 'en-US',
      }),
    ).toEqual({ locale: 'es', source: 'profile' });
  });

  it('selects the locale cookie at the root', () => {
    expect(
      selectRootRedirectLocale({
        cookieLocale: 'es',
        acceptLanguage: 'en-US',
      }),
    ).toEqual({ locale: 'es', source: 'cookie' });
  });

  it('ignores an unsupported cookie and uses Accept-Language', () => {
    expect(
      selectRootRedirectLocale({
        cookieLocale: 'fr',
        acceptLanguage: 'es-MX, es;q=0.9, en;q=0.8',
      }),
    ).toEqual({ locale: 'es', source: 'accept-language' });
  });

  it('honors Accept-Language quality weights', () => {
    expect(matchBestLocale('es;q=0.5, en-US;q=0.9')).toBe('en');
  });

  it('falls back to English when no preference matches', () => {
    expect(
      selectRootRedirectLocale({ acceptLanguage: 'fr-CA, de;q=0.8' }),
    ).toEqual({ locale: 'en', source: 'default' });
  });

  it('keeps an explicit locale-prefixed URL authoritative', () => {
    expect(
      selectRequestLocale({
        pathname: '/es/portal',
        profileLocale: 'en',
        cookieLocale: 'en',
        acceptLanguage: 'en-US',
      }),
    ).toEqual({ locale: 'es', source: 'url' });
  });

  it('does not infer language from a geographic region subtag', () => {
    expect(matchBestLocale('fr-DO')).toBeUndefined();
    expect(matchBestLocale('en-ES')).toBe('en');
  });
});
