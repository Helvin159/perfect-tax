import type { CollectionConfig } from 'payload';

import { parseClientNumber } from '@/modules/portal-identity/domain/client-number';
import {
  CLIENT_STATUSES,
  parseClientStatus,
} from '@/modules/portal-identity/domain/client';

import { enforceClientInvariants } from './invariants';

export function validateClientStatus(value: unknown): true | string {
  return parseClientStatus(value) === undefined
    ? 'Client status must be active or inactive.'
    : true;
}

export const Clients: CollectionConfig = {
  slug: 'clients',
  admin: {
    defaultColumns: [
      'clientNumber',
      'firstName',
      'lastName',
      'status',
      'updatedAt',
    ],
    group: 'Client operations',
    useAsTitle: 'clientNumber',
  },
  disableDuplicate: true,
  fields: [
    {
      name: 'clientNumber',
      type: 'text',
      admin: {
        description:
          'Server-generated business reference. It is not a database ID or credential and cannot be changed.',
        readOnly: true,
      },
      index: true,
      required: true,
      unique: true,
      validate: (value: unknown) =>
        parseClientNumber(value) === undefined
          ? 'Client number must use the canonical CL-XXXX-XXXX format.'
          : true,
    },
    {
      name: 'firstName',
      type: 'text',
      maxLength: 100,
      required: true,
    },
    {
      name: 'lastName',
      type: 'text',
      maxLength: 100,
      required: true,
    },
    {
      name: 'contactEmail',
      type: 'email',
      admin: {
        description:
          'Contact data only. Editing this value never changes login credentials or creates a portal identity.',
      },
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      options: CLIENT_STATUSES.map((status) => ({
        label: status,
        value: status,
      })),
      required: true,
      validate: validateClientStatus,
    },
  ],
  graphQL: false,
  hooks: {
    beforeValidate: [enforceClientInvariants],
  },
  labels: {
    plural: 'Clients',
    singular: 'Client',
  },
  timestamps: true,
};
