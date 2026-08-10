import type { Payload } from 'payload';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { parseStaffId } from '@/modules/portal-identity/domain/identifiers';

import type { SecurityEventRecorder } from '../application/recorder';
import {
  createPayloadSecurityEventRecorder,
  denySecurityEventDelete,
  denySecurityEventUpdate,
  enforceSecurityEventAppend,
  SecurityEvents,
  SecurityEventWriteDeniedError,
} from './security-events-collection';

describe('SecurityEvents collection boundary', () => {
  it('denies normal create, read, update, and delete access', () => {
    const access = SecurityEvents.access;
    expect(access?.create).toBeTypeOf('function');
    expect(access?.read).toBeTypeOf('function');
    expect(access?.update).toBeTypeOf('function');
    expect(access?.delete).toBeTypeOf('function');

    for (const operation of [
      access?.create,
      access?.read,
      access?.update,
      access?.delete,
    ]) {
      if (typeof operation === 'function') {
        expect(operation({} as never)).toBe(false);
      }
    }
  });

  it('denies update and delete in hooks even if Payload access is bypassed', () => {
    expect(() =>
      denySecurityEventUpdate({ operation: 'update' } as never),
    ).toThrowError(new SecurityEventWriteDeniedError('immutable-event'));
    expect(() => denySecurityEventDelete({} as never)).toThrowError(
      new SecurityEventWriteDeniedError('immutable-event'),
    );
    expect(() =>
      enforceSecurityEventAppend({
        context: {},
        data: {},
        operation: 'update',
      }),
    ).toThrowError(new SecurityEventWriteDeniedError('immutable-event'));
  });

  it('denies direct create attempts without the private append capability', () => {
    expect(() =>
      enforceSecurityEventAppend({
        context: { securityEventAppendCapability: {} },
        data: {
          action: 'authentication.failed',
          actorKind: 'anonymous',
          metadata: {},
          occurredAt: '2026-08-10T15:00:00.000Z',
        },
        operation: 'create',
      }),
    ).toThrowError(
      new SecurityEventWriteDeniedError('append-capability-required'),
    );
  });

  it('allows a valid append only through the narrow Payload recorder', async () => {
    const staffId = parseStaffId(7);
    if (!staffId) throw new Error('invalid test fixture');

    const create = vi.fn(async (operation: Record<string, unknown>) => {
      enforceSecurityEventAppend({
        context: operation.context,
        data: operation.data,
        operation: 'create',
      });
      return { id: 9 };
    });
    const recorder = createPayloadSecurityEventRecorder(
      { create } as unknown as Pick<Payload, 'create'>,
      () => new Date('2026-08-10T15:00:00.000Z'),
    );

    await expect(
      recorder.recordSecurityEvent({
        action: 'mfa.verification.succeeded',
        actor: { id: staffId, kind: 'staff-enrollment' },
        metadata: {},
      }),
    ).resolves.toMatchObject({ eventId: 9 });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'security-events',
        depth: 0,
        overrideAccess: true,
      }),
    );
  });

  it('keeps ordinary consumers on the append-only recorder type', () => {
    expectTypeOf<
      ReturnType<typeof createPayloadSecurityEventRecorder>
    >().toEqualTypeOf<SecurityEventRecorder>();
    expect(SecurityEvents.admin?.hidden).toBe(true);
    expect(SecurityEvents.disableBulkDelete).toBe(true);
    expect(SecurityEvents.disableDuplicate).toBe(true);
    expect(SecurityEvents.graphQL).toBe(false);
    expect(SecurityEvents.timestamps).toBe(false);
  });
});
