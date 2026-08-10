import {
  parseAuthUserId,
  parseClientId,
  parseStaffId,
  type AuthUserId,
  type ClientId,
  type StaffId,
} from './identifiers';
import { hasExactKeys, isRecord } from './validation';

export const PORTAL_SUBJECT_KINDS = ['staff', 'client'] as const;

export type PortalSubjectKind = (typeof PORTAL_SUBJECT_KINDS)[number];

export type PortalIdentity =
  | Readonly<{
      authUserId: AuthUserId;
      subjectKind: 'staff';
      staffId: StaffId;
    }>
  | Readonly<{
      authUserId: AuthUserId;
      clientId: ClientId;
      subjectKind: 'client';
    }>;

const portalSubjectKindSet = new Set<string>(PORTAL_SUBJECT_KINDS);

export function isPortalSubjectKind(
  value: unknown,
): value is PortalSubjectKind {
  return typeof value === 'string' && portalSubjectKindSet.has(value);
}

export function parsePortalSubjectKind(
  value: unknown,
): PortalSubjectKind | undefined {
  return isPortalSubjectKind(value) ? value : undefined;
}

/**
 * Strictly parses immutable account-to-subject binding facts. PortalIdentity
 * intentionally has no lifecycle status, email, role, or provider fields.
 */
export function parsePortalIdentity(
  value: unknown,
): PortalIdentity | undefined {
  if (!isRecord(value)) return undefined;

  const authUserId = parseAuthUserId(value.authUserId);
  if (!authUserId) return undefined;

  if (
    value.subjectKind === 'staff' &&
    hasExactKeys(value, ['authUserId', 'subjectKind', 'staffId'])
  ) {
    const staffId = parseStaffId(value.staffId);
    return staffId
      ? Object.freeze({ authUserId, staffId, subjectKind: 'staff' })
      : undefined;
  }

  if (
    value.subjectKind === 'client' &&
    hasExactKeys(value, ['authUserId', 'clientId', 'subjectKind'])
  ) {
    const clientId = parseClientId(value.clientId);
    return clientId
      ? Object.freeze({ authUserId, clientId, subjectKind: 'client' })
      : undefined;
  }

  return undefined;
}

export function isPortalIdentity(value: unknown): value is PortalIdentity {
  return parsePortalIdentity(value) !== undefined;
}
