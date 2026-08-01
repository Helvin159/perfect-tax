import {
  DEFAULT_LOCALE,
  getSupportedLocale,
  SUPPORTED_LOCALES,
  type Locale,
} from './locales';

const LANGUAGE_RANGE_PATTERN = /^(?:\*|[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*)$/;

type AcceptedLanguage = Readonly<{
  order: number;
  quality: number;
  range: string;
}>;

function parseQuality(parameters: readonly string[]): number | undefined {
  const qualityParameter = parameters.find((parameter) =>
    parameter.trim().toLowerCase().startsWith('q='),
  );

  if (!qualityParameter) {
    return 1;
  }

  const quality = Number(qualityParameter.trim().slice(2));

  return Number.isFinite(quality) && quality >= 0 && quality <= 1
    ? quality
    : undefined;
}

function parseAcceptLanguage(value: string): AcceptedLanguage[] {
  return value
    .split(',')
    .map((entry, order) => {
      const [rawRange, ...parameters] = entry.split(';');
      const range = rawRange?.trim().toLowerCase() ?? '';
      const quality = parseQuality(parameters);

      if (!LANGUAGE_RANGE_PATTERN.test(range) || quality === undefined) {
        return undefined;
      }

      return { order, quality, range };
    })
    .filter((entry): entry is AcceptedLanguage => entry !== undefined)
    .sort(
      (left, right) => right.quality - left.quality || left.order - right.order,
    );
}

function getPrimaryLanguage(range: string) {
  return range.split('-')[0];
}

export function matchBestLocale(
  acceptLanguage: string | null | undefined,
): Locale | undefined {
  if (!acceptLanguage?.trim()) {
    return undefined;
  }

  const acceptedLanguages = parseAcceptLanguage(acceptLanguage);
  const rejectedLanguages = new Set(
    acceptedLanguages
      .filter(({ quality }) => quality === 0)
      .map(({ range }) => getPrimaryLanguage(range)),
  );

  for (const { quality, range } of acceptedLanguages) {
    if (quality === 0) {
      continue;
    }

    if (range === '*') {
      return SUPPORTED_LOCALES.find((locale) => !rejectedLanguages.has(locale));
    }

    const exactLocale = getSupportedLocale(range);

    if (exactLocale) {
      return exactLocale;
    }

    const primaryLocale = getSupportedLocale(getPrimaryLanguage(range));

    if (primaryLocale) {
      return primaryLocale;
    }
  }

  return undefined;
}

export type LocaleSelectionSource =
  'url' | 'profile' | 'cookie' | 'accept-language' | 'default';

export type LocaleSelection = Readonly<{
  locale: Locale;
  source: LocaleSelectionSource;
}>;

export type LocaleSelectionInput = Readonly<{
  pathname: string;
  profileLocale?: unknown;
  cookieLocale?: unknown;
  acceptLanguage?: string | null;
}>;

function selection(
  locale: Locale,
  source: LocaleSelectionSource,
): LocaleSelection {
  return Object.freeze({ locale, source });
}

export function selectRequestLocale({
  pathname,
  profileLocale,
  cookieLocale,
  acceptLanguage,
}: LocaleSelectionInput): LocaleSelection {
  const routeLocale = pathname.startsWith('/')
    ? getSupportedLocale(pathname.split('/')[1])
    : undefined;

  if (routeLocale) {
    return selection(routeLocale, 'url');
  }

  const supportedProfileLocale = getSupportedLocale(profileLocale);

  if (supportedProfileLocale) {
    return selection(supportedProfileLocale, 'profile');
  }

  const supportedCookieLocale = getSupportedLocale(cookieLocale);

  if (supportedCookieLocale) {
    return selection(supportedCookieLocale, 'cookie');
  }

  const matchedHeaderLocale = matchBestLocale(acceptLanguage);

  if (matchedHeaderLocale) {
    return selection(matchedHeaderLocale, 'accept-language');
  }

  return selection(DEFAULT_LOCALE, 'default');
}

export type RootRedirectLocaleInput = Omit<LocaleSelectionInput, 'pathname'>;

export function selectRootRedirectLocale(
  input: RootRedirectLocaleInput,
): LocaleSelection {
  return selectRequestLocale({ pathname: '/', ...input });
}
