import { notFound } from 'next/navigation';

import { getSupportedLocale } from '@/modules/localization/locales';
import { getPublicPageMetadata } from '@/modules/metadata/public-metadata';
import { LegalPlaceholder } from '@/modules/public-site/presentation/legal-placeholder';

type PrivacyPageProps = Readonly<{
  params: Promise<{ locale: string }>;
}>;

export async function generateMetadata({ params }: PrivacyPageProps) {
  const locale = getSupportedLocale((await params).locale);
  if (!locale) return {};

  return getPublicPageMetadata(locale, 'privacy');
}

export default async function PrivacyPage({ params }: PrivacyPageProps) {
  const locale = getSupportedLocale((await params).locale);
  if (!locale) notFound();

  return <LegalPlaceholder document="privacy" locale={locale} />;
}
