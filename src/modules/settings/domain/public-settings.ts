import type { PublicContentLocale } from '@/modules/content/workflow/types';

export type PublicMediaV1 = Readonly<{
  schemaVersion: 1;
  altText: string;
  height?: number;
  url: string;
  width?: number;
}>;

export type PublicBusinessIdentityV1 = Readonly<{
  schemaVersion: 1;
  locale: PublicContentLocale;
  displayName: string;
  shortName?: string;
  tagline?: string;
  description?: string;
  serviceAreaDescription?: string;
  disclaimer?: string;
  primaryLogo?: PublicMediaV1;
  compactLogo?: PublicMediaV1;
  rebrandingNotice?: string;
}>;

export type PublicOfficeAddressV1 = Readonly<{
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  countryCode?: string;
}>;

export type PublicBusinessHoursV1 = Readonly<{
  day:
    | 'monday'
    | 'tuesday'
    | 'wednesday'
    | 'thursday'
    | 'friday'
    | 'saturday'
    | 'sunday';
  closed: boolean;
  opensAt?: string;
  closesAt?: string;
}>;

export type PublicContactSettingsV1 = Readonly<{
  schemaVersion: 1;
  locale: PublicContentLocale;
  telephone?: string;
  whatsApp?: string;
  email?: string;
  officeAddress?: PublicOfficeAddressV1;
  businessHours?: readonly PublicBusinessHoursV1[];
  safetyInstructions?: string;
}>;

export type PublicPortalSettingsV1 = Readonly<{
  schemaVersion: 1;
  locale: PublicContentLocale;
  availability: 'unavailable' | 'transitioning' | 'available';
  transitionNotice?: string;
  signInHeading?: string;
  signInMessage?: string;
}>;

export type PublicTextSectionV1 = Readonly<{
  heading?: string;
  body?: string;
}>;

export type PublicHomepageContentV1 = Readonly<{
  schemaVersion: 1;
  locale: PublicContentLocale;
  hero?: Readonly<{
    eyebrow?: string;
    heading?: string;
    body?: string;
  }>;
  servicesIntroduction?: PublicTextSectionV1;
  processSteps?: readonly Readonly<{
    title: string;
    description: string;
  }>[];
  portalIntroduction?: PublicTextSectionV1;
  trustSection?: PublicTextSectionV1;
  callToAction?: Readonly<{
    heading?: string;
    body?: string;
    primaryLabel?: string;
    secondaryLabel?: string;
  }>;
  footerCopy?: string;
}>;

export function fallbackBusinessIdentity(
  locale: PublicContentLocale,
): PublicBusinessIdentityV1 {
  return Object.freeze({
    schemaVersion: 1,
    locale,
    displayName: 'Perfect Tax',
  });
}

export function fallbackContactSettings(
  locale: PublicContentLocale,
): PublicContactSettingsV1 {
  return Object.freeze({ schemaVersion: 1, locale });
}

export function fallbackPortalSettings(
  locale: PublicContentLocale,
): PublicPortalSettingsV1 {
  return Object.freeze({
    schemaVersion: 1,
    locale,
    availability: 'unavailable',
  });
}

export function fallbackHomepageContent(
  locale: PublicContentLocale,
): PublicHomepageContentV1 {
  return Object.freeze({ schemaVersion: 1, locale });
}
