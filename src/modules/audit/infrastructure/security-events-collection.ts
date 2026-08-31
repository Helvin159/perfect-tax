import 'server-only';

import { sql } from '@payloadcms/db-postgres';
import type {
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
  Payload,
  PayloadRequest,
} from 'payload';

import {
  createSecurityEventRecorders,
  type SecurityEventRecorders,
  type TrustedPrincipalSourceResolver,
  type TrustedSystemSourceResolver,
  type TrustedTargetSourceResolver,
} from '../application/recorder';
import { SECURITY_EVENT_ACTIONS } from '../domain/actions';
import {
  parseSecurityEventAppendRecord,
  SECURITY_EVENT_ACTOR_KINDS,
  SECURITY_EVENT_TARGET_TYPES,
  type SecurityEventAppendRecord,
} from '../domain/event';

export const SECURITY_EVENTS_SLUG = 'security-events' as const;

const appendCapabilities = new WeakSet<object>();
const appendCapabilityContextKey = 'securityEventAppendCapability';

export class SecurityEventWriteDeniedError extends Error {
  constructor(message: 'append-capability-required' | 'immutable-event') {
    super(`Security event write denied: ${message}`);
    this.name = 'SecurityEventWriteDeniedError';
  }
}

function hasAppendCapability(context: unknown): boolean {
  if (typeof context !== 'object' || context === null) return false;

  const capability = Reflect.get(context, appendCapabilityContextKey);
  return (
    typeof capability === 'object' &&
    capability !== null &&
    appendCapabilities.has(capability)
  );
}

type SecurityEventAppendAttempt = Readonly<{
  context: unknown;
  data: unknown;
  operation: 'create' | 'update';
}>;

export function enforceSecurityEventAppend({
  context,
  data,
  operation,
}: SecurityEventAppendAttempt): SecurityEventAppendRecord {
  if (operation !== 'create') {
    throw new SecurityEventWriteDeniedError('immutable-event');
  }
  if (!hasAppendCapability(context)) {
    throw new SecurityEventWriteDeniedError('append-capability-required');
  }

  return parseSecurityEventAppendRecord(data);
}

export const validateSecurityEventAppend: CollectionBeforeValidateHook = ({
  data,
  operation,
  req,
}) => enforceSecurityEventAppend({ context: req.context, data, operation });

export const denySecurityEventUpdate: CollectionBeforeChangeHook = ({
  operation,
}) => {
  if (operation === 'update') {
    throw new SecurityEventWriteDeniedError('immutable-event');
  }
};

export const denySecurityEventDelete: CollectionBeforeDeleteHook = () => {
  throw new SecurityEventWriteDeniedError('immutable-event');
};

type SecurityEventDatabase = Readonly<{
  drizzle: unknown;
  sessions?: Readonly<Record<string, Readonly<{ db: unknown }>>>;
}>;

function asExecutor(
  value: unknown,
): Readonly<{ execute(statement: unknown): Promise<unknown> }> | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const execute = Reflect.get(value, 'execute');
  if (typeof execute !== 'function') return undefined;

  return { execute: execute.bind(value) };
}

function resultId(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return undefined;
  const rows = Reflect.get(value, 'rows');
  if (!Array.isArray(rows)) return undefined;
  const first = rows[0];
  return typeof first === 'object' && first !== null
    ? Reflect.get(first, 'id')
    : undefined;
}

