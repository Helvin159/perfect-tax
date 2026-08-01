import type { GlobalConfig } from 'payload';

import {
  readCmsManagedContent,
  updateCmsManagedContent,
} from '@/modules/content/access';
import { createEditorialWorkflowFields } from '@/modules/content/workflow/fields';
import { createGlobalWorkflowHook } from '@/modules/content/workflow/hook';
import { createGlobalPublicCacheInvalidationHook } from '@/modules/content/infrastructure/public-cache-invalidation';

const localizedFields = [
  'hero',
  'servicesIntroduction',
  'processSteps',
  'portalIntroduction',
  'trustSection',
  'callToAction',
  'footerCopy',
] as const;

export const HomepageContent: GlobalConfig = {
  slug: 'homepage-content',
  access: {
    read: readCmsManagedContent,
    update: updateCmsManagedContent,
  },
  admin: {
    group: 'Public content',
  },
  fields: [
    {
      name: 'hero',
      type: 'group',
      fields: [
        { name: 'eyebrow', type: 'text', maxLength: 100 },
        { name: 'heading', type: 'text', maxLength: 180 },
        { name: 'body', type: 'textarea', maxLength: 1_000 },
      ],
      localized: true,
    },
    {
      name: 'servicesIntroduction',
      type: 'group',
      fields: [
        { name: 'heading', type: 'text', maxLength: 180 },
        { name: 'body', type: 'textarea', maxLength: 1_000 },
      ],
      localized: true,
    },
    {
      name: 'processSteps',
      type: 'array',
      fields: [
        { name: 'title', type: 'text', maxLength: 120, required: true },
        {
          name: 'description',
          type: 'textarea',
          maxLength: 600,
          required: true,
        },
      ],
      localized: true,
      maxRows: 6,
    },
    {
      name: 'portalIntroduction',
      type: 'group',
      fields: [
        { name: 'heading', type: 'text', maxLength: 180 },
        { name: 'body', type: 'textarea', maxLength: 1_000 },
      ],
      localized: true,
    },
    {
      name: 'trustSection',
      type: 'group',
      fields: [
        { name: 'heading', type: 'text', maxLength: 180 },
        { name: 'body', type: 'textarea', maxLength: 1_000 },
      ],
      localized: true,
    },
    {
      name: 'callToAction',
      type: 'group',
      fields: [
        { name: 'heading', type: 'text', maxLength: 180 },
        { name: 'body', type: 'textarea', maxLength: 700 },
        { name: 'primaryLabel', type: 'text', maxLength: 80 },
        { name: 'secondaryLabel', type: 'text', maxLength: 80 },
      ],
      localized: true,
    },
    {
      name: 'footerCopy',
      type: 'textarea',
      localized: true,
      maxLength: 800,
    },
    ...createEditorialWorkflowFields('evergreen'),
  ],
  hooks: {
    afterChange: [createGlobalPublicCacheInvalidationHook('homepage-content')],
    beforeChange: [createGlobalWorkflowHook({ localizedFields })],
  },
  label: 'Homepage content',
  versions: {
    drafts: { autosave: false },
    max: 50,
  },
};
