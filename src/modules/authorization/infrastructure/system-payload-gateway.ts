/// <reference types="vitest/importMeta" />

import 'server-only';

import type { RequestContext } from 'payload';

import {
  createSecurityEventRecorders,
  type SecurityEventAppendPort,
  type SystemSecurityEventRecorder,
  type TrustedSystemEventProvenance,
  type TrustedSystemSourceResolver,
} from '@/modules/audit/application/recorder';
import type { SystemEventReasonCode } from '@/modules/audit/domain/event';
import type { SystemOperation } from '@/modules/authorization/domain/system-operation';
import {
  parseStaffId,
  type StaffId,
} from '@/modules/portal-identity/domain/identifiers';
import { isRecord } from '@/modules/portal-identity/domain/validation';
import type {
  AuthorizePrimaryOwnerBootstrap,
  PrimaryOwnerBootstrapAuthorizationArgs,
} from '@/modules/staff/domain/invariants';

const systemCapabilityContextKey = 'portalSystemCapability';
const PRIMARY_OWNER_BOOTSTRAP = 'primary-owner-bootstrap' as const;
const PRIMARY_OWNER_BOOTSTRAP_REASON =
  'initial-primary-owner-provisioning' as const;

const correlationIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const SYSTEM_PAYLOAD_GATEWAY_ERROR_CODES = Object.freeze([
  'system-capability-required',
  'system-correlation-required',
  'system-operation-not-allowed',
  'system-reason-required',
  'system-target-required',
] as const);

export type SystemPayloadGatewayErrorCode =
  (typeof SYSTEM_PAYLOAD_GATEWAY_ERROR_CODES)[number];

export class SystemPayloadGatewayAuthorizationError extends Error {
  readonly code: SystemPayloadGatewayErrorCode;

  constructor(code: SystemPayloadGatewayErrorCode) {
    super(`System operation denied: ${code}`);
    this.name = 'SystemPayloadGatewayAuthorizationError';
    this.code = code;
  }
}

export type PrimaryOwnerBootstrapRequest = Readonly<{
  correlationId: string;
  operation: Extract<SystemOperation, 'primary-owner-bootstrap'>;
  reasonCode: Extract<
    SystemEventReasonCode,
    'initial-primary-owner-provisioning'
  >;
}>;

type TrustedPrimaryOwnerBootstrapSourceResolver<Source extends object> =
  Readonly<{
    resolveSystemOperation(
      source: Source,
    ):
      | Extract<SystemOperation, 'primary-owner-bootstrap'>
      | undefined
      | Promise<
          Extract<SystemOperation, 'primary-owner-bootstrap'> | undefined
        >;
  }>;

type TrustedPrimaryOwnerTargetResolver<TargetSource extends object> = Readonly<{
  resolveCreatedPrimaryOwnerStaffId(
    source: TargetSource,
  ): StaffId | undefined | Promise<StaffId | undefined>;
}>;

declare const primaryOwnerAuditSourceBrand: unique symbol;

type PrimaryOwnerBootstrapAuditSource = Readonly<{
  readonly [primaryOwnerAuditSourceBrand]: true;
}>;

type PrimaryOwnerBootstrapScope = Readonly<{
  context: RequestContext;
  operation: Extract<SystemOperation, 'primary-owner-bootstrap'>;
  reasonCode: Extract<
    SystemEventReasonCode,
    'initial-primary-owner-provisioning'
  >;
}>;

type PrimaryOwnerBootstrapOutcome<
  Result,
  TargetSource extends object,
> = Readonly<{
  result: Result;
  targetSource: TargetSource;
}>;

type SystemPayloadGateway<
  SystemSource extends object,
  TargetSource extends object,
> = Readonly<{
  runPrimaryOwnerBootstrap<Result>(
    systemSource: SystemSource,
    request: PrimaryOwnerBootstrapRequest,
    operation: (
      scope: PrimaryOwnerBootstrapScope,
    ) => Promise<PrimaryOwnerBootstrapOutcome<Result, TargetSource>>,
  ): Promise<Result>;
}>;

type PrimaryOwnerBootstrapSystemComposition<
  SystemSource extends object,
  TargetSource extends object,
> = Readonly<{
  authorizePrimaryOwnerBootstrap: AuthorizePrimaryOwnerBootstrap;
  gateway: SystemPayloadGateway<SystemSource, TargetSource>;
}>;