async function appendSecurityEvent(
  database: SecurityEventDatabase,
  record: SecurityEventAppendRecord,
  req?: PayloadRequest,
): Promise<Readonly<{ id: unknown }>> {
  const transactionID = req?.transactionID
    ? String(await req.transactionID)
    : undefined;
  const executor = asExecutor(
    transactionID ? database.sessions?.[transactionID]?.db : database.drizzle,
  );

  if (!executor) {
    throw new SecurityEventWriteDeniedError('append-capability-required');
  }

  const result = await executor.execute(sql`
    SELECT "public"."perfect_tax_append_security_event"(
      ${record.occurredAt}::timestamp with time zone,
      ${record.action}::"public"."enum_security_events_action",
      ${record.actorKind}::"public"."enum_security_events_actor_kind",
      ${record.actorId ?? null}::varchar,
      ${record.targetType ?? null}::"public"."enum_security_events_target_type",
      ${record.targetId ?? null}::varchar,
      ${record.correlationId ?? null}::varchar,
      ${JSON.stringify(record.metadata)}::jsonb
    ) AS "id"
  `);

  return Object.freeze({ id: resultId(result) });
}

/**
 * Binds the narrow recorder to Payload's PostgreSQL adapter without granting
 * the runtime role table reads or direct writes. A success recorder uses the
 * exact Payload transaction session attached to `req`; a missing session fails
 * closed instead of silently appending outside the transaction.
 */
export function createPayloadSecurityEventRecorders<
  PrincipalSource extends object,
  TargetSource extends object,
  SystemSource extends object,
>(
  payload: Pick<Payload, 'db'>,
  provenance: Readonly<{
    principalResolver: TrustedPrincipalSourceResolver<PrincipalSource>;
    systemResolver: TrustedSystemSourceResolver<SystemSource>;
    targetResolver: TrustedTargetSourceResolver<TargetSource>;
  }>,
  now?: () => Date,
  req?: PayloadRequest,
): SecurityEventRecorders<PrincipalSource, TargetSource, SystemSource> {
  const capability = Object.freeze({});
  appendCapabilities.add(capability);

  return createSecurityEventRecorders({
    appendPort: {
      append: (data) => {
        const validated = enforceSecurityEventAppend({
          context: { [appendCapabilityContextKey]: capability },
          data,
          operation: 'create',
        });
        return appendSecurityEvent(
          payload.db as unknown as SecurityEventDatabase,
          validated,
          req,
        );
      },
    },
    ...(now === undefined ? {} : { now }),
    ...provenance,
  });
}

const denyAll = () => false;

export const SecurityEvents: CollectionConfig = {
  slug: SECURITY_EVENTS_SLUG,
  access: {
    create: denyAll,
    delete: denyAll,
    read: denyAll,
    update: denyAll,
  },
  admin: {
    hidden: true,
  },
  disableBulkDelete: true,
  disableDuplicate: true,
  fields: [
    {
      name: 'occurredAt',
      type: 'date',
      admin: { readOnly: true },
      index: true,
      required: true,
    },
    {
      name: 'action',
      type: 'select',
      admin: { readOnly: true },
      index: true,
      options: SECURITY_EVENT_ACTIONS.map((action) => ({
        label: action,
        value: action,
      })),
      required: true,
    },
    {
      name: 'actorKind',
      type: 'select',
      admin: { readOnly: true },
      options: SECURITY_EVENT_ACTOR_KINDS.map((kind) => ({
        label: kind,
        value: kind,
      })),
      required: true,
    },
    {
      name: 'actorId',
      type: 'text',
      admin: { readOnly: true },
      maxLength: 255,
    },
    {
      name: 'targetType',
      type: 'select',
      admin: { readOnly: true },
      options: SECURITY_EVENT_TARGET_TYPES.map((type) => ({
        label: type,
        value: type,
      })),
    },
    {
      name: 'targetId',
      type: 'text',
      admin: { readOnly: true },
      maxLength: 255,
    },
    {
      name: 'correlationId',
      type: 'text',
      admin: { readOnly: true },
      index: true,
      maxLength: 36,
    },
    {
      name: 'metadata',
      type: 'json',
      admin: { readOnly: true },
      required: true,
    },
  ],
  graphQL: false,
  hooks: {
    beforeChange: [denySecurityEventUpdate],
    beforeDelete: [denySecurityEventDelete],
    beforeValidate: [validateSecurityEventAppend],
  },
  timestamps: false,
};
