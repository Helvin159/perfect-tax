import type {
  AssignedClientResource,
  ClientOwnedResource,
} from '../domain/resource-evidence';
import {
  AUTHORIZATION_ALLOWED,
  denyAuthorization,
  type AuthorizationDecision,
} from '../domain/decision';
import { decideClientAssignment, decideClientOwnership } from './evidence';
import { requirePolicyPrincipal } from './principal';

export const CLIENT_POLICY_OPERATIONS = [
  'read',
  'create',
  'basic-update',
] as const;

export type ClientPolicyOperation = (typeof CLIENT_POLICY_OPERATIONS)[number];

export const CLIENT_POLICY_FIELDS = [
  'id',
  'clientNumber',
  'firstName',
  'lastName',
  'contactEmail',
  'phone',
  'status',
  'authUserId',
  'portalIdentity',
  'createdAt',
  'updatedAt',
] as const;

export type ClientPolicyField = (typeof CLIENT_POLICY_FIELDS)[number];

export type ClientPolicyEvidence = ClientOwnedResource | AssignedClientResource;

const clientPolicyOperationSet = new Set<string>(CLIENT_POLICY_OPERATIONS);
const clientPolicyFieldSet = new Set<string>(CLIENT_POLICY_FIELDS);
const basicClientFieldSet = new Set<string>([
  'firstName',
  'lastName',
  'contactEmail',
  'phone',
]);

export function isClientPolicyOperation(
  value: unknown,
): value is ClientPolicyOperation {
  return typeof value === 'string' && clientPolicyOperationSet.has(value);
}

export function isClientPolicyField(
  value: unknown,
): value is ClientPolicyField {
  return typeof value === 'string' && clientPolicyFieldSet.has(value);
}

/**
 * Decides row-level Client access. Owner/administrator have Slice 1
 * operational access; intake has basic-record access; case workers require
 * matching future assignment evidence. Client principals may read only their
 * own record and cannot create or self-edit in Slice 1.
 */
export function decideClientOperation(
  principal: unknown,
  operation: ClientPolicyOperation | unknown,
  trustedEvidence?: ClientPolicyEvidence | unknown,
): AuthorizationDecision {
  const principalResult = requirePolicyPrincipal(principal);
  if (principalResult.decision) return principalResult.decision;
  if (!isClientPolicyOperation(operation)) {
    return denyAuthorization('forbidden-role');
  }

  const policyPrincipal = principalResult.principal;
  if (policyPrincipal.kind === 'client') {
    return operation === 'read'
      ? decideClientOwnership(policyPrincipal, trustedEvidence)
      : denyAuthorization('forbidden-role');
  }

  if (policyPrincipal.kind !== 'staff') {
    return denyAuthorization('forbidden-role');
  }

  if (
    policyPrincipal.role === 'owner' ||
    policyPrincipal.role === 'administrator' ||
    policyPrincipal.role === 'intake'
  ) {
    return AUTHORIZATION_ALLOWED;
  }

  if (operation === 'create') {
    return denyAuthorization('assignment-required');
  }

  return decideClientAssignment(policyPrincipal, trustedEvidence);
}

/**
 * Applies an explicit allowlist after row-level basic-update authorization.
 * Collection access never implies that server-owned identity or lifecycle
 * fields are writable.
 */
export function decideClientFieldUpdate(
  principal: unknown,
  field: ClientPolicyField | unknown,
  trustedEvidence?: ClientPolicyEvidence | unknown,
): AuthorizationDecision {
  const operationDecision = decideClientOperation(
    principal,
    'basic-update',
    trustedEvidence,
  );
  if (!operationDecision.allowed) return operationDecision;

  if (!isClientPolicyField(field) || !basicClientFieldSet.has(field)) {
    return denyAuthorization('field-restricted');
  }

  return AUTHORIZATION_ALLOWED;
}
