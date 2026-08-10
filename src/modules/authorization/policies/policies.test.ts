import { describe, expect, it } from 'vitest';

import {
  AUTHORIZATION_DENIAL_CODES,
  isAuthorizationDecision,
} from '../domain/decision';
import {
  parseAssignedClientResource,
  parseClientOwnedResource,
  type AssignedClientResource,
  type ClientOwnedResource,
} from '../domain/resource-evidence';
import {
  parseClientId,
  parseStaffId,
  type ClientId,
  type StaffId,
} from '../../portal-identity/domain/identifiers';
import {
  parsePortalPrincipal,
  type ClientPrincipal,
  type PortalPrincipal,
  type StaffEnrollmentPrincipal,
  type StaffPrincipal,
} from '../../portal-identity/domain/principal';
import type { StaffRole } from '../../portal-identity/domain/staff';
import {
  CLIENT_POLICY_FIELDS,
  CLIENT_POLICY_OPERATIONS,
  decideClientAssignment,
  decideClientFieldUpdate,
  decideClientOperation,
  decideClientOwnership,
  decidePrimaryOwnerMutation,
  decidePrincipalSystemOperation,
  decideSecurityEventRead,
  decideStaffFieldUpdate,
  decideStaffOperation,
  parseStaffCreationEvidence,
  parseStaffResourceEvidence,
  PRIMARY_OWNER_MUTATIONS,
  STAFF_POLICY_FIELDS,
  STAFF_POLICY_OPERATIONS,
} from './index';

function requiredClientId(value: number): ClientId {
  const result = parseClientId(value);
  if (!result) throw new Error('invalid Client test ID');
  return result;
}

function requiredStaffId(value: number): StaffId {
  const result = parseStaffId(value);
  if (!result) throw new Error('invalid Staff test ID');
  return result;
}

function requiredPrincipal(value: unknown): PortalPrincipal {
  const result = parsePortalPrincipal(value);
  if (!result) throw new Error('invalid test principal');
  return result;
}

const staffIds = {
  administrator: requiredStaffId(12),
  'case-worker': requiredStaffId(13),
  intake: requiredStaffId(14),
  owner: requiredStaffId(11),
} satisfies Record<StaffRole, StaffId>;

function staffPrincipal(role: StaffRole): StaffPrincipal {
  return requiredPrincipal({
    authUserId: `auth-${role}`,
    kind: 'staff',
    mfaAssurance: 'verified',
    role,
    staffId: staffIds[role],
    status: 'active',
  }) as StaffPrincipal;
}

const clientAId = requiredClientId(101);
const clientBId = requiredClientId(102);

const clientPrincipal = requiredPrincipal({
  authUserId: 'auth-client-a',
  clientId: clientAId,
  kind: 'client',
  status: 'active',
}) as ClientPrincipal;

const enrollmentPrincipal = requiredPrincipal({
  allowedOperations: ['enroll-mfa', 'verify-mfa', 'sign-out'],
  authUserId: 'auth-enrollment',
  kind: 'staff-enrollment',
  staffId: requiredStaffId(20),
}) as StaffEnrollmentPrincipal;

function ownership(clientId: ClientId): ClientOwnedResource {
  const result = parseClientOwnedResource({ clientId });
  if (!result) throw new Error('invalid ownership test evidence');
  return result;
}

function assignment(
  assignedStaffIds: readonly StaffId[],
  clientId: ClientId = clientAId,
): AssignedClientResource {
  const result = parseAssignedClientResource({ assignedStaffIds, clientId });
  if (!result) throw new Error('invalid assignment test evidence');
  return result;
}

const ownClient = ownership(clientAId);
const otherClient = ownership(clientBId);
const matchingAssignment = assignment([staffIds['case-worker']]);
const nonmatchingAssignment = assignment([staffIds.administrator]);

const ordinaryStaffCreation = parseStaffCreationEvidence({
  isPrimaryOwner: false,
  role: 'case-worker',
});
const ordinaryStaffTarget = parseStaffResourceEvidence({
  isPrimaryOwner: false,
  role: 'case-worker',
  staffId: staffIds['case-worker'],
});
const primaryOwnerTarget = parseStaffResourceEvidence({
  isPrimaryOwner: true,
  role: 'owner',
  staffId: staffIds.owner,
});

