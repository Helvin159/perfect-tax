# Security-events database handoff

`security-events` is an append-only, server-only Slice 1 collection. Agent 13
may register the exported collection. Agent 14 exclusively owns its migration
and generated Payload types.

## Required database controls

- Create the table additively; do not modify or reuse CMS, Better Auth, Staff,
  Client, or PortalIdentity tables.
- Give the runtime audit-writer role `INSERT` only. Do not grant `UPDATE`,
  `DELETE`, or `TRUNCATE`. Do not make the application role the table owner.
- Generate and review the table through the repository's Payload migration
  lifecycle in `src/modules/cms/migrations` and its existing
  `payload_migrations` ledger. Apply it with Payload migration/deployment DDL
  authority separate from the runtime role. Better Auth migration authority
  must have no DDL access to this Payload-managed table.
- Add a database trigger that rejects `UPDATE` and `DELETE` for every role
  other than the narrowly named migration/maintenance role. PostgreSQL table
  owners and superusers can bypass ordinary grants, so deployment must not run
  the application as either.
- Keep row-level security out of the write path unless Agent 14 can prove the
  exact writer policy. The application collection denies all normal create,
  read, update, and delete access; its private runtime capability permits only
  recorder-backed inserts.
- Preserve `occurredAt`, `action`, actor fields, target fields, correlation ID,
  and metadata as immutable. Add `NOT NULL` constraints for `occurredAt`,
  `action`, `actorKind`, and `metadata`; bound text lengths to the collection
  contract. Add checks for the frozen action/actor/target vocabularies and for
  actor/target ID presence by kind/type.
- Index `occurredAt`, `action`, and `correlationId`. No search, retention,
  partitioning, analytics, or SIEM work is part of Slice 1.
- Run clean-install and populated-upgrade tests, including direct SQL attempts
  to update, delete, and truncate as the runtime role. All must fail while an
  insert through a source-bound security-event recorder succeeds.

The application layer rejects update/delete even when Payload access is
bypassed, validates every append again inside the collection hook, and accepts
only UUID correlation IDs plus action-specific scalar metadata. Database grants
and the trigger are still required defense in depth; Payload hooks alone do not
constrain direct SQL or a table-owning principal.

Actor and target provenance is enforced before this persistence boundary. The
flat append record remains structurally validated here as defense in depth, but
structural parser success is not authority to append.
