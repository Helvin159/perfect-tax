import type {
  AssignedClientResource,
  ClientOwnedResource,
} from '../domain/resource-evidence';
import {
  AUTHORIZATION_ALLOWED,
  denyAuthorization,
  type AuthorizationDecision,
} from '../domain/decision';
import type { EvidencePolicy } from './evidence';
import type { PolicyContext } from './principal';

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

export function createClientPolicy(
  context: PolicyContext,
  evidencePolicy: EvidencePolicy,
) {
  /**
   * Decides row-level Client access after principal provenance succeeds.
   * Client and case-worker paths additionally require trusted evidence.
   */
  function decideClientOperation(
    principal: unknown,
    operation: ClientPolicyOperation | unknown,
    evidenceInput?: ClientPolicyEvidence | unknown,
  ): AuthorizationDecision {
    const principalResult = context.requirePrincipal(principal);
    if (principalResult.decision) return principalResult.decision;
    if (!isClientPolicyOperation(operation)) {
      return denyAuthorization('forbidden-role');
    }

    const policyPrincipal = principalResult.principal;
    if (policyPrincipal.kind === 'client') {
      return operation === 'read'
        ? evidencePolicy.decideClientOwnership(policyPrincipal, evidenceInput)
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

    return evidencePolicy.decideClientAssignment(
      policyPrincipal,
      evidenceInput,
    );
  }

  function decideClientFieldUpdate(
    principal: unknown,
    field: ClientPolicyField | unknown,
    evidenceInput?: ClientPolicyEvidence | unknown,
  ): AuthorizationDecision {
    const operationDecision = decideClientOperation(
      principal,
      'basic-update',
      evidenceInput,
    );
    if (!operationDecision.allowed) return operationDecision;

    if (!isClientPolicyField(field) || !basicClientFieldSet.has(field)) {
      return denyAuthorization('field-restricted');
    }

    return AUTHORIZATION_ALLOWED;
  }

  return { decideClientFieldUpdate, decideClientOperation };
}
