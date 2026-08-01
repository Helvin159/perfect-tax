import type { GlobalConfig } from 'payload';

import {
  readCmsManagedContent,
  updateCmsManagedContent,
} from '@/modules/content/access';
import { createEditorialWorkflowFields } from '@/modules/content/workflow/fields';
import { createGlobalWorkflowHook } from '@/modules/content/workflow/hook';
import { createGlobalPublicCacheInvalidationHook } from '@/modules/content/infrastructure/public-cache-invalidation';

import { officeAddressFields, validateTime } from './fields';

const localizedFields = ['contactSafetyInstructions'] as const;
const sharedFields = [
  'approvedTelephone',
  'approvedWhatsAppNumber',
  'approvedGeneralEmail',
  'officeAddress',
  'businessHours',
  'channels',
] as const;

export const ContactSettings: GlobalConfig = {
  slug: 'contact-settings',
  access: {
    read: readCmsManagedContent,
    update: updateCmsManagedContent,
  },
  admin: {
    group: 'Public settings',
  },
  fields: [
    {
      name: 'approvedTelephone',
      type: 'text',
      admin: { description: 'Approved public telephone number only.' },
      maxLength: 40,
    },
    {
      name: 'approvedWhatsAppNumber',
      type: 'text',
      admin: { description: 'Approved business WhatsApp number only.' },
      maxLength: 40,
    },
    {
      name: 'approvedGeneralEmail',
      type: 'email',
      admin: { description: 'Approved general-contact mailbox only.' },
    },
    {
      name: 'officeAddress',
      type: 'group',
      fields: officeAddressFields,
    },
    {
      name: 'businessHours',
      type: 'array',
      fields: [
        {
          name: 'day',
          type: 'select',
          options: [
            'monday',
            'tuesday',
            'wednesday',
            'thursday',
            'friday',
            'saturday',
            'sunday',
          ],
          required: true,
        },
        { name: 'closed', type: 'checkbox', defaultValue: false },
        { name: 'opensAt', type: 'text', validate: validateTime },
        { name: 'closesAt', type: 'text', validate: validateTime },
      ],
      maxRows: 7,
    },
    {
      name: 'channels',
      type: 'group',
      fields: [
        {
          name: 'telephoneEnabled',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          name: 'whatsAppEnabled',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          name: 'emailEnabled',
          type: 'checkbox',
          defaultValue: false,
        },
      ],
    },
    {
      name: 'contactSafetyInstructions',
      type: 'textarea',
      admin: {
        description:
          'Tell clients not to send sensitive records or identifiers through public channels.',
      },
      localized: true,
      maxLength: 1_000,
    },
    ...createEditorialWorkflowFields('legal'),
  ],
  hooks: {
    afterChange: [createGlobalPublicCacheInvalidationHook('contact-settings')],
    beforeChange: [createGlobalWorkflowHook({ localizedFields, sharedFields })],
  },
  label: 'Contact settings',
  versions: {
    drafts: { autosave: false },
    max: 50,
  },
};
