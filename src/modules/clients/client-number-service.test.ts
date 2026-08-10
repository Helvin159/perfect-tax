import { describe, expect, it, vi } from 'vitest';

import { CLIENT_NUMBER_PATTERN } from '@/modules/portal-identity/domain/client-number';

import {
  CLIENT_NUMBER_UNIQUE_INDEX,
  createWithClientNumberCollisionRetry,
  generateClientNumber,
  isClientNumberCollision,
} from './client-number-service';

function clientNumberCollision(cause?: unknown): Record<string, unknown> {
  return {
    cause,
    code: '23505',
    constraint: CLIENT_NUMBER_UNIQUE_INDEX,
  };
}

describe('Client-number generation', () => {
  it('generates canonical values without using Math.random', () => {
    const insecureRandom = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be used');
    });

    const generated = Array.from({ length: 64 }, generateClientNumber);

    expect(generated).toHaveLength(64);
    expect(generated.every((value) => CLIENT_NUMBER_PATTERN.test(value))).toBe(
      true,
    );
    expect(insecureRandom).not.toHaveBeenCalled();
    insecureRandom.mockRestore();
  });
});

describe('Client-number collision retry', () => {
  it('deterministically retries the exact database collision', async () => {
    const createAttempt = vi
      .fn<() => Promise<{ clientNumber: string }>>()
      .mockRejectedValueOnce(
        new Error('wrapped create failure', {
          cause: clientNumberCollision(),
        }),
      )
      .mockResolvedValueOnce({ clientNumber: 'CL-7F4K-92MX' });

    await expect(
      createWithClientNumberCollisionRetry(createAttempt),
    ).resolves.toEqual({ clientNumber: 'CL-7F4K-92MX' });
    expect(createAttempt).toHaveBeenCalledTimes(2);
  });

  it('does not retry a different uniqueness violation', async () => {
    const error = {
      code: '23505',
      constraint: 'some_other_unique_idx',
    };
    const createAttempt = vi
      .fn<() => Promise<never>>()
      .mockRejectedValue(error);

    expect(isClientNumberCollision(error)).toBe(false);
    await expect(
      createWithClientNumberCollisionRetry(createAttempt),
    ).rejects.toBe(error);
    expect(createAttempt).toHaveBeenCalledOnce();
  });

  it('stops after the bounded retry budget', async () => {
    const error = clientNumberCollision();
    const createAttempt = vi
      .fn<() => Promise<never>>()
      .mockRejectedValue(error);

    await expect(
      createWithClientNumberCollisionRetry(createAttempt),
    ).rejects.toBe(error);
    expect(createAttempt).toHaveBeenCalledTimes(5);
  });
});
