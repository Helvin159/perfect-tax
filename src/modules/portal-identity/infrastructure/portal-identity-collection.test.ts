import type { Field } from 'payload';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  denyPortalIdentityAccess,
  enforcePortalIdentityInvariants,
  parsePortalIdentityPersistenceRecord,
  PortalIdentities,
  PortalIdentityInvariantError,
} from './portal-identity-collection';

function namedField(name: string): Field & { name: string } {
  const field = PortalIdentities.fields.find(
    (candidate): candidate is Field & { name: string } =>
      'name' in candidate && candidate.name === name,
  );
  if (!field) throw new Error(`Missing PortalIdentity field: ${name}`);
  return field;
}

describe('PortalIdentity collection', () => {
  it.each([
    {
      authUserId: 'auth_staff_1',
      staff: 10,
      subjectType: 'staff',
    },
    {
      authUserId: 'auth_client_1',
      client: 20,
      subjectType: 'client',
    },
  ])('accepts one valid $subjectType binding', (binding) => {
    expect(parsePortalIdentityPersistenceRecord(binding)).toEqual(binding);
  });

  it('declares database uniqueness for auth users and each domain subject', () => {
    for (const name of ['authUserId', 'staff', 'client']) {
      const field = namedField(name);
      expect('unique' in field && field.unique).toBe(true);
      expect('index' in field && field.index).toBe(true);
    }
  });

  it.each([
    {
      binding: { authUserId: 'auth_1', subjectType: 'staff' },
      code: 'subject-type-mismatch',
      label: 'missing subject',
    },
    {
      binding: {
        authUserId: 'auth_1',
        client: 20,
        staff: 10,
        subjectType: 'staff',
      },
      code: 'dual-subject',
      label: 'dual subject',
    },
    {
      binding: {
        authUserId: 'auth_1',
        client: 20,
        subjectType: 'staff',
      },
      code: 'subject-type-mismatch',
      label: 'Staff type with Client relation',
    },
    {
      binding: {
        authUserId: 'auth_1',
        staff: 10,
        subjectType: 'client',
      },
      code: 'subject-type-mismatch',
      label: 'Client type with Staff relation',
    },
  ])('rejects $label', ({ binding, code }) => {
    expect(() => parsePortalIdentityPersistenceRecord(binding)).toThrowError(
      expect.objectContaining({ code }),
    );
  });

  it('rejects mutation of the type or either relationship', () => {
    for (const data of [
      { subjectType: 'client' },
      { staff: 11 },
      { client: 21 },
    ]) {
      expect(() =>
        enforcePortalIdentityInvariants({
          data,
          operation: 'update',
        } as never),
      ).toThrowError(new PortalIdentityInvariantError('immutable-binding'));
    }
  });

  it('contains no status, role, MFA, email, invitation, CMS, or assignment state', () => {
    const names = PortalIdentities.fields.flatMap((field) =>
      'name' in field ? [field.name] : [],
    );
    expect(names).toEqual(['authUserId', 'subjectType', 'staff', 'client']);
    for (const forbidden of [
      'status',
      'role',
      'mfaState',
      'email',
      'loginEmail',
      'contactEmail',
      'invitationState',
      'cmsUser',
      'assignmentState',
    ]) {
      expect(names).not.toContain(forbidden);
    }
  });

  it('does not accept matching email as binding evidence', () => {
    expect(() =>
      parsePortalIdentityPersistenceRecord({
        authUserId: 'auth_1',
        email: 'same@example.com',
        staff: 10,
        subjectType: 'staff',
      }),
    ).toThrowError(new PortalIdentityInvariantError('unexpected-field'));
  });

  it('is hidden and unavailable through ordinary Admin, REST, or GraphQL access', async () => {
    expect(PortalIdentities.admin?.hidden).toBe(true);
    expect(PortalIdentities.graphQL).toBe(false);
    expect(PortalIdentities.disableBulkDelete).toBe(true);
    expect(PortalIdentities.disableDuplicate).toBe(true);
    expect(PortalIdentities.auth).toBeUndefined();

    for (const operation of ['create', 'delete', 'read', 'update'] as const) {
      expect(await denyPortalIdentityAccess({} as never)).toBe(false);
      expect(PortalIdentities.access?.[operation]).toBe(
        denyPortalIdentityAccess,
      );
    }
  });
});
