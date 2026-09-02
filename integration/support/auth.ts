import { execFile } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { promisify } from 'node:util';

import type { Client } from 'pg';

import type { StaffRole } from '@/modules/portal-identity/domain/staff';

import { agent15Environment, type Agent15Database } from './database';

const execFileAsync = promisify(execFile);
const ORIGIN = 'http://localhost:3000';

export const AGENT15_STAFF_PASSWORD = 'Agent15-Staff-Password!234';
export const AGENT15_OWNER_PASSWORD = 'Agent15-Owner-Password!234';

export type StaffFixture = Readonly<{
  authUserId: string;
  email: string;
  password: string;
  role: StaffRole;
  staffId: number;
  workEmail: string;
}>;

function base32Decode(value: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const character of value.replaceAll('=', '').toUpperCase()) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error('Invalid base32 test input.');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
}

export function totpCode(totpURI: string, at = Date.now()) {
  const secret = new URL(totpURI).searchParams.get('secret');
  if (!secret) throw new Error('Missing test TOTP secret.');
  const counter = Math.floor(at / 30_000);
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
  return (binary % 1_000_000).toString().padStart(6, '0');
}

export function portalAuthRequest(
  path: string,
  body?: unknown,
  cookie?: string,
) {
  const headers = new Headers({ origin: ORIGIN });
  if (body !== undefined) headers.set('content-type', 'application/json');
  if (cookie) headers.set('cookie', cookie);
  return new Request(`${ORIGIN}/api/auth${path}`, {
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers,
    method: body === undefined ? 'GET' : 'POST',
  });
}

export function responseCookie(response: Response, suffix: string) {
  const getSetCookie = (
    response.headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie;
  const values =
    typeof getSetCookie === 'function'
      ? getSetCookie.call(response.headers)
      : [response.headers.get('set-cookie') ?? ''];
  const expression = new RegExp(
    `((?:__Secure-)?portal-auth\\.${suffix}=[^;,]+)`,
  );
  for (const value of values) {
    const match = value.match(expression);
    if (match?.[1]) return match[1];
  }
  throw new Error(`Missing portal-auth.${suffix} response cookie.`);
}

export async function createPortalAuthHandler() {
  const [{ auth }, { createPortalAuthHttpHandler }, principal] =
    await Promise.all([
      import('@/modules/auth/runtime'),
      import('@/modules/auth/http'),
      import('@/modules/auth/portal-principal-composition'),
    ]);
  return createPortalAuthHttpHandler(auth, {
    isStaffMfaSubject: principal.isCanonicalActiveStaffMfaSubject,
  });
}

export async function closePortalAuthRuntime() {
  const { auth } = await import('@/modules/auth/runtime');
  const context = await auth.$context;
  const database = context.options.database;
  await quiescePostgresPool(database);
}

export async function quiescePostgresPool(database: unknown) {
  if (typeof database !== 'object' || database === null) return;
  const ignoreForcedTestShutdown = () => undefined;
  const on = Reflect.get(database, 'on');
  if (typeof on === 'function') {
    on.call(database, 'error', ignoreForcedTestShutdown);
  }
  const clients = Reflect.get(database, '_clients');
  if (Array.isArray(clients)) {
    for (const client of clients) {
      const clientOn = Reflect.get(client, 'on');
      if (typeof clientOn === 'function') {
        clientOn.call(client, 'error', ignoreForcedTestShutdown);
      }
    }
  }
  const end = Reflect.get(database, 'end');
  if (typeof end === 'function') await end.call(database);
}

export async function login(
  handler: (request: Request) => Promise<Response>,
  email: string,
  password: string,
) {
  return handler(portalAuthRequest('/sign-in/email', { email, password }));
}

export async function enrollAndVerifyMfa(
  handler: (request: Request) => Promise<Response>,
  cookie: string,
  password: string,
) {
  const enable = await handler(
    portalAuthRequest('/two-factor/enable', { password }, cookie),
  );
  if (!enable.ok) {
    throw new Error(`MFA enable failed with ${enable.status}.`);
  }
  const enrollment = (await enable.json()) as {
    backupCodes: string[];
    totpURI: string;
  };
  const verified = await handler(
    portalAuthRequest(
      '/two-factor/verify-totp',
      { code: totpCode(enrollment.totpURI) },
      cookie,
    ),
  );
  if (!verified.ok) {
    throw new Error(`MFA verification failed with ${verified.status}.`);
  }
  return Object.freeze({
    backupCodes: enrollment.backupCodes,
    cookie: responseCookie(verified, 'session_token'),
    totpURI: enrollment.totpURI,
  });
}

export async function provisionStaffFixture(
  payloadMigration: Client,
  input: Readonly<{
    email: string;
    firstName: string;
    lastName: string;
    role: Exclude<StaffRole, 'owner'>;
    workEmail: string;
  }>,
): Promise<StaffFixture> {
  const { provisionBootstrapCredential } =
    await import('@/modules/auth/bootstrap');
  return provisionBootstrapCredential(
    {
      email: input.email,
      name: `${input.firstName} ${input.lastName}`,
      password: AGENT15_STAFF_PASSWORD,
    },
    async ({ authUserId }) => {
      const staff = await payloadMigration.query<{ id: number }>(
        `INSERT INTO public.staff
           (first_name, last_name, work_email, role, status, is_primary_owner)
         VALUES ($1, $2, $3, $4, 'active', false)
         RETURNING id`,
        [input.firstName, input.lastName, input.workEmail, input.role],
      );
      await payloadMigration.query(
        `INSERT INTO public.portal_identities
           (auth_user_id, subject_type, staff_id)
         VALUES ($1, 'staff', $2)`,
        [authUserId, staff.rows[0]!.id],
      );
      return Object.freeze({
        authUserId,
        email: input.email,
        password: AGENT15_STAFF_PASSWORD,
        role: input.role,
        staffId: staff.rows[0]!.id,
        workEmail: input.workEmail,
      });
    },
  );
}

export async function provisionUnboundCredential(
  email: string,
  name = 'Unbound Account',
) {
  const { provisionBootstrapCredential } =
    await import('@/modules/auth/bootstrap');
  return provisionBootstrapCredential(
    { email, name, password: AGENT15_STAFF_PASSWORD },
    async (credential) => credential,
  );
}

export async function runPrimaryOwnerBootstrap(
  database: Agent15Database,
  overrides: Partial<Record<string, string>> = {},
) {
  const environment = {
    ...agent15Environment(database),
    PRIMARY_OWNER_BOOTSTRAP_FIRST_NAME: 'Olivia',
    PRIMARY_OWNER_BOOTSTRAP_LAST_NAME: 'Owner',
    PRIMARY_OWNER_BOOTSTRAP_LOGIN_EMAIL: 'owner-login@example.test',
    PRIMARY_OWNER_BOOTSTRAP_PASSWORD: AGENT15_OWNER_PASSWORD,
    PRIMARY_OWNER_BOOTSTRAP_WORK_EMAIL: 'owner-work@example.test',
    ...overrides,
  };

  return execFileAsync('pnpm', ['portal:bootstrap-primary-owner'], {
    cwd: process.cwd(),
    env: environment,
  });
}
