import { defineRouting } from 'next-intl/routing';

import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './locales';

export const routing = defineRouting({
  alternateLinks: false,
  defaultLocale: DEFAULT_LOCALE,
  localeCookie: false,
  localeDetection: false,
  localePrefix: 'always',
  locales: SUPPORTED_LOCALES,
});
