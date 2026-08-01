export const CMS_USER_ROLES = [
  'editor',
  'bilingual-reviewer',
  'publisher',
  'cms-admin',
] as const;

export type CmsUserRole = (typeof CMS_USER_ROLES)[number];

export type CmsIdentity = Readonly<{
  collection?: string | null;
  id: number | string;
  role?: unknown;
}>;

export type CmsAdminIdentity = CmsIdentity & Readonly<{ role: 'cms-admin' }>;

export function isCmsUserRole(value: unknown): value is CmsUserRole {
  return CMS_USER_ROLES.includes(value as CmsUserRole);
}

export function isCmsIdentity(value: unknown): value is CmsIdentity {
  if (!value || typeof value !== 'object') return false;

  const identity = value as Partial<CmsIdentity>;

  return (
    identity.collection === 'cms-users' &&
    (typeof identity.id === 'number' || typeof identity.id === 'string') &&
    isCmsUserRole(identity.role)
  );
}

export function isCmsAdminIdentity(value: unknown): value is CmsAdminIdentity {
  return isCmsIdentity(value) && value.role === 'cms-admin';
}
