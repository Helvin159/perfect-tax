import { describe, expect, expectTypeOf, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { parseClientId } from '@/modules/portal-identity/domain/identifiers';

import {
  createSecurityEventRecorder,
  SecurityEventPersistenceError,
  type SecurityEventAppendPort,
  type SecurityEventRecorder,
} from './recorder';

describe('security-event recorder port', () => {
  it('appends a validated event with server-owned time and returns an immutable result', async () => {
    const actorId = parseClientId(22);
    const targetId = parseClientId(31);
    if (!actorId || !targetId) throw new Error('invalid test fixture');

    const append = vi.fn(async () => ({ id: 17 }));
    const recorder = createSecurityEventRecorder({
      appendPort: { append },
      now: () => new Date('2026-08-10T15:00:00.000Z'),
    });

    const result = await recorder.recordSecurityEvent({
      action: 'authorization.denied',
      actor: { id: actorId, kind: 'client' },
      correlationId: '018f47a8-7b2c-7f35-8c11-7bb91f934d22',
      metadata: { reasonCode: 'ownership-required' },
      target: { id: targetId, type: 'client' },
    });

    expect(append).toHaveBeenCalledWith({
      action: 'authorization.denied',
      actorId: '22',
      actorKind: 'client',
      correlationId: '018f47a8-7b2c-7f35-8c11-7bb91f934d22',
      metadata: { reasonCode: 'ownership-required' },
      occurredAt: '2026-08-10T15:00:00.000Z',
      targetId: '31',
      targetType: 'client',
    });
    expect(result.eventId).toBe(17);
    expect(result.occurredAt).toBe('2026-08-10T15:00:00.000Z');
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('fails closed when persistence does not return a valid event ID', async () => {
    const recorder = createSecurityEventRecorder({
      appendPort: { append: async () => ({ id: '17' }) },
    });

    await expect(
      recorder.recordSecurityEvent({
        action: 'authentication.failed',
        actor: { kind: 'anonymous' },
        metadata: {},
      }),
    ).rejects.toBeInstanceOf(SecurityEventPersistenceError);
  });

  it('exposes append-only capabilities and no CRUD mutation surface', () => {
    expectTypeOf<SecurityEventRecorder>().toHaveProperty('recordSecurityEvent');
    expectTypeOf<SecurityEventRecorder>().not.toHaveProperty('create');
    expectTypeOf<SecurityEventRecorder>().not.toHaveProperty('update');
    expectTypeOf<SecurityEventRecorder>().not.toHaveProperty('delete');
    expectTypeOf<SecurityEventAppendPort>().toHaveProperty('append');
    expectTypeOf<SecurityEventAppendPort>().not.toHaveProperty('update');
    expectTypeOf<SecurityEventAppendPort>().not.toHaveProperty('delete');
  });
});
