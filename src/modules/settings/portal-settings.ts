import type { GlobalConfig } from 'payload';

import {
  readCmsManagedContent,
  updateCmsManagedContent,
} from '@/modules/content/access';
import { createEditorialWorkflowFields } from '@/modules/content/workflow/fields';
import { createGlobalWorkflowHook } from '@/modules/content/workflow/hook';
import { createGlobalPublicCacheInvalidationHook } from '@/modules/content/infrastructure/public-cache-invalidation';

const localizedFields = [
  'transitionNotice',
  'signInPlaceholderHeading',
  'signInPlaceholderMessage',
] as const;
const sharedFields = ['availabilityState'] as const;

export const PortalSettings: GlobalConfig = {
  slug: 'portal-settings',
  access: {
    read: readCmsManagedContent,
    update: updateCmsManagedContent,
  },
  admin: {
    group: 'Public settings',
  },
  fields: [
    {
      name: 'availabilityState',
      type: 'select',
      defaultValue: 'unavailable',
      options: [
        { label: 'Unavailable', value: 'unavailable' },
        { label: 'Transitioning', value: 'transitioning' },
        { label: 'Available', value: 'available' },
      ],
      required: true,
    },
    {
      name: 'transitionNotice',
      type: 'textarea',
      localized: true,
      maxLength: 1_000,
    },
    {
      name: 'signInPlaceholderHeading',
      type: 'text',
      localized: true,
      maxLength: 160,
    },
    {
      name: 'signInPlaceholderMessage',
      type: 'textarea',
      localized: true,
      maxLength: 1_000,
    },
    ...createEditorialWorkflowFields('evergreen'),
  ],
  hooks: {
    afterChange: [createGlobalPublicCacheInvalidationHook('portal-settings')],
    beforeChange: [createGlobalWorkflowHook({ localizedFields, sharedFields })],
  },
  label: 'Portal settings',
  versions: {
    drafts: { autosave: false },
    max: 50,
  },
};
