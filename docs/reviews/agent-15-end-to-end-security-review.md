# Agent 15 — Slice 1 end-to-end security integration review

## Verdict

**BLOCKED.** The accepted system cannot complete primary-owner bootstrap, the
registered PortalIdentity collection rejects an approved real create, and
readiness does not fail when the Better Auth migration ledger is absent.

The first two defects are High severity and block Slice 1 completion. The
integration tests deliberately retain expected-success assertions so an
upstream repair, rather than a weakened expectation, is required to make the
security gate green.

## Architecture exercised

The maintained suite dynamically exercises:

```text
Better Auth credential/session
→ trusted session reader
→ canonical PortalIdentity + Staff resolution
→ MFA assurance
→ private request attestation
→ authorization policy
→ registered private Client access
→ PostgreSQL runtime grants and constraints
```

Because primary-owner bootstrap is blocked, the downstream authentication test
uses explicitly migration-owned Staff and PortalIdentity fixtures. It still
uses real Better Auth credentials/sessions, real TOTP, real Payload, registered
access controls, Agent 11 principal resolution, Agent 10 attestation, Agent 8
policy, and PostgreSQL. This distinction prevents a bootstrap failure from
hiding downstream evidence without treating the fixture as bootstrap proof.

## Security invariant matrix

`NOT TESTABLE` is never treated as `PASS`.

| Invariant                                                  | Result       | Evidence                                                                                                                             |
| ---------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Clean migrations and application/auth schemas              | PASS         | `database/physical-security`: empty random database, both migration commands twice, both ledgers                                     |
| CMS/portal identity separation                             | PASS         | `cms-isolation/http-boundaries`: all four CMS roles denied private surfaces; operational cookie denied CMS authority                 |
| Email-independent portal identity                          | PASS         | `auth/staff-principal` and CMS crossover account                                                                                     |
| Provider/request role cannot grant Owner                   | PASS         | canonical Intake remains Intake despite injected Owner claims                                                                        |
| Staff status is re-evaluated                               | PASS         | valid MFA session denied after canonical Staff is disabled                                                                           |
| Expired/revoked sessions fail closed                       | PASS         | direct real-session expiry/deletion and post-sign-out gateway denial                                                                 |
| MFA mandatory for every Staff role                         | PASS         | Owner, Administrator, Case Worker, and Intake resolve enrollment-only before TOTP                                                    |
| Owner has no MFA bypass                                    | PASS         | real Owner credential/session is enrollment-only before TOTP                                                                         |
| 8-hour lifetime and 15-minute freshness remain distinct    | PASS         | aged and near-deadline sessions retain original clocks; genuinely new login gets a new epoch                                         |
| Runtime shape is not trust                                 | PASS         | real, parsed, frozen, serialized, reconstructed, fake Staff/Admin/Client values denied by final gateway                              |
| Capability/request binding and isolation                   | PASS         | copied request, changed user, fake context, and reused completed requests denied; top-level requests/DataLoaders differ              |
| Generic resolver cannot issue authority                    | PASS         | production composers/issuers are not exported; fake resolver-shaped input cannot reach either boundary                               |
| Portal/system capability namespaces are separate           | PASS         | fake/cross-shaped contexts fail and neither private issuer is exportable                                                             |
| `overrideAccess: false` reaches registered access          | PASS         | delegated real `payload.find` instrumentation observes the Client access function                                                    |
| `depth: 0` is fixed                                        | PASS         | final gateway call arguments are observed dynamically; callers have no depth input                                                   |
| Narrow Client projection                                   | PASS         | actual returned objects contain only client number, first/last name, and status                                                      |
| Nested operation propagation                               | NOT TESTABLE | no current production Client gateway operation invokes an existing nested Payload hook/operation                                     |
| Private REST/Admin/GraphQL denial                          | PASS         | anonymous, all CMS roles, and fake portal-shaped HTTP actors cannot access all four private slugs; GraphQL unavailable               |
| Owner/Administrator ordinary read policy                   | PASS         | canonical attested Owner and Administrator can list approved Client summaries                                                        |
| Owner/Administrator protected Staff mutations              | PASS         | no production gateway exposes them; policy regressions plus physical primary-owner constraints deny protected state changes          |
| Case Worker without assignment evidence                    | PASS         | real canonical Case Worker receives `assignment-required` from the final gateway                                                     |
| Intake field restrictions                                  | PASS         | only the fixed basic projection is returned; no Client mutation gateway exists and direct private REST is denied                     |
| Arbitrary Better Auth account becomes Client               | PASS         | unbound and even test-bound Client credentials resolve denied in production composition                                              |
| Client own-versus-other allow path                         | NOT TESTABLE | production Client principal issuance is intentionally fail-closed in Slice 1                                                         |
| PortalIdentity uniqueness/shape/immutability in PostgreSQL | PASS         | duplicate auth/Staff/Client, zero/dual/mismatch, update, and delete attacks rejected                                                 |
| Real PortalIdentity Payload create                         | FAIL         | A15-H02: approved three-field Staff binding throws `unexpected-field`                                                                |
| Staff role/status/one-owner physical constraints           | PASS         | invalid enums and second owner rejected; demote/disable/unmark/delete primary owner rejected                                         |
| Client number uniqueness/immutability/status/retry         | PASS         | physical index collision and actual Agent 5 retry against `clients_client_number_idx`                                                |
| SecurityEvents append-only                                 | PASS         | Agent 7 recorder succeeds; Local API and runtime-role UPDATE/DELETE/TRUNCATE/direct INSERT fail                                      |
| SecurityEvent secret safety                                | PASS         | persisted authentication, authorization, and MFA metadata recursively inspected; prohibited injection rejected                       |
| First primary-owner bootstrap                              | FAIL         | A15-H01: production CLI rolls back and reports failure                                                                               |
| Bootstrap fail-closed residual state                       | PASS         | failed real run leaves zero credentials, sessions, Staff, Owners, and identities; one mandatory failure event remains                |
| Second/concurrent bootstrap and post-bootstrap MFA         | NOT TESTABLE | first successful bootstrap is impossible under A15-H01                                                                               |
| Bootstrap partial-failure matrix                           | NOT TESTABLE | actual Staff-stage failure/compensation is proven; later stage injection would not prove success-path behavior while A15-H01 remains |
| Database runtime role separation                           | PASS         | both runtime roles lack DDL and cross-schema access; migration roles cannot cross schema ownership                                   |
| Better Auth/Payload persistence separation                 | PASS         | schema/grant tests and application-column inspection; no credential/session/MFA columns in operational tables                        |
| Migration ledger ownership separation                      | PASS         | independent exact Payload and Better Auth ledger contents on a clean database                                                        |
| Fully migrated and missing Payload migration readiness     | PASS         | ready against full state; missing required Payload ledger entry fails closed                                                         |
| Missing Better Auth migration readiness                    | FAIL         | A15-M01: readiness still returns success with the Better Auth ledger entry absent                                                    |
| Public EN/ES, globals, media, metadata/manifests           | PASS         | real Next server responses and existing full unit regressions                                                                        |
| CMS editorial role regression                              | PASS         | every role authenticates/reads; Editor create remains allowed and reviewer/publisher create remains denied                           |
| Error/record enumeration safety                            | PASS         | private responses contain no seeded identifiers; endpoints disclose no private record contents                                       |

