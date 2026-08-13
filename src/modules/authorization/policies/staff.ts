import {
  parseStaffId,
  type StaffId,
} from '../../portal-identity/domain/identifiers';
import {
  isStaffRole,
  type StaffRole,
} from '../../portal-identity/domain/staff';
import {
  hasExactKeys,
  isRecord,
} from '../../portal-identity/domain/validation';
import {
  AUTHORIZATION_ALLOWED,
  denyAuthorization,
  type AuthorizationDecision,
} from '../domain/decision';
import type { PolicyContext } from './principal';

export const STAFF_POLICY_OPERATIONS = [
  'read',
  'create',
  'basic-update',
  'disable',
  'delete',
] as const;

export type StaffPolicyOperation = (typeof STAFF_POLICY_OPERATIONS)[number];

export const STAFF_POLICY_FIELDS = [
  'id',
  'firstName',
  'lastName',
  'workEmail',
  'role',
  'status',
  'isPrimaryOwner',
  'authUserId',
  'portalIdentity',
  'createdAt',
  'updatedAt',
] as const;

export type StaffPolicyField = (typeof STAFF_POLICY_FIELDS)[number];

export type StaffResourceEvidence = Readonly<{
  isPrimaryOwner: boolean;
  role: StaffRole;
  staffId: StaffId;
}>;

export type StaffCreationEvidence = Readonly<{
  isPrimaryOwner: boolean;
  role: StaffRole;
}>;

const staffPolicyOperationSet = new Set<string>(STAFF_POLICY_OPERATIONS);
const staffPolicyFieldSet = new Set<string>(STAFF_POLICY_FIELDS);
const basicStaffFieldSet = new Set<string>([
  'firstName',
  'lastName',
  'workEmail',
]);

export function isStaffPolicyOperation(
  value: unknown,
): value is StaffPolicyOperation {
  return typeof value === 'string' && staffPolicyOperationSet.has(value);
}

export function isStaffPolicyField(value: unknown): value is StaffPolicyField {
  return typeof value === 'string' && staffPolicyFieldSet.has(value);
}

function parseStaffResourceEvidence(
  value: unknown,
): StaffResourceEvidence | undefined {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['isPrimaryOwner', 'role', 'staffId']) ||
    typeof value.isPrimaryOwner !== 'boolean' ||
    !isStaffRole(value.role)
  ) {
    return undefined;
  }

  const staffId = parseStaffId(value.staffId);
  if (!staffId || value.isPrimaryOwner !== (value.role === 'owner')) {
    return undefined;
  }

  return {
    isPrimaryOwner: value.isPrimaryOwner,
    role: value.role,
    staffId,
  };
}

function parseStaffCreationEvidence(
  value: unknown,
): StaffCreationEvidence | undefined {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['isPrimaryOwner', 'role']) ||
    typeof value.isPrimaryOwner !== 'boolean' ||
    !isStaffRole(value.role) ||
    value.isPrimaryOwner !== (value.role === 'owner')
  ) {
    return undefined;
  }

  return {
    isPrimaryOwner: value.isPrimaryOwner,
    role: value.role,
  };
}

/**
 * Decides ordinary, non-owner-protected Staff operations. Primary-owner
 * creation and mutation must also pass decidePrimaryOwnerMutation, which
 * always denies normal principals.
 *
 * Slice 1 implements no Staff lifecycle service. These decisions define the
 * boundary for later services without making those services applicable now.
 */
export function createStaffPolicy(context: PolicyContext) {
  const trustedCreationPredicate =
    context.provenance.isTrustedStaffCreationEvidence;
  const trustedResourcePredicate =
    context.provenance.isTrustedStaffResourceEvidence;

  function decideStaffOperation(
    principal: unknown,
    operation: StaffPolicyOperation | unknown,
    evidenceInput?: StaffResourceEvidence | StaffCreationEvidence | unknown,
  ): AuthorizationDecision {
    const principalResult = context.requirePrincipal(principal);
    if (principalResult.decision) return principalResult.decision;
    if (!isStaffPolicyOperation(operation)) {
      return denyAuthorization('forbidden-role');
    }

    const policyPrincipal = principalResult.principal;
    if (policyPrincipal.kind !== 'staff') {
      return denyAuthorization('forbidden-role');
    }

    if (operation === 'read') {
      if (
        policyPrincipal.role === 'owner' ||
        policyPrincipal.role === 'administrator'
      ) {
        return AUTHORIZATION_ALLOWED;
      }

      if (!trustedResourcePredicate(evidenceInput)) {
        return denyAuthorization('forbidden-role');
      }

      const target = parseStaffResourceEvidence(evidenceInput);
      return target?.staffId === policyPrincipal.staffId
        ? AUTHORIZATION_ALLOWED
        : denyAuthorization('forbidden-role');
    }

    if (operation === 'create') {
      if (!trustedCreationPredicate(evidenceInput)) {
        return denyAuthorization('owner-protected');
      }
      const evidence = parseStaffCreationEvidence(evidenceInput);
      if (!evidence || evidence.isPrimaryOwner || evidence.role === 'owner') {
        return denyAuthorization('owner-protected');
      }
    }

    if (operation === 'disable' || operation === 'delete') {
      if (!trustedResourcePredicate(evidenceInput)) {
        return denyAuthorization('owner-protected');
      }
      const evidence = parseStaffResourceEvidence(evidenceInput);
      if (!evidence || evidence.isPrimaryOwner || evidence.role === 'owner') {
        return denyAuthorization('owner-protected');
      }
    }

    return policyPrincipal.role === 'owner'
      ? AUTHORIZATION_ALLOWED
      : denyAuthorization('forbidden-role');
  }

  function decideStaffFieldUpdate(
    principal: unknown,
    field: StaffPolicyField | unknown,
  ): AuthorizationDecision {
    const operationDecision = decideStaffOperation(principal, 'basic-update');
    if (!operationDecision.allowed) return operationDecision;

    if (!isStaffPolicyField(field) || !basicStaffFieldSet.has(field)) {
      return denyAuthorization('field-restricted');
    }

    return AUTHORIZATION_ALLOWED;
  }

  return { decideStaffFieldUpdate, decideStaffOperation };
}
