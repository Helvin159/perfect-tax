import { describe, expect, it } from 'vitest';

import {
  extractRouteLocale,
  getSupportedLocale,
  isSupportedLocale,
} from './locales';
import { routing } from './routing';

describe('locale recognition', () => {
  it.each(['en', 'es'])('recognizes supported locale %s', (locale) => {
    expect(isSupportedLocale(locale)).toBe(true);
    expect(getSupportedLocale(locale)).toBe(locale);
  });

  it.each(['fr', 'EN', '', undefined, null])(
    'rejects unsupported locale %s',
    (locale) => {
      expect(isSupportedLocale(locale)).toBe(false);
      expect(getSupportedLocale(locale)).toBeUndefined();
    },
  );

  it('extracts only a supported leading route locale', () => {
    expect(extractRouteLocale('/es/account')).toBe('es');
    expect(extractRouteLocale('/en')).toBe('en');
    expect(extractRouteLocale('/fr/account')).toBeUndefined();
    expect(extractRouteLocale('/account/es')).toBeUndefined();
  });

  it('leaves page alternates to localized metadata instead of non-page middleware headers', () => {
    expect(routing.alternateLinks).toBe(false);
  });
});
