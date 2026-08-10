import {
  isAuthorizationDenialCode,
  type AuthorizationDenialCode,
} from '@/modules/authorization/domain/decision';
import {
  isSystemOperation,
  type SystemOperation,
} from '@/modules/authorization/domain/system-operation';
import {
  parseAuthUserId,
  parseClientId,
  parseStaffId,
  type AuthUserId,
  type ClientId,
  type StaffId,
} from '@/modules/portal-identity/domain/identifiers';
import {
  hasExactKeys,
  isRecord,
} from '@/modules/portal-identity/domain/validation';

import { isSecurityEventAction, type SecurityEventAction } from './actions';

declare const securityEventIdBrand: unique symbol;

export type SecurityEventId = number & {
  readonly [securityEventIdBrand]: 'SecurityEventId';
};

export const SECURITY_EVENT_ACTOR_KINDS = Object.freeze([
  'anonymous',
  'system',
  'auth-user',
  'staff',
  'client',
  'staff-enrollment',
] as const);

export type SecurityEventActorKind =
  (typeof SECURITY_EVENT_ACTOR_KINDS)[number];

export type SecurityEventActor =
  | Readonly<{ kind: 'anonymous' }>
  | Readonly<{ kind: 'system' }>
  | Readonly<{ id: AuthUserId; kind: 'auth-user' }>
  | Readonly<{ id: StaffId; kind: 'staff' }>
  | Readonly<{ id: ClientId; kind: 'client' }>
  | Readonly<{ id: StaffId; kind: 'staff-enrollment' }>;

export const SECURITY_EVENT_TARGET_TYPES = Object.freeze([
  'auth-user',
  'staff',
  'client',
] as const);

export type SecurityEventTargetType =
  (typeof SECURITY_EVENT_TARGET_TYPES)[number];

export type SecurityEventTarget =
  | Readonly<{ id: AuthUserId; type: 'auth-user' }>
  | Readonly<{ id: StaffId; type: 'staff' }>
  | Readonly<{ id: ClientId; type: 'client' }>;

export const SESSION_END_REASON_CODES = Object.freeze([
  'logout',
  'revoked',
  'subject-disabled',
] as const);

export type SessionEndReasonCode = (typeof SESSION_END_REASON_CODES)[number];

type EmptyMetadata = Readonly<Record<string, never>>;

type SecurityEventMetadataByAction = Readonly<{
  'primary-owner.bootstrap.succeeded': Readonly<{
    operation: SystemOperation;
  }>;
  'primary-owner.bootstrap.failed': Readonly<{
    operation: SystemOperation;
  }>;
  'authentication.succeeded': EmptyMetadata;
  'authentication.failed': EmptyMetadata;
  'session.ended': Readonly<{ reasonCode: SessionEndReasonCode }>;
  'mfa.enrollment.succeeded': EmptyMetadata;
  'mfa.verification.succeeded': EmptyMetadata;
  'mfa.verification.failed': EmptyMetadata;
  'domain-subject.disabled': Readonly<{ sessionsRevoked: boolean }>;
  'authorization.denied': Readonly<{
    reasonCode: AuthorizationDenialCode;
  }>;
}>;

type SecurityEventInputFor<Action extends SecurityEventAction> = Readonly<{
  action: Action;
  actor: SecurityEventActor;
  correlationId?: string;
  metadata: SecurityEventMetadataByAction[Action];
  target?: SecurityEventTarget;
}>;

export type SecurityEventInput = {
  [Action in SecurityEventAction]: SecurityEventInputFor<Action>;
}[SecurityEventAction];

export type SecurityEventAppendRecord = Readonly<{
  action: SecurityEventAction;
  actorId?: string;
  actorKind: SecurityEventActorKind;
  correlationId?: string;
  metadata: Readonly<Record<string, boolean | string>>;
  occurredAt: string;
  targetId?: string;
  targetType?: SecurityEventTargetType;
}>;

