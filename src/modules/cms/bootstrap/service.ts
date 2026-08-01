import type { Payload, RequestContext } from 'payload';

import { CMS_BOOTSTRAP_CONTEXT } from '../users/authorization';
import type { CmsBootstrapCredentials } from './credentials';
import { parseCmsBootstrapCredentials } from './credentials';

const CMS_BOOTSTRAP_ADVISORY_LOCK = 1_842_763_911;

export class CmsAdministratorExistsError extends Error {
  constructor() {
    super('A CMS administrator already exists; bootstrap made no changes.');
    this.name = 'CmsAdministratorExistsError';
  }
}

/**
 * Creates the first CMS administrator while serializing concurrent bootstrap
 * attempts. This is the sole intentional `overrideAccess: true` provisioning path.
 */
export async function bootstrapFirstCmsAdministrator(
  payload: Payload,
  unvalidatedCredentials: CmsBootstrapCredentials,
) {
  const credentials = parseCmsBootstrapCredentials(unvalidatedCredentials);
  const lockClient = await payload.db.pool.connect();

  try {
    await lockClient.query('SELECT pg_advisory_lock($1)', [
      CMS_BOOTSTRAP_ADVISORY_LOCK,
    ]);

    const existingAdministrators = await payload.count({
      collection: 'cms-users',
      overrideAccess: true,
      where: { role: { equals: 'cms-admin' } },
    });

    if (existingAdministrators.totalDocs > 0) {
      throw new CmsAdministratorExistsError();
    }

    const context = {
      [CMS_BOOTSTRAP_CONTEXT]: true,
    } as RequestContext;

    return await payload.create({
      collection: 'cms-users',
      context,
      data: {
        email: credentials.email,
        password: credentials.password,
        role: 'cms-admin',
      },
      overrideAccess: true,
    });
  } finally {
    try {
      await lockClient.query('SELECT pg_advisory_unlock($1)', [
        CMS_BOOTSTRAP_ADVISORY_LOCK,
      ]);
    } finally {
      lockClient.release();
    }
  }
}
