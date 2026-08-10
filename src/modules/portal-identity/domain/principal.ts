import {
  parseAuthUserId,
  parseClientId,
  parseStaffId,
  type AuthUserId,
  type ClientId,
  type StaffId,
} from './identifiers';
import { isStaffRole, type StaffRole } from './staff';
import { hasExactKeys, isRecord } from './validation';

export const PORTAL_PRINCIPAL_KINDS = [
  'staff',
  'client',
  'staff-enrollment',
] as const;

export type PortalPrincipalKind = (typeof PORTAL_PRINCIPAL_KINDS)[number];

export const STAFF_ENROLLMENT_OPERATIONS = Object.freeze([
  'enroll-mfa',
  'verify-mfa',
  'sign-out',
] as const);

export type StaffEnrollmentOperation =
  (typeof STAFF_ENROLLMENT_OPERATIONS)[number];

export type StaffPrincipal = Readonly<{
  authUserId: AuthUserId;
  kind: 'staff';
  mfaAssurance: 'verified';
  role: StaffRole;
  staffId: StaffId;
  status: 'active';
}>;

export type ClientPrincipal = Readonly<{
  authUserId: AuthUserId;
  clientId: ClientId;
  kind: 'client';
  status: 'active';
}>;

export type StaffEnrollmentPrincipal = Readonly<{
  allowedOperations: typeof STAFF_ENROLLMENT_OPERATIONS;
  authUserId: AuthUserId;
  kind: 'staff-enrollment';
  staffId: StaffId;
}>;

export type PortalPrincipal =
  StaffPrincipal | ClientPrincipal | StaffEnrollmentPrincipal;

const portalPrincipalKindSet = new Set<string>(PORTAL_PRINCIPAL_KINDS);

export function isPortalPrincipalKind(
  value: unknown,
): value is PortalPrincipalKind {
  return typeof value === 'string' && portalPrincipalKindSet.has(value);
}

export function parsePortalPrincipalKind(
  value: unknown,
): PortalPrincipalKind | undefined {
  return isPortalPrincipalKind(value) ? value : undefined;
}

function hasEnrollmentOperations(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length === STAFF_ENROLLMENT_OPERATIONS.length &&
    STAFF_ENROLLMENT_OPERATIONS.every(
      (operation, index) => value[index] === operation,
    )
  );
}

/**
 * Parses only the provider-independent principal projection. The result is
 * still untrusted data: only the future server-only resolver/gateway may bind
 * it to Agent 1's module-private runtime capability.
 */
export function parsePortalPrincipal(
  value: unknown,
): PortalPrincipal | undefined {
  if (!isRecord(value)) return undefined;

  const authUserId = parseAuthUserId(value.authUserId);
  if (!authUserId) return undefined;

  if (
    value.kind === 'staff' &&
    hasExactKeys(value, [
      'authUserId',
      'kind',
      'mfaAssurance',
      'role',
      'staffId',
      'status',
    ])
  ) {
    const staffId = parseStaffId(value.staffId);
    if (
      !staffId ||
      !isStaffRole(value.role) ||
      value.status !== 'active' ||
      value.mfaAssurance !== 'verified'
    ) {
      return undefined;
    }

    return Object.freeze({
      authUserId,
      kind: 'staff',
      mfaAssurance: 'verified',
      role: value.role,
      staffId,
      status: 'active',
    });
  }

  if (
    value.kind === 'client' &&
    hasExactKeys(value, ['authUserId', 'clientId', 'kind', 'status'])
  ) {
    const clientId = parseClientId(value.clientId);
    if (!clientId || value.status !== 'active') return undefined;

    return Object.freeze({
      authUserId,
      clientId,
      kind: 'client',
      status: 'active',
    });
  }

  if (
    value.kind === 'staff-enrollment' &&
    hasExactKeys(value, ['allowedOperations', 'authUserId', 'kind', 'staffId'])
  ) {
    const staffId = parseStaffId(value.staffId);
    if (!staffId || !hasEnrollmentOperations(value.allowedOperations)) {
      return undefined;
    }

    return Object.freeze({
      allowedOperations: STAFF_ENROLLMENT_OPERATIONS,
      authUserId,
      kind: 'staff-enrollment',
      staffId,
    });
  }

  return undefined;
}

export function isPortalPrincipal(value: unknown): value is PortalPrincipal {
  return parsePortalPrincipal(value) !== undefined;
}
