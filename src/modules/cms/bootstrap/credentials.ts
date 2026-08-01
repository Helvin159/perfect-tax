const MINIMUM_PASSWORD_LENGTH = 16;
const MAXIMUM_PASSWORD_LENGTH = 128;
const COMMON_PASSWORDS = new Set([
  'admin1234567890!',
  'changeme123456!',
  'password123456!',
  'perfecttax12345!',
]);

export type CmsBootstrapCredentials = Readonly<{
  email: string;
  password: string;
}>;

export class CmsBootstrapValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid CMS bootstrap credentials:\n- ${issues.join('\n- ')}`);
    this.name = 'CmsBootstrapValidationError';
    this.issues = Object.freeze([...issues]);
  }
}

function isValidEmail(value: string) {
  return (
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) &&
    !value.includes('..')
  );
}

/**
 * Validates first-administrator credentials without including credential
 * values in returned errors or logs.
 */
export function parseCmsBootstrapCredentials(source: {
  email?: string;
  password?: string;
}): CmsBootstrapCredentials {
  const issues: string[] = [];
  const email = source.email?.trim().toLowerCase() ?? '';
  const password = source.password ?? '';

  if (!email) {
    issues.push('CMS administrator email is required');
  } else if (!isValidEmail(email)) {
    issues.push('CMS administrator email must be valid');
  }

  if (!password) {
    issues.push('CMS administrator password is required');
  } else {
    if (
      password.length < MINIMUM_PASSWORD_LENGTH ||
      password.length > MAXIMUM_PASSWORD_LENGTH
    ) {
      issues.push(
        `CMS administrator password must be ${MINIMUM_PASSWORD_LENGTH}-${MAXIMUM_PASSWORD_LENGTH} characters`,
      );
    }

    const characterClasses = [
      /[a-z]/.test(password),
      /[A-Z]/.test(password),
      /\d/.test(password),
      /[^\p{L}\p{N}]/u.test(password),
    ].filter(Boolean).length;

    if (characterClasses < 3) {
      issues.push(
        'CMS administrator password must use at least three character classes',
      );
    }

    const normalizedPassword = password.toLowerCase();
    const emailLocalPart = email.split('@')[0];

    if (
      COMMON_PASSWORDS.has(normalizedPassword) ||
      (emailLocalPart.length >= 4 &&
        normalizedPassword.includes(emailLocalPart))
    ) {
      issues.push(
        'CMS administrator password is too easy to associate or guess',
      );
    }
  }

  if (issues.length > 0) {
    throw new CmsBootstrapValidationError(issues);
  }

  return Object.freeze({ email, password });
}
