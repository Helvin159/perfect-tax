import { notFound } from 'next/navigation';

import { getPublicServices } from '@/modules/content/public';
import { getSupportedLocale } from '@/modules/localization/locales';
import { getHomepageMetadata } from '@/modules/metadata/public-metadata';
import { Homepage } from '@/modules/public-site/presentation/homepage';
import {
  getPublicContactSettings,
  getPublicHomepageContent,
} from '@/modules/settings/public';

type LocalePageProps = Readonly<{
  params: Promise<{ locale: string }>;
}>;

export async function generateMetadata({ params }: LocalePageProps) {
  const locale = getSupportedLocale((await params).locale);
  if (!locale) return {};

  return getHomepageMetadata(locale);
}

export default async function LocalePage({ params }: LocalePageProps) {
  const locale = getSupportedLocale((await params).locale);
  if (!locale) notFound();

  const [contact, content, services] = await Promise.all([
    getPublicContactSettings(locale),
    getPublicHomepageContent(locale),
    getPublicServices(locale),
  ]);

  return (
    <Homepage
      contact={contact}
      content={content}
      locale={locale}
      services={services}
    />
  );
}
