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

export type PrincipalPolicyResult =
  | Readonly<{ decision: AuthorizationDecision; principal?: never }>
  | Readonly<{ decision?: never; principal: PortalPrincipal }>;

/**
 * Keeps policy entry points fail-closed at runtime without turning a parsed
 * browser value into a trusted principal. Callers must still supply the
 * resolver-attested principal required by the bridge contract.
 */
export function requirePolicyPrincipal(
  principal: unknown,
): PrincipalPolicyResult {
  if (principal === undefined || principal === null) {
    return Object.freeze({
      decision: denyAuthorization('unauthenticated'),
    });
  }

  if (isPortalPrincipal(principal)) {
    return Object.freeze({ principal });
  }

  if (
    isRecord(principal) &&
    (principal.kind === 'staff' || principal.kind === 'client') &&
    (principal.status === 'disabled' || principal.status === 'inactive') &&
    parsePortalPrincipal({ ...principal, status: 'active' })
  ) {
    return Object.freeze({
      decision: denyAuthorization('inactive-subject'),
    });
  }

  if (
    isRecord(principal) &&
    principal.kind === 'staff' &&
    principal.mfaAssurance !== 'verified' &&
    parsePortalPrincipal({ ...principal, mfaAssurance: 'verified' })
  ) {
    return Object.freeze({ decision: denyAuthorization('mfa-required') });
  }

  return Object.freeze({
    decision: denyAuthorization('invalid-principal'),
  });
}