type SystemCapabilityBinding = {
  readonly correlationId: string;
  readonly operation: typeof PRIMARY_OWNER_BOOTSTRAP;
  readonly reasonCode: typeof PRIMARY_OWNER_BOOTSTRAP_REASON;
  request?: object;
};

const systemCapabilities = new WeakMap<object, SystemCapabilityBinding>();
const systemAuditSources = new WeakMap<object, TrustedSystemEventProvenance>();

function capabilityFromContext(context: unknown): object | undefined {
  if (!isRecord(context)) return undefined;
  const capability = context[systemCapabilityContextKey];
  return typeof capability === 'object' && capability !== null
    ? capability
    : undefined;
}

function validateBootstrapRequest(
  request: unknown,
): PrimaryOwnerBootstrapRequest {
  if (!isRecord(request) || request.operation !== PRIMARY_OWNER_BOOTSTRAP) {
    throw new SystemPayloadGatewayAuthorizationError(
      'system-operation-not-allowed',
    );
  }
  if (request.reasonCode !== PRIMARY_OWNER_BOOTSTRAP_REASON) {
    throw new SystemPayloadGatewayAuthorizationError('system-reason-required');
  }
  if (
    typeof request.correlationId !== 'string' ||
    !correlationIdPattern.test(request.correlationId)
  ) {
    throw new SystemPayloadGatewayAuthorizationError(
      'system-correlation-required',
    );
  }

  return Object.freeze({
    correlationId: request.correlationId,
    operation: PRIMARY_OWNER_BOOTSTRAP,
    reasonCode: PRIMARY_OWNER_BOOTSTRAP_REASON,
  });
}

function bindSystemRequest(
  binding: SystemCapabilityBinding,
  request: object,
): boolean {
  if (binding.request === undefined) {
    binding.request = request;
    return true;
  }
  return binding.request === request;
}

function authorizeSystemRequest({
  context,
  req,
  systemOperation,
}: PrimaryOwnerBootstrapAuthorizationArgs): boolean {
  if (systemOperation !== PRIMARY_OWNER_BOOTSTRAP) return false;

  const capability = capabilityFromContext(context);
  const requestCapability = isRecord(req)
    ? capabilityFromContext(req.context)
    : undefined;
  if (!capability || requestCapability !== capability) return false;
  const binding = systemCapabilities.get(capability);

  return (
    binding?.operation === PRIMARY_OWNER_BOOTSTRAP &&
    binding.reasonCode === PRIMARY_OWNER_BOOTSTRAP_REASON &&
    bindSystemRequest(binding, req)
  );
}

function createAuditSource(
  provenance: TrustedSystemEventProvenance,
): PrimaryOwnerBootstrapAuditSource {
  const source = Object.freeze({}) as PrimaryOwnerBootstrapAuditSource;
  systemAuditSources.set(source, Object.freeze(provenance));
  return source;
}

async function resolvePrimaryOwnerTarget<TargetSource extends object>(
  resolver: TrustedPrimaryOwnerTargetResolver<TargetSource>,
  targetSource: unknown,
): Promise<StaffId> {
  if (typeof targetSource !== 'object' || targetSource === null) {
    throw new SystemPayloadGatewayAuthorizationError('system-target-required');
  }

  try {
    const staffId = parseStaffId(
      await resolver.resolveCreatedPrimaryOwnerStaffId(
        targetSource as TargetSource,
      ),
    );
    if (staffId) return staffId;
  } catch {
    // Resolver failures are intentionally indistinguishable from bad sources.
  }

  throw new SystemPayloadGatewayAuthorizationError('system-target-required');
}

/**
 * Private Agent 12 composition seam. Agent 12 must complete this module by
 * importing its concrete source/target resolvers and Agent 7 recorder here.
 * Exporting this function, any dependency object, or either issuer would
 * reopen the system authority boundary.
 */
function composePrimaryOwnerBootstrapSystemGateway<
  SystemSource extends object,
  TargetSource extends object,
