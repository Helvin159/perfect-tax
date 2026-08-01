import type { Payload } from 'payload';
import { describe, expect, it, vi } from 'vitest';

import {
  bootstrapFirstCmsAdministrator,
  CmsAdministratorExistsError,
} from './service';

const credentials = {
  email: 'admin@example.com',
  password: 'Long-local-only!Passphrase-2026',
};

function createPayloadMock(existingAdministrators: number) {
  const query = vi.fn().mockResolvedValue({});
  const release = vi.fn();
  const create = vi.fn().mockResolvedValue({ id: 1 });
  const count = vi
    .fn()
    .mockResolvedValue({ totalDocs: existingAdministrators });
  const payload = {
    count,
    create,
    db: {
      pool: {
        connect: vi.fn().mockResolvedValue({ query, release }),
      },
    },
  } as unknown as Payload;

  return { count, create, payload, query, release };
}

describe('first CMS administrator bootstrap', () => {
  it('creates one cms-admin through the explicit access override', async () => {
    const { create, payload, query, release } = createPayloadMock(0);

    await bootstrapFirstCmsAdministrator(payload, credentials);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'cms-users',
        data: expect.objectContaining({
          email: credentials.email,
          password: credentials.password,
          role: 'cms-admin',
        }),
        overrideAccess: true,
      }),
    );
    expect(query).toHaveBeenNthCalledWith(
      1,
      'SELECT pg_advisory_lock($1)',
      expect.any(Array),
    );
    expect(query).toHaveBeenLastCalledWith(
      'SELECT pg_advisory_unlock($1)',
      expect.any(Array),
    );
    expect(release).toHaveBeenCalledOnce();
  });

  it('fails safely and makes no change when an administrator exists', async () => {
    const { create, payload, release } = createPayloadMock(1);

    await expect(
      bootstrapFirstCmsAdministrator(payload, credentials),
    ).rejects.toBeInstanceOf(CmsAdministratorExistsError);
    expect(create).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledOnce();
  });
});
