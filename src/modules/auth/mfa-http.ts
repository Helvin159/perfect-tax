import 'server-only';

import type { AuthUserId } from '@/modules/portal-identity/domain/identifiers';

import { createStaffMfaAssuranceReader } from './mfa-assurance-reader';
import { commitStaffMfaVerification } from './mfa-verification-marker';

type StaffMfaHttpRuntime = Parameters<typeof createStaffMfaAssuranceReader>[0] &
  Parameters<typeof commitStaffMfaVerification>[0] &
  Readonly<{ handler(request: Request): Promise<Response> }>;

export type StaffMfaSubjectAuthorizer = (
  authUserId: AuthUserId,
) => Promise<boolean>;

export type StaffMfaHttpBoundaryOptions = Readonly<{
  isStaffMfaSubject?: StaffMfaSubjectAuthorizer;
}>;

const verificationMethodByPath = Object.freeze({
  '/two-factor/verify-backup-code': 'backup-code',
  '/two-factor/verify-totp': 'totp',
} as const);

type StaffMfaHttpPath =
  '/two-factor/enable' | keyof typeof verificationMethodByPath;

export function isStaffMfaHttpPath(path: string): path is StaffMfaHttpPath {
  return path === '/two-factor/enable' || path in verificationMethodByPath;
}

function jsonResponse(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ code, message }), {
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json',
      pragma: 'no-cache',
    },
    status,
  });
}

function genericFailure(status: number, headers?: Headers) {
  const response = jsonResponse(
    status,
    'MFA_OPERATION_FAILED',
    'MFA operation failed.',
  );
  if (headers) {
    const setCookie = headers.get('set-cookie');
    if (setCookie) response.headers.set('set-cookie', setCookie);
  }
  return response;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => key in value);
}

async function normalizeMfaRequest(request: Request, path: StaffMfaHttpPath) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return null;
  }
  if (!isRecord(body)) return null;

  let normalized: Record<string, string>;
  if (path === '/two-factor/enable') {
    if (
      !hasExactKeys(body, ['password']) ||
      typeof body.password !== 'string'
    ) {
      return null;
    }
    normalized = { password: body.password };
  } else if (path === '/two-factor/verify-totp') {
    if (
      !hasExactKeys(body, ['code']) ||
      typeof body.code !== 'string' ||
      !/^\d{6}$/.test(body.code)
    ) {
      return null;
    }
    normalized = { code: body.code };
  } else {
    if (
      !hasExactKeys(body, ['code']) ||
      typeof body.code !== 'string' ||
      !/^[A-Za-z0-9]{5}-[A-Za-z0-9]{5}$/.test(body.code)
    ) {
      return null;
    }
    normalized = { code: body.code };
  }

  const headers = new Headers(request.headers);
  headers.delete('content-length');
  headers.set('content-type', 'application/json');
  return new Request(request.url, {
    body: JSON.stringify(normalized),
    headers,
    method: 'POST',
  });
}

function hardenSensitiveResponse(response: Response) {
  const headers = new Headers(response.headers);
  headers.set('cache-control', 'no-store');
  headers.set('pragma', 'no-cache');
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

function successfulVerificationResponse(providerResponse: Response) {
  const headers = new Headers(providerResponse.headers);
  headers.delete('content-length');
  headers.set('cache-control', 'no-store');
  headers.set('content-type', 'application/json');
  headers.set('pragma', 'no-cache');
  return new Response(JSON.stringify({ status: true }), {
    headers,
    status: 200,
  });
}

async function authorizeCurrentSession(
  runtime: StaffMfaHttpRuntime,
  request: Request,
  authorizer: StaffMfaSubjectAuthorizer | undefined,
) {
  const assurance = await createStaffMfaAssuranceReader(runtime)(
    request.headers,
  );
  if (!assurance) return { assurance: null, authorized: false } as const;

  let authorized = false;
  try {
    authorized =
      authorizer !== undefined &&
      (await authorizer(assurance.authUserId)) === true;
  } catch {
    authorized = false;
  }
  return { assurance, authorized } as const;
}

/**
 * Exposes only enrollment plus TOTP/backup verification. Staff eligibility is
 * a trusted server callback; browser roles, IDs, assurance flags, issuer values,
 * trusted-device flags, and session-control flags are rejected before Better
 * Auth sees the request.
 */
export async function handleStaffMfaHttpRequest(
  runtime: StaffMfaHttpRuntime,
  request: Request,
  path: StaffMfaHttpPath,
  options: StaffMfaHttpBoundaryOptions,
) {
  const normalized = await normalizeMfaRequest(request, path);
  if (!normalized) {
    return jsonResponse(400, 'MFA_REQUEST_INVALID', 'MFA request is invalid.');
  }

  const current = await authorizeCurrentSession(
    runtime,
    normalized,
    options.isStaffMfaSubject,
  );

  if (path === '/two-factor/enable') {
    if (!current.assurance) return genericFailure(401);
    if (!current.authorized) return genericFailure(403);
    if (current.assurance.enrollment === 'complete') {
      return genericFailure(409);
    }
  } else if (current.assurance && !current.authorized) {
    return genericFailure(403);
  }

  const providerResponse = await runtime.handler(normalized);
  if (!providerResponse.ok) {
    return genericFailure(providerResponse.status, providerResponse.headers);
  }

  if (path === '/two-factor/enable') {
    return hardenSensitiveResponse(providerResponse);
  }

  try {
    await commitStaffMfaVerification(
      runtime,
      providerResponse,
      verificationMethodByPath[path],
    );
  } catch {
    return genericFailure(500, providerResponse.headers);
  }

  return successfulVerificationResponse(providerResponse);
}
