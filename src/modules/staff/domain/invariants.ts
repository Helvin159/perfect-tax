import {
  APIError,
  type CollectionBeforeChangeHook,
  type CollectionBeforeDeleteHook,
  type CollectionSlug,
  type PayloadRequest,
  type RequestContext,
  type TypeWithID,
} from 'payload';

import type { SystemOperation } from '@/modules/authorization/domain/system-operation';
import {
  isStaffRole,
  isStaffStatus,
  type StaffRole,
  type StaffStatus,
} from '@/modules/portal-identity/domain/staff';

export const STAFF_COLLECTION_SLUG = 'staff';

export type StaffPersistenceRecord = TypeWithID & {
  firstName: string;
  isPrimaryOwner: boolean;
  lastName: string;
  role: StaffRole;
  status: StaffStatus;
  workEmail: string;
};

export type PrimaryOwnerBootstrapAuthorizationArgs = Readonly<{
  context: RequestContext;
  req: PayloadRequest;
  systemOperation: Extract<SystemOperation, 'primary-owner-bootstrap'>;
}>;

/**
 * Agent 12 supplies this predicate from its private, reason-bearing system
 * capability boundary at config-composition time. Request context values are
 * never treated as authorization by this module.
 */
export type AuthorizePrimaryOwnerBootstrap = (
  args: PrimaryOwnerBootstrapAuthorizationArgs,
) => boolean | Promise<boolean>;

export type StaffInvariantOptions = Readonly<{
  authorizePrimaryOwnerBootstrap?: AuthorizePrimaryOwnerBootstrap;
}>;

type StaffMutation = Readonly<{
  data: Partial<StaffPersistenceRecord>;
  isPrimaryOwnerBootstrap?: boolean;
  operation: 'create' | 'update';
  originalDoc?: StaffPersistenceRecord;
}>;

function invalid(message: string): never {
  throw new APIError(message, 400);
}

function protectedOwner(message: string): never {
  throw new APIError(message, 403);
}

function validateRoleAndStatus(
  role: unknown,
  status: unknown,
): asserts role is StaffRole {
  if (!isStaffRole(role)) invalid('Staff role is invalid.');
  if (!isStaffStatus(status)) invalid('Staff status is invalid.');
}

function validateMarker(marker: unknown): asserts marker is boolean {
  if (typeof marker !== 'boolean') {
    invalid('The primary-owner marker must be a boolean.');
  }
}

function isProtectedOwner(
  value: Pick<StaffPersistenceRecord, 'isPrimaryOwner' | 'role'>,
): boolean {
  return value.role === 'owner' || value.isPrimaryOwner === true;
}

/**
 * Enforces persistence invariants even when a trusted server caller bypasses
 * Payload access control. Field validation remains responsible for names and
 * work-email syntax.
 */
export function enforceStaffMutation({
  data,
  isPrimaryOwnerBootstrap = false,
  operation,
  originalDoc,
}: StaffMutation): Partial<StaffPersistenceRecord> {
  if (operation === 'create') {
    const role = data.role;
    const status = data.status;
    const marker = data.isPrimaryOwner ?? false;

    validateRoleAndStatus(role, status);
    validateMarker(marker);

    if ((role === 'owner') !== marker) {
      invalid('Owner role and primary-owner marker must be set together.');
    }

    if (role === 'owner') {
      if (!isPrimaryOwnerBootstrap) {
        protectedOwner(
          'Primary owner creation requires the system bootstrap capability.',
        );
      }
      if (status !== 'active') {
        invalid('The primary owner must be active.');
      }
    }

    return data;
  }

  if (!originalDoc) {
    protectedOwner('Staff updates require trusted original record state.');
  }

  validateRoleAndStatus(originalDoc.role, originalDoc.status);
  validateMarker(originalDoc.isPrimaryOwner);

  if ((originalDoc.role === 'owner') !== originalDoc.isPrimaryOwner) {
    protectedOwner('Stored primary-owner state is inconsistent.');
  }

  const role = data.role ?? originalDoc.role;
  const status = data.status ?? originalDoc.status;
  const marker = data.isPrimaryOwner ?? originalDoc.isPrimaryOwner;

  validateRoleAndStatus(role, status);
  validateMarker(marker);

  if (isProtectedOwner(originalDoc)) {
    if (role !== 'owner' || marker !== true) {
      protectedOwner('The primary owner cannot be demoted or unmarked.');
    }
    if (status !== 'active') {
      protectedOwner('The primary owner cannot be disabled.');
    }
    return data;
  }

  if (role === 'owner' || marker === true) {
    protectedOwner('Normal Staff updates cannot promote a primary owner.');
  }

  return data;
}

export function createEnforceStaffInvariants(
  options: StaffInvariantOptions = {},
): CollectionBeforeChangeHook<StaffPersistenceRecord> {
  return async ({ context, data, operation, originalDoc, req }) => {
    const requestsOwnerCreation =
      operation === 'create' &&
      (data.role === 'owner' || data.isPrimaryOwner === true);

    const isPrimaryOwnerBootstrap = requestsOwnerCreation
      ? await (options.authorizePrimaryOwnerBootstrap?.({
          context,
          req,
          systemOperation: 'primary-owner-bootstrap',
        }) ?? false)
      : false;

    return enforceStaffMutation({
      data,
      isPrimaryOwnerBootstrap,
      operation,
      originalDoc,
    });
  };
}

export function enforceStaffDeletion(
  record: Pick<StaffPersistenceRecord, 'isPrimaryOwner' | 'role'>,
): void {
  if (isProtectedOwner(record)) {
    protectedOwner('The primary owner cannot be deleted.');
  }
}

/**
 * Payload runs beforeDelete before it proves that a query constraint matches
 * the target. Load the target independently, with the same request and
 * transaction, before allowing deletion to proceed.
 */
export const enforceStaffDeleteInvariant: CollectionBeforeDeleteHook = async ({
  id,
  req,
}) => {
  const record = (await req.payload.findByID({
    collection: STAFF_COLLECTION_SLUG as CollectionSlug,
    depth: 0,
    id,
    overrideAccess: true,
    req,
    select: {
      isPrimaryOwner: true,
      role: true,
    },
  })) as unknown as Pick<StaffPersistenceRecord, 'isPrimaryOwner' | 'role'>;

  enforceStaffDeletion(record);
};
