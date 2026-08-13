import { describe, expect, expectTypeOf, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  parseClientId,
  parseStaffId,
} from '@/modules/portal-identity/domain/identifiers';
import { parsePortalPrincipal } from '@/modules/portal-identity/domain/principal';

import {
  createSecurityEventRecorders,
  SecurityEventPersistenceError,
  SecurityEventProvenanceError,
  type SecurityEventAppendPort,
  type PrincipalSecurityEventRequest,
  type SecurityEventRecorders,
  type TrustedSystemEventProvenance,
} from './recorder';

type PrincipalSource = Readonly<{ opaquePrincipalSource: string }>;
type TargetSource = Readonly<{ opaqueTargetSource: string }>;
type SystemSource = Readonly<{ opaqueSystemSource: string }>;

function createHarness() {
  const append = vi.fn(async () => ({ id: 17 }));
  const principalBindings = new WeakMap<
    object,
    NonNullable<ReturnType<typeof parsePortalPrincipal>>
  >();
  const targetBindings = new WeakMap<
    object,
    NonNullable<ReturnType<typeof trustedTarget>>
  >();
  const systemBindings = new WeakMap<object, TrustedSystemEventProvenance>();

  const recorders = createSecurityEventRecorders({
    appendPort: { append },
    now: () => new Date('2026-08-10T15:00:00.000Z'),
    principalResolver: {
      resolvePrincipal: (source: PrincipalSource) =>
        principalBindings.get(source),
    },
    systemResolver: {
      resolveSystemSource: (source: SystemSource) => systemBindings.get(source),
    },
    targetResolver: {
      resolveTarget: (source: TargetSource) => targetBindings.get(source),
    },
  });

  return {
    append,
    bindPrincipal(source: PrincipalSource) {
      const principal = parsePortalPrincipal({
        authUserId: 'auth_staff_22',
        kind: 'staff',
        mfaAssurance: 'verified',
        role: 'administrator',
        staffId: 22,
        status: 'active',
      });
      if (!principal) throw new Error('invalid principal fixture');
      principalBindings.set(source, principal);
    },
    bindSystem(source: SystemSource, provenance: TrustedSystemEventProvenance) {
      systemBindings.set(source, provenance);
    },
    bindTarget(source: TargetSource) {
      const target = trustedTarget();
      if (!target) throw new Error('invalid target fixture');
      targetBindings.set(source, target);
    },
    recorders,
  };
}

function trustedTarget() {
  const clientId = parseClientId(31);
  return clientId ? ({ id: clientId, type: 'client' } as const) : undefined;
}

