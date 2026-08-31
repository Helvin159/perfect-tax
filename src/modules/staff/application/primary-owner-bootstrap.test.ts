import type { Payload, PayloadRequest, RequestContext } from 'payload';
import { describe, expect, it, vi } from 'vitest';

import { parseAuthUserId } from '@/modules/portal-identity/domain/identifiers';

import {
  PRIMARY_OWNER_BOOTSTRAP_ENVIRONMENT_KEYS,
  PrimaryOwnerBootstrapError,
  parsePrimaryOwnerBootstrapInput,
  type PrimaryOwnerBootstrapInput,
} from './primary-owner-bootstrap';
import { runPrimaryOwnerBootstrapCommand } from './primary-owner-bootstrap-command';
import {
  assertPrimaryOwnerBootstrapRuntimeReady,
  preparePrimaryOwnerPersistence,
  primaryOwnerAlreadyExists,
  withPrimaryOwnerBootstrapSerialization,
} from './primary-owner-bootstrap-runtime';

const password = 'test-only-initial-password-2026';
const input: PrimaryOwnerBootstrapInput = Object.freeze({
  firstName: 'Grace',
  lastName: 'Hopper',
  loginEmail: 'login.owner@example.com',
  password,
  workEmail: 'work.owner@example.com',
});

function environment(
  overrides: Partial<NodeJS.ProcessEnv> = {},
): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'test',
    [PRIMARY_OWNER_BOOTSTRAP_ENVIRONMENT_KEYS.firstName]: input.firstName,
    [PRIMARY_OWNER_BOOTSTRAP_ENVIRONMENT_KEYS.lastName]: input.lastName,
    [PRIMARY_OWNER_BOOTSTRAP_ENVIRONMENT_KEYS.loginEmail]: input.loginEmail,
    [PRIMARY_OWNER_BOOTSTRAP_ENVIRONMENT_KEYS.password]: input.password,
    [PRIMARY_OWNER_BOOTSTRAP_ENVIRONMENT_KEYS.workEmail]: input.workEmail,
    ...overrides,
  };
}

function outputSink() {
  let value = '';
  return {
    get value() {
      return value;
    },
    write(chunk: string | Uint8Array) {
      value += chunk.toString();
      return true;
    },
  };
}

describe('primary-owner bootstrap input and command', () => {
  it('normalizes but preserves distinct work and login email concepts', () => {
    expect(
      parsePrimaryOwnerBootstrapInput({
        ...input,
        loginEmail: ' LOGIN.Owner@Example.com ',
        workEmail: ' WORK.Owner@Example.com ',
      }),
    ).toEqual({
      ...input,
      loginEmail: 'login.owner@example.com',
      workEmail: 'work.owner@example.com',
    });

    const equalEmailInput = parsePrimaryOwnerBootstrapInput({
      ...input,
      loginEmail: 'same@example.com',
      workEmail: 'same@example.com',
    });
    expect(equalEmailInput.loginEmail).toBe(equalEmailInput.workEmail);
    expect(Object.keys(equalEmailInput)).toContain('loginEmail');
    expect(Object.keys(equalEmailInput)).toContain('workEmail');
  });

  it.each([
    ['firstName', ''],
    ['lastName', ''],
    ['workEmail', 'invalid'],
    ['loginEmail', 'invalid'],
    ['password', ''],
  ] as const)(
    'rejects missing or malformed %s without echoing it',
    (key, value) => {
      expect(() =>
        parsePrimaryOwnerBootstrapInput({ ...input, [key]: value }),
      ).toThrow(new PrimaryOwnerBootstrapError('INVALID_INPUT'));
    },
  );

  it('runs only from environment input, scrubs the secret, and prints no secret', async () => {
    const source = environment();
    const stdout = outputSink();
    const stderr = outputSink();
    const execute = vi.fn(async () => undefined);

    await expect(
      runPrimaryOwnerBootstrapCommand({
        environment: source,
        execute,
        stderr: stderr as never,
        stdout: stdout as never,
      }),
    ).resolves.toBe(0);

    expect(execute).toHaveBeenCalledWith(input);
    expect(
      source[PRIMARY_OWNER_BOOTSTRAP_ENVIRONMENT_KEYS.password],
    ).toBeUndefined();
    expect(stdout.value).toContain('Sign in normally to enroll MFA');
    expect(`${stdout.value}${stderr.value}`).not.toContain(password);
    expect(`${stdout.value}${stderr.value}`).not.toMatch(
      /session|token|totp|backup.?code|auth-primary-owner/iu,
    );
  });

  it.each([
    new PrimaryOwnerBootstrapError('ALREADY_COMPLETED'),
    new PrimaryOwnerBootstrapError('NOT_READY'),
    new Error(`provider exposed ${password}`),
  ])('returns failure with safe output for %s', async (failure) => {
    const source = environment();
    const stdout = outputSink();
    const stderr = outputSink();

    await expect(
      runPrimaryOwnerBootstrapCommand({
        environment: source,
        execute: async () => {
          throw failure;
        },
        stderr: stderr as never,
        stdout: stdout as never,
      }),
    ).resolves.toBe(1);

    expect(stdout.value).toBe('');
    expect(stderr.value).not.toContain(password);
    expect(stderr.value).not.toMatch(/provider exposed/iu);
    expect(
      source[PRIMARY_OWNER_BOOTSTRAP_ENVIRONMENT_KEYS.password],
    ).toBeUndefined();
  });

  it('rejects missing non-secret input before invoking the operation', async () => {
    const source = environment({
      [PRIMARY_OWNER_BOOTSTRAP_ENVIRONMENT_KEYS.workEmail]: '',
    });
    const stdout = outputSink();
    const stderr = outputSink();
    const execute = vi.fn(async () => undefined);

    await expect(
      runPrimaryOwnerBootstrapCommand({
        environment: source,
        execute,
        stderr: stderr as never,
        stdout: stdout as never,
      }),
    ).resolves.toBe(1);
    expect(execute).not.toHaveBeenCalled();
    expect(stderr.value).toBe('Primary owner bootstrap input is invalid.\n');
    expect(stderr.value).not.toContain(password);
  });
});

