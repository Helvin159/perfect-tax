import 'server-only';

import {
  parseAuthUserId,
  type AuthUserId,
} from '@/modules/portal-identity/domain/identifiers';

import { PORTAL_AUTH_SESSION_POLICY } from './config/policy';

type SessionLookupRuntime = Readonly<{
  api: Readonly<{
    getSession(input: { headers: Headers }): Promise<unknown>;
  }>;
}>;

export type AuthenticatedPortalSession = Readonly<{
  authUserId: AuthUserId;
  createdAt: Date;
  expiresAt: Date;
  sessionId: string;
}>;

function parseDate(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(date.getTime()) ? date : undefined;
}

export function createAuthenticatedSessionReader(
  runtime: SessionLookupRuntime,
  now: () => Date = () => new Date(),
) {
  return async function readAuthenticatedSession(headers: Headers) {
    const result = await runtime.api.getSession({ headers });

    if (!result || typeof result !== 'object') return null;
    const candidate = result as {
      session?: Record<string, unknown>;
      user?: Record<string, unknown>;
    };
    const authUserId = parseAuthUserId(candidate.user?.id);
    const sessionUserId = parseAuthUserId(candidate.session?.userId);
    const sessionId = candidate.session?.id;
    const createdAt = parseDate(candidate.session?.createdAt);
    const expiresAt = parseDate(candidate.session?.expiresAt);

    if (
      !authUserId ||
      authUserId !== sessionUserId ||
      typeof sessionId !== 'string' ||
      sessionId.length === 0 ||
      !createdAt ||
      !expiresAt ||
      expiresAt.getTime() <= now().getTime()
    ) {
      return null;
    }

    return Object.freeze({ authUserId, createdAt, expiresAt, sessionId });
  };
}

export function isFreshPortalSession(
  session: AuthenticatedPortalSession,
  now: Date = new Date(),
) {
  const age = now.getTime() - session.createdAt.getTime();
  return age >= 0 && age < PORTAL_AUTH_SESSION_POLICY.freshAge * 1_000;
}
