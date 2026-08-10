import { describe, expect, it } from 'vitest';

import {
  parsePortalPrincipal,
  parsePortalPrincipalKind,
  STAFF_ENROLLMENT_OPERATIONS,
} from './principal';

const validStaffPrincipal = {
  authUserId: 'auth_staff_1',
  kind: 'staff',
  mfaAssurance: 'verified',
  role: 'administrator',
  staffId: 10,
  status: 'active',
} as const;

const validClientPrincipal = {
  authUserId: 'auth_client_1',
  clientId: 20,
  kind: 'client',
  status: 'active',
} as const;

describe('provider-independent portal principals', () => {
  it('parses a fully authorized active, MFA-verified Staff principal', () => {
    expect(parsePortalPrincipal(validStaffPrincipal)).toEqual(
      validStaffPrincipal,
    );
  });

  it('parses a minimal active Client principal', () => {
    expect(parsePortalPrincipal(validClientPrincipal)).toEqual(
      validClientPrincipal,
    );
  });

  it('parses a narrow Staff enrollment principal', () => {
    expect(
      parsePortalPrincipal({
        allowedOperations: ['enroll-mfa', 'verify-mfa', 'sign-out'],
        authUserId: 'auth_staff_2',
        kind: 'staff-enrollment',
        staffId: 11,
      }),
    ).toEqual({
      allowedOperations: STAFF_ENROLLMENT_OPERATIONS,
      authUserId: 'auth_staff_2',
      kind: 'staff-enrollment',
      staffId: 11,
    });
  });

  it.each(['staff', 'client', 'staff-enrollment'])(
    'accepts principal discriminant %s',
    (kind) => {
      expect(parsePortalPrincipalKind(kind)).toBe(kind);
    },
  );

  it.each(['cms-user', 'anonymous', 'system', 'unknown', null])(
    'rejects malformed principal discriminant %s',
    (kind) => {
      expect(parsePortalPrincipalKind(kind)).toBeUndefined();
    },
  );

  it('rejects Client principals containing Staff authority', () => {
    expect(
      parsePortalPrincipal({ ...validClientPrincipal, role: 'owner' }),
    ).toBeUndefined();
    expect(
      parsePortalPrincipal({ ...validClientPrincipal, staffId: 10 }),
    ).toBeUndefined();
    expect(
      parsePortalPrincipal({
        ...validClientPrincipal,
        assignedStaffIds: [10],
      }),
    ).toBeUndefined();
  });

  it('rejects missing, false, or provider-shaped Staff MFA assurance', () => {
    expect(
      parsePortalPrincipal({
        authUserId: validStaffPrincipal.authUserId,
        kind: validStaffPrincipal.kind,
        role: validStaffPrincipal.role,
        staffId: validStaffPrincipal.staffId,
        status: validStaffPrincipal.status,
      }),
    ).toBeUndefined();
    expect(
      parsePortalPrincipal({
        ...validStaffPrincipal,
        mfaAssurance: false,
      }),
    ).toBeUndefined();
    expect(
      parsePortalPrincipal({
        ...validStaffPrincipal,
        twoFactorEnabled: true,
      }),
    ).toBeUndefined();
  });

  it('cannot represent inactive Staff as a privileged Staff principal', () => {
    expect(
      parsePortalPrincipal({ ...validStaffPrincipal, status: 'disabled' }),
    ).toBeUndefined();
  });

  it('rejects malformed and provider-specific fields rather than granting authority', () => {
    expect(
      parsePortalPrincipal({ ...validStaffPrincipal, kind: 'user' }),
    ).toBeUndefined();
    expect(
      parsePortalPrincipal({ ...validStaffPrincipal, staffId: '10' }),
    ).toBeUndefined();
    expect(
      parsePortalPrincipal({ ...validStaffPrincipal, sessionToken: 'secret' }),
    ).toBeUndefined();
    expect(
      parsePortalPrincipal({ ...validStaffPrincipal, verified: true }),
    ).toBeUndefined();
  });

  it('requires the complete enrollment-only operation set', () => {
    expect(
      parsePortalPrincipal({
        allowedOperations: ['enroll-mfa', 'sign-out'],
        authUserId: 'auth_staff_2',
        kind: 'staff-enrollment',
        staffId: 11,
      }),
    ).toBeUndefined();
    expect(
      parsePortalPrincipal({
        allowedOperations: [
          'enroll-mfa',
          'verify-mfa',
          'sign-out',
          'administer',
        ],
        authUserId: 'auth_staff_2',
        kind: 'staff-enrollment',
        staffId: 11,
      }),
    ).toBeUndefined();
  });
});