type PersistencePayloadHarness = ReturnType<typeof createPersistencePayload>;

function createPersistencePayload(
  options: {
    existingOwner?: boolean;
    identityFailure?: Error;
    staffFailure?: Error;
    transactionID?: null | string;
  } = {},
) {
  const requestLog: unknown[] = [];
  const rollbackTransaction = vi.fn(async () => undefined);
  const commitTransaction = vi.fn(async () => undefined);
  const beginTransaction = vi
    .fn()
    .mockResolvedValue(
      options.transactionID === undefined ? 'tx-1' : options.transactionID,
    );
  const count = vi.fn(async () => ({
    totalDocs: options.existingOwner ? 1 : 0,
  }));
  const create = vi.fn(async (request: Record<string, unknown>) => {
    requestLog.push(request);
    if (request.collection === 'staff') {
      if (options.staffFailure) throw options.staffFailure;
      return {
        id: 41,
        isPrimaryOwner: true,
        role: 'owner',
        status: 'active',
      };
    }
    if (request.collection === 'portal-identities') {
      if (options.identityFailure) throw options.identityFailure;
      const data = request.data as Record<string, unknown>;
      return { ...data, id: 51 };
    }
    throw new Error('Unexpected collection');
  });
  const payload = {
    count,
    create,
    db: { beginTransaction, commitTransaction, rollbackTransaction },
  } as unknown as Payload;

  return {
    beginTransaction,
    commitTransaction,
    count,
    create,
    payload,
    requestLog,
    rollbackTransaction,
  };
}

async function prepare(harness: PersistencePayloadHarness) {
  const authUserId = parseAuthUserId('auth-owner-41');
  if (!authUserId) throw new Error('Invalid test AuthUserId');
  const req = {
    context: {},
    payload: harness.payload,
  } as PayloadRequest;
  const context = { trusted: 'opaque-test-capability' } as RequestContext;
  const pending = await preparePrimaryOwnerPersistence(
    harness.payload,
    req,
    context,
    input,
    { authUserId },
  );
  return { context, pending, req };
}

