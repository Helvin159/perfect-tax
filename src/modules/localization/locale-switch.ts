import { isSupportedLocale, type Locale } from './locales';

type SafeQueryRule = Readonly<{
  maxLength: number;
  reason: string;
}>;

/**
 * Only non-sensitive, campaign-attribution values are allowed to cross a
 * locale change. Values are deliberately constrained to a small ASCII subset
 * so identifiers, URLs, free text, and credentials cannot be smuggled through.
 */
export const LOCALE_SWITCH_QUERY_ALLOWLIST = Object.freeze({
  ref: {
    maxLength: 64,
    reason: 'Non-personal campaign or partner attribution code.',
  },
  utm_campaign: {
    maxLength: 80,
    reason: 'Non-personal marketing campaign attribution.',
  },
  utm_medium: {
    maxLength: 40,
    reason: 'Non-personal marketing channel attribution.',
  },
  utm_source: {
    maxLength: 40,
    reason: 'Non-personal marketing source attribution.',
  },
}) satisfies Readonly<Record<string, SafeQueryRule>>;

export type LocaleSwitchQueryParameter =
  keyof typeof LOCALE_SWITCH_QUERY_ALLOWLIST;

const SAFE_ATTRIBUTION_VALUE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function isSafeQueryValue(value: string, rule: SafeQueryRule): boolean {
  return (
    value.length > 0 &&
    value.length <= rule.maxLength &&
    SAFE_ATTRIBUTION_VALUE.test(value)
  );
}

export function allowlistedLocaleSwitchQuery(
  query: URLSearchParams | string,
): URLSearchParams {
  const input =
    typeof query === 'string'
      ? new URLSearchParams(query.startsWith('?') ? query.slice(1) : query)
      : query;
  const safe = new URLSearchParams();

  for (const [name, rule] of Object.entries(LOCALE_SWITCH_QUERY_ALLOWLIST)) {
    const value = input.get(name);
    if (value !== null && isSafeQueryValue(value, rule)) {
      safe.set(name, value);
    }
  }

  return safe;
}

export type EquivalentLocalePathInput = Readonly<{
  pathname: string;
  query?: URLSearchParams | string;
  targetLocale: Locale;
}>;

export function buildEquivalentLocalePath({
  pathname,
  query = '',
  targetLocale,
}: EquivalentLocalePathInput): string {
  const segments = pathname.split('/');
  const currentLocale = segments[1];

  if (!pathname.startsWith('/') || !isSupportedLocale(currentLocale)) {
    return `/${targetLocale}`;
  }

  segments[1] = targetLocale;
  const localizedPath = segments.join('/') || `/${targetLocale}`;
  const safeQuery = allowlistedLocaleSwitchQuery(query).toString();

  return safeQuery ? `${localizedPath}?${safeQuery}` : localizedPath;
}

export function buildLocaleSwitchRequestHref(
  targetLocale: Locale,
  destination: string,
): string {
  const query = new URLSearchParams({
    locale: targetLocale,
    path: destination,
  });
  return `/api/locale?${query.toString()}`;
}

/** Revalidates the client-built destination at the cookie-writing boundary. */
export function sanitizeLocaleSwitchDestination(
  destination: string | null,
  targetLocale: Locale,
): string {
  if (!destination) return `/${targetLocale}`;

  let parsed: URL;
  try {
    parsed = new URL(destination, 'https://locale-switch.invalid');
  } catch {
    return `/${targetLocale}`;
  }

  if (
    parsed.origin !== 'https://locale-switch.invalid' ||
    !parsed.pathname.startsWith(`/${targetLocale}`) ||
    (parsed.pathname.length > targetLocale.length + 1 &&
      parsed.pathname[targetLocale.length + 1] !== '/')
  ) {
    return `/${targetLocale}`;
  }

  return buildEquivalentLocalePath({
    pathname: parsed.pathname,
    query: parsed.searchParams,
    targetLocale,
  });
}

export const UNSAVED_LOCALE_STATE_SELECTOR = '[data-unsaved-state="true"]';

export function canContinueLocaleSwitch(
  hasUnsavedState: boolean,
  confirmDiscard: () => boolean,
): boolean {
  return !hasUnsavedState || confirmDiscard();
}
