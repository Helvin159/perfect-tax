import { notFound } from 'next/navigation';

import { getSupportedLocale } from '@/modules/localization/locales';
import { getPublicPageMetadata } from '@/modules/metadata/public-metadata';
import { LegalPlaceholder } from '@/modules/public-site/presentation/legal-placeholder';

type TermsPageProps = Readonly<{
  params: Promise<{ locale: string }>;
}>;

export async function generateMetadata({ params }: TermsPageProps) {
  const locale = getSupportedLocale((await params).locale);
  if (!locale) return {};

  return getPublicPageMetadata(locale, 'terms');
}

export default async function TermsPage({ params }: TermsPageProps) {
  const locale = getSupportedLocale((await params).locale);
  if (!locale) notFound();

  return <LegalPlaceholder document="terms" locale={locale} />;
}
