import { notFound } from 'next/navigation';

import { getSupportedLocale } from '@/modules/localization/locales';
import { getPublicPageMetadata } from '@/modules/metadata/public-metadata';
import { AvailabilityPlaceholder } from '@/modules/public-site/presentation/availability-placeholder';
import {
  getPublicContactSettings,
  getPublicPortalSettings,
} from '@/modules/settings/public';

type SignInPageProps = Readonly<{
  params: Promise<{ locale: string }>;
}>;

export async function generateMetadata({ params }: SignInPageProps) {
  const locale = getSupportedLocale((await params).locale);
  if (!locale) return {};

  return getPublicPageMetadata(locale, 'sign-in');
}

export default async function SignInPage({ params }: SignInPageProps) {
  const locale = getSupportedLocale((await params).locale);
  if (!locale) notFound();
  const [contact, portal] = await Promise.all([
    getPublicContactSettings(locale),
    getPublicPortalSettings(locale),
  ]);

  return (
    <AvailabilityPlaceholder
      contact={contact}
      locale={locale}
      portal={portal}
      surface="sign-in"
    />
  );
}
