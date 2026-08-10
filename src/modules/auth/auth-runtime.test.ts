import { readFile } from 'node:fs/promises';

import { betterAuth } from 'better-auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  createBootstrapCredentialProvisioner,
  type BootstrapCredential,
} from './bootstrap-credential-service';
import { createPortalAuthOptions } from './config/options';
import {
  PORTAL_AUTH_COOKIE_PREFIX,
  PORTAL_AUTH_HTTP_OPERATIONS,
  PORTAL_AUTH_SESSION_POLICY,
} from './config/policy';
import { createPortalAuthHttpHandler } from './http';
import {
  createAuthenticatedSessionReader,
  isFreshPortalSession,
} from './session-reader';
import { createPortalSessionRevoker } from './session-revocation';

const origin = 'https://portal.example.com';
const credentials = {
  email: 'owner@example.com',
  name: 'Portal Owner',
  password: 'correct-horse-battery-staple',
};

function createTestRuntime() {
  const options = createPortalAuthOptions({
    baseURL: origin,
    secret: 'auth-runtime-test-only-secret-0123456789abcdef',
    secureCookies: true,
  });
  const auth = betterAuth(options);
  const handler = createPortalAuthHttpHandler(auth);
  const provision = createBootstrapCredentialProvisioner(auth);

  return { auth, handler, options, provision };
}

function request(path: string, init: RequestInit & { origin?: string } = {}) {
  const headers = new Headers(init.headers);
  if (init.origin !== undefined) headers.set('origin', init.origin);
  if (init.body) headers.set('content-type', 'application/json');

  return new Request(`${origin}/api/auth${path}`, {
    ...init,
    headers,
  });
}

function cookieFrom(response: Response) {
  const setCookie = response.headers.get('set-cookie');
  expect(setCookie).toBeTruthy();
  return setCookie!.split(';', 1)[0];
}

async function login(
  handler: (request: Request) => Promise<Response>,
  password = credentials.password,
  requestOrigin = origin,
) {
  return handler(
    request('/sign-in/email', {
      body: JSON.stringify({ email: credentials.email, password }),
      method: 'POST',
      origin: requestOrigin,
    }),
  );
}

async function provisionOwner(
  provision: ReturnType<typeof createBootstrapCredentialProvisioner>,
) {
  return provision(credentials, async (credential) => credential);
}