describe('primary-owner application persistence transaction', () => {
  it('creates fixed active Owner state and an explicit AuthUserId binding', async () => {
    const harness = createPersistencePayload();
    const { context, pending, req } = await prepare(harness);

    expect(harness.create).toHaveBeenNthCalledWith(1, {
      collection: 'staff',
      context,
      data: {
        firstName: input.firstName,
        isPrimaryOwner: true,
        lastName: input.lastName,
        role: 'owner',
        status: 'active',
        workEmail: input.workEmail,
      },
      depth: 0,
      overrideAccess: true,
      req,
    });
    expect(harness.create).toHaveBeenNthCalledWith(2, {
      collection: 'portal-identities',
      context,
      data: {
        authUserId: 'auth-owner-41',
        staff: 41,
        subjectType: 'staff',
      },
      depth: 0,
      overrideAccess: true,
      req,
    });
    expect(JSON.stringify(harness.requestLog)).not.toContain(input.loginEmail);
    expect(JSON.stringify(harness.requestLog)).not.toContain(password);
    expect(JSON.stringify(harness.requestLog)).not.toMatch(/cms-users|mfa/iu);
    expect(harness.commitTransaction).not.toHaveBeenCalled();

    await pending.commit();
    expect(harness.commitTransaction).toHaveBeenCalledWith('tx-1');
    expect(req.transactionID).toBeUndefined();
  });

  it('rechecks canonical Owner evidence inside the transaction and denies repeat', async () => {
    const harness = createPersistencePayload({ existingOwner: true });

    await expect(prepare(harness)).rejects.toMatchObject({
      code: 'ALREADY_COMPLETED',
    });
    expect(harness.create).not.toHaveBeenCalled();
    expect(harness.rollbackTransaction).toHaveBeenCalledWith('tx-1');
  });

  it.each([
    ['Staff', { staffFailure: new Error(`staff failed ${password}`) }],
    [
      'PortalIdentity',
      { identityFailure: new Error(`identity failed ${password}`) },
    ],
  ] as const)(
    'rolls back and sanitizes %s creation failure',
    async (_label, options) => {
      const harness = createPersistencePayload(options);

      const error = await prepare(harness).catch((failure: unknown) => failure);
      expect(error).toEqual(new PrimaryOwnerBootstrapError('BOOTSTRAP_FAILED'));
      expect(JSON.stringify(error)).not.toContain(password);
      expect((error as Error).message).not.toContain(password);
      expect(harness.commitTransaction).not.toHaveBeenCalled();
      expect(harness.rollbackTransaction).toHaveBeenCalledWith('tx-1');
    },
  );

  it('fails closed when the adapter cannot establish a transaction', async () => {
    const harness = createPersistencePayload({ transactionID: null });
    await expect(prepare(harness)).rejects.toMatchObject({ code: 'NOT_READY' });
    expect(harness.count).not.toHaveBeenCalled();
    expect(harness.create).not.toHaveBeenCalled();
  });

  it('counts either canonical marker or Owner role as blocking evidence', async () => {
    const harness = createPersistencePayload();
    await expect(primaryOwnerAlreadyExists(harness.payload)).resolves.toBe(
      false,
    );
    expect(harness.count).toHaveBeenCalledWith({
      collection: 'staff',
      overrideAccess: true,
      where: {
        or: [
          { isPrimaryOwner: { equals: true } },
          { role: { equals: 'owner' } },
        ],
      },
    });
  });
});

describe('PostgreSQL-backed serialization seam and readiness', () => {
  it('holds the advisory lock through the operation and always unlocks', async () => {
    const calls: string[] = [];
    const query = vi.fn(async (sql: string) => {
      calls.push(sql.includes('unlock') ? 'unlock' : 'lock');
      return {};
    });
    const release = vi.fn();
    const payload = {
      db: { pool: { connect: vi.fn(async () => ({ query, release })) } },
    } as never;

    await expect(
      withPrimaryOwnerBootstrapSerialization(payload, async () => {
        calls.push('operation');
        return 'complete';
      }),
    ).resolves.toBe('complete');
    expect(calls).toEqual(['lock', 'operation', 'unlock']);
    expect(query.mock.calls[0]?.[0]).toBe('SELECT pg_advisory_lock($1)');
    expect(query.mock.calls[1]?.[0]).toBe('SELECT pg_advisory_unlock($1)');
    expect(release).toHaveBeenCalledOnce();
  });

  it('models two concurrent production-lock calls with at most one bootstrap success', async () => {
    let tail = Promise.resolve();
    let owners = 0;

    function client() {
      let releaseLock: () => void = () => {};
      return {
        async query(sql: string) {
          if (sql.includes('pg_advisory_unlock')) {
            releaseLock();
            return {};
          }
          const previous = tail;
          tail = new Promise<void>((resolveLock) => {
            releaseLock = resolveLock;
          });
          await previous;
          return {};
        },
        release: vi.fn(),
      };
    }

    const payload = {
      db: { pool: { connect: vi.fn(async () => client()) } },
    } as never;
    const attempt = () =>
      withPrimaryOwnerBootstrapSerialization(payload, async () => {
        if (owners > 0) {
          throw new PrimaryOwnerBootstrapError('ALREADY_COMPLETED');
        }
        await Promise.resolve();
        owners += 1;
      });

    const results = await Promise.allSettled([attempt(), attempt()]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(owners).toBe(1);
  });

  it('fails closed before Agent 13 registration and Agent 14 physical proof', async () => {
    await expect(
      assertPrimaryOwnerBootstrapRuntimeReady({ collections: {} } as Payload),
    ).rejects.toThrow(new PrimaryOwnerBootstrapError('NOT_READY'));

    await expect(
      assertPrimaryOwnerBootstrapRuntimeReady({
        collections: {
          'portal-identities': {},
          'security-events': {},
          staff: {},
        },
      } as unknown as Payload),
    ).rejects.toThrow(new PrimaryOwnerBootstrapError('NOT_READY'));
  });
});
