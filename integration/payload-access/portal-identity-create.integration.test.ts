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
let clientIds: number[];
let staffIds: number[];

beforeAll(async () => {
  database = await createAgent15Database('identity');
  activateAgent15Environment(database);
  payloadMigration = new Client({
    connectionString: database.payloadMigrationURL,
  });
  await payloadMigration.connect();
  const staff = await payloadMigration.query<{ id: number }>(
    `INSERT INTO public.staff
       (first_name, last_name, work_email, role, status, is_primary_owner)
     VALUES
       ('Portal', 'Identity', 'identity-create@example.test', 'intake', 'active', false),
       ('Second', 'Identity', 'identity-second@example.test', 'intake', 'active', false)
     RETURNING id`,
  );
  const clients = await payloadMigration.query<{ id: number }>(
    `INSERT INTO public.clients
       (client_number, first_name, last_name, contact_email, status)
     VALUES
       ('CL-1DEN-0001', 'First', 'Client', 'identity-client-1@example.test', 'active'),
       ('CL-1DEN-0002', 'Second', 'Client', 'identity-client-2@example.test', 'active')
     RETURNING id`,
  );
  staffIds = staff.rows.map(({ id }) => id);
  clientIds = clients.rows.map(({ id }) => id);
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

describe('real PortalIdentity Payload create path', () => {
  it('accepts the approved three-field Staff binding after Payload normalization', async () => {
    const created = await payload.create({
      collection: 'portal-identities',
      data: {
        authUserId: 'auth-real-payload-create',
        staff: staffIds[0]!,
        subjectType: 'staff',
      },
      depth: 0,
      overrideAccess: true,
    });
    expect(created).toMatchObject({
      authUserId: 'auth-real-payload-create',
      staff: staffIds[0],
      subjectType: 'staff',
    });

    const clientBinding = await payload.create({
      collection: 'portal-identities',
      data: {
        authUserId: 'auth-real-client-create',
        client: clientIds[0]!,
        subjectType: 'client',
      },
      depth: 0,
      overrideAccess: true,
    });

    for (const data of [
      { authUserId: 'auth-zero', subjectType: 'staff' },
      {
        authUserId: 'auth-dual',
        client: clientIds[1],
        staff: staffIds[1],
        subjectType: 'staff',
      },
      {
        authUserId: 'auth-mismatch',
        staff: staffIds[1],
        subjectType: 'client',
      },
      {
        authUserId: 'auth-unexpected',
        providerRole: 'owner',
        staff: staffIds[1],
        subjectType: 'staff',
      },
    ]) {
      await expect(
        payload.create({
          collection: 'portal-identities',
          data: data as never,
          depth: 0,
          overrideAccess: true,
        }),
      ).rejects.toThrow();
    }

    for (const data of [
      {
        authUserId: 'auth-real-payload-create',
        staff: staffIds[1],
        subjectType: 'staff',
      },
      {
        authUserId: 'auth-duplicate-staff',
        staff: staffIds[0],
        subjectType: 'staff',
      },
      {
        authUserId: 'auth-duplicate-client',
        client: clientIds[0],
        subjectType: 'client',
      },
    ]) {
      await expect(
        payload.create({
          collection: 'portal-identities',
          data: data as never,
          depth: 0,
          overrideAccess: true,
        }),
      ).rejects.toThrow();
    }

    await expect(
      payload.update({
        collection: 'portal-identities',
        data: { authUserId: 'changed' },
        id: created.id,
        overrideAccess: true,
      }),
    ).rejects.toThrow('immutable-binding');
    await expect(
      payload.delete({
        collection: 'portal-identities',
        id: clientBinding.id,
        overrideAccess: true,
      }),
    ).rejects.toThrow('immutable-binding');
  });
});
