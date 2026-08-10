import 'server-only';

import {
  parseSecurityEventId,
  parseSecurityEventInput,
  toAppendRecord,
  type RecordedSecurityEvent,
  type SecurityEventAppendRecord,
  type SecurityEventInput,
} from '../domain/event';

export interface SecurityEventAppendPort {
  append(record: SecurityEventAppendRecord): Promise<Readonly<{ id: unknown }>>;
}

export interface SecurityEventRecorder {
  recordSecurityEvent(
    input: SecurityEventInput,
  ): Promise<RecordedSecurityEvent>;
}

export type SecurityEventRecorderDependencies = Readonly<{
  appendPort: SecurityEventAppendPort;
  now?: () => Date;
}>;

export class SecurityEventPersistenceError extends Error {
  constructor() {
    super('Security event append failed');
    this.name = 'SecurityEventPersistenceError';
  }
}

/**
 * Creates the only application-facing security-event operation. Time and IDs
 * come from trusted server dependencies, never from the event caller.
 */
export function createSecurityEventRecorder({
  appendPort,
  now = () => new Date(),
}: SecurityEventRecorderDependencies): SecurityEventRecorder {
  return Object.freeze({
    async recordSecurityEvent(
      unsafeInput: SecurityEventInput,
    ): Promise<RecordedSecurityEvent> {
      const input = parseSecurityEventInput(unsafeInput);
      const occurredAt = now().toISOString();
      const result = await appendPort.append(toAppendRecord(input, occurredAt));
      const eventId = parseSecurityEventId(result.id);

      if (!eventId) throw new SecurityEventPersistenceError();

      return Object.freeze({
        ...input,
        eventId,
        occurredAt,
      }) as RecordedSecurityEvent;
    },
  });
}
