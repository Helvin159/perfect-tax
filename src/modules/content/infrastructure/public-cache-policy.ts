import type { PublicContentLocale } from '../workflow/types';
import type { PublicResourceType } from '../domain/public-resource';

export const PUBLIC_CACHE_VERSION = 'v1';
export const PUBLICATION_ELIGIBILITY = 'published';
export const PUBLIC_CACHE_TTL_SECONDS = 300;

export function publicCacheKey(
  resource: PublicResourceType,
  locale: PublicContentLocale,
): readonly string[] {
  return Object.freeze([
    'public-cms',
    PUBLIC_CACHE_VERSION,
    resource,
    locale,
    PUBLICATION_ELIGIBILITY,
  ]);
}

export function publicCacheTag(
  resource: PublicResourceType,
  locale: PublicContentLocale,
): string {
  return publicCacheKey(resource, locale).join(':');
}