## Findings

### A15-H01 — High — primary-owner bootstrap cannot succeed

- **Affected module:** Agent 12 bootstrap composition with Agent 4 Staff field
  access.
- **Root cause:** `preparePrimaryOwnerPersistence` creates Staff through real
  Payload and `parseCreatedPrimaryOwner` then requires
  `value.isPrimaryOwner === true`. The registered Staff field denies read access,
  so the real returned document omits the hidden marker. The mock unit fixture
  included it and did not expose this composition failure.
- **Impact:** the only supported system path cannot provision the first Owner.
  Slice 1 has no operational primary owner.
- **Observed persistent state:** the Staff transaction rolls back; Better Auth
  credential compensation removes user/account; no identity or session exists;
  one mandatory `primary-owner.bootstrap.failed` event persists.
- **Repair owner:** Agent 12 bootstrap runtime, coordinated with Agent 4 Staff
  collection semantics.
- **Required fix:** validate the canonical persisted primary-owner state through
  an approved internal persistence result/query without exposing or weakening
  the hidden marker. Do not remove the marker invariant or broaden field read
  access.
- **Regression:**
  `integration/bootstrap/primary-owner-bootstrap.integration.test.ts`.

### A15-H02 — High — registered PortalIdentity create rejects approved input

- **Affected module:** Agent 6 PortalIdentity collection integrated by Agent 13.
- **Root cause:** the collection-level `beforeValidate` parser requires exact
  input keys. Real Payload normalizes the collection data with optional
  relationship state before this hook, causing an approved
  `authUserId + subjectType + staff` create to fail as `unexpected-field`.
- **Impact:** trusted services cannot create a PortalIdentity through the real
  registered Payload Local API. After A15-H01 is repaired, bootstrap would be
  blocked at this next operation.
- **Repair owner:** Agent 6/13 PortalIdentity collection boundary.
- **Required fix:** normalize and validate the approved Payload hook shape while
  retaining zero-subject, dual-subject, mismatch, exact allowlist, and
  immutability protections. Do not bypass the collection or relax database
  constraints.
- **Regression:**
  `integration/payload-access/portal-identity-create.integration.test.ts`.

### A15-M01 — Medium — readiness ignores Better Auth migration state

- **Affected module:** operations readiness, coordinated with Agents 3 and 14.
- **Root cause:** `checkPostgresReachable` receives only `DATABASE_URL` and checks
  only the Payload ledger/operational contract. It does not inspect
  `portal_auth.perfect_tax_auth_migrations`.
- **Impact:** deployment readiness reports ready while the authentication schema
  is not migration-ready.
- **Repair owner:** operations readiness plus Better Auth database ownership.
- **Required fix:** add a bounded, least-privilege Better Auth readiness contract
  that can verify the exact required migration without granting the auth runtime
  role DDL or Payload access and without emitting connection/migration details.
- **Regression:** `integration/readiness/migration-readiness.integration.test.ts`.

## Validation and reviewer handoff

Run under pinned Node `24.18.0`, pnpm `10.33.0`, Payload `3.86.0`, Better Auth
`1.6.23`, and PostgreSQL `17.10`. The exact harness and CI command are documented
in `integration/README.md`.

The final independent reviewer must first reproduce all three red regressions.
After upstream repairs, re-prove the same expected-success assertions without
fixture substitution, then extend bootstrap verification through first,
second, concurrent, mandatory-success-audit, partial-failure, login,
enrollment-only, and post-TOTP operational Owner states. The reviewer must also
re-run unit/security regressions, all real PostgreSQL integration tests, real
Next/Payload HTTP isolation, lint, typecheck, formatting, build, and
`git diff --check`.
