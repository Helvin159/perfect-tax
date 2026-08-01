import { describe, expect, it } from 'vitest';

import { publicCacheKey, publicCacheTag } from './public-cache-policy';
import { publishedPayloadReadPolicy } from './public-payload-read-policy';

describe('public CMS cache and read policy', () => {
  it('keys cache entries by resource, locale, and publication eligibility', () => {
    expect(publicCacheKey('business-identity', 'en')).toEqual([
      'public-cms',
      'v1',
      'business-identity',
      'en',
      'published',
    ]);
    expect(publicCacheTag('public-services', 'es')).toBe(
      'public-cms:v1:public-services:es:published',
    );
  });

  it('keeps English and Spanish cache entries independent', () => {
    expect(publicCacheTag('homepage-content', 'en')).not.toBe(
      publicCacheTag('homepage-content', 'es'),
    );
  });

  it('always reads the last published version without locale fallback', () => {
    expect(publishedPayloadReadPolicy('es')).toEqual({
      draft: false,
      fallbackLocale: false,
      locale: 'es',
      overrideAccess: true,
    });
  });
});
