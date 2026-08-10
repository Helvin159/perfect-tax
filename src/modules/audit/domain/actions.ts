export const SECURITY_EVENT_ACTIONS = Object.freeze([
  'primary-owner.bootstrap.succeeded',
  'primary-owner.bootstrap.failed',
  'authentication.succeeded',
  'authentication.failed',
  'session.ended',
  'mfa.enrollment.succeeded',
  'mfa.verification.succeeded',
  'mfa.verification.failed',
  'domain-subject.disabled',
  'authorization.denied',
] as const);

export type SecurityEventAction = (typeof SECURITY_EVENT_ACTIONS)[number];

const securityEventActionSet = new Set<string>(SECURITY_EVENT_ACTIONS);

export function isSecurityEventAction(
  value: unknown,
): value is SecurityEventAction {
  return typeof value === 'string' && securityEventActionSet.has(value);
}
