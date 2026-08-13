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
import type { PolicyContext } from './principal';

export type EvidencePolicy = Readonly<{
  decideClientAssignment(
    principal: unknown,
    evidence: AssignedClientResource | unknown,
  ): AuthorizationDecision;
  decideClientOwnership(
    principal: unknown,
    evidence: ClientOwnedResource | unknown,
  ): AuthorizationDecision;
}>;

export function createEvidencePolicy(context: PolicyContext): EvidencePolicy {
  const trustedAssignmentPredicate =
    context.provenance.isTrustedAssignmentEvidence;
  const trustedOwnershipPredicate =
    context.provenance.isTrustedOwnershipEvidence;

  function decideClientOwnership(
    principal: unknown,
    ownershipEvidence: ClientOwnedResource | unknown,
  ): AuthorizationDecision {
    const principalResult = context.requirePrincipal(principal);
    if (principalResult.decision) return principalResult.decision;

    if (principalResult.principal.kind !== 'client') {
      return denyAuthorization('forbidden-role');
    }

    if (!trustedOwnershipPredicate(ownershipEvidence)) {
      return denyAuthorization('ownership-required');
    }

    // Parsing now confirms shape only. The predicate above is the authority.
    const evidence = parseClientOwnedResource(ownershipEvidence);
    if (!evidence || evidence.clientId !== principalResult.principal.clientId) {
      return denyAuthorization('ownership-required');
    }

    return AUTHORIZATION_ALLOWED;
  }

  function decideClientAssignment(
    principal: unknown,
    assignmentEvidence: AssignedClientResource | unknown,
  ): AuthorizationDecision {
    const principalResult = context.requirePrincipal(principal);
    if (principalResult.decision) return principalResult.decision;

    const policyPrincipal = principalResult.principal;
    if (
      policyPrincipal.kind !== 'staff' ||
      policyPrincipal.role !== 'case-worker'
    ) {
      return denyAuthorization('forbidden-role');
    }

    if (!trustedAssignmentPredicate(assignmentEvidence)) {
      return denyAuthorization('assignment-required');
    }

    const evidence = parseAssignedClientResource(assignmentEvidence);
    if (
      !evidence ||
      evidence.assignedStaffIds.length === 0 ||
      !evidence.assignedStaffIds.includes(policyPrincipal.staffId)
    ) {
      return denyAuthorization('assignment-required');
    }

    return AUTHORIZATION_ALLOWED;
  }

  return { decideClientAssignment, decideClientOwnership };
}
