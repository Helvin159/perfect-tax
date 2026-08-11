import { createHmac } from 'node:crypto';

import { betterAuth } from 'better-auth';
import { getAuthTables } from 'better-auth/db';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { STAFF_ROLES } from '@/modules/portal-identity/domain/staff';

import { createBootstrapCredentialProvisioner } from './bootstrap-credential-service';
import { createPortalAuthOptions } from './config/options';
import {
  PORTAL_AUTH_HTTP_OPERATIONS,
  PORTAL_AUTH_SESSION_POLICY,
} from './config/policy';
import { createPortalAuthHttpHandler } from './http';
import { createStaffMfaAssuranceReader } from './mfa-assurance-reader';
import { STAFF_MFA_POLICY } from './mfa-policy';

const origin = 'https://portal.example.com';
const fixedTime = new Date('2026-08-10T12:00:05.000Z');
const owner = {
  email: 'owner@example.com',
  name: 'Primary Owner',
  password: 'correct-horse-battery-staple',
};
const secondAccount = {
  email: 'second@example.com',
  name: 'Second Account',
  password: 'correct-horse-battery-staple-second',
};

function createTestRuntime(
  authorize: (authUserId: string) => boolean | Promise<boolean> = () => true,
) {
  const options = createPortalAuthOptions({
    baseURL: origin,
    secret: 'staff-mfa-test-only-secret-0123456789abcdef',
    secureCookies: true,
  });
  const auth = betterAuth(options);
  const handler = createPortalAuthHttpHandler(auth, {
    isStaffMfaSubject: async (authUserId) => authorize(authUserId),
  });
  const provision = createBootstrapCredentialProvisioner(auth);
  const readAssurance = createStaffMfaAssuranceReader(auth);
  return { auth, handler, options, provision, readAssurance };
}

function request(path: string, init: RequestInit & { origin?: string } = {}) {
  const headers = new Headers(init.headers);
  if (init.origin !== undefined) headers.set('origin', init.origin);
  if (init.body) headers.set('content-type', 'application/json');
  return new Request(`${origin}/api/auth${path}`, { ...init, headers });
}

function post(path: string, body: unknown, cookie?: string) {
  return request(path, {
    body: JSON.stringify(body),
    headers: cookie ? { cookie } : undefined,
    method: 'POST',
    origin,
  });
}

function responseCookie(response: Response, suffix: string) {
  const setCookie = response.headers.get('set-cookie') ?? '';
  const match = setCookie.match(
    new RegExp(`(__Secure-portal-auth\\.${suffix}=[^;,]+)`),
  );
  expect(match?.[1]).toBeTruthy();
  return match![1];
}

async function login(
  handler: (request: Request) => Promise<Response>,
  credentials = owner,
) {
  return handler(
    post('/sign-in/email', {
      email: credentials.email,
      password: credentials.password,
    }),
  );
}

function base32Decode(value: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const character of value.replaceAll('=', '').toUpperCase()) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error('invalid base32 test input');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
}

function totpCode(totpURI: string, at = Date.now()) {
  const secret = new URL(totpURI).searchParams.get('secret');
  if (!secret) throw new Error('missing test TOTP secret');
  const counter = Math.floor(at / (STAFF_MFA_POLICY.totpPeriod * 1_000));
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', base32Decode(secret))
    .update(message)
    .digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  return (binary % 10 ** STAFF_MFA_POLICY.totpDigits)
    .toString()
    .padStart(STAFF_MFA_POLICY.totpDigits, '0');
}

async function provision(
  provisionCredential: ReturnType<typeof createBootstrapCredentialProvisioner>,
  credentials = owner,
) {
  return provisionCredential(credentials, async (credential) => credential);
}

