# Agent 12 security review — Primary Owner Bootstrap

**Review date:** 2026-08-20  
**Reviewer:** Independent architecture and security review  
**Candidate:** `feat/agent-12` at `9df1d254c66ea89e675426f2336ec1b5e300fcff`  
**Integration branch at review:** `user-structure` at `89048c7db4b83cd988633c7b870de8ec84a5437a`

> **Post-review architecture note (2026-08-20):** This report accurately
> records that schema ownership was unresolved at review time. ADR 0010's
> 2026-08-20 superseding operational collection ownership decision now places
> Staff, Clients, PortalIdentity, and SecurityEvents in the existing
> Payload-managed schema and migration lifecycle. References below to resolving
> `portal_identity` before Agent 13 are historical findings, not an active
> blocker.

## 1. Verdict

APPROVE — Agent 12 is safe to merge and the project may proceed to the pre-Agent-13 architecture decision.

## 2. Worktree state

```text
path: /Users/helvinrymer/Desktop/Projects/perfect-tax/tmp/worktrees/agent-12
branch: feat/agent-12
SHA: 9df1d254c66ea89e675426f2336ec1b5e300fcff
integration SHA: 89048c7db4b83cd988633c7b870de8ec84a5437a
merge-base: 89048c7db4b83cd988633c7b870de8ec84a5437a
commits under review:
  9df1d25 feat(auth): add primary owner bootstrap
dirty state: clean
```

The review covered the one committed Agent 12 change. `git diff --check` was clean.

## 3. Architecture consistency

The candidate was built on the merged Agent 1–11 baseline, including Agent 10's closed system-capability issuance and mandatory audit envelope and Agent 11's canonical portal-principal resolution. Owner remains a normal Staff role; it is not system authority. Staff MFA, the eight-hour absolute session lifetime, 15-minute freshness boundary, and CMS/portal separation remain intact.

The only privileged route is the intended ceremony:

```text
trusted non-web CLI invocation
→ private system source and capability
→ advisory-lock serialization
→ canonical primary-owner check
→ Agent 3 credential provisioner
→ protected Owner Staff creation
→ explicit PortalIdentity binding
→ mandatory audit
→ later normal sign-in and MFA enrollment
```

## 4. Closed system composition

`system-payload-gateway.ts` keeps the source resolver, target resolver, capability registry, audit-source registry, composition factory, issuer, runner, and dependency object private. Its runtime exports are limited to error/vocabulary values, `isPrimaryOwnerBootstrapOperation`, and `authorizePrimaryOwnerBootstrapRequest`.

The exported authorizer verifies an already-issued object-identity capability plus its exact Payload request binding; it cannot mint authority. No generic resolver-driven gateway, issuer, source attester, caller-selected operation, or caller-selected target export exists. A fake resolver returning `primary-owner-bootstrap` is therefore unusable.

## 5. Non-web boundary

The sole command is:

```text
pnpm portal:bootstrap-primary-owner
```

It directly executes the server-only system-gateway module. Searches found no bootstrap endpoint, browser action, portal UI, Payload Admin action, Better Auth endpoint, or CMS route. The generated production route table contains no bootstrap route.

## 6. One-owner invariant

The operation checks canonical Staff persistence for either `isPrimaryOwner = true` or `role = owner`, both before credential creation and again within the application transaction. It does not use email, caller input, Better Auth metadata, browser state, or cached state as owner evidence.

The write is fixed to:

```text
role = owner
status = active
isPrimaryOwner = true
```

Normal Staff operations still reject Owner creation, promotion, demotion, marker removal, disablement, and deletion.

## 7. Credential provisioning

Agent 12 uses Agent 3's server-only credential provisioner. It does not use public signup, create Better Auth roles, create a browser session, or assign Staff/CMS state inside Better Auth.

The CLI accepts only name, work email, login email, and password. Password input is process-environment only, never argv; it is scrubbed immediately after collection and excluded from output, events, result objects, and safe errors. The handoff requires transient secret-manager injection and prohibits `.env`, shell history, logs, JSON, and committed configuration.

