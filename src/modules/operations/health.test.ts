import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  HEALTH_HEADERS,
  healthStatusCode,
  livenessBody,
  readinessBody,
  type ReadyCheckDependencies,
} from './health';

function dependencies(
  overrides: Partial<ReadyCheckDependencies> = {},
): ReadyCheckDependencies {
  return {
    checkDatabase: vi.fn(async () => undefined),
    initializePayload: vi.fn(async () => undefined),
    log: vi.fn(),
    timeoutMs: 20,
    ...overrides,
  };
}

describe('health contracts', () => {
  it('keeps liveness isolated from dependencies', () => {
    expect(livenessBody()).toEqual({ status: 'ok' });
  });

  it('returns ready when PostgreSQL and Payload checks pass', async () => {
    await expect(readinessBody(dependencies())).resolves.toEqual({
      status: 'ready',
    });
  });

  it('returns unavailable and avoids Payload when PostgreSQL fails', async () => {
    const initializePayload = vi.fn(async () => undefined);
    const log = vi.fn();

    await expect(
      readinessBody(
        dependencies({
          checkDatabase: vi.fn(async () => {
            throw new Error('postgres://user:secret@private-host/db');
          }),
          initializePayload,
          log,
        }),
      ),
    ).resolves.toEqual({ status: 'unavailable' });

    expect(initializePayload).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith({ code: 'database-unavailable' });
    expect(JSON.stringify(log.mock.calls)).not.toContain('private-host');
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret');
  });

  it('returns unavailable when Payload initialization fails without leaking diagnostics', async () => {
    const log = vi.fn();

    await expect(
      readinessBody(
        dependencies({
          initializePayload: vi.fn(async () => {
            throw new Error('stack trace and hostname should not leak');
          }),
          log,
        }),
      ),
    ).resolves.toEqual({ status: 'unavailable' });

    expect(log).toHaveBeenCalledWith({ code: 'payload-unavailable' });
    expect(JSON.stringify(log.mock.calls)).not.toContain('hostname');
    expect(JSON.stringify(log.mock.calls)).not.toContain('stack trace');
  });

  it('uses 503-compatible body on readiness timeout', async () => {
    const log = vi.fn();

    await expect(
      readinessBody(
        dependencies({
          initializePayload: vi.fn(
            () => new Promise<void>((resolve) => setTimeout(resolve, 100)),
          ),
          log,
        }),
      ),
    ).resolves.toEqual({ status: 'unavailable' });

    expect(log).toHaveBeenCalledWith({ code: 'ready-timeout' });
  });

  it('uses the same non-sensitive timeout diagnostic for a database timeout', async () => {
    const initializePayload = vi.fn(async () => undefined);
    const log = vi.fn();

    await expect(
      readinessBody(
        dependencies({
          checkDatabase: vi.fn(
            () => new Promise<void>((resolve) => setTimeout(resolve, 100)),
          ),
          initializePayload,
          log,
        }),
      ),
    ).resolves.toEqual({ status: 'unavailable' });

    expect(initializePayload).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith({ code: 'ready-timeout' });
  });

  it('maps unavailable readiness to HTTP 503', () => {
    expect(healthStatusCode({ status: 'ready' })).toBe(200);
    expect(healthStatusCode({ status: 'unavailable' })).toBe(503);
  });

  it('defines non-cacheable response headers', () => {
    expect(HEALTH_HEADERS['Cache-Control']).toContain('no-store');
    expect(HEALTH_HEADERS.Pragma).toBe('no-cache');
  });
});
