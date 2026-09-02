import 'server-only';

import type {
  Access,
  CollectionBeforeDeleteHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
  Field,
} from 'payload';

import { parseAuthUserId } from '../domain/identifiers';
import { PORTAL_SUBJECT_KINDS } from '../domain/portal-identity';
import { hasExactKeys, isRecord } from '../domain/validation';

export const PORTAL_IDENTITIES_SLUG = 'portal-identities' as const;

export type PortalIdentityPersistenceRecord = Readonly<{
  authUserId: string;
  client?: number | null;
  staff?: number | null;
  subjectType: 'staff' | 'client';
}>;

export class PortalIdentityInvariantError extends Error {
  constructor(
    public readonly code:
      | 'dual-subject'
      | 'immutable-binding'
      | 'invalid-auth-user-id'
      | 'invalid-subject'
      | 'subject-type-mismatch'
      | 'unexpected-field',
  ) {
    super(`PortalIdentity invariant violated: ${code}`);
    this.name = 'PortalIdentityInvariantError';
  }
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

const PAYLOAD_PORTAL_IDENTITY_CREATE_KEYS = [
  'authUserId',
  'client',
  'createdAt',
  'staff',
  'subjectType',
  'updatedAt',
] as const;

/**
 * Payload 3.86.0 field validation visits every configured relationship before
 * collection hooks. On create it therefore adds the omitted relationship and
 * timestamp fields as own `undefined` properties. Convert only that reviewed
 * hook representation to the stricter canonical persistence shape; arbitrary
 * objects are never accepted as a relationship identity.
 */
export function normalizePayloadPortalIdentityCreateData(
  value: unknown,
): unknown {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, PAYLOAD_PORTAL_IDENTITY_CREATE_KEYS)
  ) {
    throw new PortalIdentityInvariantError('unexpected-field');
  }

  if (value.createdAt !== undefined || value.updatedAt !== undefined) {
    throw new PortalIdentityInvariantError('unexpected-field');
  }

  if (value.subjectType === 'staff' && value.client === undefined) {
    return {
      authUserId: value.authUserId,
      staff: value.staff,
      subjectType: value.subjectType,
    };
  }

  if (value.subjectType === 'client' && value.staff === undefined) {
    return {
      authUserId: value.authUserId,
      client: value.client,
      subjectType: value.subjectType,
    };
  }

  return value;
}

/**
 * Validates the persistence shape without deriving a binding from email or any
 * provider-owned field. This runs even when a trusted service bypasses access.
 */
export function parsePortalIdentityPersistenceRecord(
  value: unknown,
): PortalIdentityPersistenceRecord {
  if (!isRecord(value)) {
    throw new PortalIdentityInvariantError('invalid-subject');
  }

  const authUserId = parseAuthUserId(value.authUserId);
  if (authUserId === undefined) {
    throw new PortalIdentityInvariantError('invalid-auth-user-id');
  }

  const hasStaff = value.staff !== undefined && value.staff !== null;
  const hasClient = value.client !== undefined && value.client !== null;

  if (hasStaff && hasClient) {
    throw new PortalIdentityInvariantError('dual-subject');
  }

  if (value.subjectType === 'staff') {
    if (!hasStaff || hasClient || !isPositiveInteger(value.staff)) {
      throw new PortalIdentityInvariantError('subject-type-mismatch');
    }
    if (!hasExactKeys(value, ['authUserId', 'staff', 'subjectType'])) {
      throw new PortalIdentityInvariantError('unexpected-field');
    }

    return Object.freeze({
      authUserId,
      staff: value.staff,
      subjectType: 'staff',
    });
  }

  if (value.subjectType === 'client') {
    if (!hasClient || hasStaff || !isPositiveInteger(value.client)) {
      throw new PortalIdentityInvariantError('subject-type-mismatch');
    }
    if (!hasExactKeys(value, ['authUserId', 'client', 'subjectType'])) {
      throw new PortalIdentityInvariantError('unexpected-field');
    }

    return Object.freeze({
      authUserId,
      client: value.client,
      subjectType: 'client',
    });
  }

  if (!hasStaff && !hasClient) {
    throw new PortalIdentityInvariantError('invalid-subject');
  }

  throw new PortalIdentityInvariantError('subject-type-mismatch');
}

export const enforcePortalIdentityInvariants: CollectionBeforeValidateHook = ({
  data,
  operation,
}) => {
  if (operation === 'update') {
    throw new PortalIdentityInvariantError('immutable-binding');
  }

  if (operation !== 'create') {
    return data;
  }

  return parsePortalIdentityPersistenceRecord(
    normalizePayloadPortalIdentityCreateData(data),
  );
};

export const denyPortalIdentityAccess: Access = () => false;

/** Binding teardown is not a Slice 1 lifecycle operation, even under bypass. */
export const denyPortalIdentityDelete: CollectionBeforeDeleteHook = () => {
  throw new PortalIdentityInvariantError('immutable-binding');
};

const immutableRelationshipField = (
  name: 'client' | 'staff',
  relationTo: 'clients' | 'staff',
): Field => ({
  name,
  type: 'relationship',
  admin: {
    readOnly: true,
  },
  index: true,
  // Agent 13 owns registration and regenerated Payload CollectionSlug types.
  relationTo: relationTo as never,
  unique: true,
});

/**
 * Private infrastructure collection. Agent 13 owns central registration;
 * later trusted services may create records through a reviewed server-only
 * path, while ordinary Payload and Admin access remains denied.
 */
export const PortalIdentities: CollectionConfig = {
  slug: PORTAL_IDENTITIES_SLUG,
  access: {
    create: denyPortalIdentityAccess,
    delete: denyPortalIdentityAccess,
    read: denyPortalIdentityAccess,
    update: denyPortalIdentityAccess,
  },
  admin: {
    hidden: true,
  },
  disableBulkDelete: true,
  disableDuplicate: true,
  fields: [
    {
      name: 'authUserId',
      type: 'text',
      admin: {
        readOnly: true,
      },
      index: true,
      maxLength: 255,
      required: true,
      unique: true,
    },
    {
      name: 'subjectType',
      type: 'select',
      admin: {
        readOnly: true,
      },
      options: PORTAL_SUBJECT_KINDS.map((subjectType) => ({
        label: subjectType,
        value: subjectType,
      })),
      required: true,
    },
    immutableRelationshipField('staff', 'staff'),
    immutableRelationshipField('client', 'clients'),
  ],
  graphQL: false,
  hooks: {
    beforeDelete: [denyPortalIdentityDelete],
    beforeValidate: [enforcePortalIdentityInvariants],
  },
  labels: {
    plural: 'Portal identities',
    singular: 'Portal identity',
  },
  timestamps: true,
};