if (!ordinaryStaffCreation || !ordinaryStaffTarget || !primaryOwnerTarget) {
  throw new Error('invalid Staff policy test evidence');
}

function expectDenied(
  decision: ReturnType<typeof decideClientOperation>,
  reasonCode?: (typeof AUTHORIZATION_DENIAL_CODES)[number],
): void {
  expect(decision.allowed).toBe(false);
  if (!decision.allowed && reasonCode) {
    expect(decision.reasonCode).toBe(reasonCode);
  }
}

describe('Staff operation policy', () => {
  const allowedByRole: Record<StaffRole, readonly string[]> = {
    administrator: ['read'],
    'case-worker': ['read'],
    intake: ['read'],
    owner: STAFF_POLICY_OPERATIONS,
  };

  it.each(
    (['owner', 'administrator', 'case-worker', 'intake'] as const).flatMap(
      (role) =>
        STAFF_POLICY_OPERATIONS.map((operation) => ({ operation, role })),
    ),
  )(
    '$role / $operation follows the complete role matrix',
    ({ role, operation }) => {
      const principal = staffPrincipal(role);
      const target =
        operation === 'create'
          ? ordinaryStaffCreation
          : operation === 'disable' || operation === 'delete'
            ? ordinaryStaffTarget
            : role === 'case-worker' || role === 'intake'
              ? principal.staffId
              : staffIds.owner;
      const decision = decideStaffOperation(principal, operation, target);

      expect(decision.allowed).toBe(allowedByRole[role].includes(operation));
    },
  );

  it.each(['case-worker', 'intake'] as const)(
    '%s can read self but not another Staff record',
    (role) => {
      const principal = staffPrincipal(role);
      expect(
        decideStaffOperation(principal, 'read', principal.staffId),
      ).toEqual({ allowed: true });
      expectDenied(
        decideStaffOperation(principal, 'read', staffIds.owner),
        'forbidden-role',
      );
    },
  );

  it('denies missing self-read evidence and unknown operations', () => {
    expectDenied(
      decideStaffOperation(staffPrincipal('case-worker'), 'read'),
      'forbidden-role',
    );
    expectDenied(
      decideStaffOperation(staffPrincipal('owner'), 'impersonate'),
      'forbidden-role',
    );
  });

  it('fails closed when ordinary management lacks canonical target evidence', () => {
    const owner = staffPrincipal('owner');
    expectDenied(decideStaffOperation(owner, 'create'), 'owner-protected');
    expectDenied(
      decideStaffOperation(owner, 'disable', {
        isPrimaryOwner: false,
        role: 'case-worker',
        staffId: staffIds['case-worker'],
      }),
      'owner-protected',
    );
  });

  it('denies primary-owner create, disable, and delete in the normal Staff policy', () => {
    const owner = staffPrincipal('owner');
    const primaryOwnerCreation = parseStaffCreationEvidence({
      isPrimaryOwner: true,
      role: 'owner',
    });
    if (!primaryOwnerCreation)
      throw new Error('invalid primary owner evidence');

    expectDenied(
      decideStaffOperation(owner, 'create', primaryOwnerCreation),
      'owner-protected',
    );
    expectDenied(
      decideStaffOperation(owner, 'disable', primaryOwnerTarget),
      'owner-protected',
    );
    expectDenied(
      decideStaffOperation(owner, 'delete', primaryOwnerTarget),
      'owner-protected',
    );
  });

  it('protects Staff role, status, owner marker, identity bindings, and server fields', () => {
    for (const field of STAFF_POLICY_FIELDS) {
      expect(
        decideStaffFieldUpdate(staffPrincipal('owner'), field).allowed,
      ).toBe(['firstName', 'lastName', 'workEmail'].includes(field));
    }
    expectDenied(
      decideStaffFieldUpdate(staffPrincipal('owner'), 'unknownField'),
      'field-restricted',
    );
  });
});

