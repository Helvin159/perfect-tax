import 'server-only';

import { isSystemOperation } from '@/modules/authorization/domain/system-operation';
import {
  parsePortalPrincipal,
  type PortalPrincipal,
} from '@/modules/portal-identity/domain/principal';
import { isRecord } from '@/modules/portal-identity/domain/validation';

import type { SecurityEventAction } from '../domain/actions';
import {
  parseSecurityEventId,
  parseSecurityEventInput,
  SYSTEM_EVENT_REASON_CODES,
  toAppendRecord,
  type RecordedSecurityEvent,
  type SecurityEventAppendRecord,
  type SecurityEventMetadataByAction,
  type SecurityEventTarget,
  type SystemEventReasonCode,
} from '../domain/event';

export interface SecurityEventAppendPort {
  append(record: SecurityEventAppendRecord): Promise<Readonly<{ id: unknown }>>;
}

export const PRINCIPAL_SECURITY_EVENT_ACTIONS = Object.freeze([
  'authentication.succeeded',
  'authentication.failed',
  'session.ended',
  'mfa.enrollment.succeeded',
  'mfa.verification.succeeded',
  'mfa.verification.failed',
  'domain-subject.disabled',
  'authorization.denied',
] as const satisfies readonly SecurityEventAction[]);

export type PrincipalSecurityEventAction =
  (typeof PRINCIPAL_SECURITY_EVENT_ACTIONS)[number];

export const SYSTEM_SECURITY_EVENT_ACTIONS = Object.freeze([
  'primary-owner.bootstrap.succeeded',
  'primary-owner.bootstrap.failed',
] as const satisfies readonly SecurityEventAction[]);

export type SystemSecurityEventAction =
  (typeof SYSTEM_SECURITY_EVENT_ACTIONS)[number];

type PrincipalEventRequestFor<
  Action extends PrincipalSecurityEventAction,
  TargetSource extends object,
> = Readonly<{
  action: Action;
  correlationId?: string;
  metadata: SecurityEventMetadataByAction[Action];
  targetSource?: TargetSource;
}>;

export type PrincipalSecurityEventRequest<TargetSource extends object> = {
  [Action in PrincipalSecurityEventAction]: PrincipalEventRequestFor<
    Action,
    TargetSource
  >;
}[PrincipalSecurityEventAction];

export type SystemSecurityEventRequest = Readonly<{
  action: SystemSecurityEventAction;
}>;

/**
 * Implemented only by the trusted principal boundary. The source type should
 * be that boundary's opaque, runtime-attested type; structural parsing is not
 * an acceptable implementation.
 */
export interface TrustedPrincipalSourceResolver<
  PrincipalSource extends object,
> {
  resolvePrincipal(source: PrincipalSource): PortalPrincipal | undefined;
}

/** Implemented by the service that loaded the canonical target record. */
export interface TrustedTargetSourceResolver<TargetSource extends object> {
  resolveTarget(source: TargetSource): SecurityEventTarget | undefined;
}

export type TrustedSystemEventProvenance = Readonly<{
  correlationId: string;
  operation: 'primary-owner-bootstrap';
  reasonCode: SystemEventReasonCode;
  target?: SecurityEventTarget;
}>;

/**
 * Implemented by the private system-operation capability boundary. A plain
 * object or an operation string must not resolve successfully.
 */
export interface TrustedSystemSourceResolver<SystemSource extends object> {
  resolveSystemSource(
    source: SystemSource,
  ): TrustedSystemEventProvenance | undefined;
}

export interface PrincipalSecurityEventRecorder<
  PrincipalSource extends object,
  TargetSource extends object,
> {
  recordPrincipalSecurityEvent(
    principalSource: PrincipalSource,
    request: PrincipalSecurityEventRequest<TargetSource>,
  ): Promise<RecordedSecurityEvent>;
}

