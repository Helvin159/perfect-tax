import 'server-only';

import type {
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
  Payload,
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

type PayloadSecurityEventCreate = (
  options: Readonly<{
    collection: typeof SECURITY_EVENTS_SLUG;
    context: Readonly<Record<string, object>>;
    data: SecurityEventAppendRecord;
    depth: 0;
    overrideAccess: true;
  }>,
) => Promise<Readonly<{ id: unknown }>>;

/**
 * Binds the narrow recorder to Payload without exposing the runtime append
 * capability or any update/delete operation to application consumers.
 */
export function createPayloadSecurityEventRecorders<
  PrincipalSource extends object,
  TargetSource extends object,
  SystemSource extends object,
>(
  payload: Pick<Payload, 'create'>,
  provenance: Readonly<{
    principalResolver: TrustedPrincipalSourceResolver<PrincipalSource>;
    systemResolver: TrustedSystemSourceResolver<SystemSource>;
    targetResolver: TrustedTargetSourceResolver<TargetSource>;
  }>,
  now?: () => Date,
): SecurityEventRecorders<PrincipalSource, TargetSource, SystemSource> {
  const capability = Object.freeze({});
  appendCapabilities.add(capability);
  const create = payload.create.bind(
    payload,
  ) as unknown as PayloadSecurityEventCreate;

  return createSecurityEventRecorders({
    appendPort: {
      append: (data) =>
        create({
          collection: SECURITY_EVENTS_SLUG,
          context: { [appendCapabilityContextKey]: capability },
          data,
          depth: 0,
          overrideAccess: true,
        }),
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
