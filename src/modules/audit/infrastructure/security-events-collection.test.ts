import type { Payload } from 'payload';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { parsePortalPrincipal } from '@/modules/portal-identity/domain/principal';

import type { SecurityEventRecorders } from '../application/recorder';
import {
  createPayloadSecurityEventRecorders,
  denySecurityEventDelete,
  denySecurityEventUpdate,
  enforceSecurityEventAppend,
  SecurityEvents,
  SecurityEventWriteDeniedError,
} from './security-events-collection';

type PrincipalSource = Readonly<{ opaquePrincipalSource: string }>;

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

  it('allows append only after both principal provenance and the private Payload capability succeed', async () => {
    const principalSource = { opaquePrincipalSource: 'trusted' };
    const principalBindings = new WeakMap<
      object,
      NonNullable<ReturnType<typeof parsePortalPrincipal>>
    >();
    const principal = parsePortalPrincipal({
      authUserId: 'auth_staff_7',
      kind: 'staff-enrollment',
      allowedOperations: ['enroll-mfa', 'verify-mfa', 'sign-out'],
      staffId: 7,
    });
    if (!principal) throw new Error('invalid principal fixture');
    principalBindings.set(principalSource, principal);

    const create = vi.fn(async (operation: Record<string, unknown>) => {
      enforceSecurityEventAppend({
        context: operation.context,
        data: operation.data,
        operation: 'create',
      });
      return { id: 9 };
    });
    const recorders = createPayloadSecurityEventRecorders(
      { create } as unknown as Pick<Payload, 'create'>,
      {
        principalResolver: {
          resolvePrincipal: (source: PrincipalSource) =>
            principalBindings.get(source),
        },
        systemResolver: { resolveSystemSource: () => undefined },
        targetResolver: { resolveTarget: () => undefined },
      },
      () => new Date('2026-08-10T15:00:00.000Z'),
    );

    await expect(
      recorders.recordPrincipalSecurityEvent(principalSource, {
        action: 'mfa.verification.succeeded',
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

  it('keeps ordinary consumers on source-bound APIs with no generic recorder', () => {
    expectTypeOf<
      ReturnType<typeof createPayloadSecurityEventRecorders>
    >().toEqualTypeOf<SecurityEventRecorders<object, object, object>>();
    expectTypeOf<
      ReturnType<typeof createPayloadSecurityEventRecorders>
    >().not.toHaveProperty('recordSecurityEvent');
    expect(SecurityEvents.admin?.hidden).toBe(true);
    expect(SecurityEvents.disableBulkDelete).toBe(true);
    expect(SecurityEvents.disableDuplicate).toBe(true);
    expect(SecurityEvents.graphQL).toBe(false);
    expect(SecurityEvents.timestamps).toBe(false);
  });
});
