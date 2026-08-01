import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { SharedShell } from '@/components/layout/shared-shell';
import { getSupportedLocale } from '@/modules/localization/locales';

type PortalLayoutProps = Readonly<{
  children: ReactNode;
  params: Promise<{ locale: string }>;
}>;

export default async function PortalLayout({
  children,
  params,
}: PortalLayoutProps) {
  const locale = getSupportedLocale((await params).locale);
  if (!locale) notFound();

  return (
    <SharedShell locale={locale} surface="portal">
      {children}
    </SharedShell>
  );
}
