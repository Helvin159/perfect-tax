# Agent 13 private Payload registration handoff

## Stable registration boundary

The registered Slice 1 operational collection slugs are exactly:

- `staff`
- `clients`
- `portal-identities`
- `security-events`

They use Payload's existing managed PostgreSQL schema and migration lifecycle.
Payload Admin still authenticates only through `cms-users`. All four operational
collections are non-auth collections, hidden from Admin navigation, excluded
from GraphQL, and fail closed for anonymous and CMS-authenticated direct access.

The only normal portal read currently exposed is Agent 10's fixed Client
gateway. It re-resolves Agent 11's canonical principal, issues a module-private
runtime capability, applies Agent 8 policy in registered Client access, and
calls Payload with `overrideAccess: false`, `depth: 0`, and fixed projections.
Client create, update, and delete remain unavailable. PortalIdentity and
SecurityEvents direct operations remain unavailable. Staff has no production
gateway method in Slice 1; its registered
read adapter nevertheless requires Agent 10 attestation and applies Agent 8
policy. Owner and Administrator reads are policy-eligible, while Case Worker
and Intake self reads remain closed until trusted Staff target evidence exists.
Staff create, update, and delete remain denied to normal principals.

Agent 12's non-web primary-owner bootstrap remains the sole narrow Staff create
bypass. Staff registration passes exactly
`authorizePrimaryOwnerBootstrapRequest` to `createStaffCollection`; the Staff
invariant hook independently verifies the private system capability. Bootstrap
readiness remains deliberately closed pending Agent 14's physical proof.

## Client vocabulary reconciliation

The Slice 1 Client schema contains `clientNumber`, `firstName`, `lastName`,
`contactEmail`, and `status`, plus Payload `id`, `createdAt`, and `updatedAt`.
The Agent 8 Client policy vocabulary was narrowed to those actual fields.
`phone`, `authUserId`, and `portalIdentity` were removed rather than adding
unapproved schema fields. Basic field mutation policy now names only
`firstName`, `lastName`, and `contactEmail`, but registered collection mutation
remains denied because Slice 1 exposes no Client-edit service.

## Agent 14 physical requirements

Agent 14 exclusively owns the additive Payload migration, migration review,
generated Payload types, readiness implementation, database roles/grants, and
physical PostgreSQL proof. Do not enable schema push or auto-create tables.

### Staff

- Exact role check: `owner`, `administrator`, `case-worker`, `intake`.
- Exact status check: `active`, `disabled`.
- Non-null `is_primary_owner` defaulting to false.
- `(role = 'owner') = is_primary_owner` and primary Owner must be active.
- Partial uniqueness for the primary Owner.
- Case-insensitive `work_email` uniqueness.
- Database rejection of primary Owner demotion, unmarking, disabling, and
  deletion; ordinary contact/profile edits may remain possible.

### Clients

- Unique `client_number` using Agent 5's exact
  `clients_client_number_idx` index contract.
- Exact status check: `active`, `inactive`.
- Database-level Client-number immutability.
- Future creates must use Agent 5's collision-retry service, not raw
  `payload.create()`.

### PortalIdentity

- Unique `auth_user_id`, unique non-null Staff relationship, and unique non-null
  Client relationship.
- Exactly one subject relationship with subject-type/relation consistency.
- Restrictive/no-action foreign-key deletion behavior.
- Database/runtime grants and triggers must prevent binding update, delete, and
  truncate. The application collection now rejects both update and delete even
  when Payload access is bypassed.

### SecurityEvents

- No direct runtime table privilege. The runtime role invokes the narrowly
  typed `perfect_tax_append_security_event(...)` function, which is owned by
  the migration role and executes the insert as `SECURITY DEFINER` inside the
  caller's Payload transaction; direct select/insert/update/delete/truncate
  attempts remain denied.
- Immutable update/delete trigger and action/actor/target checks.
- Required provenance columns, scalar metadata contract, and indexes for
  occurrence time, action, and correlation ID.
- Runtime must not be the table owner or have unrestricted DDL.

Readiness must fail safely without exposing table names or credentials until
the reviewed migration, constraints, grants, Payload transaction behavior, and
bootstrap advisory-lock behavior are proven. Agent 14 must add the final
Payload migration name to the required-migration check and extend readiness to
verify the approved physical contract; the current pre-Agent-14 check knows
only the existing CMS/public migration names.

## Agent 15 end-to-end proof

With real PostgreSQL and the Agent 14 artifacts, prove:

- CMS editor, bilingual reviewer, publisher, and cms-admin retain CMS behavior
  but cannot access any operational collection through REST, Local API, Admin,
  or GraphQL if a transport is enabled later.
- Anonymous REST reads and mutations disclose no private records or existence
  differences for all four slugs.
- Fake `portal-principals` users, serialized/reconstructed principals, and
  lookalike Agent 10 contexts fail with `overrideAccess: false`.
- A real Agent 11 session-to-principal resolution followed by Agent 10
  attestation succeeds for the approved Client projection only.
- A legitimate Case Worker without trusted assignment persistence receives no
  Client access; Intake receives only the fixed basic projection.
- Client field access, Staff owner hooks, PortalIdentity update/delete hooks,
  and SecurityEvents append-only hooks run in the real Payload request path.
- Relationship depth remains zero and fixed projections expose no unauthorized
  relationship IDs.
- Primary-owner Staff, PortalIdentity, and success SecurityEvent share the
  intended transaction; failure rolls back all application state.
- Clean-install and populated-upgrade migrations preserve CMS identities,
  roles, content, globals, public media, email configuration, and public
  projection behavior.

Before Agent 14, missing physical tables, stale generated Payload types, closed
bootstrap readiness, and the absence of real HTTP/PostgreSQL proof are expected
and must not be represented as production readiness.

## Agent 14 completion amendment — 2026-08-31

The physical requirements above are now implemented. The four collections map
to the reviewed Payload migration in `public`, generated types are committed,
and readiness verifies ownership, constraints, triggers, grants, transaction
append behavior, and the bootstrap lock. The historical pre-Agent-14 closure
remains a record of the handoff state; Agent 15 still must provide the real HTTP
and end-to-end attestation proof.
