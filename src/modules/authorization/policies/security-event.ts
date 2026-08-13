import {
  AUTHORIZATION_ALLOWED,
  denyAuthorization,
  type AuthorizationDecision,
} from '../domain/decision';
import type { PolicyContext } from './principal';

/**
 * Security-event reads are owner-only at policy level. Slice 1 has no audit
 * UI, and append/update/delete remain recorder/system concerns rather than
 * principal operations.
 */
export function createSecurityEventPolicy(context: PolicyContext) {
  function decideSecurityEventRead(principal: unknown): AuthorizationDecision {
    const principalResult = context.requirePrincipal(principal);
    if (principalResult.decision) return principalResult.decision;

    return principalResult.principal.kind === 'staff' &&
      principalResult.principal.role === 'owner'
      ? AUTHORIZATION_ALLOWED
      : denyAuthorization('forbidden-role');
  }

  return { decideSecurityEventRead };
}
