export const SUPPORTED_LOCALES = ['en', 'es'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

const supportedLocaleSet = new Set<string>(SUPPORTED_LOCALES);

export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === 'string' && supportedLocaleSet.has(value);
}

export function getSupportedLocale(value: unknown): Locale | undefined {
  return isSupportedLocale(value) ? value : undefined;
}

export function extractRouteLocale(pathname: string): Locale | undefined {
  if (!pathname.startsWith('/')) {
    return undefined;
  }

  const [, localeSegment] = pathname.split('/');

  return getSupportedLocale(localeSegment);
}