describe('source-bound security-event recorders', () => {
  it('derives the actor from a trusted principal source and appends server-owned evidence', async () => {
    const harness = createHarness();
    const principalSource = { opaquePrincipalSource: 'trusted' };
    harness.bindPrincipal(principalSource);

    const result = await harness.recorders.recordPrincipalSecurityEvent(
      principalSource,
      {
        action: 'authorization.denied',
        correlationId: '018f47a8-7b2c-7f35-8c11-7bb91f934d22',
        metadata: { reasonCode: 'ownership-required' },
      },
    );

    expect(harness.append).toHaveBeenCalledWith({
      action: 'authorization.denied',
      actorId: '22',
      actorKind: 'staff',
      correlationId: '018f47a8-7b2c-7f35-8c11-7bb91f934d22',
      metadata: { reasonCode: 'ownership-required' },
      occurredAt: '2026-08-10T15:00:00.000Z',
    });
    expect(result).toMatchObject({
      actor: { id: 22, kind: 'staff' },
      eventId: 17,
      occurredAt: '2026-08-10T15:00:00.000Z',
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('denies a raw session token supplied as actor.id through the ordinary path', async () => {
    const harness = createHarness();
    const principalSource = { opaquePrincipalSource: 'trusted' };
    harness.bindPrincipal(principalSource);

    await expect(
      harness.recorders.recordPrincipalSecurityEvent(principalSource, {
        action: 'authorization.denied',
        actor: {
          id: 'raw-session-token-that-is-valid-as-a-string',
          kind: 'auth-user',
        },
        metadata: { reasonCode: 'invalid-principal' },
      } as never),
    ).rejects.toBeInstanceOf(SecurityEventProvenanceError);
    expect(harness.append).not.toHaveBeenCalled();
  });

  it('denies a raw API token supplied as target.id through the ordinary path', async () => {
    const harness = createHarness();
    const principalSource = { opaquePrincipalSource: 'trusted' };
    harness.bindPrincipal(principalSource);

    await expect(
      harness.recorders.recordPrincipalSecurityEvent(principalSource, {
        action: 'authorization.denied',
        metadata: { reasonCode: 'ownership-required' },
        target: {
          id: 'raw-api-token-that-is-valid-as-a-string',
          type: 'auth-user',
        },
      } as never),
    ).rejects.toBeInstanceOf(SecurityEventProvenanceError);
    expect(harness.append).not.toHaveBeenCalled();
  });

  it('denies a structurally valid fake AuthUserId source without runtime provenance', async () => {
    const harness = createHarness();
    const fakeSource = {
      authUserId: 'syntactically-valid-but-untrusted',
      opaquePrincipalSource: 'fake',
    } as unknown as PrincipalSource;

    await expect(
      harness.recorders.recordPrincipalSecurityEvent(fakeSource, {
        action: 'authentication.succeeded',
        metadata: {},
      }),
    ).rejects.toEqual(
      new SecurityEventProvenanceError('trusted-principal-required'),
    );
    expect(harness.append).not.toHaveBeenCalled();
  });

  it('resolves targets only through a trusted target source', async () => {
    const harness = createHarness();
    const principalSource = { opaquePrincipalSource: 'trusted' };
    const targetSource = { opaqueTargetSource: 'trusted' };
    harness.bindPrincipal(principalSource);
    harness.bindTarget(targetSource);

    await harness.recorders.recordPrincipalSecurityEvent(principalSource, {
      action: 'authorization.denied',
      metadata: { reasonCode: 'ownership-required' },
      targetSource,
    });

    expect(harness.append).toHaveBeenCalledWith(
      expect.objectContaining({ targetId: '31', targetType: 'client' }),
    );
  });

  it('records owner bootstrap only through a private system source bound to operation, reason, and target', async () => {
    const harness = createHarness();
    const systemSource = { opaqueSystemSource: 'private-capability' };
    const staffId = parseStaffId(41);
    if (!staffId) throw new Error('invalid system target fixture');
    harness.bindSystem(systemSource, {
      operation: 'primary-owner-bootstrap',
      reasonCode: 'initial-primary-owner-provisioning',
      target: { id: staffId, type: 'staff' },
    });

    await expect(
      harness.recorders.recordSystemSecurityEvent(systemSource, {
        action: 'primary-owner.bootstrap.succeeded',
      }),
    ).resolves.toMatchObject({
      actor: { kind: 'system' },
      metadata: {
        operation: 'primary-owner-bootstrap',
        reasonCode: 'initial-primary-owner-provisioning',
      },
      target: { id: 41, type: 'staff' },
    });
  });

  it('denies a lookalike system capability and generic unknown objects', async () => {
    const harness = createHarness();
    const lookalike = {
      opaqueSystemSource: 'lookalike',
      operation: 'primary-owner-bootstrap',
      reasonCode: 'initial-primary-owner-provisioning',
    } as unknown as SystemSource;

    await expect(
      harness.recorders.recordSystemSecurityEvent(lookalike, {
        action: 'primary-owner.bootstrap.failed',
      }),
    ).rejects.toEqual(
      new SecurityEventProvenanceError('trusted-system-source-required'),
    );

    await expect(
      harness.recorders.recordPrincipalSecurityEvent({} as PrincipalSource, {
        action: 'authorization.denied',
        metadata: { reasonCode: 'invalid-principal' },
      }),
    ).rejects.toBeInstanceOf(SecurityEventProvenanceError);
    expect(harness.append).not.toHaveBeenCalled();
  });

  it('retains fail-closed secret metadata validation after provenance succeeds', async () => {
    const harness = createHarness();
    const principalSource = { opaquePrincipalSource: 'trusted' };
    harness.bindPrincipal(principalSource);

    await expect(
      harness.recorders.recordPrincipalSecurityEvent(principalSource, {
        action: 'authentication.failed',
        metadata: { sessionToken: 'must-not-persist' },
      } as never),
    ).rejects.toMatchObject({ code: 'prohibited-field' });
    expect(harness.append).not.toHaveBeenCalled();
  });

  it('fails closed when persistence does not return a valid event ID', async () => {
    const principalSource = { opaquePrincipalSource: 'trusted' };
    const principal = parsePortalPrincipal({
      authUserId: 'auth_staff_22',
      kind: 'staff',
      mfaAssurance: 'verified',
      role: 'administrator',
      staffId: 22,
      status: 'active',
    });
    if (!principal) throw new Error('invalid principal fixture');

    const recorders = createSecurityEventRecorders({
      appendPort: { append: async () => ({ id: '17' }) },
      principalResolver: { resolvePrincipal: () => principal },
      systemResolver: { resolveSystemSource: () => undefined },
      targetResolver: { resolveTarget: () => undefined },
    });

    await expect(
      recorders.recordPrincipalSecurityEvent(principalSource, {
        action: 'authorization.denied',
        metadata: { reasonCode: 'forbidden-role' },
      }),
    ).rejects.toBeInstanceOf(SecurityEventPersistenceError);
  });

  it('exposes source-bound record operations and no generic append or CRUD surface', () => {
    expectTypeOf<
      PrincipalSecurityEventRequest<TargetSource>
    >().not.toHaveProperty('actor');
    expectTypeOf<
      PrincipalSecurityEventRequest<TargetSource>
    >().not.toHaveProperty('target');
    expectTypeOf<
      SecurityEventRecorders<PrincipalSource, TargetSource, SystemSource>
    >().toHaveProperty('recordPrincipalSecurityEvent');
    expectTypeOf<
      SecurityEventRecorders<PrincipalSource, TargetSource, SystemSource>
    >().toHaveProperty('recordSystemSecurityEvent');
    expectTypeOf<
      SecurityEventRecorders<PrincipalSource, TargetSource, SystemSource>
    >().not.toHaveProperty('recordSecurityEvent');
    expectTypeOf<SecurityEventAppendPort>().toHaveProperty('append');
    expectTypeOf<SecurityEventAppendPort>().not.toHaveProperty('update');
    expectTypeOf<SecurityEventAppendPort>().not.toHaveProperty('delete');
  });
});
