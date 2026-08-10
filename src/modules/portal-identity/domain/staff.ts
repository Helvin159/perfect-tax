export const STAFF_ROLES = [
  'owner',
  'administrator',
  'case-worker',
  'intake',
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_STATUSES = ['active', 'disabled'] as const;

export type StaffStatus = (typeof STAFF_STATUSES)[number];

/**
 * Shared vocabulary for the one protected primary owner. Ordinary role-change
 * contracts deliberately are not defined here.
 */
export type PrimaryOwnerMarker = Readonly<{ isPrimaryOwner: true }>;

export type PrimaryOwnerStaff = PrimaryOwnerMarker &
  Readonly<{ role: 'owner' }>;

const staffRoleSet = new Set<string>(STAFF_ROLES);
const staffStatusSet = new Set<string>(STAFF_STATUSES);

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === 'string' && staffRoleSet.has(value);
}

export function parseStaffRole(value: unknown): StaffRole | undefined {
  return isStaffRole(value) ? value : undefined;
}

export function isStaffStatus(value: unknown): value is StaffStatus {
  return typeof value === 'string' && staffStatusSet.has(value);
}

export function parseStaffStatus(value: unknown): StaffStatus | undefined {
  return isStaffStatus(value) ? value : undefined;
}
