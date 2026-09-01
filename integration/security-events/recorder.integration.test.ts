import { Client } from 'pg';
import type { Payload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { quiescePostgresPool } from '../support/auth';
import {
  activateAgent15Environment,
  createAgent15Database,
  type Agent15Database,
} from '../support/database';

let database: Agent15Database;
let payload: Payload;
let payloadMigration: Client;

beforeAll(async () => {
  database = await createAgent15Database('events');
  activateAgent15Environment(database);
  payloadMigration = new Client({
    connectionString: database.payloadMigrationURL,
  });
  await payloadMigration.connect();
  const [{ getPayload }, { default: config }] = await Promise.all([
    import('payload'),
    import('@payload-config'),
  ]);
  payload = await getPayload({ config });
});

afterAll(async () => {
  const pool = (payload as unknown as { db?: { pool?: unknown } })?.db?.pool;
  const closed = quiescePostgresPool(pool).catch(() => undefined);
  void closed;
  await payload?.destroy();
  await payloadMigration?.end();
  await database?.destroy();
});

describe('Payload-backed SecurityEvent recorder', () => {
  it('appends trusted authentication, MFA, and authorization events without secrets', async () => {
    const [{ createPayloadSecurityEventRecorders }, { parsePortalPrincipal }] =
      await Promise.all([
        import('@/modules/audit/infrastructure/security-events-collection'),
        import('@/modules/portal-identity/domain/principal'),
      ]);
    const staffPrincipal = parsePortalPrincipal({
      authUserId: 'auth-event-staff',
      kind: 'staff',
      mfaAssurance: 'verified',
      role: 'administrator',
      staffId: 15,
      status: 'active',
    })!;
    const enrollmentPrincipal = parsePortalPrincipal({
      allowedOperations: ['enroll-mfa', 'verify-mfa', 'sign-out'],
      authUserId: 'auth-event-enrollment',
      kind: 'staff-enrollment',
      staffId: 16,
    })!;
    const staffSource = Object.freeze({ source: 'staff' });
    const enrollmentSource = Object.freeze({ source: 'enrollment' });
    const principals = new WeakMap<object, typeof staffPrincipal>();
    principals.set(staffSource, staffPrincipal);
    principals.set(enrollmentSource, enrollmentPrincipal);

    const recorder = createPayloadSecurityEventRecorders(payload, {
      principalResolver: {
        resolvePrincipal: (source: object) => principals.get(source),
      },
      systemResolver: { resolveSystemSource: () => undefined },
      targetResolver: { resolveTarget: () => undefined },
    });

    await recorder.recordPrincipalSecurityEvent(staffSource, {
      action: 'authentication.succeeded',
      metadata: {},
    });
    await recorder.recordPrincipalSecurityEvent(enrollmentSource, {
      action: 'mfa.enrollment.succeeded',
      metadata: {},
    });
    await recorder.recordPrincipalSecurityEvent(enrollmentSource, {
      action: 'mfa.verification.succeeded',
      metadata: {},
    });
    await recorder.recordPrincipalSecurityEvent(staffSource, {
      action: 'authorization.denied',
      metadata: { reasonCode: 'field-restricted' },
    });

    await expect(
      recorder.recordPrincipalSecurityEvent(staffSource, {
        action: 'authorization.denied',
        metadata: {
          password: 'must-never-persist',
          reasonCode: 'field-restricted',
        },
      } as never),
    ).rejects.toMatchObject({ code: 'prohibited-field' });

    const events = await payloadMigration.query<{
      action: string;
      metadata: Record<string, unknown>;
    }>('SELECT action::text, metadata FROM public.security_events ORDER BY id');
    expect(events.rows).toEqual([
      { action: 'authentication.succeeded', metadata: {} },
      { action: 'mfa.enrollment.succeeded', metadata: {} },
      { action: 'mfa.verification.succeeded', metadata: {} },
      {
        action: 'authorization.denied',
        metadata: { reasonCode: 'field-restricted' },
      },
    ]);

    const serialized = JSON.stringify(events.rows).toLowerCase();
    for (const prohibited of [
      'password',
      'session token',
      'totp',
      'secret',
      'backup code',
      'authorization header',
      'request body',
      'provider object',
      'must-never-persist',
    ]) {
      expect(serialized).not.toContain(prohibited);
    }
  });

  it('rejects application-level update and delete even with Local API bypass', async () => {
    const { denySecurityEventDelete, denySecurityEventUpdate } =
      await import('@/modules/audit/infrastructure/security-events-collection');
    const first = await payloadMigration.query<{ id: number }>(
      'SELECT id FROM public.security_events ORDER BY id LIMIT 1',
    );
    await expect(
      payload.update({
        collection: 'security-events',
        data: { metadata: {} },
        id: first.rows[0]!.id,
        overrideAccess: true,
      }),
    ).rejects.toThrow();
    await expect(
      payload.delete({
        collection: 'security-events',
        id: first.rows[0]!.id,
        overrideAccess: true,
      }),
    ).rejects.toThrow();

    expect(() =>
      denySecurityEventUpdate({ operation: 'update' } as never),
    ).toThrow('immutable-event');
    expect(() => denySecurityEventDelete({} as never)).toThrow(
      'immutable-event',
    );
  });
});
