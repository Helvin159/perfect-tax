import type { ContactEmail } from '@/modules/portal-identity/domain/email-ownership';

const MAXIMUM_EMAIL_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Normalizes Client contact data without treating it as login identity.
 * The convention intentionally matches the repository's existing email
 * handling: trim surrounding whitespace and lowercase the complete address.
 */
export function normalizeContactEmail(
  value: unknown,
): ContactEmail | undefined {
  if (typeof value !== 'string') return undefined;

  const normalized = value.trim().toLowerCase();

  if (
    normalized.length === 0 ||
    normalized.length > MAXIMUM_EMAIL_LENGTH ||
    !EMAIL_PATTERN.test(normalized) ||
    normalized.includes('..')
  ) {
    return undefined;
  }

  return normalized as ContactEmail;
}