async function startEnrollment(
  runtime: ReturnType<typeof createTestRuntime>,
  cookie: string,
) {
  const response = await runtime.handler(
    post('/two-factor/enable', { password: owner.password }, cookie),
  );
  expect(response.status).toBe(200);
  const enrollment = (await response.json()) as {
    backupCodes: string[];
    totpURI: string;
  };
  return { enrollment, response };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Staff MFA boundary', () => {
  it('pins only TOTP, encrypted backup codes, lockout, and no trusted device', () => {
    const { options } = createTestRuntime();
    const plugin = options.plugins?.[0];

    expect(plugin?.id).toBe('two-factor');
    expect(plugin?.options).toMatchObject({
      accountLockout: {
        durationSeconds: 900,
        enabled: true,
        maxFailedAttempts: 10,
      },
      allowPasswordless: false,
      backupCodeOptions: {
        amount: 10,
        length: 10,
        storeBackupCodes: 'encrypted',
      },
      issuer: 'Operational Portal',
      skipVerificationOnEnable: false,
      totpOptions: { digits: 6, period: 30 },
      trustDeviceMaxAge: 0,
      twoFactorCookieMaxAge: 600,
    });
    expect(plugin?.options).not.toHaveProperty('otpOptions.sendOTP');
    expect(options.session).toMatchObject({
      disableSessionRefresh: true,
      expiresIn: 28_800,
      freshAge: 900,
    });
    expect(PORTAL_AUTH_SESSION_POLICY).toEqual({
      disableSessionRefresh: true,
      expiresIn: 28_800,
      freshAge: 900,
    });
    expect(STAFF_ROLES).toEqual([
      'owner',
      'administrator',
      'case-worker',
      'intake',
    ]);
  });

  it('exposes the exact provider MFA schema Agent 14 must migrate', () => {
    const { options } = createTestRuntime();
    const tables = getAuthTables(options);

    expect(tables.user?.fields.twoFactorEnabled).toMatchObject({
      defaultValue: false,
      input: false,
      required: false,
      type: 'boolean',
    });
    expect(tables.session?.fields).toMatchObject({
      mfaMethod: { input: false, required: false, type: 'string' },
      mfaVerifiedAt: { input: false, required: false, type: 'date' },
    });
    expect(tables.twoFactor).toMatchObject({
      fields: {
        backupCodes: {
          required: true,
          returned: false,
          type: 'string',
        },
        failedVerificationCount: {
          defaultValue: 0,
          input: false,
          required: false,
          returned: false,
          type: 'number',
        },
        lockedUntil: {
          input: false,
          required: false,
          returned: false,
          type: 'date',
        },
        secret: {
          index: true,
          required: true,
          returned: false,
          type: 'string',
        },
        userId: {
          index: true,
          references: { field: 'id', model: 'user' },
          required: true,
          returned: false,
          type: 'string',
        },
        verified: {
          defaultValue: true,
          input: false,
          required: false,
          type: 'boolean',
        },
      },
      modelName: 'twoFactor',
    });
  });

  it('keeps enrollment start non-operational, rejects invalid/stale TOTP, and verifies only provider-confirmed sessions', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedTime);
    const logged = [
      vi.spyOn(console, 'error').mockImplementation(() => undefined),
      vi.spyOn(console, 'log').mockImplementation(() => undefined),
      vi.spyOn(console, 'warn').mockImplementation(() => undefined),
    ];
    const runtime = createTestRuntime();
    const credential = await provision(runtime.provision);
    const loginResponse = await login(runtime.handler);
    const credentialCookie = responseCookie(loginResponse, 'session_token');

    expect(
      await runtime.readAssurance(new Headers({ cookie: credentialCookie })),
    ).toEqual({
      authUserId: credential.authUserId,
      enrollment: 'required',
      enrollmentOnly: true,
      evidence: null,
      sessionAssurance: 'unverified',
    });

    const { enrollment, response } = await startEnrollment(
      runtime,
      credentialCookie,
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(enrollment.backupCodes).toHaveLength(10);
    expect(enrollment.totpURI).toMatch(/^otpauth:\/\/totp\//);
    expect(
      await runtime.readAssurance(new Headers({ cookie: credentialCookie })),
    ).toMatchObject({
      enrollment: 'required',
      enrollmentOnly: true,
      sessionAssurance: 'unverified',
    });

    const invalid = await runtime.handler(
      post('/two-factor/verify-totp', { code: '000000' }, credentialCookie),
    );
    expect(invalid.status).toBe(401);
    expect(await invalid.json()).toEqual({
      code: 'MFA_OPERATION_FAILED',
      message: 'MFA operation failed.',
    });
    expect(
      await runtime.readAssurance(new Headers({ cookie: credentialCookie })),
    ).toMatchObject({ sessionAssurance: 'unverified' });

    const stale = await runtime.handler(
      post(
        '/two-factor/verify-totp',
        { code: totpCode(enrollment.totpURI, Date.now() - 90_000) },
        credentialCookie,
      ),
    );
    expect(stale.status).toBe(401);

    const verified = await runtime.handler(
      post(
        '/two-factor/verify-totp',
        { code: totpCode(enrollment.totpURI) },
        credentialCookie,
      ),
    );
    expect(verified.status).toBe(200);
    expect(verified.headers.get('set-cookie')).toMatch(/Max-Age=28800/i);
    expect(await verified.clone().json()).toEqual({ status: true });
    expect(await verified.clone().text()).not.toContain('token');
    const verifiedCookie = responseCookie(verified, 'session_token');
    const assurance = await runtime.readAssurance(
      new Headers({ cookie: verifiedCookie }),
    );
    expect(assurance).toMatchObject({
      authUserId: credential.authUserId,
      enrollment: 'complete',
      enrollmentOnly: false,
      evidence: {
        method: 'totp',
        provider: 'better-auth',
        sessionId: expect.any(String),
        verifiedAt: fixedTime,
      },
      sessionAssurance: 'verified',
    });
    expect(Object.isFrozen(assurance)).toBe(true);
    expect(
      await runtime.readAssurance(new Headers({ cookie: credentialCookie })),
    ).toBeNull();
    const loggedText = JSON.stringify(logged.flatMap(({ mock }) => mock.calls));
    expect(loggedText).not.toContain('000000');
    expect(loggedText).not.toContain(enrollment.totpURI);
    for (const code of enrollment.backupCodes) {
      expect(loggedText).not.toContain(code);
    }
  });

  it('encrypts backup codes, consumes exactly one, rejects replay, and marks backup-code assurance', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedTime);
    const runtime = createTestRuntime();
    await provision(runtime.provision);
    const credentialCookie = responseCookie(
      await login(runtime.handler),
      'session_token',
    );
    const { enrollment } = await startEnrollment(runtime, credentialCookie);
    const initialVerification = await runtime.handler(
      post(
        '/two-factor/verify-totp',
        { code: totpCode(enrollment.totpURI) },
        credentialCookie,
      ),
    );
    const enrolledCookie = responseCookie(initialVerification, 'session_token');

    const context = await runtime.auth.$context;
    const enrolledSession = await runtime.readAssurance(
      new Headers({ cookie: enrolledCookie }),
    );
    const stored = await context.adapter.findOne<Record<string, unknown>>({
      model: 'twoFactor',
      where: [{ field: 'userId', value: enrolledSession!.authUserId }],
    });
    expect(stored?.backupCodes).toEqual(expect.any(String));
    for (const code of enrollment.backupCodes) {
      expect(stored?.backupCodes).not.toContain(code);
    }
    const uriSecret = new URL(enrollment.totpURI).searchParams.get('secret')!;
    expect(stored?.secret).not.toContain(uriSecret);

    await runtime.handler(post('/sign-out', {}, enrolledCookie));
    const challenge = await login(runtime.handler);
    expect(await challenge.clone().json()).toMatchObject({
      twoFactorMethods: ['totp'],
      twoFactorRedirect: true,
    });
    const challengeCookie = responseCookie(challenge, 'two_factor');
    const backupVerified = await runtime.handler(
      post(
        '/two-factor/verify-backup-code',
        { code: enrollment.backupCodes[0] },
        challengeCookie,
      ),
    );
    expect(backupVerified.status).toBe(200);
    const backupSessionCookie = responseCookie(backupVerified, 'session_token');
    expect(
      await runtime.readAssurance(new Headers({ cookie: backupSessionCookie })),
    ).toMatchObject({
      evidence: { method: 'backup-code' },
      sessionAssurance: 'verified',
    });

    await runtime.handler(post('/sign-out', {}, backupSessionCookie));
    const secondChallengeCookie = responseCookie(
      await login(runtime.handler),
      'two_factor',
    );
    const replay = await runtime.handler(
      post(
        '/two-factor/verify-backup-code',
        { code: enrollment.backupCodes[0] },
        secondChallengeCookie,
      ),
    );
    expect(replay.status).toBe(401);
    const unrelatedCode = await runtime.handler(
      post(
        '/two-factor/verify-backup-code',
        { code: enrollment.backupCodes[1] },
        secondChallengeCookie,
      ),
    );
    expect(unrelatedCode.status).toBe(200);
  });

  it('rejects challenge replay but records provider acceptance in a distinct current-window challenge', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedTime);
    const runtime = createTestRuntime();
    await provision(runtime.provision);
    const credentialCookie = responseCookie(
      await login(runtime.handler),
      'session_token',
    );
    const { enrollment } = await startEnrollment(runtime, credentialCookie);
    const enrollmentVerified = await runtime.handler(
      post(
        '/two-factor/verify-totp',
        { code: totpCode(enrollment.totpURI) },
        credentialCookie,
      ),
    );
    const enrolledCookie = responseCookie(enrollmentVerified, 'session_token');
    await runtime.handler(post('/sign-out', {}, enrolledCookie));

    const challengeCookie = responseCookie(
      await login(runtime.handler),
      'two_factor',
    );
    const code = totpCode(enrollment.totpURI);
    const firstVerification = await runtime.handler(
      post('/two-factor/verify-totp', { code }, challengeCookie),
    );
    expect(firstVerification.status).toBe(200);
    expect(
      (
        await runtime.handler(
          post('/two-factor/verify-totp', { code }, challengeCookie),
        )
      ).status,
    ).toBe(401);

    const firstSessionCookie = responseCookie(
      firstVerification,
      'session_token',
    );
    await runtime.handler(post('/sign-out', {}, firstSessionCookie));
    const distinctChallengeCookie = responseCookie(
      await login(runtime.handler),
      'two_factor',
    );
    expect(
      (
        await runtime.handler(
          post('/two-factor/verify-totp', { code }, distinctChallengeCookie),
        )
      ).status,
    ).toBe(200);
  });

  it('rejects browser assurance/role/ID spoofing and cannot target another account', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedTime);
    const authorizedIds = new Set<string>();
    const observedIds: string[] = [];
    const runtime = createTestRuntime((authUserId) => {
      observedIds.push(authUserId);
      return authorizedIds.has(authUserId);
    });
    const ownerCredential = await provision(runtime.provision);
    const otherCredential = await provision(runtime.provision, secondAccount);
    authorizedIds.add(ownerCredential.authUserId);
    const ownerCookie = responseCookie(
      await login(runtime.handler),
      'session_token',
    );

    const spoofed = await runtime.handler(
      post(
        '/two-factor/enable',
        {
          authUserId: otherCredential.authUserId,
          mfaVerified: true,
          password: owner.password,
          role: 'owner',
          staffId: 1,
        },
        ownerCookie,
      ),
    );
    expect(spoofed.status).toBe(400);
    expect(observedIds).toEqual([]);
    expect(
      await runtime.readAssurance(new Headers({ cookie: ownerCookie })),
    ).toMatchObject({ sessionAssurance: 'unverified' });

    const legitimate = await startEnrollment(runtime, ownerCookie);
    expect(legitimate.enrollment.totpURI).toBeTruthy();
    expect(observedIds).toEqual([ownerCredential.authUserId]);
    const context = await runtime.auth.$context;
    expect(
      await context.adapter.findOne({
        model: 'twoFactor',
        where: [{ field: 'userId', value: otherCredential.authUserId }],
      }),
    ).toBeNull();

    const spoofedVerification = await runtime.handler(
      post(
        '/two-factor/verify-totp',
        {
          authUserId: otherCredential.authUserId,
          code: totpCode(legitimate.enrollment.totpURI),
          mfaVerified: true,
          role: 'owner',
          staffId: 1,
        },
        ownerCookie,
      ),
    );
    expect(spoofedVerification.status).toBe(400);
    expect(
      await runtime.readAssurance(new Headers({ cookie: ownerCookie })),
    ).toMatchObject({ sessionAssurance: 'unverified' });

    const trustedDeviceSpoof = await runtime.handler(
      post(
        '/two-factor/verify-totp',
        {
          code: totpCode(legitimate.enrollment.totpURI),
          trustDevice: true,
        },
        ownerCookie,
      ),
    );
    expect(trustedDeviceSpoof.status).toBe(400);
    expect(trustedDeviceSpoof.headers.get('set-cookie')).toBeNull();
  });

  it('denies unbound Client-shaped accounts and gives the primary owner no bypass', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedTime);
    const runtime = createTestRuntime(() => false);
    await provision(runtime.provision);
    const cookie = responseCookie(
      await login(runtime.handler),
      'session_token',
    );
    const denied = await runtime.handler(
      post('/two-factor/enable', { password: owner.password }, cookie),
    );
    expect(denied.status).toBe(403);
    expect(await runtime.readAssurance(new Headers({ cookie }))).toMatchObject({
      enrollment: 'required',
      enrollmentOnly: true,
      sessionAssurance: 'unverified',
    });
  });

  it('fails closed when the future Staff subject resolver is not wired', async () => {
    const options = createPortalAuthOptions({
      baseURL: origin,
      secret: 'staff-mfa-default-deny-test-secret-0123456789abcdef',
      secureCookies: true,
    });
    const auth = betterAuth(options);
    const handler = createPortalAuthHttpHandler(auth);
    await provision(createBootstrapCredentialProvisioner(auth));
    const cookie = responseCookie(await login(handler), 'session_token');

    expect(
      (
        await handler(
          post('/two-factor/enable', { password: owner.password }, cookie),
        )
      ).status,
    ).toBe(403);
  });

  it('keeps sign-out available while enrollment-only and denies MFA management/recovery routes', async () => {
    const runtime = createTestRuntime();
    await provision(runtime.provision);
    const cookie = responseCookie(
      await login(runtime.handler),
      'session_token',
    );
    expect((await runtime.handler(post('/sign-out', {}, cookie))).status).toBe(
      200,
    );
    expect(await runtime.readAssurance(new Headers({ cookie }))).toBeNull();

    const denied = [
      '/two-factor/disable',
      '/two-factor/get-totp-uri',
      '/two-factor/generate-backup-codes',
      '/request-password-reset',
      '/admin/list-users',
    ];
    for (const path of denied) {
      expect((await runtime.handler(post(path, {}))).status).toBe(404);
    }
    expect(PORTAL_AUTH_HTTP_OPERATIONS).not.toEqual(
      expect.arrayContaining([
        'POST /two-factor/disable',
        'POST /two-factor/get-totp-uri',
        'POST /two-factor/generate-backup-codes',
      ]),
    );
  });
});
