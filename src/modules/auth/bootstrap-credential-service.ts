import 'server-only';

import {
  parseAuthUserId,
  type AuthUserId,
} from '@/modules/portal-identity/domain/identifiers';

type BootstrapRuntime = Readonly<{
  $context: Promise<{
    internalAdapter: {
      createUser(input: {
        email: string;
        emailVerified: boolean;
        name: string;
      }): Promise<{ id: string }>;
      deleteUser(userId: string): Promise<void>;
      findUserByEmail(email: string): Promise<{ user: { id: string } } | null>;
      linkAccount(input: {
        accountId: string;
        password: string;
        providerId: 'credential';
        userId: string;
      }): Promise<unknown>;
    };
    password: {
      config: { maxPasswordLength: number; minPasswordLength: number };
      hash(password: string): Promise<string>;
    };
  }>;
}>;

export type BootstrapCredentialInput = Readonly<{
  email: string;
  name: string;
  password: string;
}>;

export type BootstrapCredential = Readonly<{
  authUserId: AuthUserId;
}>;

export type BootstrapCredentialErrorCode =
  'ALREADY_EXISTS' | 'CREATE_FAILED' | 'INVALID_INPUT' | 'ROLLBACK_FAILED';

export class BootstrapCredentialError extends Error {
  readonly code: BootstrapCredentialErrorCode;

  constructor(code: BootstrapCredentialErrorCode, cause?: unknown) {
    super('Portal bootstrap credential provisioning failed.', { cause });
    this.name = 'BootstrapCredentialError';
    this.code = code;
  }
}

function normalizeInput(
  input: BootstrapCredentialInput,
  passwordPolicy: { maxPasswordLength: number; minPasswordLength: number },
) {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const validEmail =
    email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validName = name.length > 0 && name.length <= 128;
  const validPassword =
    typeof input.password === 'string' &&
    input.password.length >= passwordPolicy.minPasswordLength &&
    input.password.length <= passwordPolicy.maxPasswordLength;

  if (!validEmail || !validName || !validPassword) {
    throw new BootstrapCredentialError('INVALID_INPUT');
  }

  return { email, name, password: input.password };
}

/**
 * Creates one credential and runs its trusted orchestration callback. If that
 * callback fails, the just-created Better Auth user is compensated internally;
 * arbitrary account deletion is deliberately not exported.
 */
export function createBootstrapCredentialProvisioner(
  runtime: BootstrapRuntime,
) {
  return async function provisionBootstrapCredential<T>(
    input: BootstrapCredentialInput,
    finalize: (credential: BootstrapCredential) => Promise<T>,
  ): Promise<T> {
    const context = await runtime.$context;
    const normalized = normalizeInput(input, context.password.config);

    if (await context.internalAdapter.findUserByEmail(normalized.email)) {
      throw new BootstrapCredentialError('ALREADY_EXISTS');
    }

    let createdUser: { id: string } | undefined;
    try {
      const password = await context.password.hash(normalized.password);
      createdUser = await context.internalAdapter.createUser({
        email: normalized.email,
        emailVerified: false,
        name: normalized.name,
      });
      await context.internalAdapter.linkAccount({
        accountId: createdUser.id,
        password,
        providerId: 'credential',
        userId: createdUser.id,
      });
    } catch (cause) {
      if (createdUser) {
        try {
          await context.internalAdapter.deleteUser(createdUser.id);
        } catch (rollbackCause) {
          throw new BootstrapCredentialError(
            'ROLLBACK_FAILED',
            new AggregateError([cause, rollbackCause]),
          );
        }
      }
      throw new BootstrapCredentialError('CREATE_FAILED', cause);
    }

    const authUserId = parseAuthUserId(createdUser.id);
    if (!authUserId) {
      await context.internalAdapter.deleteUser(createdUser.id);
      throw new BootstrapCredentialError('CREATE_FAILED');
    }

    try {
      return await finalize(Object.freeze({ authUserId }));
    } catch (cause) {
      try {
        await context.internalAdapter.deleteUser(authUserId);
      } catch (rollbackCause) {
        throw new BootstrapCredentialError(
          'ROLLBACK_FAILED',
          new AggregateError([cause, rollbackCause]),
        );
      }
      throw cause;
    }
  };
}