describe('Better Auth core runtime', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('BETTER_AUTH_TRUSTED_ORIGINS', '');
  });

  it('pins the absolute database-session, cookie, and origin contract', () => {
    const { options } = createTestRuntime();

    expect(options.session).toEqual({
      cookieCache: { enabled: false },
      ...PORTAL_AUTH_SESSION_POLICY,
    });
    expect(options.trustedOrigins).toEqual([origin]);
    expect(options.baseURL).toBe(origin);
    expect(options.advanced).toMatchObject({
      cookiePrefix: PORTAL_AUTH_COOKIE_PREFIX,
      crossSubDomainCookies: { enabled: false },
      defaultCookieAttributes: {
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        secure: true,
      },
      disableCSRFCheck: false,
      disableOriginCheck: false,
      trustedProxyHeaders: false,
      useSecureCookies: true,
    });
    expect(options.emailAndPassword).toMatchObject({
      disableSignUp: true,
      enabled: true,
    });
  });

  it('allows valid login and rejects invalid credentials', async () => {
    const { handler, provision } = createTestRuntime();
    await provisionOwner(provision);

    const valid = await login(handler);
    expect(valid.status).toBe(200);
    expect(valid.headers.get('set-cookie')).toContain(
      '__Secure-portal-auth.session_token=',
    );

    const invalid = await login(handler, 'definitely-not-the-password');
    expect(invalid.status).toBe(401);
    expect(invalid.headers.has('set-cookie')).toBe(false);
  });

  it('sets a host-only eight-hour cookie with the approved flags', async () => {
    const { handler, provision } = createTestRuntime();
    await provisionOwner(provision);

    const response = await login(handler);
    const cookie = response.headers.get('set-cookie')!;

    expect(cookie).toMatch(/Max-Age=28800/i);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//i);
    expect(cookie).not.toMatch(/Domain=/i);
    expect(cookie).not.toContain('session_data');
  });

  it('accepts the canonical origin and rejects a hostile origin', async () => {
    const { handler, provision } = createTestRuntime();
    await provisionOwner(provision);

    expect((await login(handler)).status).toBe(200);
    expect(
      (await login(handler, credentials.password, 'https://evil.example'))
        .status,
    ).toBe(403);
  });

  it('reads and logs out a database-backed session', async () => {
    const { auth, handler, provision } = createTestRuntime();
    await provisionOwner(provision);
    const cookie = cookieFrom(await login(handler));

    const active = await handler(
      request('/get-session', { headers: { cookie }, method: 'GET' }),
    );
    expect(active.status).toBe(200);
    expect((await active.json()) as unknown).toMatchObject({
      session: { userId: expect.any(String) },
      user: { id: expect.any(String) },
    });

    const reader = createAuthenticatedSessionReader(auth);
    const internal = await reader(new Headers({ cookie }));
    expect(internal).toMatchObject({
      authUserId: expect.any(String),
      sessionId: expect.any(String),
    });
    expect(internal).not.toHaveProperty('token');
    expect(internal).not.toHaveProperty('email');

    const logout = await handler(
      request('/sign-out', {
        headers: { cookie },
        method: 'POST',
        origin,
      }),
    );
    expect(logout.status).toBe(200);
    expect(await reader(new Headers({ cookie }))).toBeNull();
  });

  it('lists and revokes one session, then revokes all remaining sessions', async () => {
    const { auth, handler, provision } = createTestRuntime();
    const credential = await provisionOwner(provision);
    const firstCookie = cookieFrom(await login(handler));
    const secondCookie = cookieFrom(await login(handler));
    const reader = createAuthenticatedSessionReader(auth);
    const firstSession = await reader(new Headers({ cookie: firstCookie }));

    const list = await handler(
      request('/list-sessions', {
        headers: { cookie: secondCookie },
        method: 'GET',
      }),
    );
    const sessions = (await list.json()) as Array<{
      id: string;
      token: string;
    }>;
    expect(sessions).toHaveLength(2);
    const firstToken = sessions.find(
      ({ id }) => id === firstSession!.sessionId,
    )!.token;

    const revoked = await handler(
      request('/revoke-session', {
        body: JSON.stringify({ token: firstToken }),
        headers: { cookie: secondCookie },
        method: 'POST',
        origin,
      }),
    );
    expect(revoked.status).toBe(200);
    expect(await reader(new Headers({ cookie: firstCookie }))).toBeNull();
    expect(await reader(new Headers({ cookie: secondCookie }))).not.toBeNull();

    await createPortalSessionRevoker(auth)(credential.authUserId);
    expect(await reader(new Headers({ cookie: secondCookie }))).toBeNull();
  });

  it('enforces the separate 15-minute freshness contract', () => {
    const createdAt = new Date('2026-08-10T12:00:00.000Z');
    const session = {
      authUserId: 'auth-user' as BootstrapCredential['authUserId'],
      createdAt,
      expiresAt: new Date('2026-08-10T20:00:00.000Z'),
      sessionId: 'session-id',
    };

    expect(
      isFreshPortalSession(session, new Date('2026-08-10T12:14:59.999Z')),
    ).toBe(true);
    expect(
      isFreshPortalSession(session, new Date('2026-08-10T12:15:00.000Z')),
    ).toBe(false);
  });

  it('denies public signup, every recovery path, bootstrap, and provider admin', async () => {
    const { auth, handler } = createTestRuntime();
    const attempts = [
      request('/sign-up/email', {
        body: JSON.stringify(credentials),
        method: 'POST',
        origin,
      }),
      request('/request-password-reset', {
        body: JSON.stringify({ email: credentials.email }),
        method: 'POST',
        origin,
      }),
      request('/reset-password/token', { method: 'GET' }),
      request('/bootstrap', { method: 'POST', origin }),
      request('/admin/list-users', { method: 'GET' }),
      request('/update-user', {
        body: JSON.stringify({ name: 'Attacker' }),
        method: 'POST',
        origin,
      }),
    ];

    for (const attempt of attempts) {
      expect((await handler(attempt)).status).toBe(404);
    }

    const providerSignup = await auth.handler(
      request('/sign-up/email', {
        body: JSON.stringify(credentials),
        method: 'POST',
        origin,
      }),
    );
    expect(providerSignup.status).toBe(400);
    expect(auth.options.plugins).toEqual([]);
    expect(PORTAL_AUTH_HTTP_OPERATIONS).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining('admin'),
        expect.stringContaining('impersonate'),
      ]),
    );
  });

  it('provisions only through the server callback and compensates failure', async () => {
    const { handler, provision } = createTestRuntime();

    await expect(
      provision(credentials, async () => {
        throw new Error('downstream domain write failed');
      }),
    ).rejects.toThrow('downstream domain write failed');
    expect((await login(handler)).status).toBe(401);

    const credential = await provisionOwner(provision);
    expect(credential).toEqual({ authUserId: expect.any(String) });
    expect(Object.isFrozen(credential)).toBe(true);
    expect((await login(handler)).status).toBe(200);
  });

  it('coexists with the independent CMS route and identity configuration', async () => {
    const [authRoute, cmsRoute, payloadConfig] = await Promise.all([
      readFile(
        new URL('../../app/api/auth/[...all]/route.ts', import.meta.url),
        'utf8',
      ),
      readFile(
        new URL(
          '../../app/(payload)/api/cms/[[...slug]]/route.ts',
          import.meta.url,
        ),
        'utf8',
      ),
      readFile(new URL('../../../payload.config.ts', import.meta.url), 'utf8'),
    ]);

    expect(authRoute).toContain("from '@/modules/auth/runtime'");
    expect(cmsRoute).toContain("from '@payloadcms/next/routes'");
    expect(payloadConfig).toContain("user: 'cms-users'");
    expect(payloadConfig).toContain("api: '/api/cms'");
    expect(payloadConfig).not.toMatch(/better-auth|portal-auth|portal_auth/i);
  });
});
