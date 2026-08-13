import {
  parseAssignedClientResource,
  parseClientOwnedResource,
  type AssignedClientResource,
  type ClientOwnedResource,
} from '../../domain/resource-evidence';
import {
  parseClientId,
  parseStaffId,
  type ClientId,
  type StaffId,
} from '../../../portal-identity/domain/identifiers';
import {
  parsePortalPrincipal,
  type PortalPrincipal,
} from '../../../portal-identity/domain/principal';
import {
  createAuthorizationPolicies,
  type StaffCreationEvidence,
  type StaffResourceEvidence,
} from '../index';

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

export function requiredClientId(value: number): ClientId {
  const result = parseClientId(value);
  if (!result) throw new Error('invalid Client test ID');
  return result;
}

export function requiredStaffId(value: number): StaffId {
  const result = parseStaffId(value);
  if (!result) throw new Error('invalid Staff test ID');
  return result;
}

/** Test-only identity registries; production code has no equivalent issuer. */
export function createTrustedPolicyHarness() {
  const assignments = new WeakSet<object>();
  const ownershipFacts = new WeakSet<object>();
  const principals = new WeakSet<object>();
  const staffCreations = new WeakSet<object>();
  const staffResources = new WeakSet<object>();

  const policies = createAuthorizationPolicies({
    isTrustedAssignmentEvidence: (value) =>
      isObject(value) && assignments.has(value),
    isTrustedOwnershipEvidence: (value) =>
      isObject(value) && ownershipFacts.has(value),
    isTrustedPrincipal: (value) => isObject(value) && principals.has(value),
    isTrustedStaffCreationEvidence: (value) =>
      isObject(value) && staffCreations.has(value),
    isTrustedStaffResourceEvidence: (value) =>
      isObject(value) && staffResources.has(value),
  });

  function trustPrincipal(value: unknown): PortalPrincipal {
    const principal = parsePortalPrincipal(value);
    if (!principal) throw new Error('invalid trusted test principal');
    principals.add(principal);
    return principal;
  }

  function trustRawPrincipal<T extends object>(value: T): T {
    principals.add(value);
    return value;
  }

  function trustOwnership(clientId: ClientId): ClientOwnedResource {
    const evidence = parseClientOwnedResource({ clientId });
    if (!evidence) throw new Error('invalid trusted ownership test fact');
    ownershipFacts.add(evidence);
    return evidence;
  }

  function trustAssignment(
    assignedStaffIds: readonly StaffId[],
    clientId: ClientId,
  ): AssignedClientResource {
    const evidence = parseAssignedClientResource({
      assignedStaffIds,
      clientId,
    });
    if (!evidence) throw new Error('invalid trusted assignment test fact');
    assignments.add(evidence);
    return evidence;
  }

  function trustRawAssignment<T extends object>(value: T): T {
    assignments.add(value);
    return value;
  }

  function trustRawOwnership<T extends object>(value: T): T {
    ownershipFacts.add(value);
    return value;
  }

  function trustStaffCreation(
    evidence: StaffCreationEvidence,
  ): StaffCreationEvidence {
    staffCreations.add(evidence);
    return evidence;
  }

  function trustStaffResource(
    evidence: StaffResourceEvidence,
  ): StaffResourceEvidence {
    staffResources.add(evidence);
    return evidence;
  }

  return {
    policies,
    trustAssignment,
    trustOwnership,
    trustPrincipal,
    trustRawAssignment,
    trustRawOwnership,
    trustRawPrincipal,
    trustStaffCreation,
    trustStaffResource,
  };
}