export interface SystemSecurityEventRecorder<SystemSource extends object> {
  recordSystemSecurityEvent(
    systemSource: SystemSource,
    request: SystemSecurityEventRequest,
  ): Promise<RecordedSecurityEvent>;
}

export type SecurityEventRecorders<
  PrincipalSource extends object,
  TargetSource extends object,
  SystemSource extends object,
> = PrincipalSecurityEventRecorder<PrincipalSource, TargetSource> &
  SystemSecurityEventRecorder<SystemSource>;

export type SecurityEventRecorderDependencies<
  PrincipalSource extends object,
  TargetSource extends object,
  SystemSource extends object,
> = Readonly<{
  appendPort: SecurityEventAppendPort;
  now?: () => Date;
  principalResolver: TrustedPrincipalSourceResolver<PrincipalSource>;
  systemResolver: TrustedSystemSourceResolver<SystemSource>;
  targetResolver: TrustedTargetSourceResolver<TargetSource>;
}>;

export const SECURITY_EVENT_PROVENANCE_ERROR_CODES = Object.freeze([
  'trusted-principal-required',
  'trusted-target-required',
  'trusted-system-source-required',
] as const);

export type SecurityEventProvenanceErrorCode =
  (typeof SECURITY_EVENT_PROVENANCE_ERROR_CODES)[number];

export class SecurityEventProvenanceError extends Error {
  readonly code: SecurityEventProvenanceErrorCode;

  constructor(code: SecurityEventProvenanceErrorCode) {
    super(`Security event provenance rejected: ${code}`);
    this.name = 'SecurityEventProvenanceError';
    this.code = code;
  }
}

export class SecurityEventPersistenceError extends Error {
  constructor() {
    super('Security event append failed');
    this.name = 'SecurityEventPersistenceError';
  }
}

const principalActionSet = new Set<string>(PRINCIPAL_SECURITY_EVENT_ACTIONS);
const systemActionSet = new Set<string>(SYSTEM_SECURITY_EVENT_ACTIONS);
const systemReasonCodeSet = new Set<string>(SYSTEM_EVENT_REASON_CODES);

function actorFromPrincipal(
  principal: PortalPrincipal,
  action: PrincipalSecurityEventAction,
) {
  if (
    action === 'authentication.succeeded' ||
    action === 'authentication.failed'
  ) {
    return Object.freeze({
      id: principal.authUserId,
      kind: 'auth-user' as const,
    });
  }

  switch (principal.kind) {
    case 'staff':
      return Object.freeze({ id: principal.staffId, kind: 'staff' as const });
    case 'client':
      return Object.freeze({ id: principal.clientId, kind: 'client' as const });
    case 'staff-enrollment':
      return Object.freeze({
        id: principal.staffId,
        kind: 'staff-enrollment' as const,
      });
  }
}

function assertPrincipalRequest(request: unknown): asserts request is Readonly<
  Record<string, unknown>
> & {
  action: PrincipalSecurityEventAction;
  metadata: unknown;
} {
  if (
    !isRecord(request) ||
    !Object.keys(request).every((key) =>
      ['action', 'correlationId', 'metadata', 'targetSource'].includes(key),
    ) ||
    !Object.hasOwn(request, 'action') ||
    !Object.hasOwn(request, 'metadata') ||
    typeof request.action !== 'string' ||
    !principalActionSet.has(request.action)
  ) {
    throw new SecurityEventProvenanceError('trusted-principal-required');
  }
}

function assertSystemRequest(request: unknown): asserts request is Readonly<
  Record<string, unknown>
> & {
  action: SystemSecurityEventAction;
} {
  if (
    !isRecord(request) ||
    !Object.keys(request).every((key) => key === 'action') ||
    !Object.hasOwn(request, 'action') ||
    typeof request.action !== 'string' ||
    !systemActionSet.has(request.action)
  ) {
    throw new SecurityEventProvenanceError('trusted-system-source-required');
  }
}

