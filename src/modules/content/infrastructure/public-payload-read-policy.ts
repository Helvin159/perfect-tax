import type { PublicContentLocale } from '../workflow/types';

export function publishedPayloadReadPolicy(locale: PublicContentLocale) {
  return Object.freeze({
    draft: false as const,
    fallbackLocale: false as const,
    locale,
    overrideAccess: true as const,
  });
}
