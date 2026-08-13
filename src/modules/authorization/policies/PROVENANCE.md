# Authorization provenance boundary

`createAuthorizationPolicies()` evaluates policy only after a trusted
composition layer supplies runtime provenance predicates. Agent 8 intentionally
does not provide a production issuer, registry, permissive predicate, or
assignment source.

Agents 10 and 11 must compose the predicates as follows:

- `isTrustedPrincipal`: accept only the canonical principal resolved from a
  server-validated session and recognized by Agent 1's runtime attestation.
- `isTrustedOwnershipEvidence`: accept only canonical resource ownership loaded
  inside the trusted gateway boundary and bound to the same operation.
- `isTrustedAssignmentEvidence`: accept only canonical assignment facts from a
  future trusted assignment repository. Slice 1 has no such repository, so its
  normal production implementation must deny every value.
- `isTrustedStaffCreationEvidence` and `isTrustedStaffResourceEvidence`: accept
  only canonical Staff target facts loaded or constructed inside the trusted
  service/gateway operation, never request data.

Every predicate establishes provenance only. Agent 8 then independently checks
the Agent 2 shape contracts, role matrix, ownership or assignment match,
field allowlists, and owner protections. Parser success, branded IDs, exact
shape, `Object.freeze()`, and caller-provided IDs or arrays must never cause a
predicate to return true.

The predicates should recognize values through the downstream runtime
capability/attestation design. Do not implement them as parser wrappers. No
Payload, Better Auth, session, HTTP, or database dependency belongs in this
policy package.
