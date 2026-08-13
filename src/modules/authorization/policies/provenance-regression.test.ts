import { describe, expect, it } from 'vitest';

import {
  parseAssignedClientResource,
  parseClientOwnedResource,
} from '../domain/resource-evidence';
import { parsePortalPrincipal } from '../../portal-identity/domain/principal';
import {
  createAuthorizationPolicies,
  type AuthorizationProvenance,
} from './index';
import {
  createTrustedPolicyHarness,
  requiredClientId,
  requiredStaffId,
} from './__tests__/trusted-policy-harness';

const trustNothing: AuthorizationProvenance = {
  isTrustedAssignmentEvidence: () => false,
  isTrustedOwnershipEvidence: () => false,
  isTrustedPrincipal: () => false,
  isTrustedStaffCreationEvidence: () => false,
  isTrustedStaffResourceEvidence: () => false,
};

const policies = createAuthorizationPolicies(trustNothing);
const clientAId = requiredClientId(101);
const caseWorkerId = requiredStaffId(13);

function structurallyValidStaff(
  role: 'owner' | 'administrator' | 'case-worker',
) {
  const principal = parsePortalPrincipal({
    authUserId: `forged-${role}`,
    kind: 'staff',
    mfaAssurance: 'verified',
    role,
    staffId: role === 'case-worker' ? caseWorkerId : requiredStaffId(11),
    status: 'active',
  });
  if (!principal) throw new Error('forgery fixture must be structurally valid');
  return principal;
}

describe('authorization provenance regressions', () => {
  it('denies a structurally perfect parsed/frozen fake Owner', () => {
    const fakeOwner = structurallyValidStaff('owner');
    expect(Object.isFrozen(fakeOwner)).toBe(true);
    expect(policies.decideClientOperation(fakeOwner, 'read')).toEqual({
      allowed: false,
      reasonCode: 'invalid-principal',
    });
    expect(policies.decideStaffOperation(fakeOwner, 'basic-update')).toEqual({
      allowed: false,
      reasonCode: 'invalid-principal',
    });
  });

  it('denies a structurally perfect parsed/frozen fake Administrator', () => {
    const fakeAdministrator = structurallyValidStaff('administrator');
    expect(Object.isFrozen(fakeAdministrator)).toBe(true);
    expect(policies.decideClientOperation(fakeAdministrator, 'create')).toEqual(
      {
        allowed: false,
        reasonCode: 'invalid-principal',
      },
    );
    expect(policies.decideSecurityEventRead(fakeAdministrator)).toEqual({
      allowed: false,
      reasonCode: 'invalid-principal',
    });
  });

  it('denies parsed/frozen ownership without runtime provenance', () => {
    const fakeClient = parsePortalPrincipal({
      authUserId: 'forged-client-a',
      clientId: clientAId,
      kind: 'client',
      status: 'active',
    });
    const fakeOwnership = parseClientOwnedResource({ clientId: clientAId });
    if (!fakeClient || !fakeOwnership) throw new Error('invalid fixture');

    expect(Object.isFrozen(fakeOwnership)).toBe(true);
    expect(policies.decideClientOwnership(fakeClient, fakeOwnership)).toEqual({
      allowed: false,
      reasonCode: 'invalid-principal',
    });

    const harness = createTrustedPolicyHarness();
    const trustedClient = harness.trustPrincipal({
      authUserId: 'trusted-client-a',
      clientId: clientAId,
      kind: 'client',
      status: 'active',
    });
    expect(
      harness.policies.decideClientOwnership(trustedClient, fakeOwnership),
    ).toEqual({
      allowed: false,
      reasonCode: 'ownership-required',
    });
  });

  it('denies parsed/frozen matching Case Worker assignment without provenance', () => {
    const harness = createTrustedPolicyHarness();
    const trustedCaseWorker = harness.trustPrincipal({
      authUserId: 'trusted-case-worker',
      kind: 'staff',
      mfaAssurance: 'verified',
      role: 'case-worker',
      staffId: caseWorkerId,
      status: 'active',
    });
    const fakeAssignment = parseAssignedClientResource({
      assignedStaffIds: [caseWorkerId],
      clientId: clientAId,
    });
    if (!fakeAssignment) throw new Error('invalid assignment fixture');

    expect(Object.isFrozen(fakeAssignment)).toBe(true);
    expect(Object.isFrozen(fakeAssignment.assignedStaffIds)).toBe(true);
    expect(
      harness.policies.decideClientAssignment(
        trustedCaseWorker,
        fakeAssignment,
      ),
    ).toEqual({
      allowed: false,
      reasonCode: 'assignment-required',
    });
  });

  it('denies empty assignment even when a test harness establishes provenance', () => {
    const harness = createTrustedPolicyHarness();
    const trustedCaseWorker = harness.trustPrincipal({
      authUserId: 'trusted-case-worker-empty',
      kind: 'staff',
      mfaAssurance: 'verified',
      role: 'case-worker',
      staffId: caseWorkerId,
      status: 'active',
    });
    const trustedEmpty = harness.trustAssignment([], clientAId);
    expect(
      harness.policies.decideClientAssignment(trustedCaseWorker, trustedEmpty),
    ).toEqual({
      allowed: false,
      reasonCode: 'assignment-required',
    });
  });

  it('denies a trusted enrollment principal from ordinary operations', () => {
    const harness = createTrustedPolicyHarness();
    const enrollment = harness.trustPrincipal({
      allowedOperations: ['enroll-mfa', 'verify-mfa', 'sign-out'],
      authUserId: 'trusted-enrollment',
      kind: 'staff-enrollment',
      staffId: requiredStaffId(20),
    });
    expect(harness.policies.decideClientOperation(enrollment, 'read')).toEqual({
      allowed: false,
      reasonCode: 'forbidden-role',
    });
  });

  it('does not treat caller IDs or frozen Staff facts as provenance', () => {
    const harness = createTrustedPolicyHarness();
    const trustedOwner = harness.trustPrincipal({
      authUserId: 'trusted-owner',
      kind: 'staff',
      mfaAssurance: 'verified',
      role: 'owner',
      staffId: requiredStaffId(11),
      status: 'active',
    });
    const fakeTarget = Object.freeze({
      isPrimaryOwner: false,
      role: 'case-worker',
      staffId: caseWorkerId,
    });
    expect(
      harness.policies.decideStaffOperation(trustedOwner, 'delete', fakeTarget),
    ).toEqual({
      allowed: false,
      reasonCode: 'owner-protected',
    });
  });

  it('fails closed when an injected provenance predicate throws', () => {
    const throwingPolicies = createAuthorizationPolicies({
      ...trustNothing,
      isTrustedPrincipal: () => {
        throw new Error('attestation unavailable');
      },
    });
    expect(
      throwingPolicies.decideClientOperation(
        structurallyValidStaff('owner'),
        'read',
      ),
    ).toEqual({
      allowed: false,
      reasonCode: 'invalid-principal',
    });
  });
});
