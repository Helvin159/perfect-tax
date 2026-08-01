import { revalidateTag } from 'next/cache';
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  GlobalAfterChangeHook,
  TypeWithID,
} from 'payload';

import type { PublicResourceType } from '../domain/public-resource';
import { publishedLocales } from '../domain/publication';
import type { PublicContentLocale } from '../workflow/types';
import { publicCacheTag } from './public-cache-policy';

export type PublicTagRevalidator = (tag: string) => Promise<unknown> | unknown;

const nextTagRevalidator: PublicTagRevalidator = (tag) =>
  revalidateTag(tag, 'max');

export function publicationInvalidationTags(
  resource: PublicResourceType,
  doc: unknown,
  now = new Date(),
): string[] {
  return publishedLocales(doc, now).map((locale) =>
    publicCacheTag(resource, locale),
  );
}

export function publicMediaInvalidationTags(doc: unknown): string[] {
  if (
    !doc ||
    typeof doc !== 'object' ||
    (doc as { _status?: unknown })._status !== 'published'
  ) {
    return [];
  }
  return (['en', 'es'] as const).map((locale: PublicContentLocale) =>
    publicCacheTag('business-identity', locale),
  );
}

function allLocaleTags(resource: PublicResourceType): string[] {
  return (['en', 'es'] as const).map((locale) =>
    publicCacheTag(resource, locale),
  );
}

async function invalidate(
  tags: readonly string[],
  revalidate: PublicTagRevalidator,
): Promise<void> {
  await Promise.all(tags.map((tag) => revalidate(tag)));
}

export function createGlobalPublicCacheInvalidationHook(
  resource: Exclude<PublicResourceType, 'public-services'>,
  revalidate: PublicTagRevalidator = nextTagRevalidator,
): GlobalAfterChangeHook {
  return async ({ doc, req }) => {
    try {
      await invalidate(publicationInvalidationTags(resource, doc), revalidate);
    } catch {
      req.payload.logger.error(
        `Public cache invalidation failed for ${resource}.`,
      );
    }
    return doc;
  };
}

export function createServicesCacheInvalidationHook(
  revalidate: PublicTagRevalidator = nextTagRevalidator,
): CollectionAfterChangeHook<TypeWithID & Record<string, unknown>> {
  return async ({ doc, req }) => {
    try {
      await invalidate(
        publicationInvalidationTags('public-services', doc),
        revalidate,
      );
    } catch {
      req.payload.logger.error(
        'Public cache invalidation failed for public-services.',
      );
    }
    return doc;
  };
}

export function createPublicMediaCacheInvalidationHook(
  revalidate: PublicTagRevalidator = nextTagRevalidator,
): CollectionAfterChangeHook<TypeWithID & Record<string, unknown>> {
  return async ({ doc, req }) => {
    try {
      await invalidate(publicMediaInvalidationTags(doc), revalidate);
    } catch {
      req.payload.logger.error(
        'Public cache invalidation failed for business-identity media.',
      );
    }
    return doc;
  };
}

export function createPublicResourceDeletionInvalidationHook(
  resource: 'business-identity' | 'public-services',
  revalidate: PublicTagRevalidator = nextTagRevalidator,
): CollectionAfterDeleteHook<TypeWithID & Record<string, unknown>> {
  return async ({ doc, req }) => {
    try {
      await invalidate(allLocaleTags(resource), revalidate);
    } catch {
      req.payload.logger.error(
        `Public cache deletion invalidation failed for ${resource}.`,
      );
    }
    return doc;
  };
}
