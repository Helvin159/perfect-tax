import type { Access, FieldAccess } from 'payload';

import { isCmsAdminIdentity, isCmsIdentity } from './roles';

/** Allows access only to authenticated identities from the dedicated CMS collection. */
export const authenticatedCmsUser: Access = ({ req }) =>
  isCmsIdentity(req.user);

/** Allows collection administration only to dedicated Payload CMS identities. */
export const accessCmsAdminPanel = ({ req }: Parameters<Access>[0]) =>
  isCmsIdentity(req.user);

/** Allows new CMS identities to be provisioned only by a current CMS administrator. */
export const createCmsUser: Access = ({ req }) => isCmsAdminIdentity(req.user);

/** Limits CMS-user reads to the current identity unless the requester is an administrator. */
export const readCmsUser: Access = ({ req }) => {
  if (isCmsAdminIdentity(req.user)) return true;
  if (!isCmsIdentity(req.user)) return false;

  return { id: { equals: req.user.id } };
};

/** Limits profile updates to self while allowing administrators to manage other profiles. */
export const updateCmsUser: Access = ({ req }) => {
  if (isCmsAdminIdentity(req.user)) return true;
  if (!isCmsIdentity(req.user)) return false;

  return { id: { equals: req.user.id } };
};

/** Allows administrators to delete other CMS identities, never their own active identity. */
export const deleteCmsUser: Access = ({ req }) => {
  if (!isCmsAdminIdentity(req.user)) return false;

  return { id: { not_equals: req.user.id } };
};

/** Exposes the role field only to CMS admins; hooks separately enforce update semantics. */
export const manageCmsUserRole: FieldAccess = ({ req }) =>
  isCmsAdminIdentity(req.user);
