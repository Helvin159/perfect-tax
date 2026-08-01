import 'server-only';

import { unstable_cache } from 'next/cache';

import type { PublicResourceType } from '../domain/public-resource';
import type { PublicContentLocale } from '../workflow/types';
import {
  PUBLIC_CACHE_TTL_SECONDS,
  publicCacheKey,
  publicCacheTag,
} from './public-cache-policy';

export function persistentlyCachePublicResource<T>(
  resource: PublicResourceType,
  locale: PublicContentLocale,
  load: () => Promise<T>,
): Promise<T> {
  return unstable_cache(load, [...publicCacheKey(resource, locale)], {
    revalidate: PUBLIC_CACHE_TTL_SECONDS,
    tags: [publicCacheTag(resource, locale)],
  })();
}
