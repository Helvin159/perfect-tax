/// <reference types="vitest/importMeta" />

import 'server-only';

import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Payload, PayloadRequest, RequestContext } from 'payload';

import {
  createSecurityEventRecorders,
  type SecurityEventAppendPort,
  type SystemSecurityEventRecorder,
  type TrustedSystemEventProvenance,
  type TrustedSystemSourceResolver,
} from '@/modules/audit/application/recorder';
import type { SystemEventReasonCode } from '@/modules/audit/domain/event';
import { createPayloadSecurityEventRecorders } from '@/modules/audit/infrastructure/security-events-collection';
import type { BootstrapCredential } from '@/modules/auth/bootstrap';
import type { SystemOperation } from '@/modules/authorization/domain/system-operation';
import {
  parseAuthUserId,
  parseStaffId,
  type StaffId,
} from '@/modules/portal-identity/domain/identifiers';
import { isRecord } from '@/modules/portal-identity/domain/validation';
import type {
  AuthorizePrimaryOwnerBootstrap,
  PrimaryOwnerBootstrapAuthorizationArgs,
} from '@/modules/staff/domain/invariants';
import {
  createPrimaryOwnerBootstrapPayloadRequest,
  loadPrimaryOwnerBootstrapPayload,
  preparePrimaryOwnerPersistence,
  primaryOwnerAlreadyExists,
  provisionPrimaryOwnerBootstrapCredential,
  withPrimaryOwnerBootstrapSerialization,
  type PendingPrimaryOwnerPersistence,
} from '@/modules/staff/application/primary-owner-bootstrap-runtime';
import {
  PrimaryOwnerBootstrapError,
  type PrimaryOwnerBootstrapInput,
} from '@/modules/staff/application/primary-owner-bootstrap';
import { runPrimaryOwnerBootstrapCommand } from '@/modules/staff/application/primary-owner-bootstrap-command';

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

type PrimaryOwnerTargetBinding = Readonly<{
  commit(): Promise<void>;
  rollback(): Promise<void>;
  staffId: StaffId;
}>;

