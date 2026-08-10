import {
  hasExactKeys,
  isRecord,
} from '../../portal-identity/domain/validation';

export const AUTHORIZATION_DENIAL_CODES = [
  'unauthenticated',
  'invalid-principal',
  'inactive-subject',
  'mfa-required',
  'forbidden-role',
  'ownership-required',
  'assignment-required',
  'field-restricted',
  'owner-protected',
  'system-capability-required',
] as const;

export type AuthorizationDenialCode =
  (typeof AUTHORIZATION_DENIAL_CODES)[number];

export type AuthorizationDecision =
  | Readonly<{ allowed: true }>
  | Readonly<{
      allowed: false;
      reasonCode: AuthorizationDenialCode;
    }>;

export const AUTHORIZATION_ALLOWED: AuthorizationDecision = Object.freeze({
  allowed: true,
});

const denialCodeSet = new Set<string>(AUTHORIZATION_DENIAL_CODES);

export function isAuthorizationDenialCode(
  value: unknown,
): value is AuthorizationDenialCode {
  return typeof value === 'string' && denialCodeSet.has(value);
}

export function denyAuthorization(
  reasonCode: AuthorizationDenialCode,
): AuthorizationDecision {
  return Object.freeze({ allowed: false, reasonCode });
}

export function isAuthorizationDecision(
  value: unknown,
): value is AuthorizationDecision {
  if (!isRecord(value)) return false;

  if (value.allowed === true) {
    return hasExactKeys(value, ['allowed']);
  }

  return (
    value.allowed === false &&
    hasExactKeys(value, ['allowed', 'reasonCode']) &&
    isAuthorizationDenialCode(value.reasonCode)
  );
}
