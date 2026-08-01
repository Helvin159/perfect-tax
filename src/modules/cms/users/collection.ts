import type { CollectionConfig } from 'payload';

import {
  accessCmsAdminPanel,
  createCmsUser,
  deleteCmsUser,
  manageCmsUserRole,
  readCmsUser,
  updateCmsUser,
} from './access';
import { enforceCmsUserAuthorization } from './authorization';
import { CMS_USER_ROLES } from './roles';

export const CmsUsers: CollectionConfig = {
  slug: 'cms-users',
  access: {
    admin: accessCmsAdminPanel,
    create: createCmsUser,
    delete: deleteCmsUser,
    read: readCmsUser,
    update: updateCmsUser,
  },
  admin: {
    defaultColumns: ['email', 'role', 'updatedAt'],
    group: 'CMS administration',
    useAsTitle: 'email',
  },
  auth: {
    lockTime: 30 * 60 * 1000,
    maxLoginAttempts: 5,
    removeTokenFromResponses: true,
    tokenExpiration: 2 * 60 * 60,
    useAPIKey: false,
  },
  disableBulkDelete: true,
  disableDuplicate: true,
  fields: [
    {
      name: 'role',
      type: 'select',
      access: {
        create: manageCmsUserRole,
        update: manageCmsUserRole,
      },
      defaultValue: 'editor',
      options: CMS_USER_ROLES.map((role) => ({ label: role, value: role })),
      required: true,
      saveToJWT: true,
    },
  ],
  graphQL: false,
  hooks: {
    beforeChange: [enforceCmsUserAuthorization],
  },
  labels: {
    plural: 'CMS users',
    singular: 'CMS user',
  },
};