describe('Client row policy', () => {
  const staffExpectations: Record<
    StaffRole,
    Record<(typeof CLIENT_POLICY_OPERATIONS)[number], boolean>
  > = {
    administrator: { 'basic-update': true, create: true, read: true },
    'case-worker': { 'basic-update': true, create: false, read: true },
    intake: { 'basic-update': true, create: true, read: true },
    owner: { 'basic-update': true, create: true, read: true },
  };

  it.each(
    (['owner', 'administrator', 'case-worker', 'intake'] as const).flatMap(
      (role) =>
        CLIENT_POLICY_OPERATIONS.map((operation) => ({ operation, role })),
    ),
  )(
    '$role / $operation follows the complete role matrix',
    ({ role, operation }) => {
      const evidence = role === 'case-worker' ? matchingAssignment : undefined;
      const decision = decideClientOperation(
        staffPrincipal(role),
        operation,
        evidence,
      );

      expect(decision.allowed).toBe(staffExpectations[role][operation]);
    },
  );

  it('gives a case worker zero Client access without assignment evidence', () => {
    for (const operation of CLIENT_POLICY_OPERATIONS) {
      expectDenied(
        decideClientOperation(staffPrincipal('case-worker'), operation),
        'assignment-required',
      );
    }
  });

  it('denies nonmatching, empty, duplicate, and malformed assignments', () => {
    const caseWorker = staffPrincipal('case-worker');
    expectDenied(
      decideClientOperation(caseWorker, 'read', nonmatchingAssignment),
      'assignment-required',
    );
    expectDenied(
      decideClientOperation(caseWorker, 'read', assignment([])),
      'assignment-required',
    );
    expectDenied(
      decideClientOperation(
        caseWorker,
        'read',
        Object.freeze({
          assignedStaffIds: Object.freeze([
            caseWorker.staffId,
            caseWorker.staffId,
          ]),
          clientId: clientAId,
        }),
      ),
      'assignment-required',
    );
    expectDenied(
      decideClientOperation(
        caseWorker,
        'read',
        Object.freeze({
          assignedStaffIds: Object.freeze(['13']),
          clientId: clientAId,
        }),
      ),
      'assignment-required',
    );
  });

  it('allows a Client to read only the Client bound in trusted evidence', () => {
    expect(decideClientOperation(clientPrincipal, 'read', ownClient)).toEqual({
      allowed: true,
    });
    expectDenied(
      decideClientOperation(clientPrincipal, 'read', otherClient),
      'ownership-required',
    );
    expectDenied(
      decideClientOperation(clientPrincipal, 'read'),
      'ownership-required',
    );
  });

  it('keeps Client create and self-editing not applicable in Slice 1', () => {
    expectDenied(
      decideClientOperation(clientPrincipal, 'create', ownClient),
      'forbidden-role',
    );
    expectDenied(
      decideClientOperation(clientPrincipal, 'basic-update', ownClient),
      'forbidden-role',
    );
  });

  it('denies an unknown Client operation', () => {
    expectDenied(
      decideClientOperation(staffPrincipal('owner'), 'export-all'),
      'forbidden-role',
    );
  });
});

describe('ownership and assignment evidence policies', () => {
  it('does not infer ownership or assignment from a mutable browser-like shape', () => {
    expectDenied(
      decideClientOwnership(clientPrincipal, { clientId: clientAId }),
      'ownership-required',
    );
    expectDenied(
      decideClientAssignment(staffPrincipal('case-worker'), {
        assignedStaffIds: [staffIds['case-worker']],
        clientId: clientAId,
      }),
      'assignment-required',
    );
  });

  it('does not infer ownership from email or a caller-selected target ID', () => {
    expectDenied(
      decideClientOwnership(clientPrincipal, {
        clientId: clientAId,
        email: 'client@example.test',
      }),
      'ownership-required',
    );
    expectDenied(
      decideClientOwnership(clientPrincipal, clientAId),
      'ownership-required',
    );
  });
});

describe('Client field policy', () => {
  it.each(['owner', 'administrator', 'intake'] as const)(
    '%s may update only the basic Client field allowlist',
    (role) => {
      for (const field of CLIENT_POLICY_FIELDS) {
        const decision = decideClientFieldUpdate(staffPrincipal(role), field);
        expect(decision.allowed).toBe(
          ['firstName', 'lastName', 'contactEmail', 'phone'].includes(field),
        );
      }
    },
  );

  it('applies assignment before fields for case workers', () => {
    expect(
      decideClientFieldUpdate(
        staffPrincipal('case-worker'),
        'firstName',
        matchingAssignment,
      ),
    ).toEqual({ allowed: true });
    expectDenied(
      decideClientFieldUpdate(
        staffPrincipal('case-worker'),
        'firstName',
        nonmatchingAssignment,
      ),
      'assignment-required',
    );
  });

  it.each([
    'id',
    'clientNumber',
    'status',
    'authUserId',
    'portalIdentity',
    'createdAt',
    'updatedAt',
    'role',
    'isPrimaryOwner',
    'unknownField',
  ])('denies protected or unknown field %s', (field) => {
    expectDenied(
      decideClientFieldUpdate(staffPrincipal('owner'), field),
      'field-restricted',
    );
  });
});

