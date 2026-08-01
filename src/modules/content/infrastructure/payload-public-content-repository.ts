import 'server-only';

import { getPayload } from 'payload';

import config from '@payload-config';

import type { PublicContentRepository } from '../application/public-content-service';
import { CmsUnavailableError } from '../domain/publication';
import { publishedPayloadReadPolicy } from './public-payload-read-policy';

export class PayloadPublicContentRepository implements PublicContentRepository {
  async findServices(
    locale: Parameters<PublicContentRepository['findServices']>[0],
  ): Promise<readonly unknown[]> {
    try {
      const payload = await getPayload({ config });
      const result = await payload.find({
        collection: 'services',
        depth: 0,
        limit: 100,
        ...publishedPayloadReadPolicy(locale),
        select: {
          stableIdentifier: true,
          title: true,
          summary: true,
          detailedDescription: true,
          displayOrder: true,
          isActive: true,
          contentPolicy: true,
          workingRevision: true,
          translationWorkflow: true,
          _status: true,
        },
        sort: ['displayOrder', 'stableIdentifier'],
        where: {
          and: [
            { _status: { equals: 'published' } },
            { isActive: { equals: true } },
          ],
        },
      });
      return result.docs;
    } catch (error) {
      throw new CmsUnavailableError('public-services', { cause: error });
    }
  }
}
