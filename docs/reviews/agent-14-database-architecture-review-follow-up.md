# Agent 14 database architecture review — follow-up for foundation-plan completion

- Review date: 2026-09-01
- Candidate: `feat/agent-14` at `ecce00ba4bf9367398bea125c38ca51823a29d1c`
- Integration baseline: `user-structure` at `8c956b1702db675338c1bff60ce59e3e0666b090`
- Verdict: **APPROVE WITH NOTES — Agent 14 may be merged and Agent 15 may proceed.**

This record captures the independent, read-only Agent 14 persistence/security review. It is a follow-up checklist for completion of `.codex/admin-portal-identity-authorization-foundation-plan.md`, not a replacement for the approved architecture.

## Review conclusion

No CRITICAL or HIGH finding was identified. The reviewed PostgreSQL implementation enforces the approved topology:

```text
Better Auth authentication state
  -> portal_auth schema
  -> Better Auth migration boundary
  -> portal_auth.perfect_tax_auth_migrations

Payload application/domain state
  -> public schema
  -> Payload migration boundary
  -> public.payload_migrations
```

Staff, Clients, PortalIdentity, and SecurityEvents are Payload-owned in `public`. Better Auth `user`, `session`, `account`, `verification`, and `twoFactor` are Better Auth-owned in `portal_auth`. No `portal_identity` schema is created.

The review verified, using real PostgreSQL 17.10 and disposable databases/roles:

- clean migration and populated-upgrade migration paths;
- separate ledgers, table owners, and cross-schema DDL denial;
- database checks, unique indexes, foreign keys, triggers, and runtime grants;
- primary-owner, Client-number, and PortalIdentity uniqueness under concurrent attempts;
- PortalIdentity update/delete immutability;
- SecurityEvents append-only behavior, including runtime `UPDATE`, `DELETE`, and `TRUNCATE` denial;
- runtime-role inability to perform DDL or access the other schema;
- rollback of an appended SecurityEvent inside a direct PostgreSQL transaction.

Repository validation was green: lint, TypeScript, formatting, focused real-PostgreSQL migration tests, and the full 533-test suite. The supported webpack production build succeeded with explicit build-only configuration. Turbopack stalled during optimized compilation and was terminated; this was reported distinctly.

## Follow-up items required before foundation-plan completion

### A14-M01 — expand populated upgrade coverage

- Severity: MEDIUM
- Owner: Agent 15, with Agent 14 only if migration corrections are discovered.
- Affected test: `src/modules/cms/migration-testing/operational-schema.integration.test.ts`

The existing upgrade fixture preserves CMS users in all editorial roles and a Service record, but not the full populated Phase 1 topology required by the plan.

Required proof:

- populate CMS users, localized/versioned Services, public media, all globals, editorial relationships, and migration history;
- migrate from the pre-Agent-14 baseline;
- verify data, localization, versions, and relationships survive unchanged;
- rerun the migrations to prove ledger idempotence.

### A14-M02 — prove the exact real Payload bootstrap transaction path

- Severity: MEDIUM
- Owner: Agent 15
- Affected code: `src/modules/audit/infrastructure/security-events-collection.ts` and `src/modules/staff/application/primary-owner-bootstrap-runtime.ts`

The database append function and transaction rollback are proven directly against PostgreSQL. The exact Payload adapter path that uses `req.transactionID`, `payload.db.sessions[transactionID].db`, Staff creation, PortalIdentity creation, and the SecurityEvent recorder is currently mocked.

Required proof:

- initialize registered Payload with the least-privilege runtime role;
- begin a real Payload transaction and reuse one request;
- create Staff and PortalIdentity through the bootstrap path;
- append the success SecurityEvent through the recorder;
- prove both commit success and forced rollback leave the expected persisted state;
- prove a missing transaction session fails closed.

### A14-M03 — extend readiness to Better Auth persistence

- Severity: MEDIUM
- Owner: Agent 15 or the readiness/deployment owner
- Affected code: `src/modules/operations/health.ts`, `src/modules/database/operational-schema-verification.ts`

Current readiness verifies the Payload operational schema, Payload ledger, runtime role, constraints, triggers, and grants. It does not verify `portal_auth`, the Better Auth ledger, auth table ownership, or auth-runtime grants.

Required proof:

- missing `portal_auth` schema returns safe unavailable;
- missing auth migration ledger entry returns safe unavailable;
- incorrect auth runtime role/grants return safe unavailable;
- a fully migrated dual-schema deployment returns ready;
- output must not disclose database names, connection strings, credentials, tokens, or row data.

## Important enforcement boundaries retained by Agent 14

| Claim | Actual enforcement |
|---|---|
| At most one active primary owner | Database unique partial index, checks, trigger; application capability/preflight |
| Owner demotion, disablement, unmarking, deletion | Database trigger and application hook |
| Client-number format/uniqueness/immutability | Database check/index/trigger plus application generator/invariant hook |
| PortalIdentity one-auth-user/one-subject shape | Database unique indexes, check, FKs; application invariant hook |
| PortalIdentity update/delete | Runtime grants and database trigger; application denial hooks |
| PortalIdentity binding provenance | Application only; runtime role may insert a structurally valid binding by design |
| SecurityEvents append-only | Runtime grants and database trigger |
| SecurityEvent action provenance/metadata semantics | Application only; database enforces vocabulary and structural shape |
| Payload/Better Auth schema isolation | Separate schemas, owners, ledgers, and grants |
| User-driven Payload operations | Application gateway requires `overrideAccess: false` and attested runtime capability |

## Agent 15 assumptions and re-proofs

Agent 15 may assume that the committed Agent 14 candidate provides the correct physical schema ownership, migration ledgers, constraints, triggers, and least-privilege role model.

Agent 15 must independently prove:

- end-to-end concurrent primary-owner bootstrap across processes;
- Better Auth credential compensation under real persistence failure modes;
- real Payload request/transaction propagation and rollback;
- HTTP, REST, Admin, and capability-forgery denial against the migrated database;
- expanded upgrade preservation coverage;
- Better Auth-aware readiness behavior.

## Validation evidence

| Validation | Result |
|---|---|
| `pnpm lint` | Pass |
| `pnpm typecheck` | Pass |
| `pnpm format:check` | Pass |
| Focused PostgreSQL migration tests | 2 files / 2 tests passed |
| Full PostgreSQL-enabled test suite | 61 files / 533 tests passed |
| Independent hostile SQL and concurrency matrix | Pass; expected database denials observed |
| Webpack production build with build-only config | Pass |
| Turbopack build | Stalled; not treated as a successful build |

## Final merge gate recorded by the review

Agent 14 may be merged. Agent 15 may proceed.