describe('owner and system protection', () => {
  it.each(PRIMARY_OWNER_MUTATIONS)(
    'denies normal owner %s of the protected primary owner',
    (mutation) => {
      expectDenied(
        decidePrimaryOwnerMutation(staffPrincipal('owner'), mutation),
        'owner-protected',
      );
    },
  );

  it('denies administrator owner escalation and provider-like operations', () => {
    expectDenied(
      decidePrimaryOwnerMutation(staffPrincipal('administrator'), 'promote'),
      'owner-protected',
    );
    expectDenied(
      decidePrincipalSystemOperation(
        staffPrincipal('administrator'),
        'primary-owner-bootstrap',
      ),
      'system-capability-required',
    );
    expectDenied(
      decidePrincipalSystemOperation(staffPrincipal('owner'), 'ban-auth-user'),
      'forbidden-role',
    );
  });
});

describe('SecurityEvent policy', () => {
  it.each(['owner', 'administrator', 'case-worker', 'intake'] as const)(
    'applies the owner-only read boundary to %s',
    (role) => {
      expect(decideSecurityEventRead(staffPrincipal(role)).allowed).toBe(
        role === 'owner',
      );
    },
  );

  it('denies Client reads', () => {
    expectDenied(decideSecurityEventRead(clientPrincipal), 'forbidden-role');
  });
});

describe('fail-closed principal and result behavior', () => {
  it('denies enrollment-only principals across ordinary policy areas', () => {
    const decisions = [
      decideStaffOperation(enrollmentPrincipal, 'read'),
      decideClientOperation(enrollmentPrincipal, 'read', ownClient),
      decideClientFieldUpdate(enrollmentPrincipal, 'firstName', ownClient),
      decideSecurityEventRead(enrollmentPrincipal),
      decidePrimaryOwnerMutation(enrollmentPrincipal, 'delete'),
    ];

    for (const decision of decisions) {
      expectDenied(decision, 'forbidden-role');
    }
  });

  it('uses stable denials for absent, inactive, MFA-incomplete, and malformed principals', () => {
    expectDenied(decideClientOperation(undefined, 'read'), 'unauthenticated');
    expectDenied(
      decideClientOperation(
        { ...staffPrincipal('owner'), status: 'disabled' },
        'read',
      ),
      'inactive-subject',
    );
    expectDenied(
      decideClientOperation(
        { ...staffPrincipal('owner'), mfaAssurance: 'unverified' },
        'read',
      ),
      'mfa-required',
    );
    expectDenied(
      decideClientOperation({ kind: 'staff', role: 'owner' }, 'read'),
      'invalid-principal',
    );
  });

  it('returns only stable, non-sensitive AuthorizationDecision data', () => {
    const decisions = [
      decideClientOperation(clientPrincipal, 'read', otherClient),
      decideClientOperation(staffPrincipal('case-worker'), 'read'),
      decideClientFieldUpdate(staffPrincipal('owner'), 'authUserId'),
      decidePrimaryOwnerMutation(staffPrincipal('owner'), 'delete'),
      decideClientOperation(staffPrincipal('owner'), 'read'),
    ];

    for (const decision of decisions) {
      expect(isAuthorizationDecision(decision)).toBe(true);
      expect(Object.isFrozen(decision)).toBe(true);
      expect(Object.keys(decision).sort()).toEqual(
        decision.allowed ? ['allowed'] : ['allowed', 'reasonCode'],
      );
      expect(JSON.stringify(decision)).not.toContain('auth-');
      expect(JSON.stringify(decision)).not.toContain('example.test');
      if (!decision.allowed) {
        expect(AUTHORIZATION_DENIAL_CODES).toContain(decision.reasonCode);
      }
    }
  });
});
