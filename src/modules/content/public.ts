import 'server-only';

import { cache } from 'react';

import { fallbackPublicServices } from './domain/public-services';
import { createPublicContentService } from './application/public-content-service';
import { safePublicLoad } from './application/safe-public-load';
import { persistentlyCachePublicResource } from './infrastructure/next-public-cache';
import { PayloadPublicContentRepository } from './infrastructure/payload-public-content-repository';
import type { PublicContentLocale } from './workflow/types';

const service = createPublicContentService(
  new PayloadPublicContentRepository(),
);

export const getPublicServices = cache((locale: PublicContentLocale) =>
  safePublicLoad({
    fallback: () => fallbackPublicServices(locale),
    load: () =>
      persistentlyCachePublicResource('public-services', locale, () =>
        service.getServices(locale),
      ),
    locale,
    resource: 'public-services',
  }),
);