export type RecordedSecurityEvent = SecurityEventInput &
  Readonly<{
    eventId: SecurityEventId;
    occurredAt: string;
  }>;

export const SECURITY_EVENT_VALIDATION_ERROR_CODES = [
  'invalid-event',
  'invalid-action',
  'invalid-actor',
  'invalid-target',
  'invalid-correlation-id',
  'invalid-metadata',
  'prohibited-field',
] as const;

export type SecurityEventValidationErrorCode =
  (typeof SECURITY_EVENT_VALIDATION_ERROR_CODES)[number];

export class SecurityEventValidationError extends Error {
  readonly code: SecurityEventValidationErrorCode;

  constructor(code: SecurityEventValidationErrorCode) {
    super(`Security event rejected: ${code}`);
    this.name = 'SecurityEventValidationError';
    this.code = code;
  }
}

const prohibitedKeyFragments = [
  'password',
  'token',
  'secret',
  'backupcode',
  'emailbody',
  'documentcontent',
  'requestbody',
  'credential',
  'authorizationheader',
  'cookie',
] as const;

const correlationIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const sessionEndReasonCodeSet = new Set<string>(SESSION_END_REASON_CODES);

function normalizeKey(key: string): string {
  return key.toLowerCase().replaceAll(/[^a-z0-9]/g, '');
}

function containsProhibitedField(
  value: unknown,
  visited = new WeakSet<object>(),
): boolean {
  if (typeof value !== 'object' || value === null) return false;
  if (visited.has(value)) return true;
  visited.add(value);

  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = normalizeKey(key);
    if (
      prohibitedKeyFragments.some((fragment) =>
        normalizedKey.includes(fragment),
      ) ||
      containsProhibitedField(child, visited)
    ) {
      return true;
    }
  }

  return false;
}

function hasAllowedInputKeys(value: Record<string, unknown>): boolean {
  const allowedKeys = new Set([
    'action',
    'actor',
    'correlationId',
    'metadata',
    'target',
  ]);
  const keys = Object.keys(value);

  return (
    keys.every((key) => allowedKeys.has(key)) &&
    ['action', 'actor', 'metadata'].every((key) => Object.hasOwn(value, key))
  );
}

function parseActor(value: unknown): SecurityEventActor | undefined {
  if (!isRecord(value)) return undefined;

  if (
    (value.kind === 'anonymous' || value.kind === 'system') &&
    hasExactKeys(value, ['kind'])
  ) {
    return Object.freeze({ kind: value.kind });
  }

  if (!hasExactKeys(value, ['id', 'kind'])) return undefined;

  if (value.kind === 'auth-user') {
    const id = parseAuthUserId(value.id);
    return id ? Object.freeze({ id, kind: 'auth-user' }) : undefined;
  }

  if (value.kind === 'client') {
    const id = parseClientId(value.id);
    return id ? Object.freeze({ id, kind: 'client' }) : undefined;
  }

  if (value.kind === 'staff' || value.kind === 'staff-enrollment') {
    const id = parseStaffId(value.id);
    return id ? Object.freeze({ id, kind: value.kind }) : undefined;
  }

  return undefined;
}

function parseTarget(value: unknown): SecurityEventTarget | undefined {
  if (!isRecord(value) || !hasExactKeys(value, ['id', 'type'])) {
    return undefined;
  }

  if (value.type === 'auth-user') {
    const id = parseAuthUserId(value.id);
    return id ? Object.freeze({ id, type: 'auth-user' }) : undefined;
  }

  if (value.type === 'staff') {
    const id = parseStaffId(value.id);
    return id ? Object.freeze({ id, type: 'staff' }) : undefined;
  }

  if (value.type === 'client') {
    const id = parseClientId(value.id);
    return id ? Object.freeze({ id, type: 'client' }) : undefined;
  }

  return undefined;
}

