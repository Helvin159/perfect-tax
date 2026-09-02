import type { Access, CollectionConfig, FieldAccess } from 'payload';

import {
  STAFF_ROLES,
  STAFF_STATUSES,
  isStaffRole,
  isStaffStatus,
} from '@/modules/portal-identity/domain/staff';

import {
  createEnforceStaffInvariants,
  enforceStaffDeleteInvariant,
  STAFF_COLLECTION_SLUG,
  type StaffInvariantOptions,
} from './domain/invariants';
import {
  normalizeWorkEmailField,
  validateWorkEmail,
} from './domain/work-email';

export const denyStaffAccess: Access = () => false;
export const denyStaffAdminAccess = () => false;
export const denyStaffFieldAccess: FieldAccess = () => false;

export const validateStaffRoleField = (value: unknown): true | string =>
  isStaffRole(value) ? true : 'Select a valid Staff role.';

export const validateStaffStatusField = (value: unknown): true | string =>
  isStaffStatus(value) ? true : 'Select a valid Staff status.';

export function createStaffCollection(
  invariantOptions: StaffInvariantOptions = {},
): CollectionConfig {
  return {
    slug: STAFF_COLLECTION_SLUG,
    access: {
      admin: denyStaffAdminAccess,
      create: denyStaffAccess,
      delete: denyStaffAccess,
      read: denyStaffAccess,
      update: denyStaffAccess,
    },
    admin: {
      defaultColumns: [
        'firstName',
        'lastName',
        'workEmail',
        'role',
        'status',
        'updatedAt',
      ],
      group: 'Portal administration',
      useAsTitle: 'workEmail',
    },
    disableBulkDelete: true,
    disableDuplicate: true,
    fields: [
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
        name: 'workEmail',
        type: 'email',
        hooks: {
          beforeValidate: [normalizeWorkEmailField],
        },
        index: true,
        required: true,
        unique: true,
        validate: validateWorkEmail,
      },
      {
        name: 'role',
        type: 'select',
        options: STAFF_ROLES.map((role) => ({ label: role, value: role })),
        required: true,
        validate: validateStaffRoleField,
      },
      {
        name: 'status',
        type: 'select',
        options: STAFF_STATUSES.map((status) => ({
          label: status,
          value: status,
        })),
        required: true,
        validate: validateStaffStatusField,
      },
      {
        name: 'isPrimaryOwner',
        type: 'checkbox',
        access: {
          create: denyStaffFieldAccess,
          read: denyStaffFieldAccess,
          update: denyStaffFieldAccess,
        },
        admin: {
          description:
            'Server-owned primary-owner marker. Owner transfer is not supported.',
          hidden: true,
        },
        defaultValue: false,
        index: true,
        required: true,
      },
    ],
    graphQL: false,
    hooks: {
      beforeChange: [createEnforceStaffInvariants(invariantOptions)],
      beforeDelete: [enforceStaffDeleteInvariant],
    },
    labels: {
      plural: 'Staff',
      singular: 'Staff member',
    },
  };
}

/**
 * Fail-closed default. Agent 13 should register a factory result wired to
 * Agent 12's private bootstrap authorizer; Agent 8 replaces collection and
 * field access at its separately reviewed policy seam.
 */
export const Staff = createStaffCollection();
