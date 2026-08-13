import {
  isPortalPrincipal,
  parsePortalPrincipal,
  type PortalPrincipal,
} from '../../portal-identity/domain/principal';
import { isRecord } from '../../portal-identity/domain/validation';
import {
  denyAuthorization,
  type AuthorizationDecision,
} from '../domain/decision';
import type { AuthorizationProvenance } from './provenance';

export type PrincipalPolicyResult =
  | Readonly<{ decision: AuthorizationDecision; principal?: never }>
  | Readonly<{ decision?: never; principal: PortalPrincipal }>;

export type PolicyContext = Readonly<{
  provenance: AuthorizationProvenance;
  requirePrincipal(principal: unknown): PrincipalPolicyResult;
}>;

/**
 * Builds the shared policy boundary around downstream runtime provenance.
 * Shape validation runs only after the injected predicate establishes trust.
 */
export function createPolicyContext(
  provenance: AuthorizationProvenance,
): PolicyContext {
  const trustedPrincipalPredicate = provenance.isTrustedPrincipal;

  function requirePrincipal(principal: unknown): PrincipalPolicyResult {
    if (principal === undefined || principal === null) {
      return { decision: denyAuthorization('unauthenticated') };
    }

    if (!trustedPrincipalPredicate(principal)) {
      return { decision: denyAuthorization('invalid-principal') };
    }

    if (isPortalPrincipal(principal)) {
      return { principal };
    }

    // These more specific denials are available only for values whose runtime
    // provenance was already established. A lookalike never reaches them.
    if (
      isRecord(principal) &&
      (principal.kind === 'staff' || principal.kind === 'client') &&
      (principal.status === 'disabled' || principal.status === 'inactive') &&
      parsePortalPrincipal({ ...principal, status: 'active' })
    ) {
      return { decision: denyAuthorization('inactive-subject') };
    }

    if (
      isRecord(principal) &&
      principal.kind === 'staff' &&
      principal.mfaAssurance !== 'verified' &&
      parsePortalPrincipal({ ...principal, mfaAssurance: 'verified' })
    ) {
      return { decision: denyAuthorization('mfa-required') };
    }

    return { decision: denyAuthorization('invalid-principal') };
  }

  return { provenance, requirePrincipal };
}
