import type { BetterAuthOptions } from 'better-auth';
import { twoFactor } from 'better-auth/plugins';

import {
  STAFF_MFA_POLICY,
  STAFF_MFA_SESSION_METHOD_FIELD,
  STAFF_MFA_SESSION_VERIFIED_AT_FIELD,
} from '../mfa-policy';
import { preserveMfaEnrollmentSessionClock } from '../session-clock-continuity';
import {
  PORTAL_AUTH_BASE_PATH,
  PORTAL_AUTH_COOKIE_PREFIX,
  PORTAL_AUTH_DISABLED_PATHS,
  PORTAL_AUTH_SESSION_POLICY,
} from './policy';

type PortalAuthDatabase = NonNullable<BetterAuthOptions['database']>;

export type PortalAuthOptionsInput = Readonly<{
  baseURL: string;
  database?: PortalAuthDatabase;
  secret: string;
  secureCookies: boolean;
}>;

export function createPortalAuthOptions(
  input: PortalAuthOptionsInput,
): BetterAuthOptions {
  return {
    advanced: {
      cookiePrefix: PORTAL_AUTH_COOKIE_PREFIX,
      crossSubDomainCookies: { enabled: false },
      defaultCookieAttributes: {
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        secure: input.secureCookies,
      },
      disableCSRFCheck: false,
      disableOriginCheck: false,
      trustedProxyHeaders: false,
      useSecureCookies: input.secureCookies,
    },
    appName: 'Operational Portal',
    basePath: PORTAL_AUTH_BASE_PATH,
    baseURL: input.baseURL,
    ...(input.database ? { database: input.database } : {}),
    disabledPaths: [...PORTAL_AUTH_DISABLED_PATHS],
    databaseHooks: {
      session: {
        create: { before: preserveMfaEnrollmentSessionClock },
      },
    },
    emailAndPassword: {
      disableSignUp: true,
      enabled: true,
    },
    plugins: [
      twoFactor({
        accountLockout: {
          durationSeconds: STAFF_MFA_POLICY.lockoutDuration,
          enabled: true,
          maxFailedAttempts: STAFF_MFA_POLICY.lockoutMaxFailedAttempts,
        },
        allowPasswordless: false,
        backupCodeOptions: {
          amount: STAFF_MFA_POLICY.backupCodeAmount,
          length: STAFF_MFA_POLICY.backupCodeLength,
          storeBackupCodes: 'encrypted',
        },
        issuer: STAFF_MFA_POLICY.issuer,
        skipVerificationOnEnable: false,
        totpOptions: {
          digits: STAFF_MFA_POLICY.totpDigits,
          period: STAFF_MFA_POLICY.totpPeriod,
        },
        trustDeviceMaxAge: STAFF_MFA_POLICY.trustedDeviceMaxAge,
        twoFactorCookieMaxAge: STAFF_MFA_POLICY.challengeMaxAge,
      }),
    ],
    secret: input.secret,
    session: {
      additionalFields: {
        [STAFF_MFA_SESSION_METHOD_FIELD]: {
          input: false,
          required: false,
          type: 'string',
        },
        [STAFF_MFA_SESSION_VERIFIED_AT_FIELD]: {
          input: false,
          required: false,
          type: 'date',
        },
      },
      cookieCache: { enabled: false },
      disableSessionRefresh: PORTAL_AUTH_SESSION_POLICY.disableSessionRefresh,
      expiresIn: PORTAL_AUTH_SESSION_POLICY.expiresIn,
      freshAge: PORTAL_AUTH_SESSION_POLICY.freshAge,
    },
    telemetry: { enabled: false },
    trustedOrigins: [input.baseURL],
  };
}
