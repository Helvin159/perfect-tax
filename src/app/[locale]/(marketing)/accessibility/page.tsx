import { notFound } from 'next/navigation';

import { getSupportedLocale } from '@/modules/localization/locales';
import { getPublicPageMetadata } from '@/modules/metadata/public-metadata';
import { LegalPlaceholder } from '@/modules/public-site/presentation/legal-placeholder';

type AccessibilityPageProps = Readonly<{
  params: Promise<{ locale: string }>;
}>;

export async function generateMetadata({ params }: AccessibilityPageProps) {
  const locale = getSupportedLocale((await params).locale);
  if (!locale) return {};

  return getPublicPageMetadata(locale, 'accessibility');
}

export default async function AccessibilityPage({
  params,
}: AccessibilityPageProps) {
  const locale = getSupportedLocale((await params).locale);
  if (!locale) notFound();

  return <LegalPlaceholder document="accessibility" locale={locale} />;
}
