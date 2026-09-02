import type { FieldHook } from 'payload';

const MAX_EMAIL_LENGTH = 254;
const WORK_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

/**
 * Staff work email is contact data. Its canonical value is deliberately
 * independent from Better Auth's login email.
 */
export function normalizeWorkEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function validateWorkEmail(value: unknown): true | string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_EMAIL_LENGTH ||
    !WORK_EMAIL_PATTERN.test(value)
  ) {
    return 'Enter a valid work email address.';
  }

  return true;
}

export const normalizeWorkEmailField: FieldHook = ({ value }) =>
  typeof value === 'string' ? normalizeWorkEmail(value) : value;
