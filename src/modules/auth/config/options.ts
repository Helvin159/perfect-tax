import type { BetterAuthOptions } from 'better-auth';

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
    emailAndPassword: {
      disableSignUp: true,
      enabled: true,
    },
    plugins: [],
    secret: input.secret,
    session: {
      cookieCache: { enabled: false },
      disableSessionRefresh: PORTAL_AUTH_SESSION_POLICY.disableSessionRefresh,
      expiresIn: PORTAL_AUTH_SESSION_POLICY.expiresIn,
      freshAge: PORTAL_AUTH_SESSION_POLICY.freshAge,
    },
    telemetry: { enabled: false },
    trustedOrigins: [input.baseURL],
  };
}
