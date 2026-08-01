import {
  APIError,
  type CollectionBeforeChangeHook,
  type CollectionConfig,
  type TypeWithID,
} from 'payload';

import {
  createEditorialContent,
  deleteEditorialContent,
  readCmsManagedContent,
  updateCmsManagedContent,
} from './access';
import { createEditorialWorkflowFields } from './workflow/fields';
import { createCollectionWorkflowHook } from './workflow/hook';
import {
  createPublicResourceDeletionInvalidationHook,
  createServicesCacheInvalidationHook,
} from './infrastructure/public-cache-invalidation';

const localizedFields = ['title', 'summary', 'detailedDescription'] as const;
const sharedFields = ['displayOrder', 'isActive'] as const;

const enforceStableIdentifier: CollectionBeforeChangeHook<
  TypeWithID & Record<string, unknown>
> = ({ data, operation, originalDoc }) => {
  if (
    operation === 'update' &&
    data.stableIdentifier !== undefined &&
    data.stableIdentifier !== originalDoc?.stableIdentifier
  ) {
    throw new APIError('A service stable identifier cannot be changed.', 400);
  }
  return data;
};

export const Services: CollectionConfig = {
  slug: 'services',
  access: {
    create: createEditorialContent,
    delete: deleteEditorialContent,
    read: readCmsManagedContent,
    update: updateCmsManagedContent,
  },
  admin: {
    defaultColumns: [
      'stableIdentifier',
      'title',
      'isActive',
      'displayOrder',
      'updatedAt',
    ],
    group: 'Public content',
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'stableIdentifier',
      type: 'text',
      admin: {
        description:
          'Stable internal key. Lowercase letters, numbers, and hyphens only; cannot be changed after creation.',
      },
      index: true,
      required: true,
      unique: true,
      validate: (value: unknown) =>
        typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
          ? true
          : 'Use a lowercase kebab-case identifier.',
    },
    {
      name: 'title',
      type: 'text',
      localized: true,
      maxLength: 160,
      required: true,
    },
    {
      name: 'summary',
      type: 'textarea',
      localized: true,
      maxLength: 500,
      required: true,
    },
    {
      name: 'detailedDescription',
      type: 'textarea',
      localized: true,
      maxLength: 3_000,
    },
    {
      name: 'displayOrder',
      type: 'number',
      defaultValue: 100,
      min: 0,
      required: true,
    },
    {
      name: 'isActive',
      type: 'checkbox',
      admin: {
        description:
          'Inactive services remain in CMS history but are not eligible for future public projection.',
      },
      defaultValue: false,
      required: true,
    },
    ...createEditorialWorkflowFields('evergreen'),
  ],
  graphQL: false,
  hooks: {
    afterChange: [createServicesCacheInvalidationHook()],
    afterDelete: [
      createPublicResourceDeletionInvalidationHook('public-services'),
    ],
    beforeChange: [
      enforceStableIdentifier,
      createCollectionWorkflowHook({ localizedFields, sharedFields }),
    ],
  },
  labels: {
    plural: 'Services',
    singular: 'Service',
  },
  versions: {
    drafts: { autosave: false },
    maxPerDoc: 50,
  },
};
