import {
  InvalidPublicContentError,
  isPublicationEligible,
  isRecord,
  optionalRecord,
  optionalText,
  requiredText,
} from '@/modules/content/domain/publication';
import type { PublicContentLocale } from '@/modules/content/workflow/types';

import type {
  PublicBusinessHoursV1,
  PublicBusinessIdentityV1,
  PublicContactSettingsV1,
  PublicHomepageContentV1,
  PublicMediaV1,
  PublicOfficeAddressV1,
  PublicPortalSettingsV1,
  PublicTextSectionV1,
} from './public-settings';

const DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;
const AVAILABILITY = ['unavailable', 'transitioning', 'available'] as const;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function optionalPositiveInteger(
  record: Record<string, unknown>,
  key: string,
  resource: string,
): number | undefined {
  const value = record[key];
  if (value === undefined || value === null) return undefined;
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new InvalidPublicContentError(resource);
  }
  return Number(value);
}

function safePublicUrl(value: string, resource: string): string {
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const url = new URL(value);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
  } catch {
    // The common invalid-content error below deliberately contains no field data.
  }
  throw new InvalidPublicContentError(resource);
}

function projectMedia(value: unknown): PublicMediaV1 | undefined {
  if (value === undefined || value === null || typeof value === 'number') {
    return undefined;
  }
  if (!isRecord(value) || value._status !== 'published') return undefined;

  const resource = 'public-media';
  return Object.freeze({
    schemaVersion: 1,
    altText: requiredText(value, 'altText', 300, resource),
    url: safePublicUrl(requiredText(value, 'url', 2_048, resource), resource),
    width: optionalPositiveInteger(value, 'width', resource),
    height: optionalPositiveInteger(value, 'height', resource),
  });
}

export function projectBusinessIdentity(
  value: unknown,
  locale: PublicContentLocale,
  now?: Date,
): PublicBusinessIdentityV1 | null {
  if (!isPublicationEligible(value, locale, now)) return null;

  const resource = 'business-identity';
  return Object.freeze({
    schemaVersion: 1,
    locale,
    displayName: requiredText(value, 'publicDisplayName', 120, resource),
    shortName: optionalText(value, 'shortName', 50, resource),
    tagline: optionalText(value, 'tagline', 180, resource),
    description: optionalText(value, 'businessDescription', 2_000, resource),
    serviceAreaDescription: optionalText(
      value,
      'serviceAreaDescription',
      800,
      resource,
    ),
    disclaimer: optionalText(value, 'publicDisclaimer', 2_000, resource),
    primaryLogo: projectMedia(value.primaryLogo),
    compactLogo: projectMedia(value.compactLogo),
    rebrandingNotice:
      value.brandingStatus === 'rebranding'
        ? optionalText(value, 'rebrandingNotice', 600, resource)
        : undefined,
  });
}

function validateContactValue(
  value: string | undefined,
  resource: string,
): string | undefined {
  if (!value) return undefined;
  if (!/^[+()\-.\s\d]{3,40}$/.test(value)) {
    throw new InvalidPublicContentError(resource);
  }
  return value;
}

function validateEmail(
  value: string | undefined,
  resource: string,
): string | undefined {
  if (!value) return undefined;
  if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new InvalidPublicContentError(resource);
  }
  return value;
}

function projectAddress(
  value: Record<string, unknown> | undefined,
): PublicOfficeAddressV1 | undefined {
  if (!value) return undefined;
  const resource = 'contact-settings';
  const address = {
    line1: optionalText(value, 'line1', 120, resource),
    line2: optionalText(value, 'line2', 120, resource),
    city: optionalText(value, 'city', 80, resource),
    region: optionalText(value, 'region', 80, resource),
    postalCode: optionalText(value, 'postalCode', 20, resource),
    countryCode: optionalText(value, 'countryCode', 2, resource),
  };
  if (address.countryCode && !/^[A-Z]{2}$/.test(address.countryCode)) {
    throw new InvalidPublicContentError(resource);
  }
  return Object.values(address).some(Boolean)
    ? Object.freeze(address)
    : undefined;
}

function projectHours(
  value: unknown,
): readonly PublicBusinessHoursV1[] | undefined {
  if (value === undefined || value === null) return undefined;
  const resource = 'contact-settings';
  if (!Array.isArray(value) || value.length > 7) {
    throw new InvalidPublicContentError(resource);
  }

  const hours = value.map((entry): PublicBusinessHoursV1 => {
    if (
      !isRecord(entry) ||
      !DAYS.includes(entry.day as (typeof DAYS)[number])
    ) {
      throw new InvalidPublicContentError(resource);
    }
    const closed = entry.closed === true;
    const opensAt = optionalText(entry, 'opensAt', 5, resource);
    const closesAt = optionalText(entry, 'closesAt', 5, resource);
    if (
      !closed &&
      (!opensAt ||
        !closesAt ||
        !TIME_PATTERN.test(opensAt) ||
        !TIME_PATTERN.test(closesAt))
    ) {
      throw new InvalidPublicContentError(resource);
    }
    return Object.freeze({
      day: entry.day as PublicBusinessHoursV1['day'],
      closed,
      opensAt: closed ? undefined : opensAt,
      closesAt: closed ? undefined : closesAt,
    });
  });
  return hours.length ? Object.freeze(hours) : undefined;
}

