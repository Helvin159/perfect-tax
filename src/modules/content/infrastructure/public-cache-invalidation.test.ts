import { describe, expect, it, vi } from 'vitest';

import { Services } from '../services';
import { BusinessIdentity } from '@/modules/settings/business-identity';

import {
  createGlobalPublicCacheInvalidationHook,
  publicationInvalidationTags,
} from './public-cache-invalidation';

function record(status: 'draft' | 'published') {
  return {
    _status: status,
    contentPolicy: 'evergreen',
    workingRevision: 4,
    translationWorkflow: {
      en: { state: status, sourceRevision: 4 },
      es: { state: status, sourceRevision: 4 },
    },
  };
}

describe('public cache invalidation', () => {
  it('registers focused publication hooks on settings and services', () => {
    expect(BusinessIdentity.hooks?.afterChange).toHaveLength(1);
    expect(Services.hooks?.afterChange).toHaveLength(1);
    expect(Services.hooks?.afterDelete).toHaveLength(1);
  });

  it('invalidates only the affected resource locale tags after publication', async () => {
    const revalidate = vi.fn();
    const hook = createGlobalPublicCacheInvalidationHook(
      'business-identity',
      revalidate,
    );
    const doc = record('published');

    await hook({
      doc,
      req: { payload: { logger: { error: vi.fn() } } },
    } as never);

    expect(revalidate.mock.calls).toEqual([
      ['public-cms:v1:business-identity:en:published'],
      ['public-cms:v1:business-identity:es:published'],
    ]);
    expect(publicationInvalidationTags('portal-settings', doc)).toEqual([
      'public-cms:v1:portal-settings:en:published',
      'public-cms:v1:portal-settings:es:published',
    ]);
  });

  it('does not invalidate or replace the last published cache on draft changes', async () => {
    const revalidate = vi.fn();
    const hook = createGlobalPublicCacheInvalidationHook(
      'homepage-content',
      revalidate,
    );

    await hook({
      doc: record('draft'),
      previousDoc: record('published'),
      req: { payload: { logger: { error: vi.fn() } } },
    } as never);

    expect(revalidate).not.toHaveBeenCalled();
    expect(
      publicationInvalidationTags('homepage-content', record('draft')),
    ).toEqual([]);
  });
});
