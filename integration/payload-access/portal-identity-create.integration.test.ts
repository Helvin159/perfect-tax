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
  database = await createAgent15Database('identity');
  activateAgent15Environment(database);
  payloadMigration = new Client({
    connectionString: database.payloadMigrationURL,
  });
  await payloadMigration.connect();
  const staff = await payloadMigration.query<{ id: number }>(
    `INSERT INTO public.staff
       (first_name, last_name, work_email, role, status, is_primary_owner)
     VALUES ('Portal', 'Identity', 'identity-create@example.test', 'intake', 'active', false)
     RETURNING id`,
  );
  process.env.AGENT15_PORTAL_IDENTITY_STAFF_ID = String(staff.rows[0]!.id);
  const [{ getPayload }, { default: config }] = await Promise.all([
    import('payload'),
    import('@payload-config'),
  ]);
  payload = await getPayload({ config });
});

afterAll(async () => {
  delete process.env.AGENT15_PORTAL_IDENTITY_STAFF_ID;
  const pool = (payload as unknown as { db?: { pool?: unknown } })?.db?.pool;
  const closed = quiescePostgresPool(pool).catch(() => undefined);
  void closed;
  await payload?.destroy();
  await payloadMigration?.end();
  await database?.destroy();
});

describe('real PortalIdentity Payload create path', () => {
  it('accepts the approved three-field Staff binding after Payload normalization', async () => {
    const staffId = Number(process.env.AGENT15_PORTAL_IDENTITY_STAFF_ID);
    await expect(
      payload.create({
        collection: 'portal-identities',
        data: {
          authUserId: 'auth-real-payload-create',
          staff: staffId,
          subjectType: 'staff',
        },
        depth: 0,
        overrideAccess: true,
      }),
    ).resolves.toMatchObject({
      authUserId: 'auth-real-payload-create',
      staff: staffId,
      subjectType: 'staff',
    });
  });
});