export function projectContactSettings(
  value: unknown,
  locale: PublicContentLocale,
  now?: Date,
): PublicContactSettingsV1 | null {
  if (!isPublicationEligible(value, locale, now)) return null;
  const resource = 'contact-settings';
  const channels = optionalRecord(value, 'channels', resource);

  return Object.freeze({
    schemaVersion: 1,
    locale,
    telephone:
      channels?.telephoneEnabled === true
        ? validateContactValue(
            optionalText(value, 'approvedTelephone', 40, resource),
            resource,
          )
        : undefined,
    whatsApp:
      channels?.whatsAppEnabled === true
        ? validateContactValue(
            optionalText(value, 'approvedWhatsAppNumber', 40, resource),
            resource,
          )
        : undefined,
    email:
      channels?.emailEnabled === true
        ? validateEmail(
            optionalText(value, 'approvedGeneralEmail', 254, resource),
            resource,
          )
        : undefined,
    officeAddress: projectAddress(
      optionalRecord(value, 'officeAddress', resource),
    ),
    businessHours: projectHours(value.businessHours),
    safetyInstructions: optionalText(
      value,
      'contactSafetyInstructions',
      1_000,
      resource,
    ),
  });
}

export function projectPortalSettings(
  value: unknown,
  locale: PublicContentLocale,
  now?: Date,
): PublicPortalSettingsV1 | null {
  if (!isPublicationEligible(value, locale, now)) return null;
  const resource = 'portal-settings';
  if (
    !AVAILABILITY.includes(
      value.availabilityState as (typeof AVAILABILITY)[number],
    )
  ) {
    throw new InvalidPublicContentError(resource);
  }

  return Object.freeze({
    schemaVersion: 1,
    locale,
    availability:
      value.availabilityState as PublicPortalSettingsV1['availability'],
    transitionNotice: optionalText(value, 'transitionNotice', 1_000, resource),
    signInHeading: optionalText(
      value,
      'signInPlaceholderHeading',
      160,
      resource,
    ),
    signInMessage: optionalText(
      value,
      'signInPlaceholderMessage',
      1_000,
      resource,
    ),
  });
}

function projectTextSection(
  value: Record<string, unknown> | undefined,
  resource: string,
): PublicTextSectionV1 | undefined {
  if (!value) return undefined;
  const section = {
    heading: optionalText(value, 'heading', 180, resource),
    body: optionalText(value, 'body', 1_000, resource),
  };
  return section.heading || section.body ? Object.freeze(section) : undefined;
}

export function projectHomepageContent(
  value: unknown,
  locale: PublicContentLocale,
  now?: Date,
): PublicHomepageContentV1 | null {
  if (!isPublicationEligible(value, locale, now)) return null;
  const resource = 'homepage-content';
  const hero = optionalRecord(value, 'hero', resource);
  const callToAction = optionalRecord(value, 'callToAction', resource);
  const processSteps = value.processSteps;
  if (
    processSteps !== undefined &&
    processSteps !== null &&
    !Array.isArray(processSteps)
  ) {
    throw new InvalidPublicContentError(resource);
  }
  if (Array.isArray(processSteps) && processSteps.length > 6) {
    throw new InvalidPublicContentError(resource);
  }

  return Object.freeze({
    schemaVersion: 1,
    locale,
    hero: hero
      ? Object.freeze({
          eyebrow: optionalText(hero, 'eyebrow', 100, resource),
          heading: optionalText(hero, 'heading', 180, resource),
          body: optionalText(hero, 'body', 1_000, resource),
        })
      : undefined,
    servicesIntroduction: projectTextSection(
      optionalRecord(value, 'servicesIntroduction', resource),
      resource,
    ),
    processSteps: Array.isArray(processSteps)
      ? Object.freeze(
          processSteps.map((step) => {
            if (!isRecord(step)) throw new InvalidPublicContentError(resource);
            return Object.freeze({
              title: requiredText(step, 'title', 120, resource),
              description: requiredText(step, 'description', 600, resource),
            });
          }),
        )
      : undefined,
    portalIntroduction: projectTextSection(
      optionalRecord(value, 'portalIntroduction', resource),
      resource,
    ),
    trustSection: projectTextSection(
      optionalRecord(value, 'trustSection', resource),
      resource,
    ),
    callToAction: callToAction
      ? Object.freeze({
          heading: optionalText(callToAction, 'heading', 180, resource),
          body: optionalText(callToAction, 'body', 700, resource),
          primaryLabel: optionalText(
            callToAction,
            'primaryLabel',
            80,
            resource,
          ),
          secondaryLabel: optionalText(
            callToAction,
            'secondaryLabel',
            80,
            resource,
          ),
        })
      : undefined,
    footerCopy: optionalText(value, 'footerCopy', 800, resource),
  });
}
