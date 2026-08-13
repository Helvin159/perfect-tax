import 'server-only';

import { parseAuthUserId } from '@/modules/portal-identity/domain/identifiers';

type SessionClock = Readonly<{
  createdAt: Date;
  expiresAt: Date;
}>;

type SessionCreateInput = Record<string, unknown>;

type SessionCreateContext = Readonly<{
  context?: Readonly<{
    session?: Readonly<{
      session?: Record<string, unknown>;
    }> | null;
  }>;
  path?: string;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseDate(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(date.getTime()) ? date : undefined;
}

export function parseSessionClock(value: unknown): SessionClock | undefined {
  if (!isRecord(value)) return undefined;
  const createdAt = parseDate(value.createdAt);
  const expiresAt = parseDate(value.expiresAt);
  if (!createdAt || !expiresAt || createdAt >= expiresAt) return undefined;
  return Object.freeze({ createdAt, expiresAt });
}

/**
 * Better Auth 1.6.23 creates a replacement session after the first successful
 * TOTP enrollment verification. Its `createSession` implementation otherwise
 * overwrites the trusted active session's clocks. This official database hook
 * restores those clocks only for that authenticated rotation and only when the
 * old and new sessions are bound to the same Better Auth user.
 */
export async function preserveMfaEnrollmentSessionClock(
  candidate: SessionCreateInput,
  endpointContext: SessionCreateContext | null,
) {
  if (endpointContext?.path !== '/two-factor/verify-totp') return;

  const original = endpointContext.context?.session?.session;
  if (!original) return;

  const candidateUserId = parseAuthUserId(candidate.userId);
  const originalUserId = parseAuthUserId(original.userId);
  const candidateToken = candidate.token;
  const originalToken = original.token;
  const candidateClock = parseSessionClock(candidate);
  const originalClock = parseSessionClock(original);

  if (
    !candidateUserId ||
    candidateUserId !== originalUserId ||
    typeof candidateToken !== 'string' ||
    candidateToken.length === 0 ||
    typeof originalToken !== 'string' ||
    originalToken.length === 0 ||
    candidateToken === originalToken ||
    !candidateClock ||
    !originalClock ||
    originalClock.createdAt > candidateClock.createdAt ||
    originalClock.expiresAt <= candidateClock.createdAt
  ) {
    return;
  }

  return {
    data: {
      createdAt: originalClock.createdAt,
      expiresAt: new Date(
        Math.min(
          originalClock.expiresAt.getTime(),
          candidateClock.expiresAt.getTime(),
        ),
      ),
    },
  };
}

function getSetCookies(headers: Headers) {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] })
    .getSetCookie;
  if (typeof getSetCookie === 'function') return getSetCookie.call(headers);
  const combined = headers.get('set-cookie');
  return combined ? [combined] : [];
}

function isPortalSessionCookie(cookie: string) {
  const name = cookie.slice(0, cookie.indexOf('='));
  return (
    name === 'portal-auth.session_token' ||
    name === '__Secure-portal-auth.session_token'
  );
}

function capCookie(cookie: string, expiresAt: Date, maxAge: number) {
  const attributes = cookie.split(';').map((part) => part.trim());
  let hasExpires = false;
  let hasMaxAge = false;

  const capped = attributes.map((attribute, index) => {
    if (index === 0) return attribute;
    if (/^expires=/i.test(attribute)) {
      hasExpires = true;
      return `Expires=${expiresAt.toUTCString()}`;
    }
    if (/^max-age=/i.test(attribute)) {
      hasMaxAge = true;
      return `Max-Age=${maxAge}`;
    }
    return attribute;
  });

  if (!hasExpires) capped.push(`Expires=${expiresAt.toUTCString()}`);
  if (!hasMaxAge) capped.push(`Max-Age=${maxAge}`);
  return capped.join('; ');
}

/** Caps the replacement browser cookie to the provider-persisted deadline. */
export function capPortalSessionCookieToDeadline(
  headers: Headers,
  expiresAt: Date,
  now: Date = new Date(),
) {
  const cookies = getSetCookies(headers);
  if (!cookies.some(isPortalSessionCookie)) return headers;

  const remainingSeconds = Math.max(
    0,
    Math.floor((expiresAt.getTime() - now.getTime()) / 1_000),
  );
  const cappedHeaders = new Headers(headers);
  cappedHeaders.delete('set-cookie');
  for (const cookie of cookies) {
    cappedHeaders.append(
      'set-cookie',
      isPortalSessionCookie(cookie)
        ? capCookie(cookie, expiresAt, remainingSeconds)
        : cookie,
    );
  }
  return cappedHeaders;
}
