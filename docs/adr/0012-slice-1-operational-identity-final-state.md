# ADR 0012: Slice 1 operational identity final state

- Status: Accepted
- Date: 2026-09-02
- Supersedes: operational final-state guidance in ADR 0010 and the historical Phase 1 assumptions in ADR 0011

## Context

ADRs 0010 and 0011 preserve important compatibility and Phase 1 history, but their original text predates the merged Slice 1 identity foundation. A future developer needs one current decision without mistaking historical deferral statements for deployed architecture.

## Decision

Slice 1 uses Better Auth `1.6.23` for credential, account, database-session, verification, and MFA-provider state in `portal_auth`. Canonical portal authority begins only after trusted session validation, immutable PortalIdentity binding, active domain-state evaluation, and Staff MFA assurance. Agent 10 converts the canonical principal into a module-private runtime attestation for fixed Payload Local API calls using `overrideAccess: false`, `depth: 0`, and narrow selects. Shape validation is not authority.

Payload `cms-users` remains the only CMS Admin identity collection. CMS roles and operational Staff roles are independent; email matching creates no authority or binding. `staff`, `clients`, `portal-identities`, and `security-events` are private registered Payload collections in `public`. GraphQL is disabled and private REST/Admin access fails closed.

Payload owns operational DDL in `public.payload_migrations`; Better Auth owns `portal_auth.perfect_tax_auth_migrations`. The former `portal_identity` physical-schema proposal is superseded. Production separates Payload/Auth migration authority from their runtime roles and never enables schema push.

Exactly one primary Owner is created only by the non-web system bootstrap ceremony. Owner role is not system capability. Client authentication/provisioning and all invitation/recovery lifecycle work remain deferred.

## Consequences

The canonical implementation and operational instructions are:

- [architecture](../architecture/portal-identity-authorization.md)
- [bootstrap ceremony](../operations/primary-owner-bootstrap.md)
- [migration and deployment](../operations/database-migrations-and-deployment.md)
- [security validation](../operations/security-validation.md)

ADR 0010 remains current for the version-specific Better Auth/Payload bridge proof where it does not conflict with this decision. ADR 0011 remains historical Phase 1 context. The anonymous authentication-failure recorder gap is documented as deferred operational audit work; it is not claimed to be implemented.
