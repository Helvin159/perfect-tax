/**
 * Runtime provenance predicates supplied by the trusted Agent 10/11
 * composition boundary.
 *
 * These predicates must validate runtime attestation or canonical facts. They
 * must never return true because a value parses, has branded TypeScript IDs,
 * is frozen, or has an expected object shape. Agent 8 deliberately provides
 * no production issuer or permissive default implementation.
 */
export type AuthorizationProvenance = Readonly<{
  isTrustedAssignmentEvidence(value: unknown): boolean;
  isTrustedOwnershipEvidence(value: unknown): boolean;
  isTrustedPrincipal(value: unknown): boolean;
  isTrustedStaffCreationEvidence(value: unknown): boolean;
  isTrustedStaffResourceEvidence(value: unknown): boolean;
}>;

type ProvenancePredicateName = keyof AuthorizationProvenance;

const denyProvenance = () => false;

/** Converts missing, throwing, or non-boolean predicates into fail-closed predicates. */
export function normalizeAuthorizationProvenance(
  provenance: AuthorizationProvenance,
): AuthorizationProvenance {
  const source: Partial<Record<ProvenancePredicateName, unknown>> = provenance;

  function readPredicate(name: ProvenancePredicateName) {
    const candidate = source?.[name];
    if (typeof candidate !== 'function') return denyProvenance;

    return (value: unknown) => {
      try {
        return candidate(value) === true;
      } catch {
        return false;
      }
    };
  }

  return {
    isTrustedAssignmentEvidence: readPredicate('isTrustedAssignmentEvidence'),
    isTrustedOwnershipEvidence: readPredicate('isTrustedOwnershipEvidence'),
    isTrustedPrincipal: readPredicate('isTrustedPrincipal'),
    isTrustedStaffCreationEvidence: readPredicate(
      'isTrustedStaffCreationEvidence',
    ),
    isTrustedStaffResourceEvidence: readPredicate(
      'isTrustedStaffResourceEvidence',
    ),
  };
}