>(dependencies: {
  createAuditRecorder(
    resolver: TrustedSystemSourceResolver<PrimaryOwnerBootstrapAuditSource>,
  ): SystemSecurityEventRecorder<PrimaryOwnerBootstrapAuditSource>;
  sourceResolver: TrustedPrimaryOwnerBootstrapSourceResolver<SystemSource>;
  targetResolver: TrustedPrimaryOwnerTargetResolver<TargetSource>;
}): PrimaryOwnerBootstrapSystemComposition<SystemSource, TargetSource> {
  const auditSourceResolver: TrustedSystemSourceResolver<PrimaryOwnerBootstrapAuditSource> =
    Object.freeze({
      resolveSystemSource: (source: PrimaryOwnerBootstrapAuditSource) =>
        systemAuditSources.get(source),
    });
  const auditRecorder = dependencies.createAuditRecorder(auditSourceResolver);

  const gateway: SystemPayloadGateway<SystemSource, TargetSource> =
    Object.freeze({
      async runPrimaryOwnerBootstrap<Result>(
        unsafeSource: SystemSource,
        unsafeRequest: PrimaryOwnerBootstrapRequest,
        operation: (
          scope: PrimaryOwnerBootstrapScope,
        ) => Promise<PrimaryOwnerBootstrapOutcome<Result, TargetSource>>,
      ): Promise<Result> {
        if (typeof unsafeSource !== 'object' || unsafeSource === null) {
          throw new SystemPayloadGatewayAuthorizationError(
            'system-capability-required',
          );
        }

        let resolvedOperation:
          Extract<SystemOperation, 'primary-owner-bootstrap'> | undefined;
        try {
          resolvedOperation =
            await dependencies.sourceResolver.resolveSystemOperation(
              unsafeSource,
            );
        } catch {
          throw new SystemPayloadGatewayAuthorizationError(
            'system-capability-required',
          );
        }
        if (resolvedOperation !== PRIMARY_OWNER_BOOTSTRAP) {
          throw new SystemPayloadGatewayAuthorizationError(
            'system-capability-required',
          );
        }

        const request = validateBootstrapRequest(unsafeRequest);
        const capability = Object.freeze({});
        const binding: SystemCapabilityBinding = {
          correlationId: request.correlationId,
          operation: request.operation,
          reasonCode: request.reasonCode,
        };
        systemCapabilities.set(capability, binding);

        const invocationAuditSources =
          new Set<PrimaryOwnerBootstrapAuditSource>();
        const failureAuditSource = createAuditSource({
          correlationId: binding.correlationId,
          operation: binding.operation,
          reasonCode: binding.reasonCode,
        });
        invocationAuditSources.add(failureAuditSource);

        const scope: PrimaryOwnerBootstrapScope = Object.freeze({
          context: Object.freeze({ [systemCapabilityContextKey]: capability }),
          operation: binding.operation,
          reasonCode: binding.reasonCode,
        });

        try {
          let outcome: PrimaryOwnerBootstrapOutcome<Result, TargetSource>;
          let successAuditSource: PrimaryOwnerBootstrapAuditSource;

          try {
            outcome = await operation(scope);
            if (
              !isRecord(outcome) ||
              !Object.hasOwn(outcome, 'result') ||
              !Object.hasOwn(outcome, 'targetSource')
            ) {
              throw new SystemPayloadGatewayAuthorizationError(
                'system-target-required',
              );
            }

            const staffId = await resolvePrimaryOwnerTarget(
              dependencies.targetResolver,
              outcome.targetSource,
            );
            successAuditSource = createAuditSource({
              correlationId: binding.correlationId,
              operation: binding.operation,
              reasonCode: binding.reasonCode,
              target: { id: staffId, type: 'staff' },
            });
            invocationAuditSources.add(successAuditSource);
          } catch (operationFailure) {
            await auditRecorder.recordSystemSecurityEvent(failureAuditSource, {
              action: 'primary-owner.bootstrap.failed',
            });
            throw operationFailure;
          }

          // A successful return is impossible until this append succeeds.
          // If it fails, no second terminal event is attempted: Agent 12/14
          // must later supply the database transaction that rolls back the
          // privileged change and append atomically.
          await auditRecorder.recordSystemSecurityEvent(successAuditSource, {
            action: 'primary-owner.bootstrap.succeeded',
          });
          return outcome.result;
        } finally {
          systemCapabilities.delete(capability);
          for (const source of invocationAuditSources) {
            systemAuditSources.delete(source);
          }
        }
      },
    });

  return Object.freeze({
    authorizePrimaryOwnerBootstrap: authorizeSystemRequest,
    gateway,
  });
}