function isTrustedSystemProvenance(
  value: unknown,
): value is TrustedSystemEventProvenance {
  if (
    !isRecord(value) ||
    !Object.keys(value).every((key) =>
      ['correlationId', 'operation', 'reasonCode', 'target'].includes(key),
    ) ||
    typeof value.correlationId !== 'string' ||
    !isSystemOperation(value.operation) ||
    typeof value.reasonCode !== 'string' ||
    !systemReasonCodeSet.has(value.reasonCode)
  ) {
    return false;
  }

  return value.target === undefined || isRecord(value.target);
}

async function appendEvent(
  appendPort: SecurityEventAppendPort,
  input: ReturnType<typeof parseSecurityEventInput>,
  now: () => Date,
): Promise<RecordedSecurityEvent> {
  const occurredAt = now().toISOString();
  const result = await appendPort.append(toAppendRecord(input, occurredAt));
  const eventId = parseSecurityEventId(result.id);

  if (!eventId) throw new SecurityEventPersistenceError();

  return Object.freeze({
    ...input,
    eventId,
    occurredAt,
  }) as RecordedSecurityEvent;
}

/**
 * Creates source-bound recorder APIs. Requests contain action details only;
 * actor and target identities are derived from runtime-verified source objects.
 */
export function createSecurityEventRecorders<
  PrincipalSource extends object,
  TargetSource extends object,
  SystemSource extends object,
>({
  appendPort,
  now = () => new Date(),
  principalResolver,
  systemResolver,
  targetResolver,
}: SecurityEventRecorderDependencies<
  PrincipalSource,
  TargetSource,
  SystemSource
>): SecurityEventRecorders<PrincipalSource, TargetSource, SystemSource> {
  return Object.freeze({
    async recordPrincipalSecurityEvent(
      principalSource: PrincipalSource,
      unsafeRequest: PrincipalSecurityEventRequest<TargetSource>,
    ) {
      assertPrincipalRequest(unsafeRequest);
      const principal = parsePortalPrincipal(
        principalResolver.resolvePrincipal(principalSource),
      );
      if (!principal) {
        throw new SecurityEventProvenanceError('trusted-principal-required');
      }

      let target: SecurityEventTarget | undefined;
      if (Object.hasOwn(unsafeRequest, 'targetSource')) {
        if (!isRecord(unsafeRequest.targetSource)) {
          throw new SecurityEventProvenanceError('trusted-target-required');
        }
        target = targetResolver.resolveTarget(
          unsafeRequest.targetSource as TargetSource,
        );
        if (!target) {
          throw new SecurityEventProvenanceError('trusted-target-required');
        }
      }

      const input = parseSecurityEventInput({
        action: unsafeRequest.action,
        actor: actorFromPrincipal(principal, unsafeRequest.action),
        ...(unsafeRequest.correlationId === undefined
          ? {}
          : { correlationId: unsafeRequest.correlationId }),
        metadata: unsafeRequest.metadata,
        ...(target === undefined ? {} : { target }),
      });

      return appendEvent(appendPort, input, now);
    },

    async recordSystemSecurityEvent(
      systemSource: SystemSource,
      unsafeRequest: SystemSecurityEventRequest,
    ) {
      assertSystemRequest(unsafeRequest);
      const provenance = systemResolver.resolveSystemSource(systemSource);
      if (!isTrustedSystemProvenance(provenance)) {
        throw new SecurityEventProvenanceError(
          'trusted-system-source-required',
        );
      }

      const input = parseSecurityEventInput({
        action: unsafeRequest.action,
        actor: { kind: 'system' },
        correlationId: provenance.correlationId,
        metadata: {
          operation: provenance.operation,
          reasonCode: provenance.reasonCode,
        },
        ...(provenance.target === undefined
          ? {}
          : { target: provenance.target }),
      });

      return appendEvent(appendPort, input, now);
    },
  });
}
