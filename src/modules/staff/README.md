# Staff persistence handoff

`Staff` owns operational profile data only: `firstName`, `lastName`, normalized
unique `workEmail`, operational `role`, domain `status`, the server-owned
`isPrimaryOwner` marker, Payload's numeric ID, and Payload timestamps. It owns no
credentials, login email, sessions, MFA material, provider roles, invitations,
CMS links, or case state. Matching `workEmail` and login email never binds or
updates an identity.

## Integration seams

- `Staff` is the fail-closed collection export. Its collection access and the
  primary-owner field's access deny by default until Agent 8's attested policy
  is composed.
- `createStaffCollection` accepts only an
  `authorizePrimaryOwnerBootstrap` predicate at server config-composition time.
  Agent 12 implements that predicate with Agent 10's private, reason-bearing
  `primary-owner-bootstrap` system capability. Agent 13 must register the
  factory result wired to `authorizePrimaryOwnerBootstrapRequest`; the default
  `Staff` export intentionally remains fail closed. This module does not trust a
  request context flag, role, email, or caller-provided ID.
- Agent 13 should register the composed collection without changing its fields
  or invariant hooks. Agent 12's bootstrap must create an active owner with
  `isPrimaryOwner: true`; owner transfer remains unsupported.

## Agent 14 database requirements

The final additive migration must preserve the Payload field shape and add
database defense in depth:

1. `role` is non-null and checked against exactly `owner`, `administrator`,
   `case-worker`, and `intake`.
2. `status` is non-null and checked against exactly `active` and `disabled`.
3. `is_primary_owner` is non-null with default `false`.
4. A check constraint enforces `(role = 'owner') = is_primary_owner`.
5. A check constraint enforces `NOT is_primary_owner OR status = 'active'`.
6. A partial unique index permits at most one row where
   `is_primary_owner = true`.
7. A unique index on `lower(work_email)` backs canonical email uniqueness even
   if a write bypasses application normalization.
8. Update/delete database protection must reject demotion, unmarking,
   disabling, or deletion of the primary-owner row. It may allow ordinary
   profile/contact edits. Owner transfer is deferred.

The migration must not seed an owner. Agent 12's command performs the one
system-only serialized bootstrap after readiness is proven; its advisory lock,
transaction, credential compensation, and mandatory audit behavior are outside
this module. See `application/PRIMARY_OWNER_BOOTSTRAP_HANDOFF.md`.
