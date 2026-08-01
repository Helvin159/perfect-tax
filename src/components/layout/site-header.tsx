import { Suspense } from 'react';

import type {
  PublicBusinessIdentityV1,
  PublicContactSettingsV1,
} from '@/modules/settings/domain/public-settings';
import { LanguageSwitcher } from '@/modules/localization/presentation/language-switcher';
import type { Locale } from '@/modules/localization/locales';
import type { ShellCopy } from '@/modules/localization/shell-copy';
import { getPrimaryContactHref } from '@/modules/public-site/contact-actions';

type ShellSurface = 'auth' | 'portal' | 'public';

type SiteHeaderProps = Readonly<{
  contact: PublicContactSettingsV1;
  copy: ShellCopy;
  identity: PublicBusinessIdentityV1;
  locale: Locale;
  surface: ShellSurface;
}>;

function LanguageSwitcherFallback({ copy }: { copy: ShellCopy }) {
  return (
    <span aria-label={copy.language} className="language-switcher-fallback">
      English · Español
    </span>
  );
}

export function SiteHeader({
  contact,
  copy,
  identity,
  locale,
  surface,
}: SiteHeaderProps) {
  const homeHref = `/${locale}`;
  const contactLink =
    getPrimaryContactHref(contact, locale) ?? `${homeHref}#contact`;
  const publicLinks = [
    { href: homeHref, label: copy.home },
    { href: `${homeHref}#services`, label: copy.services },
    { href: `${homeHref}#contact`, label: copy.contact },
  ];
  const contextualLinks = [
    { href: homeHref, label: copy.backHome },
    { href: contactLink, label: copy.contact },
  ];
  const navigationLinks = surface === 'public' ? publicLinks : contextualLinks;

  return (
    <header className="site-header">
      <div className="shell-container site-header-row">
        <a className="brand-link" href={homeHref}>
          {identity.displayName}
        </a>

        <nav aria-label={copy.mainNavigation} className="desktop-navigation">
          <ul>
            {navigationLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="desktop-actions">
          <Suspense fallback={<LanguageSwitcherFallback copy={copy} />}>
            <LanguageSwitcher
              accessibleName={copy.language}
              currentLocale={locale}
              unsavedStateWarning={
                locale === 'en'
                  ? 'Changing language will leave this page. Discard unsaved changes?'
                  : 'Cambiar el idioma cerrará esta página. ¿Descartar los cambios no guardados?'
              }
            />
          </Suspense>
          {surface === 'public' ? (
            <a className="button button-secondary" href={`/${locale}/sign-in`}>
              {copy.signIn}
            </a>
          ) : null}
          <a className="button button-primary" href={contactLink}>
            {copy.contact}
          </a>
        </div>

        <details className="mobile-navigation">
          <summary>{copy.openMenu}</summary>
          <div className="mobile-navigation-panel">
            <nav aria-label={copy.mobileNavigation}>
              <ul>
                {navigationLinks.map((link) => (
                  <li key={link.href}>
                    <a href={link.href}>{link.label}</a>
                  </li>
                ))}
                {surface === 'public' ? (
                  <li>
                    <a href={`/${locale}/sign-in`}>{copy.signIn}</a>
                  </li>
                ) : null}
              </ul>
            </nav>
            <Suspense fallback={<LanguageSwitcherFallback copy={copy} />}>
              <LanguageSwitcher
                accessibleName={copy.language}
                currentLocale={locale}
                unsavedStateWarning={
                  locale === 'en'
                    ? 'Changing language will leave this page. Discard unsaved changes?'
                    : 'Cambiar el idioma cerrará esta página. ¿Descartar los cambios no guardados?'
                }
              />
            </Suspense>
            <a className="button button-primary" href={contactLink}>
              {copy.contact}
            </a>
          </div>
        </details>
      </div>
    </header>
  );
}
