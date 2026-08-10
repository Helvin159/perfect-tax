import { describe, expect, expectTypeOf, it } from 'vitest';

import { parseClientStatus } from './client';
import type {
  ContactEmail,
  IntendedEmail,
  LoginEmail,
  WorkEmail,
} from './email-ownership';
import { parseAuthUserId, parseClientId, parseStaffId } from './identifiers';
import {
  parsePortalIdentity,
  parsePortalSubjectKind,
  type PortalIdentity,
} from './portal-identity';
import { parseStaffRole, parseStaffStatus } from './staff';

describe('Staff role contract', () => {
  it.each(['owner', 'administrator', 'case-worker', 'intake'])(
    'accepts %s',
    (role) => {
      expect(parseStaffRole(role)).toBe(role);
    },
  );

  it.each([
    'content-editor',
    'editor',
    'publisher',
    'cms-admin',
    'admin',
    'client',
    'OWNER',
    'unknown',
    null,
    undefined,
  ])('rejects %s', (role) => {
    expect(parseStaffRole(role)).toBeUndefined();
  });
});

describe('domain status contracts', () => {
  it.each(['active', 'disabled'])('accepts Staff status %s', (status) => {
    expect(parseStaffStatus(status)).toBe(status);
  });

  it.each(['invited', 'pending', 'mfa-enrollment-required'])(
    'rejects Staff status %s',
    (status) => {
      expect(parseStaffStatus(status)).toBeUndefined();
    },
  );

  it.each(['active', 'inactive'])('accepts Client status %s', (status) => {
    expect(parseClientStatus(status)).toBe(status);
  });

  it.each(['invited', 'disabled', 'portal-active'])(
    'rejects Client status %s',
    (status) => {
      expect(parseClientStatus(status)).toBeUndefined();
    },
  );
});

describe('PortalIdentity contract', () => {
  it.each(['staff', 'client'])('accepts subject kind %s', (kind) => {
    expect(parsePortalSubjectKind(kind)).toBe(kind);
  });

  it.each(['cms-user', 'anonymous', 'system', 'staff-enrollment'])(
    'rejects subject kind %s',
    (kind) => {
      expect(parsePortalSubjectKind(kind)).toBeUndefined();
    },
  );

  it('parses exactly one immutable Staff or Client binding', () => {
    expect(
      parsePortalIdentity({
        authUserId: 'auth_staff_1',
        staffId: 10,
        subjectKind: 'staff',
      }),
    ).toEqual({
      authUserId: 'auth_staff_1',
      staffId: 10,
      subjectKind: 'staff',
    });
    expect(
      parsePortalIdentity({
        authUserId: 'auth_client_1',
        clientId: 20,
        subjectKind: 'client',
      }),
    ).toEqual({
      authUserId: 'auth_client_1',
      clientId: 20,
      subjectKind: 'client',
    });
  });

  it('has no shared lifecycle status and rejects attempts to add one', () => {
    expectTypeOf<PortalIdentity>().not.toHaveProperty('status');
    expect(
      parsePortalIdentity({
        authUserId: 'auth_staff_1',
        staffId: 10,
        status: 'active',
        subjectKind: 'staff',
      }),
    ).toBeUndefined();
  });

  it('rejects dual-subject and malformed bindings', () => {
    expect(
      parsePortalIdentity({
        authUserId: 'auth_1',
        clientId: 20,
        staffId: 10,
        subjectKind: 'staff',
      }),
    ).toBeUndefined();
    expect(
      parsePortalIdentity({
        authUserId: 'auth_1',
        subjectKind: 'staff',
        staffId: 0,
      }),
    ).toBeUndefined();
  });
});

describe('identifier contracts', () => {
  it('accepts provider IDs and positive Payload domain IDs', () => {
    expect(parseAuthUserId('auth_123')).toBe('auth_123');
    expect(parseStaffId(1)).toBe(1);
    expect(parseClientId(Number.MAX_SAFE_INTEGER)).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });

  it.each(['', ' auth_123', 'auth_123 ', null, undefined, 123])(
    'rejects malformed AuthUserId %s',
    (value) => {
      expect(parseAuthUserId(value)).toBeUndefined();
    },
  );

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '1', null])(
    'rejects malformed domain ID %s',
    (value) => {
      expect(parseStaffId(value)).toBeUndefined();
      expect(parseClientId(value)).toBeUndefined();
    },
  );
});

describe('email ownership vocabulary', () => {
  it('keeps authentication, profile, contact, and invitation emails distinct', () => {
    expectTypeOf<LoginEmail>().not.toEqualTypeOf<WorkEmail>();
    expectTypeOf<LoginEmail>().not.toEqualTypeOf<ContactEmail>();
    expectTypeOf<LoginEmail>().not.toEqualTypeOf<IntendedEmail>();
    expectTypeOf<WorkEmail>().not.toEqualTypeOf<ContactEmail>();
  });
});
