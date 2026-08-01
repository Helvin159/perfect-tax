import type { ReactNode } from 'react';

import { getShellCopy } from '@/modules/localization/shell-copy';
import type { Locale } from '@/modules/localization/locales';
import {
  getPublicBusinessIdentity,
  getPublicContactSettings,
  getPublicHomepageContent,
} from '@/modules/settings/public';

import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';

type ShellSurface = 'auth' | 'portal' | 'public';

type SharedShellProps = Readonly<{
  children: ReactNode;
  locale: Locale;
  surface: ShellSurface;
}>;

export async function SharedShell({
  children,
  locale,
  surface,
}: SharedShellProps) {
  const [identity, contact, homepage] = await Promise.all([
    getPublicBusinessIdentity(locale),
    getPublicContactSettings(locale),
    getPublicHomepageContent(locale),
  ]);
  const copy = getShellCopy(locale);

  return (
    <div className={`app-shell app-shell-${surface}`}>
      <a className="skip-link" href="#main-content">
        {copy.skipToContent}
      </a>
      <SiteHeader
        contact={contact}
        copy={copy}
        identity={identity}
        locale={locale}
        surface={surface}
      />
      <main className="shell-main" id="main-content" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter
        contact={contact}
        copy={copy}
        identity={identity}
        locale={locale}
        footerCopy={homepage.footerCopy}
      />
    </div>
  );
}
