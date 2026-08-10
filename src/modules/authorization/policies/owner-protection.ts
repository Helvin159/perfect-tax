import { isSystemOperation } from '../domain/system-operation';
import {
  denyAuthorization,
  type AuthorizationDecision,
} from '../domain/decision';
import { requirePolicyPrincipal } from './principal';

export const PRIMARY_OWNER_MUTATIONS = [
  'create',
  'promote',
  'demote',
  'disable',
  'delete',
] as const;

export type PrimaryOwnerMutation = (typeof PRIMARY_OWNER_MUTATIONS)[number];

const primaryOwnerMutationSet = new Set<string>(PRIMARY_OWNER_MUTATIONS);

export function isPrimaryOwnerMutation(
  value: unknown,
): value is PrimaryOwnerMutation {
  return typeof value === 'string' && primaryOwnerMutationSet.has(value);
}

/** Normal application principals can never mutate the protected owner. */
export function decidePrimaryOwnerMutation(
  principal: unknown,
  mutation: PrimaryOwnerMutation | unknown,
): AuthorizationDecision {
  const principalResult = requirePolicyPrincipal(principal);
  if (principalResult.decision) return principalResult.decision;
  if (principalResult.principal.kind !== 'staff') {
    return denyAuthorization('forbidden-role');
  }

  return isPrimaryOwnerMutation(mutation)
    ? denyAuthorization('owner-protected')
    : denyAuthorization('forbidden-role');
}

/** System operations require Agent 10/12's unforgeable server capability. */
export function decidePrincipalSystemOperation(
  principal: unknown,
  operation: unknown,
): AuthorizationDecision {
  const principalResult = requirePolicyPrincipal(principal);
  if (principalResult.decision) return principalResult.decision;
  if (principalResult.principal.kind !== 'staff') {
    return denyAuthorization('forbidden-role');
  }

  return isSystemOperation(operation)
    ? denyAuthorization('system-capability-required')
    : denyAuthorization('forbidden-role');
}
