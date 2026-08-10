import {
  parseAssignedClientResource,
  parseClientOwnedResource,
  type AssignedClientResource,
  type ClientOwnedResource,
} from '../domain/resource-evidence';
import {
  AUTHORIZATION_ALLOWED,
  denyAuthorization,
  type AuthorizationDecision,
} from '../domain/decision';
import { requirePolicyPrincipal } from './principal';

/** Decides Client self-ownership from trusted repository evidence only. */
export function decideClientOwnership(
  principal: unknown,
  trustedOwnershipEvidence: ClientOwnedResource | unknown,
): AuthorizationDecision {
  const principalResult = requirePolicyPrincipal(principal);
  if (principalResult.decision) return principalResult.decision;

  if (principalResult.principal.kind !== 'client') {
    return denyAuthorization('forbidden-role');
  }

  // Agent 2's guard returns a frozen canonical value. Do not canonicalize a
  // mutable browser-shaped object inside policy code and accidentally treat
  // shape validation as evidence provenance.
  if (!Object.isFrozen(trustedOwnershipEvidence)) {
    return denyAuthorization('ownership-required');
  }

  const evidence = parseClientOwnedResource(trustedOwnershipEvidence);
  if (!evidence || evidence.clientId !== principalResult.principal.clientId) {
    return denyAuthorization('ownership-required');
  }

  return AUTHORIZATION_ALLOWED;
}

/**
 * Decides future case-worker access from trusted assignment evidence. This
 * does not create or load assignments; empty, duplicate, and malformed
 * evidence denies.
 */
export function decideClientAssignment(
  principal: unknown,
  trustedAssignmentEvidence: AssignedClientResource | unknown,
): AuthorizationDecision {
  const principalResult = requirePolicyPrincipal(principal);
  if (principalResult.decision) return principalResult.decision;

  const policyPrincipal = principalResult.principal;
  if (
    policyPrincipal.kind !== 'staff' ||
    policyPrincipal.role !== 'case-worker'
  ) {
    return denyAuthorization('forbidden-role');
  }

  if (
    !Object.isFrozen(trustedAssignmentEvidence) ||
    typeof trustedAssignmentEvidence !== 'object' ||
    trustedAssignmentEvidence === null ||
    !('assignedStaffIds' in trustedAssignmentEvidence) ||
    !Object.isFrozen(trustedAssignmentEvidence.assignedStaffIds)
  ) {
    return denyAuthorization('assignment-required');
  }

  const evidence = parseAssignedClientResource(trustedAssignmentEvidence);
  if (
    !evidence ||
    evidence.assignedStaffIds.length === 0 ||
    !evidence.assignedStaffIds.includes(policyPrincipal.staffId)
  ) {
    return denyAuthorization('assignment-required');
  }

  return AUTHORIZATION_ALLOWED;
}
