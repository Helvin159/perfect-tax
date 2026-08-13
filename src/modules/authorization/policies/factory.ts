import { createClientPolicy } from './client';
import { createEvidencePolicy } from './evidence';
import { createOwnerProtectionPolicy } from './owner-protection';
import { createPolicyContext } from './principal';
import {
  normalizeAuthorizationProvenance,
  type AuthorizationProvenance,
} from './provenance';
import { createSecurityEventPolicy } from './security-event';
import { createStaffPolicy } from './staff';

/**
 * Creates pure policy evaluators around provenance predicates owned by the
 * trusted Agent 10/11 composition layer. Supplying a parser or shape check as
 * a provenance predicate is a security defect.
 */
export function createAuthorizationPolicies(
  provenance: AuthorizationProvenance,
) {
  const context = createPolicyContext(
    normalizeAuthorizationProvenance(provenance),
  );
  const evidencePolicy = createEvidencePolicy(context);

  return {
    ...createClientPolicy(context, evidencePolicy),
    ...evidencePolicy,
    ...createOwnerProtectionPolicy(context),
    ...createSecurityEventPolicy(context),
    ...createStaffPolicy(context),
  };
}

export type AuthorizationPolicies = ReturnType<
  typeof createAuthorizationPolicies
>;
