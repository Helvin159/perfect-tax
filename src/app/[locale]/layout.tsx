import type { Viewport } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';

import {
  isSupportedLocale,
  SUPPORTED_LOCALES,
} from '@/modules/localization/locales';
import { PWA_THEME_COLOR } from '@/modules/pwa/constants';

import '../globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: PWA_THEME_COLOR,
};

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

type LocaleLayoutProps = Readonly<{
  children: ReactNode;
  params: Promise<{ locale: string }>;
}>;

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;

  if (!isSupportedLocale(locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
