export const STAFF_MFA_SESSION_VERIFIED_AT_FIELD = 'mfaVerifiedAt';
export const STAFF_MFA_SESSION_METHOD_FIELD = 'mfaMethod';

export const STAFF_MFA_METHODS = Object.freeze([
  'totp',
  'backup-code',
] as const);

export type StaffMfaMethod = (typeof STAFF_MFA_METHODS)[number];

export const STAFF_MFA_POLICY = Object.freeze({
  backupCodeAmount: 10,
  backupCodeLength: 10,
  challengeMaxAge: 600,
  issuer: 'Operational Portal',
  lockoutDuration: 900,
  lockoutMaxFailedAttempts: 10,
  totpDigits: 6,
  totpPeriod: 30,
  trustedDeviceMaxAge: 0,
} as const);

const staffMfaMethodSet = new Set<string>(STAFF_MFA_METHODS);

export function isStaffMfaMethod(value: unknown): value is StaffMfaMethod {
  return typeof value === 'string' && staffMfaMethodSet.has(value);
}
