import { APIError, type CollectionBeforeChangeHook } from 'payload';

import { isCmsAdminIdentity, isCmsUserRole } from './roles';

export const CMS_BOOTSTRAP_CONTEXT = Symbol('cms-bootstrap');

type CmsUserData = {
  id: number | string;
  role?: unknown;
};

function forbidden(): never {
  throw new APIError('This CMS user operation is not permitted.', 403);
}

/**
 * Enforces provisioning and role-change policy even when a server caller has
 * explicitly overridden normal Payload access checks.
 */
export const enforceCmsUserAuthorization: CollectionBeforeChangeHook<
  CmsUserData
> = ({ context, data, operation, originalDoc, req }) => {
  if (operation === 'create') {
    const isBootstrap = Reflect.get(context, CMS_BOOTSTRAP_CONTEXT) === true;

    if (isBootstrap) {
      if (data.role !== 'cms-admin') forbidden();
      return data;
    }

    if (!isCmsAdminIdentity(req.user)) forbidden();

    if (data.role !== undefined && !isCmsUserRole(data.role)) forbidden();
    return data;
  }

  if (data.role === undefined || data.role === originalDoc?.role) return data;

  if (!isCmsAdminIdentity(req.user) || req.user.id === originalDoc?.id) {
    forbidden();
  }

  if (!isCmsUserRole(data.role)) forbidden();

  return data;
};
