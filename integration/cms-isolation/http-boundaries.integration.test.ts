import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  AGENT15_STAFF_PASSWORD,
  closePortalAuthRuntime,
  provisionUnboundCredential,
  quiescePostgresPool,
} from '../support/auth';
import {
  activateAgent15Environment,
  agent15Environment,
  createAgent15Database,
  type Agent15Database,
} from '../support/database';
import {
  cookieFromHttpResponse,
  startNextTestServer,
  type TestServer,
} from '../support/server';

const CMS_PASSWORD = 'Agent15-Cms-Password!234';
const CMS_ROLES = [
  'editor',
  'bilingual-reviewer',
  'publisher',
  'cms-admin',
] as const;

let database: Agent15Database;
let payloadMigration: Client;
let server: TestServer;
let origin: string;

async function loginCms(email: string) {
  const response = await fetch(`${origin}/api/cms/cms-users/login`, {
    body: JSON.stringify({ email, password: CMS_PASSWORD }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  expect(response.status).toBe(200);
  return cookieFromHttpResponse(response, 'payload-token');
}

beforeAll(async () => {
  database = await createAgent15Database('http');
  const port = 32_000 + (process.pid % 1_000);
  origin = `http://127.0.0.1:${port}`;
  activateAgent15Environment(database, origin);
  payloadMigration = new Client({
    connectionString: database.payloadMigrationURL,
  });
  await payloadMigration.connect();

  const [
    { getPayload },
    { default: config },
    { bootstrapFirstCmsAdministrator },
  ] = await Promise.all([
    import('payload'),
    import('@payload-config'),
    import('@/modules/cms/bootstrap/service'),
  ]);
  const payload = await getPayload({ config });
  const cmsAdmin = await bootstrapFirstCmsAdministrator(payload, {
    email: 'cms-admin@example.test',
    password: CMS_PASSWORD,
  });
  for (const role of CMS_ROLES.filter(
    (candidate) => candidate !== 'cms-admin',
  )) {
    await payload.create({
      collection: 'cms-users',
      data: {
        email:
          role === 'editor' ? 'crossover@example.test' : `${role}@example.test`,
        password: CMS_PASSWORD,
        role,
      },
      overrideAccess: false,
      user: cmsAdmin,
    });
  }

  const credential = await provisionUnboundCredential(
    'crossover@example.test',
    'Operational Crossover',
  );
  const operationalStaff = await payloadMigration.query<{ id: number }>(
    `INSERT INTO public.staff
       (first_name, last_name, work_email, role, status, is_primary_owner)
     VALUES ('Operational', 'Staff', 'crossover@example.test', 'administrator', 'active', false)
     RETURNING id`,
  );
  await payloadMigration.query(
    `INSERT INTO public.portal_identities
       (auth_user_id, subject_type, staff_id)
     VALUES ($1, 'staff', $2)`,
    [credential.authUserId, operationalStaff.rows[0]!.id],
  );
  await payloadMigration.query(
    `INSERT INTO public.clients
       (client_number, first_name, last_name, contact_email, status)
     VALUES ('CL-HTTP-0001', 'Private', 'Client', 'private-client@example.test', 'active')`,
  );

  const payloadPool = (payload as unknown as { db?: { pool?: unknown } }).db
    ?.pool;
  const payloadClosed = quiescePostgresPool(payloadPool).catch(() => undefined);
  const authClosed = closePortalAuthRuntime().catch(() => undefined);
  void payloadClosed;
  void authClosed;
  await payload.destroy();

  server = await startNextTestServer(
    agent15Environment(database, origin),
    port,
  );
});

afterAll(async () => {
  await server?.stop();
  await payloadMigration?.end();
  await database?.destroy();
});

describe('real HTTP CMS/portal isolation', () => {
  it('keeps all CMS roles functional while denying every private collection surface', async () => {
    const cmsCookies = new Map<string, string>();
    for (const role of CMS_ROLES) {
      const email =
        role === 'cms-admin'
          ? 'cms-admin@example.test'
          : role === 'editor'
            ? 'crossover@example.test'
            : `${role}@example.test`;
      const cookie = await loginCms(email);
      cmsCookies.set(role, cookie);
      const services = await fetch(`${origin}/api/cms/services?depth=0`, {
        headers: { cookie, origin },
      });
      expect(services.status).toBe(200);
    }

    const editorCreate = await fetch(`${origin}/api/cms/services?locale=en`, {
      body: JSON.stringify({
        displayOrder: 10,
        isActive: false,
        stableIdentifier: 'agent-15-editor-service',
        summary: 'Maintained integration test service.',
        title: 'Agent 15 service',
      }),
      headers: {
        'content-type': 'application/json',
        cookie: cmsCookies.get('editor')!,
        origin,
      },
      method: 'POST',
    });
    expect(editorCreate.status).toBe(201);

    for (const role of ['bilingual-reviewer', 'publisher'] as const) {
      const deniedCreate = await fetch(`${origin}/api/cms/services?locale=en`, {
        body: JSON.stringify({
          stableIdentifier: `agent-15-${role}`,
          summary: 'Must be denied.',
          title: 'Denied service',
        }),
        headers: {
          'content-type': 'application/json',
          cookie: cmsCookies.get(role)!,
          origin,
        },
        method: 'POST',
      });
      expect([401, 403]).toContain(deniedCreate.status);
    }

    const slugs = [
      'staff',
      'clients',
      'portal-identities',
      'security-events',
    ] as const;
    const actors: Array<Readonly<Record<string, string>>> = [
      {},
      ...CMS_ROLES.map((role) => ({
        cookie: cmsCookies.get(role)!,
        origin,
      })),
      {
        authorization: 'Bearer fake-portal-owner',
        'x-portal-role': 'owner',
      },
    ];
    for (const slug of slugs) {
      for (const headers of actors) {
        for (const [method, suffix] of [
          ['GET', ''],
          ['POST', ''],
          ['PATCH', '/1'],
          ['DELETE', '/1'],
        ] as const) {
          const response = await fetch(`${origin}/api/cms/${slug}${suffix}`, {
            ...(method === 'POST' || method === 'PATCH'
              ? { body: JSON.stringify({ role: 'owner' }) }
              : {}),
            headers: {
              ...headers,
              'content-type': 'application/json',
            },
            method,
          });
          expect([401, 403, 404, 501]).toContain(response.status);
          const body = await response.text();
          expect(body).not.toContain('crossover@example.test');
          expect(body).not.toContain('private-client@example.test');
          expect(body).not.toContain('CL-HTTP-0001');
        }
      }
    }

    const privateAdmin = await fetch(`${origin}/admin/collections/staff`, {
      headers: { cookie: cmsCookies.get('cms-admin')!, origin },
    });
    const privateAdminBody = await privateAdmin.text();
    expect(privateAdmin.status).not.toBe(500);
    expect(privateAdminBody).not.toContain('crossover@example.test');

    const graphQL = await fetch(`${origin}/api/cms/graphql`, {
      body: JSON.stringify({ query: '{ staff { docs { id } } }' }),
      headers: {
        'content-type': 'application/json',
        cookie: cmsCookies.get('cms-admin')!,
        origin,
      },
      method: 'POST',
    });
    expect([404, 405]).toContain(graphQL.status);
  });

  it('does not treat an operational Staff session or matching email as CMS authority', async () => {
    const loginResponse = await fetch(`${origin}/api/auth/sign-in/email`, {
      body: JSON.stringify({
        email: 'crossover@example.test',
        password: AGENT15_STAFF_PASSWORD,
      }),
      headers: {
        'content-type': 'application/json',
        origin,
      },
      method: 'POST',
    });
    expect(loginResponse.status).toBe(200);
    const portalCookie = cookieFromHttpResponse(
      loginResponse,
      'portal-auth.session_token',
    );

    const cmsMe = await fetch(`${origin}/api/cms/cms-users/me`, {
      headers: { cookie: portalCookie },
    });
    expect([200, 401, 403]).toContain(cmsMe.status);
    expect((await cmsMe.text()).toLowerCase()).not.toContain('cms-admin');

    const cmsServices = await fetch(`${origin}/api/cms/services`, {
      headers: { cookie: portalCookie },
    });
    expect([401, 403]).toContain(cmsServices.status);

    const admin = await fetch(`${origin}/admin`, {
      headers: { cookie: portalCookie },
      redirect: 'manual',
    });
    expect([200, 302, 303, 307, 308]).toContain(admin.status);
    expect(admin.headers.get('location') ?? '').not.toContain(
      '/collections/staff',
    );
  });

  it('preserves readiness, public EN/ES routes, manifests, globals, and public media', async () => {
    const ready = await fetch(`${origin}/api/health/ready`);
    expect(ready.status).toBe(200);
    await expect(ready.json()).resolves.toEqual({ status: 'ready' });

    for (const locale of ['en', 'es']) {
      const home = await fetch(`${origin}/${locale}`);
      expect(home.status).toBe(200);
      expect((await home.text()).toLowerCase()).toContain('perfect tax');

      const manifest = await fetch(`${origin}/${locale}/manifest.webmanifest`);
      expect(manifest.status).toBe(200);
      expect(manifest.headers.get('content-type')).toContain(
        'application/manifest+json',
      );
    }

    const media = await fetch(`${origin}/api/cms/public-media?depth=0`);
    expect(media.status).toBe(200);

    const cmsAdminCookie = await loginCms('cms-admin@example.test');
    for (const global of [
      'business-identity',
      'contact-settings',
      'portal-settings',
      'homepage-content',
    ]) {
      const response = await fetch(`${origin}/api/cms/globals/${global}`, {
        headers: { cookie: cmsAdminCookie, origin },
      });
      expect(response.status).toBe(200);
    }
  });
});