function parseMetadata(
  action: SecurityEventAction,
  value: unknown,
): Readonly<Record<string, boolean | string>> | undefined {
  if (!isRecord(value)) return undefined;

  switch (action) {
    case 'primary-owner.bootstrap.succeeded':
    case 'primary-owner.bootstrap.failed':
      return hasExactKeys(value, ['operation']) &&
        isSystemOperation(value.operation)
        ? Object.freeze({ operation: value.operation })
        : undefined;
    case 'session.ended':
      return hasExactKeys(value, ['reasonCode']) &&
        typeof value.reasonCode === 'string' &&
        sessionEndReasonCodeSet.has(value.reasonCode)
        ? Object.freeze({ reasonCode: value.reasonCode })
        : undefined;
    case 'domain-subject.disabled':
      return hasExactKeys(value, ['sessionsRevoked']) &&
        typeof value.sessionsRevoked === 'boolean'
        ? Object.freeze({ sessionsRevoked: value.sessionsRevoked })
        : undefined;
    case 'authorization.denied':
      return hasExactKeys(value, ['reasonCode']) &&
        isAuthorizationDenialCode(value.reasonCode)
        ? Object.freeze({ reasonCode: value.reasonCode })
        : undefined;
    case 'authentication.succeeded':
    case 'authentication.failed':
    case 'mfa.enrollment.succeeded':
    case 'mfa.verification.succeeded':
    case 'mfa.verification.failed':
      return hasExactKeys(value, []) ? Object.freeze({}) : undefined;
  }
}

function hasValidActionShape(input: SecurityEventInput): boolean {
  switch (input.action) {
    case 'primary-owner.bootstrap.succeeded':
      return input.actor.kind === 'system' && input.target?.type === 'staff';
    case 'primary-owner.bootstrap.failed':
      return input.actor.kind === 'system' && input.target === undefined;
    case 'authentication.succeeded':
      return input.actor.kind === 'auth-user' && input.target === undefined;
    case 'authentication.failed':
      return (
        (input.actor.kind === 'anonymous' ||
          input.actor.kind === 'auth-user') &&
        input.target === undefined
      );
    case 'mfa.enrollment.succeeded':
    case 'mfa.verification.succeeded':
    case 'mfa.verification.failed':
      return (
        input.actor.kind === 'staff-enrollment' && input.target === undefined
      );
    case 'domain-subject.disabled':
      return (
        (input.actor.kind === 'staff' || input.actor.kind === 'system') &&
        (input.target?.type === 'staff' || input.target?.type === 'client')
      );
    case 'session.ended':
    case 'authorization.denied':
      return true;
  }
}

export function parseSecurityEventInput(value: unknown): SecurityEventInput {
  if (containsProhibitedField(value)) {
    throw new SecurityEventValidationError('prohibited-field');
  }

  if (!isRecord(value) || !hasAllowedInputKeys(value)) {
    throw new SecurityEventValidationError('invalid-event');
  }

  if (!isSecurityEventAction(value.action)) {
    throw new SecurityEventValidationError('invalid-action');
  }

  const actor = parseActor(value.actor);
  if (!actor) throw new SecurityEventValidationError('invalid-actor');

  const target =
    value.target === undefined ? undefined : parseTarget(value.target);
  if (value.target !== undefined && !target) {
    throw new SecurityEventValidationError('invalid-target');
  }

  if (
    value.correlationId !== undefined &&
    (typeof value.correlationId !== 'string' ||
      !correlationIdPattern.test(value.correlationId))
  ) {
    throw new SecurityEventValidationError('invalid-correlation-id');
  }

  const metadata = parseMetadata(value.action, value.metadata);
  if (!metadata) throw new SecurityEventValidationError('invalid-metadata');

  const input = Object.freeze({
    action: value.action,
    actor,
    ...(value.correlationId === undefined
      ? {}
      : { correlationId: value.correlationId }),
    metadata,
    ...(target === undefined ? {} : { target }),
  }) as SecurityEventInput;

  if (!hasValidActionShape(input)) {
    throw new SecurityEventValidationError(
      target === undefined ? 'invalid-actor' : 'invalid-target',
    );
  }

  return input;
}

