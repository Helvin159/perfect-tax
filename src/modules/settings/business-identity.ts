import type { GlobalConfig } from 'payload';

import {
  readCmsManagedContent,
  updateCmsManagedContent,
} from '@/modules/content/access';
import { createEditorialWorkflowFields } from '@/modules/content/workflow/fields';
import { createGlobalWorkflowHook } from '@/modules/content/workflow/hook';
import { createGlobalPublicCacheInvalidationHook } from '@/modules/content/infrastructure/public-cache-invalidation';

const localizedFields = [
  'tagline',
  'businessDescription',
  'serviceAreaDescription',
  'publicDisclaimer',
  'rebrandingNotice',
] as const;

const sharedFields = [
  'legalBusinessName',
  'publicDisplayName',
  'shortName',
  'primaryLogo',
  'compactLogo',
  'brandingStatus',
] as const;

export const BusinessIdentity: GlobalConfig = {
  slug: 'business-identity',
  access: {
    read: readCmsManagedContent,
    update: updateCmsManagedContent,
  },
  admin: {
    group: 'Public settings',
  },
  fields: [
    {
      name: 'legalBusinessName',
      type: 'text',
      admin: {
        description:
          'The legally recognized name. Do not translate or infer this value.',
      },
      maxLength: 160,
    },
    {
      name: 'publicDisplayName',
      type: 'text',
      defaultValue: 'Perfect Tax',
      maxLength: 120,
      required: true,
    },
    {
      name: 'shortName',
      type: 'text',
      maxLength: 50,
    },
    {
      name: 'tagline',
      type: 'text',
      localized: true,
      maxLength: 180,
    },
    {
      name: 'businessDescription',
      type: 'textarea',
      localized: true,
      maxLength: 2_000,
    },
    {
      name: 'serviceAreaDescription',
      type: 'textarea',
      localized: true,
      maxLength: 800,
    },
    {
      name: 'publicDisclaimer',
      type: 'textarea',
      admin: {
        description: 'Requires qualified bilingual review before publication.',
      },
      localized: true,
      maxLength: 2_000,
    },
    {
      name: 'primaryLogo',
      type: 'upload',
      relationTo: 'public-media',
    },
    {
      name: 'compactLogo',
      type: 'upload',
      relationTo: 'public-media',
    },
    {
      name: 'brandingStatus',
      type: 'select',
      defaultValue: 'established',
      options: [
        { label: 'Established', value: 'established' },
        { label: 'Rebranding', value: 'rebranding' },
      ],
      required: true,
    },
    {
      name: 'rebrandingNotice',
      type: 'textarea',
      admin: {
        condition: (_, siblingData) =>
          siblingData?.brandingStatus === 'rebranding',
      },
      localized: true,
      maxLength: 600,
    },
    ...createEditorialWorkflowFields('legal'),
  ],
  hooks: {
    afterChange: [createGlobalPublicCacheInvalidationHook('business-identity')],
    beforeChange: [createGlobalWorkflowHook({ localizedFields, sharedFields })],
  },
  label: 'Business identity',
  versions: {
    drafts: { autosave: false },
    max: 50,
  },
};