## 8. Staff / PortalIdentity provisioning

The persistence runtime creates a fixed active primary Owner and then an explicit:

```text
AuthUserId → PortalIdentity(subjectType = staff) → StaffId
```

binding. It performs no email lookup or linking. Equal login/work emails remain contact equality only. No CMS user, MFA flag, provider role, invitation, session, or system capability is created.

## 9. Partial failure / compensation

| Failure point           | Actual resulting state                                        |
| ----------------------- | ------------------------------------------------------------- |
| Credential creation     | No Staff or PortalIdentity; required failure event attempted  |
| Staff creation          | Payload transaction rollback; Agent 3 credential compensation |
| PortalIdentity creation | Payload transaction rollback; Agent 3 credential compensation |
| Success audit append    | Rollback and compensation; no successful return               |
| Failure audit append    | Safe generic failure; no raw cause or secret output           |
| Lock acquisition        | No credential provisioning; failure event attempted           |
| Existing Owner check    | No credential or application writes                           |

Staff, PortalIdentity, and the success event use one Payload request/transaction. Better Auth remains a separate store, so compensation is application-level rather than a claimed distributed transaction.

## 10. Audit enforcement

Success cannot return until exactly one required `primary-owner.bootstrap.succeeded` event is appended and the transaction commits. Normal authorized failure appends exactly one `primary-owner.bootstrap.failed` event after privileged state has rolled back. Audit append failure fails closed and does not claim success.

Correlation ID is generated internally. Operation, reason, system actor, and success target derive from private provenance; the callback cannot replace the correlation ID, choose a target ID, or inject secrets. Audit data excludes credential/session/MFA material, raw request bodies, capabilities, principals, and full Staff records.

## 11. MFA post-bootstrap state

Bootstrap does not establish MFA verification or create a session. Following a normal sign-in, Agent 11 resolves the active bound Owner only to `StaffEnrollmentPrincipal` until Agent 9's TOTP enrollment and verification produce valid assurance for the exact live session. Owner has no MFA bypass.

## 12. Forgery / escalation matrix

| Attack                                        | Expected             | Actual                                                                         | Result                 |
| --------------------------------------------- | -------------------- | ------------------------------------------------------------------------------ | ---------------------- |
| Browser bootstrap                             | DENY/impossible      | No browser surface                                                             | PASS                   |
| HTTP bootstrap                                | DENY/impossible      | No HTTP surface                                                                | PASS                   |
| Owner/Administrator/Case Worker/Intake source | DENY                 | Private WeakSet miss                                                           | PASS                   |
| Client or enrollment principal source         | DENY                 | Private WeakSet miss                                                           | PASS                   |
| Fake or serialized capability                 | DENY                 | Private WeakMap miss                                                           | PASS                   |
| Fake context                                  | DENY                 | Capability/request binding fails                                               | PASS                   |
| Generic resolver injection                    | Impossible           | No exported composition factory                                                | PASS                   |
| Normal create Owner                           | DENY                 | Staff invariant requires private capability                                    | PASS                   |
| Promote, demote, disable, or delete Owner     | DENY                 | Staff invariants and delete hook                                               | PASS                   |
| Second bootstrap                              | DENY                 | Canonical Owner/marker count blocks it                                         | PASS                   |
| Concurrent second bootstrap                   | At most one succeeds | Mocked advisory-lock model has one success/one rejection; production is closed | PASS, pending DB proof |
| Email match as identity                       | DENY                 | Explicit AuthUserId binding only                                               | PASS                   |
| CMS user as operational Owner                 | DENY                 | CMS identity is not portal identity                                            | PASS                   |

## 13. Concurrency assessment

The implementation uses PostgreSQL session advisory-lock calls, not an in-memory mutex. Its intended lock window runs from preflight through terminal settlement. The candidate has unit/application proof for lock ordering and modeled concurrency, but no real PostgreSQL, independent-process, or real Payload transaction proof.

This does not create a live production weakness because `assertPrimaryOwnerBootstrapRuntimeReady` deliberately rejects execution with `NOT_READY` until Agent 13 registration and Agent 14 physical proof exist.