/**
 * Verifies only the private request capability. It cannot mint one and normal
 * callers can obtain only `false` until Agent 12 completes this module.
 */
export function authorizePrimaryOwnerBootstrapRequest(
  args: PrimaryOwnerBootstrapAuthorizationArgs,
): boolean {
  return authorizeSystemRequest(args);
}

/** Avoid accidental widening to a generic system operation vocabulary. */
export function isPrimaryOwnerBootstrapOperation(
  value: unknown,
): value is Extract<SystemOperation, 'primary-owner-bootstrap'> {
  return value === PRIMARY_OWNER_BOOTSTRAP;
}

if (import.meta.vitest) {
  const { describe, expect, it, vi } = import.meta.vitest;

  type TestSystemSource = Readonly<{ opaqueSystemSource: string }>;
  type TestTargetSource = Readonly<{ opaqueTargetSource: string }>;

  const testCorrelationId = '3ca85f64-5717-4562-b3fc-2c963f66afa6';
  const replacementCorrelationId = '018f47a8-7b2c-7f35-8c11-7bb91f934d22';
  const testRequest: PrimaryOwnerBootstrapRequest = Object.freeze({
    correlationId: testCorrelationId,
    operation: PRIMARY_OWNER_BOOTSTRAP,
    reasonCode: PRIMARY_OWNER_BOOTSTRAP_REASON,
  });

  function createPrivateSystemHarness(
    appendImplementation: SecurityEventAppendPort['append'] = async () => ({
      id: 1,
    }),
  ) {
    const systemSources = new WeakSet<object>();
    const targetSources = new WeakMap<object, StaffId>();
    const append = vi.fn(appendImplementation);
    const composition = composePrimaryOwnerBootstrapSystemGateway<
      TestSystemSource,
      TestTargetSource
    >({
      createAuditRecorder: (systemResolver) =>
        createSecurityEventRecorders({
          appendPort: { append },
          now: () => new Date('2026-08-15T18:00:00.000Z'),
          principalResolver: { resolvePrincipal: () => undefined },
          systemResolver,
          targetResolver: { resolveTarget: () => undefined },
        }),
      sourceResolver: {
        resolveSystemOperation: (source) =>
          systemSources.has(source) ? PRIMARY_OWNER_BOOTSTRAP : undefined,
      },
      targetResolver: {
        resolveCreatedPrimaryOwnerStaffId: (source) =>
          targetSources.get(source),
      },
    });

    return {
      append,
      composition,
      trustSystemSource(): TestSystemSource {
        const source = Object.freeze({
          opaqueSystemSource: crypto.randomUUID(),
        });
        systemSources.add(source);
        return source;
      },
      trustTarget(staffIdValue = 44): TestTargetSource {
        const staffId = parseStaffId(staffIdValue);
        if (!staffId) throw new Error('Invalid Staff test ID');
        const source = Object.freeze({
          opaqueTargetSource: crypto.randomUUID(),
        });
        targetSources.set(source, staffId);
        return source;
      },
    };
  }

  describe('private mandatory-audit system envelope', () => {
    it('returns success only after exactly one required success event', async () => {
      const harness = createPrivateSystemHarness();
      const targetSource = harness.trustTarget();
      let retainedScope: PrimaryOwnerBootstrapScope | undefined;
      let retainedRequest: Record<string, unknown> | undefined;
      const privilegedAction = vi.fn(
        async (scope: PrimaryOwnerBootstrapScope) => {
          retainedScope = scope;
          retainedRequest = {
            context: { ...scope.context },
            privateRequestBody: { password: 'must-not-reach-audit' },
          };
          expect(
            harness.composition.authorizePrimaryOwnerBootstrap({
              context: retainedRequest.context,
              req: retainedRequest,
              systemOperation: PRIMARY_OWNER_BOOTSTRAP,
            } as never),
          ).toBe(true);
          expect(scope).toEqual({
            context: expect.any(Object),
            operation: PRIMARY_OWNER_BOOTSTRAP,
            reasonCode: PRIMARY_OWNER_BOOTSTRAP_REASON,
          });
          expect(scope).not.toHaveProperty('auditSource');
          expect(scope).not.toHaveProperty('correlationId');
          return {
            capability: scope.context,
            correlationId: replacementCorrelationId,
            principal: { kind: 'staff', role: 'owner' },
            requestBody: { password: 'must-not-reach-audit' },
            result: 'bootstrap-complete',
            targetSource,
          };
        },
      );

      await expect(
        harness.composition.gateway.runPrimaryOwnerBootstrap(
          harness.trustSystemSource(),
          testRequest,
          privilegedAction,
        ),
      ).resolves.toBe('bootstrap-complete');

      expect(privilegedAction).toHaveBeenCalledOnce();
      expect(harness.append).toHaveBeenCalledOnce();
      expect(harness.append).toHaveBeenCalledWith({
        action: 'primary-owner.bootstrap.succeeded',
        actorKind: 'system',
        correlationId: testCorrelationId,
        metadata: {
          operation: PRIMARY_OWNER_BOOTSTRAP,
          reasonCode: PRIMARY_OWNER_BOOTSTRAP_REASON,
        },
        occurredAt: '2026-08-15T18:00:00.000Z',
        targetId: '44',
        targetType: 'staff',
      });
      expect(JSON.stringify(harness.append.mock.calls)).not.toContain(
        replacementCorrelationId,
      );
      expect(JSON.stringify(harness.append.mock.calls)).not.toMatch(
        /capability|password|principal|requestBody|token|totp|backupCode/iu,
      );

      if (!retainedScope || !retainedRequest) {
        throw new Error('Missing retained system request');
      }
      expect(
        harness.composition.authorizePrimaryOwnerBootstrap({
          context: retainedScope.context,
          req: retainedRequest,
          systemOperation: PRIMARY_OWNER_BOOTSTRAP,
        } as never),
      ).toBe(false);
    });

    it('records exactly one required failure event before propagating action failure', async () => {
      const harness = createPrivateSystemHarness();
      const actionFailure = Object.assign(
        new Error('privileged action failed'),
        {
          capability: {},
          password: 'must-not-reach-audit',
          principal: { kind: 'staff', role: 'owner' },
        },
      );
      const privilegedAction = vi.fn(async () => {
        throw actionFailure;
      });

      await expect(
        harness.composition.gateway.runPrimaryOwnerBootstrap(
          harness.trustSystemSource(),
          testRequest,
          privilegedAction,
        ),
      ).rejects.toBe(actionFailure);

      expect(harness.append).toHaveBeenCalledOnce();
      expect(harness.append).toHaveBeenCalledWith({
        action: 'primary-owner.bootstrap.failed',
        actorKind: 'system',
        correlationId: testCorrelationId,
        metadata: {
          operation: PRIMARY_OWNER_BOOTSTRAP,
          reasonCode: PRIMARY_OWNER_BOOTSTRAP_REASON,
        },
        occurredAt: '2026-08-15T18:00:00.000Z',
      });
      expect(JSON.stringify(harness.append.mock.calls)).not.toMatch(
        /capability|password|principal|token|totp|backupCode/iu,
      );
    });

    it('fails closed on success-audit append failure without attempting a second terminal event', async () => {
      const harness = createPrivateSystemHarness(async () => ({ id: 'bad' }));
      const privilegedAction = vi.fn(async () => ({
        result: 'must-not-return',
        targetSource: harness.trustTarget(),
      }));

      await expect(
        harness.composition.gateway.runPrimaryOwnerBootstrap(
          harness.trustSystemSource(),
          testRequest,
          privilegedAction,
        ),
      ).rejects.toMatchObject({ name: 'SecurityEventPersistenceError' });
      expect(privilegedAction).toHaveBeenCalledOnce();
      expect(harness.append).toHaveBeenCalledOnce();
      expect(harness.append.mock.calls[0]?.[0]).toMatchObject({
        action: 'primary-owner.bootstrap.succeeded',
        correlationId: testCorrelationId,
      });
    });

    it('fails closed when the mandatory failure audit cannot be established', async () => {
      const harness = createPrivateSystemHarness(async () => ({ id: 'bad' }));
      const privilegedAction = vi.fn(async () => {
        throw new Error('privileged failure');
      });

      await expect(
        harness.composition.gateway.runPrimaryOwnerBootstrap(
          harness.trustSystemSource(),
          testRequest,
          privilegedAction,
        ),
      ).rejects.toMatchObject({ name: 'SecurityEventPersistenceError' });
      expect(harness.append).toHaveBeenCalledOnce();
      expect(harness.append.mock.calls[0]?.[0]).toMatchObject({
        action: 'primary-owner.bootstrap.failed',
        correlationId: testCorrelationId,
      });
    });

    it('records failure for an untrusted success target and never reports success', async () => {
      const harness = createPrivateSystemHarness();

      await expect(
        harness.composition.gateway.runPrimaryOwnerBootstrap(
          harness.trustSystemSource(),
          testRequest,
          async () => ({
            result: 'must-not-return',
            targetSource: { opaqueTargetSource: 'lookalike' },
          }),
        ),
      ).rejects.toMatchObject({ code: 'system-target-required' });
      expect(harness.append).toHaveBeenCalledOnce();
      expect(harness.append.mock.calls[0]?.[0]).toMatchObject({
        action: 'primary-owner.bootstrap.failed',
      });
    });

    it('denies Owner and lookalike sources before action or authoritative audit', async () => {
      const harness = createPrivateSystemHarness();
      const privilegedAction = vi.fn(async () => ({
        result: undefined,
        targetSource: harness.trustTarget(),
      }));

      for (const source of [
        {
          authUserId: 'auth-owner',
          kind: 'staff',
          mfaAssurance: 'verified',
          role: 'owner',
          staffId: 11,
          status: 'active',
        },
        { opaqueSystemSource: 'lookalike' },
        { operation: PRIMARY_OWNER_BOOTSTRAP, trusted: true },
      ]) {
        await expect(
          harness.composition.gateway.runPrimaryOwnerBootstrap(
            source as TestSystemSource,
            testRequest,
            privilegedAction,
          ),
        ).rejects.toMatchObject({ code: 'system-capability-required' });
      }

      expect(privilegedAction).not.toHaveBeenCalled();
      expect(harness.append).not.toHaveBeenCalled();
    });

    it('denies invalid correlation, reason, and operation before action or audit', async () => {
      const harness = createPrivateSystemHarness();
      const source = harness.trustSystemSource();
      const privilegedAction = vi.fn(async () => ({
        result: undefined,
        targetSource: harness.trustTarget(),
      }));

      for (const unsafeRequest of [
        { ...testRequest, correlationId: 'not-a-uuid' },
        { ...testRequest, reasonCode: 'caller-selected-reason' },
        { ...testRequest, operation: 'run-anything' },
      ]) {
        await expect(
          harness.composition.gateway.runPrimaryOwnerBootstrap(
            source,
            unsafeRequest as PrimaryOwnerBootstrapRequest,
            privilegedAction,
          ),
        ).rejects.toBeInstanceOf(SystemPayloadGatewayAuthorizationError);
      }

      expect(privilegedAction).not.toHaveBeenCalled();
      expect(harness.append).not.toHaveBeenCalled();
    });

    it('requires the genuine capability and binds it to one request object', async () => {
      const harness = createPrivateSystemHarness();
      let validRequest: Record<string, unknown> | undefined;

      await harness.composition.gateway.runPrimaryOwnerBootstrap(
        harness.trustSystemSource(),
        testRequest,
        async (scope) => {
          validRequest = { context: { ...scope.context } };
          expect(
            harness.composition.authorizePrimaryOwnerBootstrap({
              context: validRequest.context,
              req: validRequest,
              systemOperation: PRIMARY_OWNER_BOOTSTRAP,
            } as never),
          ).toBe(true);
          expect(
            harness.composition.authorizePrimaryOwnerBootstrap({
              context: validRequest.context,
              req: { ...validRequest },
              systemOperation: PRIMARY_OWNER_BOOTSTRAP,
            } as never),
          ).toBe(false);
          expect(
            authorizePrimaryOwnerBootstrapRequest({
              context: { [systemCapabilityContextKey]: {} },
              req: { context: { [systemCapabilityContextKey]: {} } },
              systemOperation: PRIMARY_OWNER_BOOTSTRAP,
            } as never),
          ).toBe(false);
          return { result: undefined, targetSource: harness.trustTarget() };
        },
      );

      if (!validRequest) throw new Error('Missing valid request');
      expect(
        harness.composition.authorizePrimaryOwnerBootstrap({
          context: validRequest.context,
          req: validRequest,
          systemOperation: PRIMARY_OWNER_BOOTSTRAP,
        } as never),
      ).toBe(false);
    });
  });
}
