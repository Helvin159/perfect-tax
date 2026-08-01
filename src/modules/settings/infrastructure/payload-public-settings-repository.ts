import 'server-only';

import { getPayload } from 'payload';

import config from '@payload-config';

import { CmsUnavailableError } from '@/modules/content/domain/publication';
import { publishedPayloadReadPolicy } from '@/modules/content/infrastructure/public-payload-read-policy';

import type { PublicSettingsRepository } from '../application/public-settings-service';

type SettingsLocale = Parameters<
  PublicSettingsRepository['findBusinessIdentity']
>[0];

export class PayloadPublicSettingsRepository implements PublicSettingsRepository {
  async findBusinessIdentity(locale: SettingsLocale): Promise<unknown | null> {
    try {
      const payload = await getPayload({ config });
      return await payload.findGlobal({
        slug: 'business-identity',
        depth: 1,
        ...publishedPayloadReadPolicy(locale),
        select: {
          publicDisplayName: true,
          shortName: true,
          tagline: true,
          businessDescription: true,
          serviceAreaDescription: true,
          publicDisclaimer: true,
          primaryLogo: true,
          compactLogo: true,
          brandingStatus: true,
          rebrandingNotice: true,
          contentPolicy: true,
          workingRevision: true,
          translationWorkflow: true,
          urgentPublicationControls: true,
          _status: true,
        },
      });
    } catch (error) {
      throw new CmsUnavailableError('business-identity', { cause: error });
    }
  }

  async findContactSettings(locale: SettingsLocale): Promise<unknown | null> {
    try {
      const payload = await getPayload({ config });
      return await payload.findGlobal({
        slug: 'contact-settings',
        depth: 0,
        ...publishedPayloadReadPolicy(locale),
        select: {
          approvedTelephone: true,
          approvedWhatsAppNumber: true,
          approvedGeneralEmail: true,
          officeAddress: true,
          businessHours: true,
          channels: true,
          contactSafetyInstructions: true,
          contentPolicy: true,
          workingRevision: true,
          translationWorkflow: true,
          urgentPublicationControls: true,
          _status: true,
        },
      });
    } catch (error) {
      throw new CmsUnavailableError('contact-settings', { cause: error });
    }
  }

  async findHomepageContent(locale: SettingsLocale): Promise<unknown | null> {
    try {
      const payload = await getPayload({ config });
      return await payload.findGlobal({
        slug: 'homepage-content',
        depth: 0,
        ...publishedPayloadReadPolicy(locale),
        select: {
          hero: true,
          servicesIntroduction: true,
          processSteps: true,
          portalIntroduction: true,
          trustSection: true,
          callToAction: true,
          footerCopy: true,
          contentPolicy: true,
          workingRevision: true,
          translationWorkflow: true,
          urgentPublicationControls: true,
          _status: true,
        },
      });
    } catch (error) {
      throw new CmsUnavailableError('homepage-content', { cause: error });
    }
  }

  async findPortalSettings(locale: SettingsLocale): Promise<unknown | null> {
    try {
      const payload = await getPayload({ config });
      return await payload.findGlobal({
        slug: 'portal-settings',
        depth: 0,
        ...publishedPayloadReadPolicy(locale),
        select: {
          availabilityState: true,
          transitionNotice: true,
          signInPlaceholderHeading: true,
          signInPlaceholderMessage: true,
          contentPolicy: true,
          workingRevision: true,
          translationWorkflow: true,
          urgentPublicationControls: true,
          _status: true,
        },
      });
    } catch (error) {
      throw new CmsUnavailableError('portal-settings', { cause: error });
    }
  }
}
