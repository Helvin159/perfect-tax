import {
  AUTHORIZATION_ALLOWED,
  denyAuthorization,
  type AuthorizationDecision,
} from '../domain/decision';
import { requirePolicyPrincipal } from './principal';

/**
 * Security-event reads are owner-only at policy level. Slice 1 has no audit
 * UI, and append/update/delete remain recorder/system concerns rather than
 * principal operations.
 */
export function decideSecurityEventRead(
  principal: unknown,
): AuthorizationDecision {
  const principalResult = requirePolicyPrincipal(principal);
  if (principalResult.decision) return principalResult.decision;

  return principalResult.principal.kind === 'staff' &&
    principalResult.principal.role === 'owner'
    ? AUTHORIZATION_ALLOWED
    : denyAuthorization('forbidden-role');
}
