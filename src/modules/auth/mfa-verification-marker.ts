import 'server-only';

import { parseAuthUserId } from '@/modules/portal-identity/domain/identifiers';

import {
  STAFF_MFA_SESSION_METHOD_FIELD,
  STAFF_MFA_SESSION_VERIFIED_AT_FIELD,
  type StaffMfaMethod,
} from './mfa-policy';
import { parseSessionClock } from './session-clock-continuity';

type MfaVerificationRuntime = Readonly<{
  $context: Promise<{
    adapter: {
      findOne(input: {
        model: 'twoFactor';
        where: { field: 'userId'; value: string }[];
      }): Promise<unknown>;
    };
    internalAdapter: {
      findSession(token: string): Promise<unknown>;
      updateSession(
        token: string,
        update: Readonly<Record<string, unknown>>,
      ): Promise<unknown>;
    };
  }>;
  api: {
    getSession(input: { headers: Headers }): Promise<unknown>;
  };
}>;

export class StaffMfaVerificationCommitError extends Error {
  readonly code: string;

  constructor(code = 'unknown') {
    super('Staff MFA verification could not be committed.');
    this.name = 'StaffMfaVerificationCommitError';
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sessionCookieFrom(response: Response) {
  const setCookie = response.headers.get('set-cookie') ?? '';
  return setCookie.match(
    /((?:__Secure-)?portal-auth\.session_token=[^;,]+)/,
  )?.[1];
}

async function findTrustedProviderSession(
  runtime: MfaVerificationRuntime,
  providerResponse: Response,
  payload: Record<string, unknown>,
) {
  const responseCookie = sessionCookieFrom(providerResponse);
  if (responseCookie) {
    const current = await runtime.api.getSession({
      headers: new Headers({ cookie: responseCookie }),
    });
    if (
      isRecord(current) &&
      isRecord(current.session) &&
      isRecord(current.user)
    ) {
      return current;
    }
  }

  if (typeof payload.token !== 'string') return null;
  const context = await runtime.$context;
  return context.internalAdapter.findSession(payload.token);
}

/**
 * Commits session assurance only from a successful provider response. The raw
 * token is used transiently for the Better Auth database update and is never
 * returned by this boundary or included in an error.
 */
export async function commitStaffMfaVerification(
  runtime: MfaVerificationRuntime,
  providerResponse: Response,
  method: StaffMfaMethod,
  now: () => Date = () => new Date(),
) {
  let payload: unknown;
  try {
    payload = await providerResponse.clone().json();
  } catch {
    throw new StaffMfaVerificationCommitError('json');
  }

  if (!isRecord(payload)) {
    throw new StaffMfaVerificationCommitError('payload');
  }

  const context = await runtime.$context;
  const trustedSession = await findTrustedProviderSession(
    runtime,
    providerResponse,
    payload,
  );
  if (!isRecord(trustedSession)) {
    throw new StaffMfaVerificationCommitError('session-record');
  }

  const session = isRecord(trustedSession.session)
    ? trustedSession.session
    : undefined;
  const user = isRecord(trustedSession.user) ? trustedSession.user : undefined;
  const authUserId = parseAuthUserId(user?.id);
  const token = session?.token;
  if (
    !session ||
    !authUserId ||
    typeof token !== 'string' ||
    session.userId !== authUserId ||
    user?.twoFactorEnabled !== true
  ) {
    throw new StaffMfaVerificationCommitError('session-binding');
  }

  const clock = parseSessionClock(session);
  if (!clock || clock.expiresAt.getTime() <= now().getTime()) {
    throw new StaffMfaVerificationCommitError('session-clock');
  }

  const twoFactor = await context.adapter.findOne({
    model: 'twoFactor',
    where: [{ field: 'userId', value: authUserId }],
  });
  if (
    !isRecord(twoFactor) ||
    twoFactor.userId !== authUserId ||
    twoFactor.verified !== true
  ) {
    throw new StaffMfaVerificationCommitError('two-factor');
  }

  const updated = await context.internalAdapter.updateSession(token, {
    [STAFF_MFA_SESSION_METHOD_FIELD]: method,
    [STAFF_MFA_SESSION_VERIFIED_AT_FIELD]: now(),
  });
  if (!isRecord(updated) || updated.userId !== authUserId) {
    throw new StaffMfaVerificationCommitError('session-update');
  }

  const updatedClock = parseSessionClock(updated);
  if (
    !updatedClock ||
    updatedClock.createdAt.getTime() !== clock.createdAt.getTime() ||
    updatedClock.expiresAt.getTime() !== clock.expiresAt.getTime()
  ) {
    throw new StaffMfaVerificationCommitError('session-clock-update');
  }

  return updatedClock;
}
