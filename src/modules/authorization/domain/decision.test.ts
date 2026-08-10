import { describe, expect, it } from 'vitest';

import {
  AUTHORIZATION_ALLOWED,
  AUTHORIZATION_DENIAL_CODES,
  denyAuthorization,
  isAuthorizationDecision,
  isAuthorizationDenialCode,
  type AuthorizationDecision,
} from './decision';

function describeDecision(decision: AuthorizationDecision): string {
  if (decision.allowed) return 'allowed';

  return `denied:${decision.reasonCode}`;
}

describe('AuthorizationDecision contract', () => {
  it('makes allow and deny exhaustively distinguishable', () => {
    expect(describeDecision(AUTHORIZATION_ALLOWED)).toBe('allowed');
    expect(describeDecision(denyAuthorization('forbidden-role'))).toBe(
      'denied:forbidden-role',
    );
  });

  it.each(AUTHORIZATION_DENIAL_CODES)('accepts denial code %s', (code) => {
    expect(isAuthorizationDenialCode(code)).toBe(true);
    expect(isAuthorizationDecision(denyAuthorization(code))).toBe(true);
  });

  it('rejects undefined, prose, unknown codes, and malformed decisions', () => {
    expect(isAuthorizationDecision(undefined)).toBe(false);
    expect(isAuthorizationDecision({ allowed: false })).toBe(false);
    expect(
      isAuthorizationDecision({
        allowed: false,
        reasonCode: 'This user is forbidden.',
      }),
    ).toBe(false);
    expect(
      isAuthorizationDecision({
        allowed: false,
        reasonCode: 'case-document-unavailable',
      }),
    ).toBe(false);
    expect(
      isAuthorizationDecision({ allowed: true, reasonCode: 'forbidden-role' }),
    ).toBe(false);
  });
});
