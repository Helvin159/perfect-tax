import type { Payload } from 'payload';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  parseAuthUserId,
  parseClientId,
  parseStaffId,
} from '../domain/identifiers';
import {
  createPayloadPortalIdentityRepository,
  PortalIdentityPersistenceError,
} from './portal-identity-repository';

function fixtures() {
  const authUserId = parseAuthUserId('auth_1');
  const clientId = parseClientId(20);
  const staffId = parseStaffId(10);
  if (!authUserId || !clientId || !staffId) {
    throw new Error('Invalid PortalIdentity test fixtures');
  }
  return { authUserId, clientId, staffId };
}

describe('Payload PortalIdentity repository', () => {
  it('looks up and projects only the frozen Staff binding data', async () => {
    const find = vi.fn(async () => ({
      docs: [
        {
          authUserId: 'auth_1',
          id: 99,
          staff: 10,
          subjectType: 'staff',
          updatedAt: '2026-08-10T12:00:00.000Z',
        },
      ],
    }));
    const repository = createPayloadPortalIdentityRepository({
      find,
    } as unknown as Pick<Payload, 'find'>);

    await expect(
      repository.findByAuthUserId(fixtures().authUserId),
    ).resolves.toEqual({
      authUserId: 'auth_1',
      staffId: 10,
      subjectKind: 'staff',
    });

    expect(find).toHaveBeenCalledWith({
      collection: 'portal-identities',
      depth: 0,
      limit: 2,
      overrideAccess: true,
      select: {
        authUserId: true,
        client: true,
        staff: true,
        subjectType: true,
      },
      where: { authUserId: { equals: 'auth_1' } },
    });
  });

  it('supports direct Client and Staff subject lookups without email linking', async () => {
    const find = vi
      .fn()
      .mockResolvedValueOnce({
        docs: [
          {
            authUserId: 'auth_client_1',
            client: 20,
            subjectType: 'client',
          },
        ],
      })
      .mockResolvedValueOnce({ docs: [] });
    const repository = createPayloadPortalIdentityRepository({
      find,
    } as unknown as Pick<Payload, 'find'>);
    const { clientId, staffId } = fixtures();

    await expect(repository.findByClientId(clientId)).resolves.toEqual({
      authUserId: 'auth_client_1',
      clientId: 20,
      subjectKind: 'client',
    });
    await expect(repository.findByStaffId(staffId)).resolves.toBeNull();

    expect(find.mock.calls.map(([call]) => call.where)).toEqual([
      { client: { equals: 20 } },
      { staff: { equals: 10 } },
    ]);
    expect(JSON.stringify(find.mock.calls)).not.toContain('email');
  });

  it('fails closed if duplicate auth-user or subject rows are observed', async () => {
    const duplicate = {
      authUserId: 'auth_1',
      staff: 10,
      subjectType: 'staff',
    };
    const find = vi.fn(async () => ({ docs: [duplicate, duplicate] }));
    const repository = createPayloadPortalIdentityRepository({
      find,
    } as unknown as Pick<Payload, 'find'>);
    const { authUserId, staffId } = fixtures();

    await expect(repository.findByAuthUserId(authUserId)).rejects.toThrowError(
      new PortalIdentityPersistenceError('duplicate-binding'),
    );
    await expect(repository.findByStaffId(staffId)).rejects.toThrowError(
      new PortalIdentityPersistenceError('duplicate-binding'),
    );
  });

  it('fails closed on a malformed persisted mismatch or dual binding', async () => {
    const find = vi
      .fn()
      .mockResolvedValueOnce({
        docs: [
          {
            authUserId: 'auth_1',
            client: 20,
            staff: 10,
            subjectType: 'staff',
          },
        ],
      })
      .mockResolvedValueOnce({
        docs: [
          {
            authUserId: 'auth_1',
            client: 20,
            subjectType: 'staff',
          },
        ],
      });
    const repository = createPayloadPortalIdentityRepository({
      find,
    } as unknown as Pick<Payload, 'find'>);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await expect(
        repository.findByAuthUserId(fixtures().authUserId),
      ).rejects.toThrowError(
        new PortalIdentityPersistenceError('invalid-persisted-binding'),
      );
    }
  });
});
