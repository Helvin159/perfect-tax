import 'server-only';

import { cache } from 'react';

import { safePublicLoad } from '@/modules/content/application/safe-public-load';
import { persistentlyCachePublicResource } from '@/modules/content/infrastructure/next-public-cache';
import type { PublicContentLocale } from '@/modules/content/workflow/types';

import { createPublicSettingsService } from './application/public-settings-service';
import {
  fallbackBusinessIdentity,
  fallbackContactSettings,
  fallbackHomepageContent,
  fallbackPortalSettings,
} from './domain/public-settings';
import { PayloadPublicSettingsRepository } from './infrastructure/payload-public-settings-repository';

const service = createPublicSettingsService(
  new PayloadPublicSettingsRepository(),
);

export const getPublicBusinessIdentity = cache((locale: PublicContentLocale) =>
  safePublicLoad({
    fallback: () => fallbackBusinessIdentity(locale),
    load: () =>
      persistentlyCachePublicResource('business-identity', locale, () =>
        service.getBusinessIdentity(locale),
      ),
    locale,
    resource: 'business-identity',
  }),
);

export const getPublicContactSettings = cache((locale: PublicContentLocale) =>
  safePublicLoad({
    fallback: () => fallbackContactSettings(locale),
    load: () =>
      persistentlyCachePublicResource('contact-settings', locale, () =>
        service.getContactSettings(locale),
      ),
    locale,
    resource: 'contact-settings',
  }),
);

export const getPublicHomepageContent = cache((locale: PublicContentLocale) =>
  safePublicLoad({
    fallback: () => fallbackHomepageContent(locale),
    load: () =>
      persistentlyCachePublicResource('homepage-content', locale, () =>
        service.getHomepageContent(locale),
      ),
    locale,
    resource: 'homepage-content',
  }),
);

export const getPublicPortalSettings = cache((locale: PublicContentLocale) =>
  safePublicLoad({
    fallback: () => fallbackPortalSettings(locale),
    load: () =>
      persistentlyCachePublicResource('portal-settings', locale, () =>
        service.getPortalSettings(locale),
      ),
    locale,
    resource: 'portal-settings',
  }),
);
