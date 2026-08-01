import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { SharedShell } from '@/components/layout/shared-shell';
import { getSupportedLocale } from '@/modules/localization/locales';

type PublicLayoutProps = Readonly<{
  children: ReactNode;
  params: Promise<{ locale: string }>;
}>;

export default async function PublicLayout({
  children,
  params,
}: PublicLayoutProps) {
  const locale = getSupportedLocale((await params).locale);
  if (!locale) notFound();

  return (
    <SharedShell locale={locale} surface="public">
      {children}
    </SharedShell>
  );
}