type TrustedPrimaryOwnerTargetResolver<TargetSource extends object> = Readonly<{
  resolveCreatedPrimaryOwnerTarget(
    source: TargetSource,
  ):
    | PrimaryOwnerTargetBinding
    | undefined
    | Promise<PrimaryOwnerTargetBinding | undefined>;
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
): Promise<PrimaryOwnerTargetBinding> {
  if (typeof targetSource !== 'object' || targetSource === null) {
    throw new SystemPayloadGatewayAuthorizationError('system-target-required');
  }

  try {
    const target = await resolver.resolveCreatedPrimaryOwnerTarget(
      targetSource as TargetSource,
    );
    const staffId = parseStaffId(target?.staffId);
    if (
      staffId &&
      typeof target?.commit === 'function' &&
      typeof target.rollback === 'function'
    ) {
      return Object.freeze({
        commit: target.commit,
        rollback: target.rollback,
        staffId,
      });
    }
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
  createFailureAuditRecorder(
    resolver: TrustedSystemSourceResolver<PrimaryOwnerBootstrapAuditSource>,
  ): SystemSecurityEventRecorder<PrimaryOwnerBootstrapAuditSource>;
  createSuccessAuditRecorder(
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
  const failureAuditRecorder =
    dependencies.createFailureAuditRecorder(auditSourceResolver);
  const successAuditRecorder =
    dependencies.createSuccessAuditRecorder(auditSourceResolver);

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
          let target: PrimaryOwnerTargetBinding | undefined;

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

            target = await resolvePrimaryOwnerTarget(
              dependencies.targetResolver,
              outcome.targetSource,
            );
            successAuditSource = createAuditSource({
              correlationId: binding.correlationId,
              operation: binding.operation,
              reasonCode: binding.reasonCode,
              target: { id: target.staffId, type: 'staff' },
            });
            invocationAuditSources.add(successAuditSource);
          } catch (operationFailure) {
            if (target) await target.rollback();
            await failureAuditRecorder.recordSystemSecurityEvent(
              failureAuditSource,
              {
                action: 'primary-owner.bootstrap.failed',
              },
            );
            throw operationFailure;
          }

          try {
            // The success append uses the same Payload request/transaction as
            // Staff and PortalIdentity. A successful return is impossible
            // until both the append and transaction commit succeed.
            await successAuditRecorder.recordSystemSecurityEvent(
              successAuditSource,
              { action: 'primary-owner.bootstrap.succeeded' },
            );
            await target.commit();
            return outcome.result;
          } catch (terminalFailure) {
            await target.rollback();
            // Do not attempt a second terminal event after an audit/commit
            // failure; the uncommitted success event is rolled back with the
            // privileged application writes.
            throw terminalFailure;
          }
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

type ConcreteBootstrapSystemSource = Readonly<{
  readonly bootstrapInvocation: 'private';
}>;

type ConcreteBootstrapTargetSource = Readonly<{
  readonly createdPrimaryOwner: 'private';
}>;

const concreteBootstrapSystemSources = new WeakSet<object>();
const concreteBootstrapTargets = new WeakMap<
  object,
  PrimaryOwnerTargetBinding
>();

function trustConcreteBootstrapSystemSource(): ConcreteBootstrapSystemSource {
  const source = Object.freeze({
    bootstrapInvocation: 'private' as const,
  });
  concreteBootstrapSystemSources.add(source);
  return source;
}

function trustConcreteBootstrapTarget(
  pending: PendingPrimaryOwnerPersistence,
): ConcreteBootstrapTargetSource {
  const source = Object.freeze({ createdPrimaryOwner: 'private' as const });
  concreteBootstrapTargets.set(
    source,
    Object.freeze({
      commit: pending.commit,
      rollback: pending.rollback,
      staffId: pending.staffId,
    }),
  );
  return source;
}

function createConcreteBootstrapComposition(
  payload: Payload,
  auditRequest: PayloadRequest,
) {
  return composePrimaryOwnerBootstrapSystemGateway<
    ConcreteBootstrapSystemSource,
    ConcreteBootstrapTargetSource
  >({
    createFailureAuditRecorder: (systemResolver) =>
      createPayloadSecurityEventRecorders(payload, {
        principalResolver: { resolvePrincipal: () => undefined },
        systemResolver,
        targetResolver: { resolveTarget: () => undefined },
      }),
    createSuccessAuditRecorder: (systemResolver) =>
      createPayloadSecurityEventRecorders(
        payload,
        {
          principalResolver: { resolvePrincipal: () => undefined },
          systemResolver,
          targetResolver: { resolveTarget: () => undefined },
        },
        undefined,
        auditRequest,
      ),
    sourceResolver: {
      resolveSystemOperation: (source) =>
        concreteBootstrapSystemSources.has(source)
          ? PRIMARY_OWNER_BOOTSTRAP
          : undefined,
    },
    targetResolver: {
      resolveCreatedPrimaryOwnerTarget: (source) =>
        concreteBootstrapTargets.get(source),
    },
  });
}

async function throwThroughMandatoryFailureAudit(
  composition: PrimaryOwnerBootstrapSystemComposition<
    ConcreteBootstrapSystemSource,
    ConcreteBootstrapTargetSource
  >,
  source: ConcreteBootstrapSystemSource,
  request: PrimaryOwnerBootstrapRequest,
  failure: unknown,
): Promise<never> {
  return composition.gateway.runPrimaryOwnerBootstrap(
    source,
    request,
    async () => {
      throw failure;
    },
  );
}

function safeBootstrapFailure(error: unknown): PrimaryOwnerBootstrapError {
  return error instanceof PrimaryOwnerBootstrapError
    ? error
    : new PrimaryOwnerBootstrapError('BOOTSTRAP_FAILED');
}

type ConcreteBootstrapPayload = Awaited<
  ReturnType<typeof loadPrimaryOwnerBootstrapPayload>
>;

type ConcreteBootstrapDependencies = Readonly<{
  createAuditRequest(
    payload: ConcreteBootstrapPayload,
  ): Promise<PayloadRequest>;
  loadPayload(): Promise<ConcreteBootstrapPayload>;
  ownerExists(payload: ConcreteBootstrapPayload): Promise<boolean>;
  prepare(
    payload: ConcreteBootstrapPayload,
    auditRequest: PayloadRequest,
    context: RequestContext,
    input: PrimaryOwnerBootstrapInput,
    credential: BootstrapCredential,
  ): Promise<PendingPrimaryOwnerPersistence>;
  provision<T>(
    input: PrimaryOwnerBootstrapInput,
    finalize: (credential: BootstrapCredential) => Promise<T>,
  ): Promise<T>;
  serialize<T>(
    payload: ConcreteBootstrapPayload,
    operation: () => Promise<T>,
  ): Promise<T>;
}>;

const concreteBootstrapDependencies: ConcreteBootstrapDependencies =
  Object.freeze({
    createAuditRequest: createPrimaryOwnerBootstrapPayloadRequest,
    loadPayload: loadPrimaryOwnerBootstrapPayload,
    ownerExists: primaryOwnerAlreadyExists,
    prepare: preparePrimaryOwnerPersistence,
    provision: provisionPrimaryOwnerBootstrapCredential,
    serialize: withPrimaryOwnerBootstrapSerialization,
  });

/**
 * Private testable orchestration. Dependency substitution remains lexical to
 * this module; production callers cannot inject a resolver, issuer, recorder,
 * lock, Payload instance, or credential mechanism.
 */
async function runPrimaryOwnerBootstrapWithDependencies(
  input: PrimaryOwnerBootstrapInput,
  dependencies: ConcreteBootstrapDependencies,
): Promise<void> {
  let payload: ConcreteBootstrapPayload;
  try {
    payload = await dependencies.loadPayload();
  } catch (error) {
    throw safeBootstrapFailure(error);
  }

  let auditRequest: PayloadRequest;
  try {
    auditRequest = await dependencies.createAuditRequest(payload);
  } catch (error) {
    try {
      await payload.destroy();
    } catch {
      // The operation never issued authority or changed state.
    }
    throw safeBootstrapFailure(error);
  }

  const composition = createConcreteBootstrapComposition(payload, auditRequest);
  const source = trustConcreteBootstrapSystemSource();
  const request: PrimaryOwnerBootstrapRequest = Object.freeze({
    correlationId: randomUUID(),
    operation: PRIMARY_OWNER_BOOTSTRAP,
    reasonCode: PRIMARY_OWNER_BOOTSTRAP_REASON,
  });
  let mandatoryEnvelopeOwnsTerminalAudit = false;
  let bootstrapCommitted = false;
  let targetSource: ConcreteBootstrapTargetSource | undefined;

  try {
    await dependencies.serialize(payload, async () => {
      let alreadyCompleted = false;
      try {
        alreadyCompleted = await dependencies.ownerExists(payload);
      } catch (error) {
        mandatoryEnvelopeOwnsTerminalAudit = true;
        await throwThroughMandatoryFailureAudit(
          composition,
          source,
          request,
          error,
        );
      }

      if (alreadyCompleted) {
        mandatoryEnvelopeOwnsTerminalAudit = true;
        await throwThroughMandatoryFailureAudit(
          composition,
          source,
          request,
          new PrimaryOwnerBootstrapError('ALREADY_COMPLETED'),
        );
      }

      try {
        await dependencies.provision(input, async (credential) => {
          mandatoryEnvelopeOwnsTerminalAudit = true;
          return composition.gateway.runPrimaryOwnerBootstrap(
            source,
            request,
            async (scope) => {
              const pending = await dependencies.prepare(
                payload,
                auditRequest,
                scope.context,
                input,
                credential,
              );
              targetSource = trustConcreteBootstrapTarget(pending);
              return Object.freeze({ result: undefined, targetSource });
            },
          );
        });
        bootstrapCommitted = true;
      } catch (error) {
        if (!mandatoryEnvelopeOwnsTerminalAudit) {
          mandatoryEnvelopeOwnsTerminalAudit = true;
          await throwThroughMandatoryFailureAudit(
            composition,
            source,
            request,
            error,
          );
        }
        throw error;
      }
    });
  } catch (error) {
    if (bootstrapCommitted) return;
    if (!mandatoryEnvelopeOwnsTerminalAudit) {
      mandatoryEnvelopeOwnsTerminalAudit = true;
      try {
        await throwThroughMandatoryFailureAudit(
          composition,
          source,
          request,
          error,
        );
      } catch (auditedFailure) {
        throw safeBootstrapFailure(auditedFailure);
      }
    }
    throw safeBootstrapFailure(error);
  } finally {
    concreteBootstrapSystemSources.delete(source);
    if (targetSource) concreteBootstrapTargets.delete(targetSource);
    try {
      await payload.destroy();
    } catch {
      // Terminal state is already audited and settled. Cleanup failure must
      // not turn a committed bootstrap into an ambiguous retry instruction.
    }
  }
}

/**
 * The sole concrete operation. It is intentionally not exported; only direct
 * execution of this module can pass it to the non-web command adapter.
 */
async function runConcretePrimaryOwnerBootstrap(
  input: PrimaryOwnerBootstrapInput,
): Promise<void> {
  return runPrimaryOwnerBootstrapWithDependencies(
    input,
    concreteBootstrapDependencies,
  );
}

function isDirectCommandExecution(): boolean {
  const entrypoint = process.argv[1];
  return (
    typeof entrypoint === 'string' &&
    resolve(entrypoint) === fileURLToPath(import.meta.url)
  );
}

if (isDirectCommandExecution()) {
  void runPrimaryOwnerBootstrapCommand({
    environment: process.env,
    execute: runConcretePrimaryOwnerBootstrap,
    stderr: process.stderr,
    stdout: process.stdout,
  }).then((exitCode) => {
    process.exit(exitCode);
  });
}

/**
 * Verifies only the private request capability. It cannot mint one and normal
 * callers can obtain only `false` because issuance is lexical to the direct
 * non-web command above.
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
    const targetSources = new WeakMap<object, PrimaryOwnerTargetBinding>();
    const append = vi.fn(appendImplementation);
    const commit = vi.fn(async () => undefined);
    const rollback = vi.fn(async () => undefined);
    const composition = composePrimaryOwnerBootstrapSystemGateway<
      TestSystemSource,
      TestTargetSource
    >({
      createFailureAuditRecorder: (systemResolver) =>
        createSecurityEventRecorders({
          appendPort: { append },
          now: () => new Date('2026-08-15T18:00:00.000Z'),
          principalResolver: { resolvePrincipal: () => undefined },
          systemResolver,
          targetResolver: { resolveTarget: () => undefined },
        }),
      createSuccessAuditRecorder: (systemResolver) =>
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
        resolveCreatedPrimaryOwnerTarget: (source) => targetSources.get(source),
      },
    });

    return {
      append,
      commit,
      composition,
      rollback,
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
        targetSources.set(source, { commit, rollback, staffId });
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
      expect(harness.commit).toHaveBeenCalledOnce();
      expect(harness.rollback).not.toHaveBeenCalled();
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
      expect(harness.commit).not.toHaveBeenCalled();
      expect(harness.rollback).toHaveBeenCalledOnce();
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

    it('denies Owner, Administrator, and lookalike sources before action or authoritative audit', async () => {
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
        {
          authUserId: 'auth-administrator',
          kind: 'staff',
          mfaAssurance: 'verified',
          role: 'administrator',
          staffId: 12,
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

  const concreteTestInput: PrimaryOwnerBootstrapInput = Object.freeze({
    firstName: 'Grace',
    lastName: 'Hopper',
    loginEmail: 'login.owner@example.com',
    password: 'test-only-primary-owner-password',
    workEmail: 'work.owner@example.com',
  });

  function createConcreteOperationHarness(
    options: Readonly<{
      auditFailure?: boolean;
      ownerExists?: boolean;
      prepareFailure?: 'portal-identity' | 'staff';
      provisionFailure?: boolean;
      serializationFailure?: boolean;
    }> = {},
  ) {
    const auditAttempts: unknown[] = [];
    const auditCreateRequests: Array<Record<string, unknown>> = [];
    const persistedEvents: unknown[] = [];
    const create = vi.fn(async (request: Record<string, unknown>) => {
      auditCreateRequests.push(request);
      auditAttempts.push(request.data);
      if (options.auditFailure) return { id: 'invalid-event-id' };
      persistedEvents.push(request.data);
      return { id: persistedEvents.length };
    });
    const payload = { create } as unknown as ConcreteBootstrapPayload;
    const commit = vi.fn(async () => undefined);
    const rollback = vi.fn(async () => undefined);
    const prepare = vi.fn(async (): Promise<PendingPrimaryOwnerPersistence> => {
      if (options.prepareFailure) {
        throw new Error(
          `${options.prepareFailure} rejected ${concreteTestInput.password}`,
        );
      }
      const staffId = parseStaffId(91);
      if (!staffId) throw new Error('Invalid test Staff ID');
      return {
        auditRequest: {} as PayloadRequest,
        commit,
        rollback,
        staffId,
      };
    });
    let credentialCreated = 0;
    let credentialCompensated = 0;
    const provision: ConcreteBootstrapDependencies['provision'] = async (
      input,
      finalize,
    ) => {
      if (options.provisionFailure) {
        throw new Error(`credential rejected ${input.password}`);
      }
      credentialCreated += 1;
      const authUserId = parseAuthUserId('auth-primary-owner');
      if (!authUserId) throw new Error('Invalid test AuthUserId');
      try {
        return await finalize(Object.freeze({ authUserId }));
      } catch (error) {
        credentialCompensated += 1;
        throw error;
      }
    };
    const dependencies: ConcreteBootstrapDependencies = Object.freeze({
      createAuditRequest: async () => ({}) as PayloadRequest,
      loadPayload: async () => payload,
      ownerExists: async () => options.ownerExists ?? false,
      prepare,
      provision,
      serialize: async (_payload, operation) => {
        if (options.serializationFailure) {
          throw new Error('database lock unavailable');
        }
        return operation();
      },
    });

    return {
      auditAttempts,
      auditCreateRequests,
      commit,
      dependencies,
      get credentialCompensated() {
        return credentialCompensated;
      },
      get credentialCreated() {
        return credentialCreated;
      },
      persistedEvents,
      prepare,
      rollback,
    };
  }

  describe('concrete primary-owner bootstrap orchestration', () => {
    it('creates one credential and commits only after one success audit', async () => {
      const harness = createConcreteOperationHarness();

      await expect(
        runPrimaryOwnerBootstrapWithDependencies(
          concreteTestInput,
          harness.dependencies,
        ),
      ).resolves.toBeUndefined();

      expect(harness.credentialCreated).toBe(1);
      expect(harness.credentialCompensated).toBe(0);
      expect(harness.prepare).toHaveBeenCalledOnce();
      expect(harness.commit).toHaveBeenCalledOnce();
      expect(harness.rollback).not.toHaveBeenCalled();
      expect(harness.persistedEvents).toHaveLength(1);
      expect(harness.auditCreateRequests[0]).toHaveProperty('req');
      expect(harness.persistedEvents[0]).toMatchObject({
        action: 'primary-owner.bootstrap.succeeded',
        actorKind: 'system',
        metadata: {
          operation: PRIMARY_OWNER_BOOTSTRAP,
          reasonCode: PRIMARY_OWNER_BOOTSTRAP_REASON,
        },
        targetId: '91',
        targetType: 'staff',
      });
    });

    it('denies a completed bootstrap before credential creation and records one failure', async () => {
      const harness = createConcreteOperationHarness({ ownerExists: true });

      await expect(
        runPrimaryOwnerBootstrapWithDependencies(
          concreteTestInput,
          harness.dependencies,
        ),
      ).rejects.toMatchObject({ code: 'ALREADY_COMPLETED' });

      expect(harness.credentialCreated).toBe(0);
      expect(harness.prepare).not.toHaveBeenCalled();
      expect(harness.persistedEvents).toHaveLength(1);
      expect(harness.auditCreateRequests[0]).not.toHaveProperty('req');
      expect(harness.persistedEvents[0]).toMatchObject({
        action: 'primary-owner.bootstrap.failed',
        actorKind: 'system',
      });
    });

    it('records credential-creation failure without creating application state', async () => {
      const harness = createConcreteOperationHarness({
        provisionFailure: true,
      });

      await expect(
        runPrimaryOwnerBootstrapWithDependencies(
          concreteTestInput,
          harness.dependencies,
        ),
      ).rejects.toMatchObject({ code: 'BOOTSTRAP_FAILED' });

      expect(harness.credentialCreated).toBe(0);
      expect(harness.prepare).not.toHaveBeenCalled();
      expect(harness.persistedEvents).toHaveLength(1);
      expect(harness.persistedEvents[0]).toMatchObject({
        action: 'primary-owner.bootstrap.failed',
      });
      expect(JSON.stringify(harness.auditAttempts)).not.toContain(
        concreteTestInput.password,
      );
    });

    it('records one failure when database serialization cannot start', async () => {
      const harness = createConcreteOperationHarness({
        serializationFailure: true,
      });

      await expect(
        runPrimaryOwnerBootstrapWithDependencies(
          concreteTestInput,
          harness.dependencies,
        ),
      ).rejects.toMatchObject({ code: 'BOOTSTRAP_FAILED' });

      expect(harness.credentialCreated).toBe(0);
      expect(harness.prepare).not.toHaveBeenCalled();
      expect(harness.persistedEvents).toHaveLength(1);
      expect(harness.persistedEvents[0]).toMatchObject({
        action: 'primary-owner.bootstrap.failed',
      });
    });

    it.each(['staff', 'portal-identity'] as const)(
      'compensates the credential and records failure when %s persistence fails',
      async (prepareFailure) => {
        const harness = createConcreteOperationHarness({ prepareFailure });

        await expect(
          runPrimaryOwnerBootstrapWithDependencies(
            concreteTestInput,
            harness.dependencies,
          ),
        ).rejects.toMatchObject({ code: 'BOOTSTRAP_FAILED' });

        expect(harness.credentialCreated).toBe(1);
        expect(harness.credentialCompensated).toBe(1);
        expect(harness.commit).not.toHaveBeenCalled();
        expect(harness.persistedEvents).toHaveLength(1);
        expect(harness.persistedEvents[0]).toMatchObject({
          action: 'primary-owner.bootstrap.failed',
        });
        expect(JSON.stringify(harness.auditAttempts)).not.toContain(
          concreteTestInput.password,
        );
      },
    );

    it('rolls back and compensates when the mandatory success audit fails', async () => {
      const harness = createConcreteOperationHarness({ auditFailure: true });

      await expect(
        runPrimaryOwnerBootstrapWithDependencies(
          concreteTestInput,
          harness.dependencies,
        ),
      ).rejects.toMatchObject({ code: 'BOOTSTRAP_FAILED' });

      expect(harness.commit).not.toHaveBeenCalled();
      expect(harness.rollback).toHaveBeenCalledOnce();
      expect(harness.credentialCompensated).toBe(1);
      expect(harness.auditAttempts).toHaveLength(1);
      expect(harness.persistedEvents).toHaveLength(0);
      expect(JSON.stringify(harness.auditAttempts)).not.toContain(
        concreteTestInput.password,
      );
    });
  });
}
