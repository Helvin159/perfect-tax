import type { PublicContentLocale } from '@/modules/content/workflow/types';

export type PublicServiceV1 = Readonly<{
  key: string;
  title: string;
  summary: string;
  detailedDescription?: string;
  displayOrder: number;
}>;

export type PublicServicesV1 = Readonly<{
  schemaVersion: 1;
  locale: PublicContentLocale;
  items: readonly PublicServiceV1[];
}>;

export function fallbackPublicServices(
  locale: PublicContentLocale,
): PublicServicesV1 {
  return Object.freeze({ schemaVersion: 1, locale, items: Object.freeze([]) });
}