## 14. CMS isolation

Agent 12 changes no Payload CMS configuration, CMS role, CMS collection, CMS migration, schema, or CMS user provisioning. It creates no `cms-users` record, CMS administrator, publisher, editor, or bilingual reviewer.

## 15. Critical / High findings

None.

## 16. Medium / Low findings

### Medium — physical database proof intentionally deferred

Agent 13 registration and Agent 14 schema/migration work are absent. Real cross-process serialization, physical uniqueness, append-only guarantees, and transaction behavior are not yet demonstrated. The operation is fail closed, so this does not block the merge. Agents 13–15 must provide the database-backed readiness proof and real concurrent-attempt regression.

### Medium — committed negative-test matrix is representative rather than exhaustive

The repository tests directly enumerate Owner and Administrator sources and one completed-bootstrap input. Case Worker, Intake, Client, enrollment-principal, and contact-variant second attempts rely on the same object-identity/count logic; they were independently spot-checked during review. Add table-driven committed regressions before enabling production execution.

### Low findings

None.

## 17. Agent 13 handoff

Agent 13 must privately register Staff, PortalIdentities, SecurityEvents, and Clients. Staff must be registered through `createStaffCollection` with exactly `authorizePrimaryOwnerBootstrapRequest`. It must preserve denied ordinary access, invariant hooks, hidden Admin state, and `graphQL: false`; it must expose no HTTP/Admin/GraphQL/bootstrap fallback and leave readiness closed.

## 18. Agent 14 handoff

Agent 14 must resolve the `portal_identity` schema-ownership decision and provide reviewed migrations, at-most-one primary Owner enforcement, Owner-state checks, immutable/unique PortalIdentity constraints, append-only SecurityEvents, transaction proof for the shared Payload request, advisory-lock proof across independent processes, recovery/deployment procedures, and a database-backed readiness check.

## 19. Test coverage assessment

Covered: Staff invariants, system-export closure, fake resolver/capability/context attacks, audit provenance and secret exclusion, credential compensation, transactional seams, CLI secret handling, MFA/session behavior, and canonical principal composition.

Not covered: a successful real CLI run, real Better Auth plus Payload end-to-end composition, real Payload transaction behavior, real PostgreSQL lock/uniqueness proof, and process-termination recovery. The full suite's only skipped test was the pre-existing CMS clean-migration integration test, skipped because `CMS_TEST_DATABASE_URL` was absent.

## 20. Validation results

```text
git candidate checks and git diff --check: PASS
focused security suites: 12 files, 137 tests passed
pnpm lint: PASS
pnpm typecheck: PASS
pnpm test: 57 files passed, 1 skipped; 508 tests passed, 1 skipped
pnpm exec prettier --check <Agent-12 changed paths>: PASS
pnpm portal:bootstrap-primary-owner with missing input: safe failure, exit 1
pnpm build --webpack with disposable build environment: PASS
pnpm build (Turbopack): stalled during optimized-build compilation and was interrupted after more than 90 seconds
```

No real PostgreSQL bootstrap concurrency or transaction test was run, and this artifact makes no such claim.

## 21. Merge gate

Agent 12 is safe to merge.
Proceed to resolve the application-schema ownership decision before Agent 13.

## 22. Agent 14 closure amendment — 2026-08-31

The pending physical proof described above is now supplied by Agent 14. ADR
0010's 2026-08-31 matrix makes Payload the sole owner of the four Slice 1
operational tables in `public`, while Better Auth remains independently owned
in `portal_auth`. The committed PostgreSQL integration test proves migration
idempotence, populated-upgrade preservation, exact ownership comments,
cross-schema DDL isolation, runtime grants, owner uniqueness/protection,
immutable PortalIdentity rows, append-only SecurityEvents through the typed
definer function, transaction rollback, and advisory-lock serialization. The
readiness guard now verifies this physical contract before bootstrap can run.
Agent 15 still owns real HTTP exposure and end-to-end attestation regression;
this amendment does not expand Agent 12's approved security boundary.
