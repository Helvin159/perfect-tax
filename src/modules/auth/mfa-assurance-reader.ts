import 'server-only';

import {
  parseAuthUserId,
  type AuthUserId,
} from '@/modules/portal-identity/domain/identifiers';

import {
  isStaffMfaMethod,
  STAFF_MFA_SESSION_METHOD_FIELD,
  STAFF_MFA_SESSION_VERIFIED_AT_FIELD,
  type StaffMfaMethod,
} from './mfa-policy';

type MfaAssuranceRuntime = Readonly<{
  $context: Promise<{
    adapter: {
      findOne(input: {
        model: 'twoFactor';
        where: { field: 'userId'; value: string }[];
      }): Promise<unknown>;
    };
  }>;
  api: Readonly<{
    getSession(input: { headers: Headers }): Promise<unknown>;
  }>;
}>;

export type StaffMfaEvidence = Readonly<{
  method: StaffMfaMethod;
  provider: 'better-auth';
  sessionId: string;
  verifiedAt: Date;
}>;

export type StaffMfaAssurance = Readonly<{
  authUserId: AuthUserId;
  enrollment: 'complete' | 'required';
  enrollmentOnly: boolean;
  evidence: StaffMfaEvidence | null;
  sessionAssurance: 'unverified' | 'verified';
}>;

function parseDate(value: unknown) {
  if (value === null || value === undefined) return undefined;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(date.getTime()) ? date : undefined;
}

function isVerifiedTwoFactorRecord(value: unknown, authUserId: AuthUserId) {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return record.userId === authUserId && record.verified === true;
}

/**
 * Reads only trusted Better Auth database/session state. The result says
 * nothing about Staff status, role, or PortalIdentity; Agent 11 must resolve
 * those independently and exact-match `authUserId` before issuing a principal.
 */
export function createStaffMfaAssuranceReader(
  runtime: MfaAssuranceRuntime,
  now: () => Date = () => new Date(),
) {
  return async function readStaffMfaAssurance(
    headers: Headers,
  ): Promise<StaffMfaAssurance | null> {
    const result = await runtime.api.getSession({ headers });
    if (!result || typeof result !== 'object') return null;

    const candidate = result as {
      session?: Record<string, unknown>;
      user?: Record<string, unknown>;
    };
    const authUserId = parseAuthUserId(candidate.user?.id);
    const sessionUserId = parseAuthUserId(candidate.session?.userId);
    const sessionId = candidate.session?.id;
    const sessionCreatedAt = parseDate(candidate.session?.createdAt);
    const sessionExpiresAt = parseDate(candidate.session?.expiresAt);

    if (
      !authUserId ||
      authUserId !== sessionUserId ||
      typeof sessionId !== 'string' ||
      sessionId.length === 0 ||
      !sessionCreatedAt ||
      !sessionExpiresAt ||
      sessionExpiresAt.getTime() <= now().getTime()
    ) {
      return null;
    }

    const context = await runtime.$context;
    const twoFactor = await context.adapter.findOne({
      model: 'twoFactor',
      where: [{ field: 'userId', value: authUserId }],
    });
    const enrollmentComplete =
      candidate.user?.twoFactorEnabled === true &&
      isVerifiedTwoFactorRecord(twoFactor, authUserId);
    const method = candidate.session?.[STAFF_MFA_SESSION_METHOD_FIELD];
    const verifiedAt = parseDate(
      candidate.session?.[STAFF_MFA_SESSION_VERIFIED_AT_FIELD],
    );
    const nowTime = now().getTime();
    const hasSessionEvidence =
      enrollmentComplete &&
      isStaffMfaMethod(method) &&
      verifiedAt !== undefined &&
      verifiedAt.getTime() >= sessionCreatedAt.getTime() &&
      verifiedAt.getTime() <= nowTime;

    if (!hasSessionEvidence) {
      return Object.freeze({
        authUserId,
        enrollment: enrollmentComplete ? 'complete' : 'required',
        enrollmentOnly: true,
        evidence: null,
        sessionAssurance: 'unverified',
      });
    }

    return Object.freeze({
      authUserId,
      enrollment: 'complete',
      enrollmentOnly: false,
      evidence: Object.freeze({
        method,
        provider: 'better-auth',
        sessionId,
        verifiedAt,
      }),
      sessionAssurance: 'verified',
    });
  };
}
