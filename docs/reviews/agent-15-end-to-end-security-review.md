# Agent 15 — Slice 1 end-to-end security integration review

## Verdict

**COMPLETE.** The maintained integration gate dynamically proves the required
real authentication, canonical identity, attestation, authorization, Payload,
and PostgreSQL chain. The repaired A15-H01, A15-H02, and A15-M01 regressions are
green.

## Environment

- Node.js 24.18.0 and pnpm 10.33.0
- Payload 3.86.0 and Better Auth 1.6.23
- isolated PostgreSQL 17.10 container
- committed Payload and Better Auth migrations; no schema push
- one worker because the reviewed database role names are cluster-global

## Complete chain

`integration/auth/staff-principal.integration.test.ts` provisions real Better
Auth credentials and sessions in `portal_auth`, binds the canonical AuthUserId
to real Staff through PortalIdentity, completes real TOTP, invokes Agent 11's
production principal composition and Agent 10's private gateway, reaches Agent
8 policy and the registered Clients access function with
`overrideAccess:false`, calls Payload Local API, and reads PostgreSQL-backed
Client rows. Instrumentation observes the registered access function and the
fixed `depth:0`/narrow selection at runtime.

## Bootstrap and repair evidence

- A15-H01: the real primary-owner CLI creates one credential/account, one
  active primary Owner, one PortalIdentity, and one success SecurityEvent.
- A15-H02: approved Staff and Client PortalIdentity creates pass through real
  Payload normalization; malformed, duplicate, update, and delete attacks fail.
- A15-M01: readiness passes only when both independent ledgers are current and
  fails for a missing Payload migration, missing Better Auth ledger entry, or
  unavailable `portal_auth`.
- A newly bootstrapped Owner resolves enrollment-only before TOTP and as an
  operational canonical Owner after TOTP.
- Four repeated bootstrap permutations fail without adding credentials,
  identities, Staff, or Owners; failure events contain no prohibited secrets.
- Two concurrent real CLI processes yield one success, one failure, one Owner,
  one binding, and one effective credential authority.
- Real credential, Staff, PortalIdentity, and mandatory-success-audit failures
  leave no incomplete privileged authority. The first three persist the
  approved failure event; a failed mandatory success append rolls back its
  transaction and does not attempt a misleading second terminal event.

## Security invariant matrix

| Invariant                                                | Result       | Evidence                                                             |
| -------------------------------------------------------- | ------------ | -------------------------------------------------------------------- |
| Complete real auth-to-database chain                     | PASS         | `integration/auth/staff-principal.integration.test.ts`               |
| Independent idempotent migrations                        | PASS         | `integration/database/physical-security.integration.test.ts`         |
| All four Staff roles require MFA                         | PASS         | real credentials, sessions, and TOTP in auth integration             |
| Eight-hour lifetime and 15-minute freshness              | PASS         | persisted session clocks before and after enrollment                 |
| Expired, revoked, and signed-out sessions deny           | PASS         | real `portal_auth.session` mutations and sign-out                    |
| Disabled Staff re-evaluates and denies                   | PASS         | canonical Staff mutation followed by top-level resolution            |
| Browser/provider/request role injection                  | PASS         | canonical Intake remains Intake                                      |
| Shape, serialization, copying, or freezing creates trust | PASS         | forged values rejected by final gateway                              |
| Capability/request and user binding                      | PASS         | copied, mismatched, and completed request contexts deny              |
| Generic resolver/system-capability attack                | PASS         | private issuers unavailable plus focused security regressions        |
| Registered access executes with override disabled        | PASS         | runtime instrumentation around real Payload collection access        |
| Fixed depth and narrow projection                        | PASS         | observed Local API arguments and returned Client fields              |
| CMS users can access private portal collections          | PASS         | all four CMS roles denied REST/Admin private data                    |
| Private REST and GraphQL exposure                        | PASS         | GET/POST/PATCH/DELETE denied; GraphQL unavailable                    |
| CMS/portal matching email crossover                      | PASS         | real separate credentials confer no cross-authority                  |
| First and repeated primary-owner bootstrap               | PASS         | real CLI and exact final database state                              |
| Concurrent primary-owner bootstrap                       | PASS         | two real CLI processes and final database state                      |
| Bootstrap compensation and audit secrecy                 | PASS         | post-readiness fault injection and recursive metadata checks         |
| PortalIdentity repaired Local API create                 | PASS         | approved Staff and Client relationships persist                      |
| PortalIdentity malformed/duplicate/immutable boundaries  | PASS         | Payload plus PostgreSQL attacks                                      |
| Payload and Better Auth readiness                        | PASS         | current/missing/unavailable scenarios                                |
| Staff/Client/PortalIdentity physical constraints         | PASS         | real PostgreSQL constraint failures                                  |
| SecurityEvents append-only                               | PASS         | application hooks and runtime role DML/DDL denial                    |
| Runtime/migration and cross-schema separation            | PASS         | four-role PostgreSQL checks                                          |
| Transaction rollback and advisory locking                | PASS         | real rollback, lock contention, and bootstrap concurrency            |
| Public EN/ES, media, globals, manifests, CMS auth        | PASS         | running Next/Payload HTTP suite                                      |
| Production Client credential flow                        | NOT TESTABLE | intentionally fail-closed in Slice 1; no signup invented             |
| Nested Payload gateway operation propagation             | NOT TESTABLE | no current production Client gateway operation invokes a nested hook |

## Validation

- `pnpm lint`: pass
- `pnpm typecheck`: pass
- `pnpm test`: 60 files passed, 2 environment-gated migration files skipped;
  547 tests passed, 2 skipped
- `pnpm test:security:regressions`: 31 files and 402 tests passed
- `pnpm test:integration:security`: 9 files and 20 tests passed
- `pnpm test:integration:database`: 5 files and 13 tests passed
- real CMS clean/upgrade migration run: 2 files and 2 tests passed
- HTTPS-configured `next build --webpack`: pass
- `git diff --check`: pass
- Agent 15 file formatting: pass

Repository-wide `pnpm format:check` remains red only for the pre-existing Agent
14 review document and `tsconfig.json`; neither file is changed by Agent 15.
The default Turbopack `pnpm build` also reproduced the previously documented
compile stall and was stopped before the supported webpack build passed.
