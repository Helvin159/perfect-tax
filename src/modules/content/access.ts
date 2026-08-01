import type { Access } from 'payload';

import { isCmsAdminIdentity, isCmsIdentity } from '@/modules/cms/users/roles';

export const readCmsManagedContent: Access = ({ req }) =>
  isCmsIdentity(req.user);

export const updateCmsManagedContent: Access = ({ req }) =>
  isCmsIdentity(req.user);

export const createEditorialContent: Access = ({ req }) =>
  isCmsIdentity(req.user) &&
  (req.user.role === 'editor' || req.user.role === 'cms-admin');

export const deleteEditorialContent: Access = ({ req }) =>
  isCmsAdminIdentity(req.user);

export const updatePublicMedia: Access = ({ req }) =>
  isCmsIdentity(req.user) &&
  ['editor', 'publisher', 'cms-admin'].includes(req.user.role);

export const readPublicMedia: Access = ({ req }) => {
  if (isCmsIdentity(req.user)) return true;

  return { _status: { equals: 'published' } };
};
