import { describe, expect, it } from 'vitest';

import {
  AUTHORIZATION_DENIAL_CODES,
  isAuthorizationDecision,
  type AuthorizationDecision,
} from '../domain/decision';
import type {
  ClientPrincipal,
  StaffEnrollmentPrincipal,
  StaffPrincipal,
} from '../../portal-identity/domain/principal';
import type { StaffRole } from '../../portal-identity/domain/staff';
import {
  CLIENT_POLICY_FIELDS,
  CLIENT_POLICY_OPERATIONS,
  PRIMARY_OWNER_MUTATIONS,
  STAFF_POLICY_FIELDS,
  STAFF_POLICY_OPERATIONS,
} from './index';
import {
  createTrustedPolicyHarness,
  requiredClientId,
  requiredStaffId,
} from './__tests__/trusted-policy-harness';

function expectDenied(
  decision: AuthorizationDecision,
  reasonCode: (typeof AUTHORIZATION_DENIAL_CODES)[number],
): void {
  expect(decision).toEqual({ allowed: false, reasonCode });
}

describe('authorization policy semantics with test-only provenance', () => {
  const harness = createTrustedPolicyHarness();
  const { policies } = harness;
  const staffIds = {
    administrator: requiredStaffId(12),
    'case-worker': requiredStaffId(13),
    intake: requiredStaffId(14),
    owner: requiredStaffId(11),
  } satisfies Record<StaffRole, ReturnType<typeof requiredStaffId>>;

  function staff(role: StaffRole): StaffPrincipal {
    return harness.trustPrincipal({
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
  const client = harness.trustPrincipal({
    authUserId: 'auth-client-a',
    clientId: clientAId,
    kind: 'client',
    status: 'active',
  }) as ClientPrincipal;
  const enrollment = harness.trustPrincipal({
    allowedOperations: ['enroll-mfa', 'verify-mfa', 'sign-out'],
    authUserId: 'auth-enrollment',
    kind: 'staff-enrollment',
    staffId: requiredStaffId(20),
  }) as StaffEnrollmentPrincipal;
  const ordinaryStaffCreation = harness.trustStaffCreation({
    isPrimaryOwner: false,
    role: 'case-worker',
  });
  const ordinaryStaffTarget = harness.trustStaffResource({
    isPrimaryOwner: false,
    role: 'case-worker',
    staffId: staffIds['case-worker'],
  });
  const primaryOwnerTarget = harness.trustStaffResource({
    isPrimaryOwner: true,
    role: 'owner',
    staffId: staffIds.owner,
  });
  const matchingAssignment = harness.trustAssignment(
    [staffIds['case-worker']],
    clientAId,
  );
  const nonmatchingAssignment = harness.trustAssignment(
    [staffIds.administrator],
    clientAId,
  );
  const emptyAssignment = harness.trustAssignment([], clientAId);
  const ownClient = harness.trustOwnership(clientAId);
  const otherClient = harness.trustOwnership(clientBId);

  describe('Staff matrix and owner protection', () => {
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
    )('$role / $operation follows the role matrix', ({ role, operation }) => {
      const principal = staff(role);
      const evidence =
        operation === 'create'
          ? ordinaryStaffCreation
          : operation === 'disable' || operation === 'delete'
            ? ordinaryStaffTarget
            : role === 'case-worker' || role === 'intake'
              ? harness.trustStaffResource({
                  isPrimaryOwner: false,
                  role,
                  staffId: principal.staffId,
                })
              : ordinaryStaffTarget;
      expect(
        policies.decideStaffOperation(principal, operation, evidence).allowed,
      ).toBe(allowedByRole[role].includes(operation));
    });

    it.each(['case-worker', 'intake'] as const)(
      '%s reads self only with trusted target evidence',
      (role) => {
        const principal = staff(role);
        const ownTarget = harness.trustStaffResource({
          isPrimaryOwner: false,
          role,
          staffId: principal.staffId,
        });
        expect(
          policies.decideStaffOperation(principal, 'read', ownTarget),
        ).toEqual({ allowed: true });
        expectDenied(
          policies.decideStaffOperation(principal, 'read', primaryOwnerTarget),
          'forbidden-role',
        );
      },
    );

    it('protects primary owner operations in both normal and explicit policies', () => {
      const owner = staff('owner');
      const ownerCreation = harness.trustStaffCreation({
        isPrimaryOwner: true,
        role: 'owner',
      });
      expectDenied(
        policies.decideStaffOperation(owner, 'create', ownerCreation),
        'owner-protected',
      );
      expectDenied(
        policies.decideStaffOperation(owner, 'disable', primaryOwnerTarget),
        'owner-protected',
      );
      expectDenied(
        policies.decideStaffOperation(owner, 'delete', primaryOwnerTarget),
        'owner-protected',
      );
      for (const mutation of PRIMARY_OWNER_MUTATIONS) {
        expectDenied(
          policies.decidePrimaryOwnerMutation(owner, mutation),
          'owner-protected',
        );
      }
    });

    it('keeps Staff fields allowlisted', () => {
      for (const field of STAFF_POLICY_FIELDS) {
        expect(
          policies.decideStaffFieldUpdate(staff('owner'), field).allowed,
        ).toBe(['firstName', 'lastName', 'workEmail'].includes(field));
      }
      expectDenied(
        policies.decideStaffFieldUpdate(staff('owner'), 'unknown'),
        'field-restricted',
      );
    });
  });

  describe('Client matrix, ownership, assignment, and fields', () => {
    const expected: Record<
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
    )('$role / $operation follows the Client matrix', ({ role, operation }) => {
      expect(
        policies.decideClientOperation(
          staff(role),
          operation,
          role === 'case-worker' ? matchingAssignment : undefined,
        ).allowed,
      ).toBe(expected[role][operation]);
    });

    it('requires matching, non-empty assignment evidence for case workers', () => {
      const caseWorker = staff('case-worker');
      expect(
        policies.decideClientOperation(caseWorker, 'read', matchingAssignment),
      ).toEqual({ allowed: true });
      for (const evidence of [
        undefined,
        nonmatchingAssignment,
        emptyAssignment,
      ]) {
        expectDenied(
          policies.decideClientOperation(caseWorker, 'read', evidence),
          'assignment-required',
        );
      }
      expectDenied(
        policies.decideClientOperation(
          caseWorker,
          'create',
          matchingAssignment,
        ),
        'assignment-required',
      );

      const duplicateAssignment = harness.trustRawAssignment({
        assignedStaffIds: [caseWorker.staffId, caseWorker.staffId],
        clientId: clientAId,
      });
      const malformedAssignment = harness.trustRawAssignment({
        assignedStaffIds: [String(caseWorker.staffId)],
        clientId: clientAId,
      });
      for (const invalidEvidence of [
        duplicateAssignment,
        malformedAssignment,
      ]) {
        expectDenied(
          policies.decideClientOperation(caseWorker, 'read', invalidEvidence),
          'assignment-required',
        );
      }
    });

    it('allows Client self-read only with matching trusted ownership', () => {
      expect(policies.decideClientOperation(client, 'read', ownClient)).toEqual(
        {
          allowed: true,
        },
      );
      expectDenied(
        policies.decideClientOperation(client, 'read', otherClient),
        'ownership-required',
      );
      expectDenied(
        policies.decideClientOperation(client, 'basic-update', ownClient),
        'forbidden-role',
      );
      expectDenied(
        policies.decideClientOwnership(
          client,
          harness.trustRawOwnership({ clientId: String(clientAId) }),
        ),
        'ownership-required',
      );
    });

    it.each(['owner', 'administrator', 'intake'] as const)(
      '%s receives only the basic Client field allowlist',
      (role) => {
        for (const field of CLIENT_POLICY_FIELDS) {
          expect(
            policies.decideClientFieldUpdate(staff(role), field).allowed,
          ).toBe(
            ['firstName', 'lastName', 'contactEmail', 'phone'].includes(field),
          );
        }
      },
    );

    it('denies unknown operations and fields', () => {
      expectDenied(
        policies.decideClientOperation(staff('owner'), 'export-all'),
        'forbidden-role',
      );
      expectDenied(
        policies.decideClientFieldUpdate(staff('owner'), 'unknown'),
        'field-restricted',
      );
    });
  });

  describe('remaining operational boundaries', () => {
    it('allows only a trusted owner to read SecurityEvents', () => {
      for (const role of [
        'owner',
        'administrator',
        'case-worker',
        'intake',
      ] as const) {
        expect(policies.decideSecurityEventRead(staff(role)).allowed).toBe(
          role === 'owner',
        );
      }
    });

    it('denies all ordinary actions to a trusted enrollment principal', () => {
      const decisions = [
        policies.decideStaffOperation(enrollment, 'read'),
        policies.decideClientOperation(enrollment, 'read', ownClient),
        policies.decideClientFieldUpdate(enrollment, 'firstName', ownClient),
        policies.decideSecurityEventRead(enrollment),
        policies.decidePrimaryOwnerMutation(enrollment, 'delete'),
      ];
      for (const decision of decisions) {
        expectDenied(decision, 'forbidden-role');
      }
    });

    it('denies principal system operations without a separate system capability', () => {
      expectDenied(
        policies.decidePrincipalSystemOperation(
          staff('owner'),
          'primary-owner-bootstrap',
        ),
        'system-capability-required',
      );
    });

    it('uses specific denials only after runtime provenance succeeds', () => {
      const inactive = harness.trustRawPrincipal({
        authUserId: 'trusted-inactive-client',
        clientId: clientAId,
        kind: 'client',
        status: 'inactive',
      });
      const mfaIncomplete = harness.trustRawPrincipal({
        authUserId: 'trusted-mfa-incomplete',
        kind: 'staff',
        mfaAssurance: 'unverified',
        role: 'owner',
        staffId: staffIds.owner,
        status: 'active',
      });
      expectDenied(
        policies.decideClientOperation(inactive, 'read'),
        'inactive-subject',
      );
      expectDenied(
        policies.decideClientOperation(mfaIncomplete, 'read'),
        'mfa-required',
      );
      expectDenied(
        policies.decideClientOperation(undefined, 'read'),
        'unauthenticated',
      );
      expectDenied(
        policies.decideClientOperation(
          harness.trustRawPrincipal({ kind: 'staff', role: 'owner' }),
          'read',
        ),
        'invalid-principal',
      );
    });

    it('returns stable, frozen, non-sensitive decisions', () => {
      const decisions = [
        policies.decideClientOperation(client, 'read', otherClient),
        policies.decideClientOperation(staff('case-worker'), 'read'),
        policies.decideClientFieldUpdate(staff('owner'), 'authUserId'),
        policies.decideClientOperation(staff('owner'), 'read'),
      ];
      for (const decision of decisions) {
        expect(isAuthorizationDecision(decision)).toBe(true);
        expect(Object.isFrozen(decision)).toBe(true);
        expect(JSON.stringify(decision)).not.toContain('auth-');
      }
    });
  });
});
