import type { PublicContentLocale } from '@/modules/content/workflow/types';

import {
  fallbackBusinessIdentity,
  fallbackContactSettings,
  fallbackHomepageContent,
  fallbackPortalSettings,
  type PublicBusinessIdentityV1,
  type PublicContactSettingsV1,
  type PublicHomepageContentV1,
  type PublicPortalSettingsV1,
} from '../domain/public-settings';
import {
  projectBusinessIdentity,
  projectContactSettings,
  projectHomepageContent,
  projectPortalSettings,
} from '../domain/project-public-settings';

export interface PublicSettingsRepository {
  findBusinessIdentity(locale: PublicContentLocale): Promise<unknown | null>;
  findContactSettings(locale: PublicContentLocale): Promise<unknown | null>;
  findHomepageContent(locale: PublicContentLocale): Promise<unknown | null>;
  findPortalSettings(locale: PublicContentLocale): Promise<unknown | null>;
}

export type PublicSettingsService = Readonly<{
  getBusinessIdentity(
    locale: PublicContentLocale,
  ): Promise<PublicBusinessIdentityV1>;
  getContactSettings(
    locale: PublicContentLocale,
  ): Promise<PublicContactSettingsV1>;
  getHomepageContent(
    locale: PublicContentLocale,
  ): Promise<PublicHomepageContentV1>;
  getPortalSettings(
    locale: PublicContentLocale,
  ): Promise<PublicPortalSettingsV1>;
}>;

export function createPublicSettingsService(
  repository: PublicSettingsRepository,
  now: () => Date = () => new Date(),
): PublicSettingsService {
  return {
    async getBusinessIdentity(locale) {
      const record = await repository.findBusinessIdentity(locale);
      return (
        projectBusinessIdentity(record, locale, now()) ??
        fallbackBusinessIdentity(locale)
      );
    },
    async getContactSettings(locale) {
      const record = await repository.findContactSettings(locale);
      return (
        projectContactSettings(record, locale, now()) ??
        fallbackContactSettings(locale)
      );
    },
    async getHomepageContent(locale) {
      const record = await repository.findHomepageContent(locale);
      return (
        projectHomepageContent(record, locale, now()) ??
        fallbackHomepageContent(locale)
      );
    },
    async getPortalSettings(locale) {
      const record = await repository.findPortalSettings(locale);
      return (
        projectPortalSettings(record, locale, now()) ??
        fallbackPortalSettings(locale)
      );
    },
  };
}
