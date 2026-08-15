import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { createSecurityEventRecorders } from '@/modules/audit/application/recorder';
import {
  parseStaffId,
  type StaffId,
} from '@/modules/portal-identity/domain/identifiers';

import {
  authorizePrimaryOwnerBootstrapRequest,
  composePrimaryOwnerBootstrapSystemGateway,
  SystemPayloadGatewayAuthorizationError,
  type PrimaryOwnerBootstrapAuditSource,
  type PrimaryOwnerBootstrapScope,
} from './system-payload-gateway';

type SystemSource = Readonly<{ opaqueSystemSource: string }>;
type TargetSource = Readonly<{ opaqueTargetSource: string }>;

const correlationId = '3ca85f64-5717-4562-b3fc-2c963f66afa6';

function requiredStaffId(value: number): StaffId {
  const id = parseStaffId(value);
  if (!id) throw new Error('Invalid Staff test ID');
  return id;
}

function createHarness() {
  const systemSources = new WeakSet<object>();
  const targetSources = new WeakMap<object, StaffId>();
  const composition = composePrimaryOwnerBootstrapSystemGateway<
    SystemSource,
    TargetSource
  >({
    sourceResolver: {
      resolveSystemOperation: (source) =>
        systemSources.has(source) ? 'primary-owner-bootstrap' : undefined,
    },
    targetResolver: {
      resolveCreatedPrimaryOwnerStaffId: (source) => targetSources.get(source),
    },
  });

  function trustSystemSource(): SystemSource {
    const source = Object.freeze({ opaqueSystemSource: crypto.randomUUID() });
    systemSources.add(source);
    return source;
  }

  function trustTarget(staffId = requiredStaffId(44)): TargetSource {
    const source = Object.freeze({ opaqueTargetSource: crypto.randomUUID() });
    targetSources.set(source, staffId);
    return source;
  }

  return { composition, trustSystemSource, trustTarget };
}

const request = Object.freeze({
  correlationId,
  operation: 'primary-owner-bootstrap' as const,
  reasonCode: 'initial-primary-owner-provisioning' as const,
});

