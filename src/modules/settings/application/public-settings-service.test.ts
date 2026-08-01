import { describe, expect, it, vi } from 'vitest';

import { CmsUnavailableError } from '@/modules/content/domain/publication';
import { safePublicLoad } from '@/modules/content/application/safe-public-load';

import { fallbackBusinessIdentity } from '../domain/public-settings';
import {
  createPublicSettingsService,
  type PublicSettingsRepository,
} from './public-settings-service';

function repository(
  businessIdentity: PublicSettingsRepository['findBusinessIdentity'],
): PublicSettingsRepository {
  return {
    findBusinessIdentity: businessIdentity,
    findContactSettings: async () => null,
    findHomepageContent: async () => null,
    findPortalSettings: async () => null,
  };
}

describe('public settings service fallbacks', () => {
  it('uses only the approved display-name fallback when identity is missing', async () => {
    const service = createPublicSettingsService(repository(async () => null));

    await expect(service.getBusinessIdentity('es')).resolves.toEqual({
      schemaVersion: 1,
      locale: 'es',
      displayName: 'Perfect Tax',
    });
  });

  it('returns a deterministic fallback and safe diagnostic when Payload is unavailable', async () => {
    const service = createPublicSettingsService(
      repository(async () => {
        throw new CmsUnavailableError('business-identity', {
          cause: new Error('postgres://user:secret@private-host/database'),
        });
      }),
    );
    const logger = vi.fn();

    const result = await safePublicLoad({
      fallback: () => fallbackBusinessIdentity('en'),
      load: () => service.getBusinessIdentity('en'),
      locale: 'en',
      logger,
      resource: 'business-identity',
    });

    expect(result).toEqual({
      schemaVersion: 1,
      locale: 'en',
      displayName: 'Perfect Tax',
    });
    expect(logger).toHaveBeenCalledWith({
      code: 'cms-unavailable',
      locale: 'en',
      resource: 'business-identity',
    });
    expect(JSON.stringify(logger.mock.calls)).not.toContain('private-host');
    expect(JSON.stringify(logger.mock.calls)).not.toContain('secret');
  });
});
