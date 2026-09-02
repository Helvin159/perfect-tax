import { isSystemOperation } from '../domain/system-operation';
import {
  denyAuthorization,
  type AuthorizationDecision,
} from '../domain/decision';
import type { PolicyContext } from './principal';

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
export function createOwnerProtectionPolicy(context: PolicyContext) {
  function decidePrimaryOwnerMutation(
    principal: unknown,
    mutation: PrimaryOwnerMutation | unknown,
  ): AuthorizationDecision {
    const principalResult = context.requirePrincipal(principal);
    if (principalResult.decision) return principalResult.decision;
    if (principalResult.principal.kind !== 'staff') {
      return denyAuthorization('forbidden-role');
    }

    return isPrimaryOwnerMutation(mutation)
      ? denyAuthorization('owner-protected')
      : denyAuthorization('forbidden-role');
  }

  function decidePrincipalSystemOperation(
    principal: unknown,
    operation: unknown,
  ): AuthorizationDecision {
    const principalResult = context.requirePrincipal(principal);
    if (principalResult.decision) return principalResult.decision;
    if (principalResult.principal.kind !== 'staff') {
      return denyAuthorization('forbidden-role');
    }

    return isSystemOperation(operation)
      ? denyAuthorization('system-capability-required')
      : denyAuthorization('forbidden-role');
  }

  return { decidePrimaryOwnerMutation, decidePrincipalSystemOperation };
}
