# Primary Owner bootstrap handoff

## Implemented ceremony

The sole operator entrypoint is:

```text
pnpm portal:bootstrap-primary-owner
```

It directly executes Agent 10's server-only system composition. The concrete
runner, trusted invocation source, target source, source/target registries,
system gateway composition, Payload runtime, and recorders are not exported.
There is no HTTP route, Server Action, Better Auth route, Payload Admin action,
or CMS operation for this ceremony.

The command reads these values only from its server process environment:

```text
PRIMARY_OWNER_BOOTSTRAP_FIRST_NAME
PRIMARY_OWNER_BOOTSTRAP_LAST_NAME
PRIMARY_OWNER_BOOTSTRAP_WORK_EMAIL
PRIMARY_OWNER_BOOTSTRAP_LOGIN_EMAIL
PRIMARY_OWNER_BOOTSTRAP_PASSWORD
```

The password must be injected transiently by an operator-controlled secret
manager or equivalent server process environment. Do not put it in argv,
`.env`, shell history, JSON, logs, or committed configuration. The command
collects and deletes its environment entry before loading the normal local
application `.env`; therefore a bootstrap password stored in `.env` is not an
accepted input mechanism. Success output contains no identifier or credential.

Work email and login email are validated and stored as separate concepts even
when their initial values happen to match. Portal identity is established only
by the explicit Better Auth `AuthUserId -> PortalIdentity -> StaffId` binding.

## Trusted sequence

```text
direct non-web module execution
  -> private trusted system source + generated UUID correlation ID
  -> PostgreSQL session advisory lock
  -> canonical Staff Owner/marker preflight
  -> Agent 3 Better Auth credential provisioner
  -> Agent 10 private primary-owner-bootstrap capability
  -> one Payload transaction
       -> canonical Owner/marker recheck
       -> Staff(owner, active, isPrimaryOwner=true)
       -> PortalIdentity(AuthUserId, staff)
       -> required success SecurityEvent
       -> commit
  -> normal later sign-in
  -> Agent 11 enrollment-only principal
  -> Agent 9 TOTP enrollment/verification
  -> operational Owner principal
```

Failure before credential creation records one required failure event when the
audit store is ready. Credential creation failure also records one required
failure event. A failure in Staff or PortalIdentity creation rolls back the
Payload transaction, records one failure event outside that rolled-back
transaction, and causes Agent 3's callback to compensate the Better Auth
credential. A success-event append or application commit failure rolls back the
Staff, PortalIdentity, and uncommitted event together; the callback then
compensates the credential. No second terminal event is attempted after an
audit/commit failure.

## Current production readiness

Production execution is deliberately fail closed with `NOT_READY`. The
orchestration, CLI, advisory-lock adapter, transaction settlement, compensation,
audit envelope, and application-level concurrency model are implemented and
unit-tested, but Agent 13 registration and Agent 14 physical database proof are
not present on this branch. No real PostgreSQL transaction/concurrency claim is
made by Agent 12.

Readiness rejection happens before credential provisioning or capability
issuance. If required persistence is unavailable, the command prints only a
safe operational error and exits nonzero. It never creates schemas, enables
Payload push, registers an alternate store, or bypasses missing migrations.

## Agent 13 registration handoff

Agent 13 must:

1. Register `Staff`, `PortalIdentities`, and `SecurityEvents` privately in the
   approved Payload configuration composition.
2. Register Staff by calling `createStaffCollection` with exactly
   `authorizePrimaryOwnerBootstrapRequest` from Agent 10's system module.
   Registering the fail-closed default `Staff` export will correctly keep Owner
   bootstrap unavailable.
3. Preserve all collection fields, hooks, `graphQL: false`, hidden Admin state,
   denied ordinary access, and server-owned marker behavior.
4. Expose no HTTP/GraphQL/Admin bootstrap operation and no collection mutation
   fallback.
5. Leave the readiness guard closed for Agent 14; registration alone is not
   proof of database constraints or atomicity.

Agent 13 must not add a second authorizer, context flag, resolver-driven system
factory, or role-to-system-capability conversion.

## Agent 14 physical database handoff

ADR 0010's 2026-08-20 superseding decision resolves the former schema
discrepancy. Staff, Clients, PortalIdentity, and SecurityEvents are
Payload-managed collections in the adapter's existing/default `public` schema.
They use `src/modules/cms/migrations` and the existing `payload_migrations`
ledger; no separate `portal_identity` schema is created for them. Agent 14 owns
the additive Payload migration, generated Payload types, production role/grant
strategy, and physical proof. Agent 12 remains migration-neutral.

The reviewed physical implementation must prove:

1. At most one primary-owner row through a database constraint/index, with
   `(role = 'owner') = is_primary_owner` and primary Owner active-state checks.
2. Database rejection of primary Owner demotion, unmarking, disablement, or
   deletion; owner transfer remains unsupported.
3. Unique, immutable PortalIdentity bindings for Better Auth account, Staff,
   and Client subject keys, with exactly one subject relation.
4. Append-only SecurityEvents and a valid event identifier returned inside the
   same Payload transaction used by Staff and PortalIdentity.
5. Payload 3.86 transaction behavior for the exact shared `PayloadRequest` used
   by bootstrap, including rollback on event-append and commit failure.
6. The PostgreSQL session advisory lock used by the command serializes two
   independently connected processes/instances for the full preflight through
   commit/rollback window.
7. Clean-install and populated-upgrade migrations, grants, schema ownership,
   lock ordering, deployment ordering, and recovery for process termination
   between Better Auth and Payload stores.
8. A database-backed readiness check based on the approved physical contract.
   Only after these proofs may Agent 14 replace the final fail-closed branch in
   `assertPrimaryOwnerBootstrapRuntimeReady`.

Agent 15 must run the real PostgreSQL concurrent-attempt and transaction-failure
proofs. Exactly one attempt may succeed, the other must be denied, and the
database must contain exactly one canonical primary Owner and one explicit
PortalIdentity binding.

## Agent 14 completion amendment — 2026-08-31

The physical contract is now implemented and the readiness guard is open only
for a registered Payload instance whose database verifies that contract. The
historical “leave readiness closed” instruction above describes the pre-Agent-14
handoff state. Agent 15 remains responsible for the real concurrent bootstrap
and HTTP/end-to-end security proof.

## Final-state note — 2026-09-02

Agent 15 completed the required real concurrent/bootstrap and HTTP/end-to-end
proof. This is historical implementation evidence; the authoritative operator
procedure is `docs/operations/primary-owner-bootstrap.md`.
