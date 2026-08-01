import { Suspense } from 'react';

import { LanguageSwitcher } from '@/modules/localization/presentation/language-switcher';
import type { Locale } from '@/modules/localization/locales';
import type { ShellCopy } from '@/modules/localization/shell-copy';
import { getPublicContactActions } from '@/modules/public-site/contact-actions';
import { getPublicSiteCopy } from '@/modules/public-site/copy';
import type {
  PublicBusinessIdentityV1,
  PublicContactSettingsV1,
} from '@/modules/settings/domain/public-settings';

type SiteFooterProps = Readonly<{
  contact: PublicContactSettingsV1;
  copy: ShellCopy;
  footerCopy?: string;
  identity: PublicBusinessIdentityV1;
  locale: Locale;
}>;

export function SiteFooter({
  contact,
  copy,
  footerCopy,
  identity,
  locale,
}: SiteFooterProps) {
  const safetyCopy = contact.safetyInstructions ?? copy.contactSafety;
  const actions = getPublicContactActions(contact, locale);
  const publicCopy = getPublicSiteCopy(locale);
  const includesWrittenChannel = actions.some(
    ({ channel }) => channel === 'email' || channel === 'whatsapp',
  );

  return (
    <footer className="site-footer" id="contact">
      <div className="shell-container footer-grid">
        <section aria-labelledby="footer-identity-heading">
          <h2 id="footer-identity-heading">{identity.displayName}</h2>
          {identity.tagline ? <p>{identity.tagline}</p> : null}
          {identity.disclaimer ? (
            <p className="footer-disclaimer">{identity.disclaimer}</p>
          ) : null}
          <p>{footerCopy ?? publicCopy.defaultFooter}</p>
        </section>

        <section aria-labelledby="footer-contact-heading">
          <h2 id="footer-contact-heading">{copy.contact}</h2>
          <address>
            <ul className="footer-links">
              {actions.map((action) => (
                <li key={action.channel}>
                  <a
                    href={action.href}
                    rel={
                      action.channel === 'whatsapp' ? 'noreferrer' : undefined
                    }
                  >
                    {action.displayValue}
                  </a>
                </li>
              ))}
            </ul>
          </address>
          {actions.length ? null : (
            <p className="contact-unavailable">{publicCopy.cta.noChannels}</p>
          )}
          {includesWrittenChannel ? (
            <p className="channel-safety-copy">{safetyCopy}</p>
          ) : null}
        </section>

        <section aria-labelledby="footer-links-heading">
          <h2 id="footer-links-heading">{copy.footerNavigation}</h2>
          <nav aria-label={copy.footerNavigation}>
            <ul className="footer-links">
              <li>
                <a href={`/${locale}/privacy`}>{copy.privacy}</a>
              </li>
              <li>
                <a href={`/${locale}/terms`}>{copy.terms}</a>
              </li>
              <li>
                <a href={`/${locale}/accessibility`}>{copy.accessibility}</a>
              </li>
            </ul>
          </nav>
          <Suspense fallback={<span>{copy.language}</span>}>
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
        </section>
      </div>
    </footer>
  );
}
