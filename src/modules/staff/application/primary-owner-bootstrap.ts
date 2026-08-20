import 'server-only';

import { normalizeWorkEmail, validateWorkEmail } from '../domain/work-email';

export const PRIMARY_OWNER_BOOTSTRAP_ENVIRONMENT_KEYS = Object.freeze({
  firstName: 'PRIMARY_OWNER_BOOTSTRAP_FIRST_NAME',
  lastName: 'PRIMARY_OWNER_BOOTSTRAP_LAST_NAME',
  loginEmail: 'PRIMARY_OWNER_BOOTSTRAP_LOGIN_EMAIL',
  password: 'PRIMARY_OWNER_BOOTSTRAP_PASSWORD',
  workEmail: 'PRIMARY_OWNER_BOOTSTRAP_WORK_EMAIL',
} as const);

export type PrimaryOwnerBootstrapInput = Readonly<{
  firstName: string;
  lastName: string;
  loginEmail: string;
  password: string;
  workEmail: string;
}>;

export type PrimaryOwnerBootstrapErrorCode =
  'ALREADY_COMPLETED' | 'BOOTSTRAP_FAILED' | 'INVALID_INPUT' | 'NOT_READY';

const SAFE_BOOTSTRAP_ERROR_MESSAGES = Object.freeze({
  ALREADY_COMPLETED:
    'Primary owner bootstrap is already completed; no changes were made.',
  BOOTSTRAP_FAILED:
    'Primary owner bootstrap failed. Review access-controlled server diagnostics.',
  INVALID_INPUT: 'Primary owner bootstrap input is invalid.',
  NOT_READY:
    'Primary owner bootstrap is not ready for this deployment; no changes were made.',
} satisfies Record<PrimaryOwnerBootstrapErrorCode, string>);

/**
 * Safe operator-facing error. It deliberately carries no cause or submitted
 * values because provider and persistence errors may contain private data.
 */
export class PrimaryOwnerBootstrapError extends Error {
  readonly code: PrimaryOwnerBootstrapErrorCode;

  constructor(code: PrimaryOwnerBootstrapErrorCode) {
    super(SAFE_BOOTSTRAP_ERROR_MESSAGES[code]);
    this.name = 'PrimaryOwnerBootstrapError';
    this.code = code;
  }
}

function parseName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 100
    ? normalized
    : undefined;
}

function parseEmail(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = normalizeWorkEmail(value);
  return validateWorkEmail(normalized) === true ? normalized : undefined;
}

/** Keeps work email and login email as separately validated concepts. */
export function parsePrimaryOwnerBootstrapInput(
  value: Readonly<Record<string, unknown>>,
): PrimaryOwnerBootstrapInput {
  const firstName = parseName(value.firstName);
  const lastName = parseName(value.lastName);
  const workEmail = parseEmail(value.workEmail);
  const loginEmail = parseEmail(value.loginEmail);
  const password =
    typeof value.password === 'string' && value.password.length > 0
      ? value.password
      : undefined;
  const displayName =
    firstName && lastName ? `${firstName} ${lastName}` : undefined;

  if (
    !firstName ||
    !lastName ||
    !workEmail ||
    !loginEmail ||
    !password ||
    !displayName ||
    displayName.length > 128
  ) {
    throw new PrimaryOwnerBootstrapError('INVALID_INPUT');
  }

  return Object.freeze({
    firstName,
    lastName,
    loginEmail,
    password,
    workEmail,
  });
}

export function readPrimaryOwnerBootstrapEnvironment(
  source: Readonly<Record<string, string | undefined>>,
): PrimaryOwnerBootstrapInput {
  return parsePrimaryOwnerBootstrapInput({
    firstName: source[PRIMARY_OWNER_BOOTSTRAP_ENVIRONMENT_KEYS.firstName],
    lastName: source[PRIMARY_OWNER_BOOTSTRAP_ENVIRONMENT_KEYS.lastName],
    loginEmail: source[PRIMARY_OWNER_BOOTSTRAP_ENVIRONMENT_KEYS.loginEmail],
    password: source[PRIMARY_OWNER_BOOTSTRAP_ENVIRONMENT_KEYS.password],
    workEmail: source[PRIMARY_OWNER_BOOTSTRAP_ENVIRONMENT_KEYS.workEmail],
  });
}
