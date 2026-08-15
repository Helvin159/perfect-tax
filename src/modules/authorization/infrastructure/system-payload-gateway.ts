import 'server-only';

import type { RequestContext } from 'payload';

import type {
  TrustedSystemEventProvenance,
  TrustedSystemSourceResolver,
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

/** Agent 12 owns the private, non-web source recognized by this resolver. */
export interface TrustedPrimaryOwnerBootstrapSourceResolver<
  Source extends object,
> {
  resolveSystemOperation(
    source: Source,
  ):
    | Extract<SystemOperation, 'primary-owner-bootstrap'>
    | undefined
    | Promise<Extract<SystemOperation, 'primary-owner-bootstrap'> | undefined>;
}

/** Agent 12 resolves this only from the canonical Staff create result. */
export interface TrustedPrimaryOwnerTargetResolver<
  TargetSource extends object,
> {
  resolveCreatedPrimaryOwnerStaffId(
    source: TargetSource,
  ): StaffId | undefined | Promise<StaffId | undefined>;
}

declare const primaryOwnerAuditSourceBrand: unique symbol;

export type PrimaryOwnerBootstrapAuditSource = Readonly<{
  readonly [primaryOwnerAuditSourceBrand]: true;
}>;

export type PrimaryOwnerBootstrapRequest = Readonly<{
  correlationId: string;
  operation: Extract<SystemOperation, 'primary-owner-bootstrap'>;
  reasonCode: Extract<
    SystemEventReasonCode,
    'initial-primary-owner-provisioning'
  >;
}>;

export interface PrimaryOwnerBootstrapScope<TargetSource extends object> {
  readonly context: RequestContext;
  readonly correlationId: string;
  readonly failureAuditSource: PrimaryOwnerBootstrapAuditSource;
  readonly operation: Extract<SystemOperation, 'primary-owner-bootstrap'>;
  readonly reasonCode: Extract<
    SystemEventReasonCode,
    'initial-primary-owner-provisioning'
  >;
  createSuccessAuditSource(
    targetSource: TargetSource,
  ): Promise<PrimaryOwnerBootstrapAuditSource>;
}

export interface SystemPayloadGateway<
  SystemSource extends object,
  TargetSource extends object,
> {
  runPrimaryOwnerBootstrapScope<Result>(
    systemSource: SystemSource,
    request: PrimaryOwnerBootstrapRequest,
    operation: (
      scope: PrimaryOwnerBootstrapScope<TargetSource>,
    ) => Promise<Result>,
  ): Promise<Result>;
}

export type PrimaryOwnerBootstrapSystemComposition<
  SystemSource extends object,
  TargetSource extends object,
> = Readonly<{
  auditSourceResolver: TrustedSystemSourceResolver<PrimaryOwnerBootstrapAuditSource>;
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

/**
 * Narrow Agent 12 composition seam. It creates no Staff, credentials,
 * PortalIdentity, lock, CLI, or transaction. The callback receives only a
 * one-operation context and runtime-recognized audit sources.
 */
export function composePrimaryOwnerBootstrapSystemGateway<
  SystemSource extends object,
  TargetSource extends object,
>(dependencies: {
  sourceResolver: TrustedPrimaryOwnerBootstrapSourceResolver<SystemSource>;
  targetResolver: TrustedPrimaryOwnerTargetResolver<TargetSource>;
}): PrimaryOwnerBootstrapSystemComposition<SystemSource, TargetSource> {
  const auditSourceResolver: TrustedSystemSourceResolver<PrimaryOwnerBootstrapAuditSource> =
    Object.freeze({
      resolveSystemSource: (source: PrimaryOwnerBootstrapAuditSource) =>
        systemAuditSources.get(source),
    });

  const authorizePrimaryOwnerBootstrap: AuthorizePrimaryOwnerBootstrap =
    authorizeSystemRequest;

  const gateway: SystemPayloadGateway<SystemSource, TargetSource> =
    Object.freeze({
      async runPrimaryOwnerBootstrapScope(
        unsafeSource: SystemSource,
        unsafeRequest: PrimaryOwnerBootstrapRequest,
        operation: (
          scope: PrimaryOwnerBootstrapScope<TargetSource>,
        ) => Promise<unknown>,
      ) {
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
          operation: request.operation,
          reasonCode: request.reasonCode,
        });
        invocationAuditSources.add(failureAuditSource);

        const scope: PrimaryOwnerBootstrapScope<TargetSource> = Object.freeze({
          context: Object.freeze({ [systemCapabilityContextKey]: capability }),
          correlationId: request.correlationId,
          failureAuditSource,
          operation: request.operation,
          reasonCode: request.reasonCode,
          async createSuccessAuditSource(targetSource: TargetSource) {
            let staffId: StaffId | undefined;
            try {
              staffId = parseStaffId(
                await dependencies.targetResolver.resolveCreatedPrimaryOwnerStaffId(
                  targetSource,
                ),
              );
            } catch {
              staffId = undefined;
            }
            if (!staffId) {
              throw new SystemPayloadGatewayAuthorizationError(
                'system-target-required',
              );
            }

            const source = createAuditSource({
              operation: request.operation,
              reasonCode: request.reasonCode,
              target: { id: staffId, type: 'staff' },
            });
            invocationAuditSources.add(source);
            return source;
          },
        });

        try {
          return await operation(scope);
        } finally {
          systemCapabilities.delete(capability);
          for (const source of invocationAuditSources) {
            systemAuditSources.delete(source);
          }
        }
      },
    }) as SystemPayloadGateway<SystemSource, TargetSource>;

  return Object.freeze({
    auditSourceResolver,
    authorizePrimaryOwnerBootstrap,
    gateway,
  });
}

/**
 * Testable hook-shaped adapter; no caller-controlled context value is trusted.
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
