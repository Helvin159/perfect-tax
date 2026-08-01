export const PUBLIC_RESOURCE_TYPES = [
  'business-identity',
  'contact-settings',
  'portal-settings',
  'homepage-content',
  'public-services',
] as const;

export type PublicResourceType = (typeof PUBLIC_RESOURCE_TYPES)[number];
