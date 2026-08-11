export const PORTAL_AUTH_BASE_PATH = '/api/auth';
export const PORTAL_AUTH_COOKIE_PREFIX = 'portal-auth';
export const PORTAL_AUTH_SCHEMA = 'portal_auth';

export const PORTAL_AUTH_SESSION_POLICY = Object.freeze({
  disableSessionRefresh: true,
  expiresIn: 28_800,
  freshAge: 900,
} as const);

export const PORTAL_AUTH_DISABLED_PATHS = Object.freeze([
  '/request-password-reset',
  '/reset-password',
] as const);

/**
 * Slice 1 exposes only core credential login and database-session operations.
 * Agent 9 may add separately reviewed MFA operations without weakening this
 * allowlist.
 */
export const PORTAL_AUTH_HTTP_OPERATIONS = Object.freeze([
  'GET /get-session',
  'POST /sign-in/email',
  'POST /sign-out',
  'GET /list-sessions',
  'POST /revoke-session',
  'POST /revoke-sessions',
  'POST /revoke-other-sessions',
  'POST /two-factor/enable',
  'POST /two-factor/verify-totp',
  'POST /two-factor/verify-backup-code',
] as const);

const portalAuthHttpOperationSet = new Set<string>(PORTAL_AUTH_HTTP_OPERATIONS);

export function isPortalAuthHttpOperation(method: string, path: string) {
  return portalAuthHttpOperationSet.has(`${method.toUpperCase()} ${path}`);
}
