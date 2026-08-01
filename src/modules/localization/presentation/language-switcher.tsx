'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import type { MouseEvent } from 'react';

import {
  buildEquivalentLocalePath,
  buildLocaleSwitchRequestHref,
  canContinueLocaleSwitch,
  UNSAVED_LOCALE_STATE_SELECTOR,
} from '../locale-switch';
import type { Locale } from '../locales';

type LanguageSwitcherProps = Readonly<{
  accessibleName: string;
  currentLocale: Locale;
  unsavedStateWarning: string;
}>;

const LANGUAGE_OPTIONS = [
  { label: 'English', locale: 'en' },
  { label: 'Español', locale: 'es' },
] as const;

export function LanguageSwitcher({
  accessibleName,
  currentLocale,
  unsavedStateWarning,
}: LanguageSwitcherProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function guardUnsavedState(event: MouseEvent<HTMLAnchorElement>) {
    const hasUnsavedState = Boolean(
      document.querySelector(UNSAVED_LOCALE_STATE_SELECTOR),
    );
    if (
      !canContinueLocaleSwitch(hasUnsavedState, () =>
        window.confirm(unsavedStateWarning),
      )
    ) {
      event.preventDefault();
    }
  }

  return (
    <nav aria-label={accessibleName} className="language-switcher">
      <ul>
        {LANGUAGE_OPTIONS.map(({ label, locale }) => {
          const destination = buildEquivalentLocalePath({
            pathname,
            query: searchParams.toString(),
            targetLocale: locale,
          });

          return (
            <li key={locale}>
              <a
                aria-current={locale === currentLocale ? 'page' : undefined}
                href={buildLocaleSwitchRequestHref(locale, destination)}
                hrefLang={locale}
                lang={locale}
                onClick={guardUnsavedState}
              >
                {label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