describe('SystemPayloadGateway capability boundary', () => {
  it('represents only the approved bootstrap operation without executing bootstrap itself', async () => {
    const harness = createHarness();
    const operation = vi.fn(
      async (scope: PrimaryOwnerBootstrapScope<TargetSource>) => {
        expect(scope.operation).toBe('primary-owner-bootstrap');
        return 'represented-only';
      },
    );

    await expect(
      harness.composition.gateway.runPrimaryOwnerBootstrapScope(
        harness.trustSystemSource(),
        request,
        operation,
      ),
    ).resolves.toBe('represented-only');

    expect(operation).toHaveBeenCalledOnce();
    const scope = operation.mock.calls[0]?.[0];
    expect(scope).toMatchObject({
      correlationId,
      operation: 'primary-owner-bootstrap',
      reasonCode: 'initial-primary-owner-provisioning',
    });
    expect(scope).not.toHaveProperty('payload');
    expect(scope).not.toHaveProperty('overrideAccess');
    expect(scope).not.toHaveProperty('createOwner');
  });

  it('denies normal Staff, including Owner, and lookalike system sources', async () => {
    const harness = createHarness();
    const callback = vi.fn(async () => undefined);

    for (const source of [
      {
        authUserId: 'auth-owner',
        kind: 'staff',
        mfaAssurance: 'verified',
        role: 'owner',
        staffId: 11,
        status: 'active',
      },
      { opaqueSystemSource: 'looks-valid' },
      { operation: 'primary-owner-bootstrap', trusted: true },
    ]) {
      await expect(
        harness.composition.gateway.runPrimaryOwnerBootstrapScope(
          source as SystemSource,
          request,
          callback,
        ),
      ).rejects.toEqual(
        new SystemPayloadGatewayAuthorizationError(
          'system-capability-required',
        ),
      );
    }
    expect(callback).not.toHaveBeenCalled();
  });

  it('denies a missing reason, invalid correlation ID, and wrong operation', async () => {
    const harness = createHarness();
    const source = harness.trustSystemSource();
    const callback = vi.fn(async () => undefined);

    await expect(
      harness.composition.gateway.runPrimaryOwnerBootstrapScope(
        source,
        { ...request, reasonCode: undefined } as never,
        callback,
      ),
    ).rejects.toMatchObject({ code: 'system-reason-required' });
    await expect(
      harness.composition.gateway.runPrimaryOwnerBootstrapScope(
        source,
        { ...request, correlationId: 'browser-job-1' },
        callback,
      ),
    ).rejects.toMatchObject({ code: 'system-correlation-required' });
    await expect(
      harness.composition.gateway.runPrimaryOwnerBootstrapScope(
        source,
        { ...request, operation: 'run-anything' } as never,
        callback,
      ),
    ).rejects.toMatchObject({ code: 'system-operation-not-allowed' });
    expect(callback).not.toHaveBeenCalled();
  });

  it('requires the genuine context token and binds it to exactly one Payload request', async () => {
    const harness = createHarness();
    let retainedScope: PrimaryOwnerBootstrapScope<TargetSource> | undefined;
    let retainedReq: Record<string, unknown> | undefined;

    await harness.composition.gateway.runPrimaryOwnerBootstrapScope(
      harness.trustSystemSource(),
      request,
      async (scope) => {
        retainedScope = scope;
        const req = { context: { ...scope.context }, transactionID: 'tx-1' };
        retainedReq = req;

        expect(Object.keys(scope.context)).toEqual(['portalSystemCapability']);
        expect(
          await harness.composition.authorizePrimaryOwnerBootstrap({
            context: req.context,
            req,
            systemOperation: 'primary-owner-bootstrap',
          } as never),
        ).toBe(true);
        expect(
          await harness.composition.authorizePrimaryOwnerBootstrap({
            context: req.context,
            req,
            systemOperation: 'run-anything',
          } as never),
        ).toBe(false);
        expect(
          await harness.composition.authorizePrimaryOwnerBootstrap({
            context: req.context,
            req: { ...req },
            systemOperation: 'primary-owner-bootstrap',
          } as never),
        ).toBe(false);

        expect(
          authorizePrimaryOwnerBootstrapRequest({
            context: { portalSystemCapability: {} },
            req: {},
            systemOperation: 'primary-owner-bootstrap',
          } as never),
        ).toBe(false);
      },
    );

    if (!retainedScope || !retainedReq) throw new Error('Missing scope');
    expect(
      await harness.composition.authorizePrimaryOwnerBootstrap({
        context: retainedScope.context,
        req: retainedReq,
        systemOperation: 'primary-owner-bootstrap',
      } as never),
    ).toBe(false);
  });

  it('produces Agent 7 trusted failure and success audit sources without exposing capability internals', async () => {
    const harness = createHarness();
    const appended: unknown[] = [];
    let nextId = 1;
    const recorders = createSecurityEventRecorders({
      appendPort: {
        append: async (record) => {
          appended.push(record);
          return { id: nextId++ };
        },
      },
      now: () => new Date('2026-08-14T12:00:00.000Z'),
      principalResolver: { resolvePrincipal: () => undefined },
      systemResolver: harness.composition.auditSourceResolver,
      targetResolver: { resolveTarget: () => undefined },
    });

    await harness.composition.gateway.runPrimaryOwnerBootstrapScope(
      harness.trustSystemSource(),
      request,
      async (scope) => {
        await expect(
          recorders.recordSystemSecurityEvent(scope.failureAuditSource, {
            action: 'primary-owner.bootstrap.failed',
            correlationId: scope.correlationId,
          }),
        ).resolves.toMatchObject({
          actor: { kind: 'system' },
          metadata: {
            operation: 'primary-owner-bootstrap',
            reasonCode: 'initial-primary-owner-provisioning',
          },
        });

        const successSource = await scope.createSuccessAuditSource(
          harness.trustTarget(),
        );
        await expect(
          recorders.recordSystemSecurityEvent(successSource, {
            action: 'primary-owner.bootstrap.succeeded',
            correlationId: scope.correlationId,
          }),
        ).resolves.toMatchObject({
          actor: { kind: 'system' },
          target: { id: 44, type: 'staff' },
        });

        expect(
          harness.composition.auditSourceResolver.resolveSystemSource(
            {} as PrimaryOwnerBootstrapAuditSource,
          ),
        ).toBeUndefined();
      },
    );

    expect(appended).toHaveLength(2);
    expect(JSON.stringify(appended)).not.toContain('capability');
    expect(JSON.stringify(appended)).not.toContain('token');
  });

  it('denies untrusted success targets and revokes audit sources after the scope', async () => {
    const harness = createHarness();
    let retainedFailure: PrimaryOwnerBootstrapAuditSource | undefined;
    let retainedSuccess: PrimaryOwnerBootstrapAuditSource | undefined;

    await harness.composition.gateway.runPrimaryOwnerBootstrapScope(
      harness.trustSystemSource(),
      request,
      async (scope) => {
        retainedFailure = scope.failureAuditSource;
        await expect(
          scope.createSuccessAuditSource({
            opaqueTargetSource: 'lookalike',
          }),
        ).rejects.toMatchObject({ code: 'system-target-required' });
        retainedSuccess = await scope.createSuccessAuditSource(
          harness.trustTarget(requiredStaffId(77)),
        );
        expect(
          harness.composition.auditSourceResolver.resolveSystemSource(
            retainedSuccess,
          ),
        ).toEqual({
          operation: 'primary-owner-bootstrap',
          reasonCode: 'initial-primary-owner-provisioning',
          target: { id: 77, type: 'staff' },
        });
      },
    );

    if (!retainedFailure || !retainedSuccess) {
      throw new Error('Missing retained audit source');
    }
    expect(
      harness.composition.auditSourceResolver.resolveSystemSource(
        retainedFailure,
      ),
    ).toBeUndefined();
    expect(
      harness.composition.auditSourceResolver.resolveSystemSource(
        retainedSuccess,
      ),
    ).toBeUndefined();
  });

  it('fails closed when the system provenance resolver throws', async () => {
    const composition = composePrimaryOwnerBootstrapSystemGateway({
      sourceResolver: {
        resolveSystemOperation: () => {
          throw new Error('resolver unavailable');
        },
      },
      targetResolver: {
        resolveCreatedPrimaryOwnerStaffId: () => undefined,
      },
    });

    await expect(
      composition.gateway.runPrimaryOwnerBootstrapScope(
        { source: true },
        request,
        async () => undefined,
      ),
    ).rejects.toMatchObject({ code: 'system-capability-required' });
  });
});