export function parseSecurityEventId(
  value: unknown,
): SecurityEventId | undefined {
  return Number.isSafeInteger(value) && Number(value) > 0
    ? (value as SecurityEventId)
    : undefined;
}

export function toAppendRecord(
  input: SecurityEventInput,
  occurredAt: string,
): SecurityEventAppendRecord {
  return Object.freeze({
    action: input.action,
    ...('id' in input.actor ? { actorId: String(input.actor.id) } : {}),
    actorKind: input.actor.kind,
    ...(input.correlationId === undefined
      ? {}
      : { correlationId: input.correlationId }),
    metadata: input.metadata,
    occurredAt,
    ...(input.target === undefined
      ? {}
      : {
          targetId: String(input.target.id),
          targetType: input.target.type,
        }),
  });
}

function parseStoredNumericId(value: unknown): number | undefined {
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value)) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function restoreActor(
  actorKind: unknown,
  actorId: unknown,
): SecurityEventActor | undefined {
  if (actorKind === 'anonymous' || actorKind === 'system') {
    return actorId === undefined ? { kind: actorKind } : undefined;
  }

  if (typeof actorId !== 'string') return undefined;
  if (actorKind === 'auth-user') {
    return parseActor({ id: actorId, kind: actorKind });
  }

  const numericId = parseStoredNumericId(actorId);
  return numericId === undefined
    ? undefined
    : parseActor({ id: numericId, kind: actorKind });
}

function restoreTarget(
  targetType: unknown,
  targetId: unknown,
): SecurityEventTarget | undefined {
  if (targetType === undefined && targetId === undefined) return undefined;
  if (typeof targetId !== 'string') return undefined;
  if (targetType === 'auth-user') {
    return parseTarget({ id: targetId, type: targetType });
  }

  const numericId = parseStoredNumericId(targetId);
  return numericId === undefined
    ? undefined
    : parseTarget({ id: numericId, type: targetType });
}

/** Revalidates the exact flat record passed to the persistence boundary. */
export function parseSecurityEventAppendRecord(
  value: unknown,
): SecurityEventAppendRecord {
  if (!isRecord(value)) {
    throw new SecurityEventValidationError('invalid-event');
  }

  const allowedKeys = new Set([
    'action',
    'actorId',
    'actorKind',
    'correlationId',
    'metadata',
    'occurredAt',
    'targetId',
    'targetType',
  ]);
  if (
    !Object.keys(value).every((key) => allowedKeys.has(key)) ||
    !['action', 'actorKind', 'metadata', 'occurredAt'].every((key) =>
      Object.hasOwn(value, key),
    )
  ) {
    throw new SecurityEventValidationError('invalid-event');
  }

  if (
    typeof value.occurredAt !== 'string' ||
    Number.isNaN(Date.parse(value.occurredAt)) ||
    new Date(value.occurredAt).toISOString() !== value.occurredAt
  ) {
    throw new SecurityEventValidationError('invalid-event');
  }

  const actor = restoreActor(value.actorKind, value.actorId);
  if (!actor) throw new SecurityEventValidationError('invalid-actor');

  const target = restoreTarget(value.targetType, value.targetId);
  if (
    (value.targetType !== undefined || value.targetId !== undefined) &&
    !target
  ) {
    throw new SecurityEventValidationError('invalid-target');
  }

  const input = parseSecurityEventInput({
    action: value.action,
    actor,
    ...(value.correlationId === undefined
      ? {}
      : { correlationId: value.correlationId }),
    metadata: value.metadata,
    ...(target === undefined ? {} : { target }),
  });

  return toAppendRecord(input, value.occurredAt);
}
