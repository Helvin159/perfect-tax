# ADR 0010: Better Auth compatibility, portal identity boundary, and Payload bridge gate

- Status: Accepted for Slice 1 identity work, with mandatory bridge constraints
- Decision date: 2026-07-18
- Bridge gate date: 2026-08-09
- Scope: Phase 1 Task 10 compatibility research plus Slice 1 authorization-bridge gate
- Tested Better Auth version: `1.6.23`
- Tested Payload version: `3.86.0`

## Decision

**Go**, conditionally, with Better Auth `1.6.23` as the Phase 2 portal-authentication candidate. The spike proved that this exact release installs, typechecks, builds, migrates, rejects an untrusted-origin mutation, and reads a server-side session with the repository's pinned stack.

This is not approval to add production authentication in Phase 1. Better Auth remains absent from the application until every Phase 2 entry criterion below is met. A dependency update requires a fresh compatibility and migration review; `1.6.23` is evidence, not a floating-version approval.

## 2026-08-09 Payload authorization-bridge gate

### Gate decision

**Approve** the attested-principal bridge for Slice 1, subject to every mandatory convention in this addendum. Payload `3.86.0` can execute Local API operations with `overrideAccess: false` for a Better Auth-derived operational principal without making that principal a `cms-users` record or changing Payload Admin authentication.

The trusted value is not the caller-supplied `user`, its role, its IDs, the context property name, or any TypeScript shape. The trusted value is a module-private, runtime-issued opaque object held in a private `WeakMap` and bound to the canonical principal resolved from a server-validated Better Auth session. Access functions accept a call only when the opaque token is recognized and the complete narrow `PortalPayloadUser` projection exactly matches the principal bound to that token.

This approval does not extend to arbitrary implementations using `WeakSet`, `WeakMap`, symbols, or request context. Two tempting variants failed the propagation probe:

- attesting the `req.context` container itself is unsafe because Payload may shallow-clone that container; and
- storing the only capability under a symbol key is unsafe because a nested Local API call can replace a symbol-only context with `{}` after testing it with `Object.keys`.

The proven representation is an opaque frozen token stored as the value of an enumerable string-keyed context property. The property name is not secret and grants no authority. Object identity of the token is the runtime capability.

### Repository baseline reviewed

The gate was run on branch `feat/agent-1` at commit `3ee79675f6b557abd9553d2079b319999eb22bea`. The worktree was clean before the proof. The review covered:

- `payload.config.ts`, including `admin.user: 'cms-users'`, `/admin`, `/api/cms`, schema push disabled, and the existing Nodemailer/Ethereal adapter;
- `src/modules/cms/users/**`, including the CMS-only collection discriminator and editorial roles;
- CMS access functions, CMS bootstrap authorization hook, and the one existing explicitly privileged CMS bootstrap path;
- content access, editorial workflow policy and hooks, public projection policy, and all current Local API call sites;
- the committed Payload migrations and migration tests;
- ADR 0010 and ADR 0011;
- current tests and dependency state; and
- the absence of Better Auth packages, routes, schemas, cookies, and runtime code from the production application.

No Staff, Client, PortalIdentity, operational authorization, Better Auth, route, migration, generated type, CMS workflow, or email-adapter production code was changed for this gate.

### Exact Payload behavior established

Installed Payload `3.86.0` behaves as follows:

1. Every tested Local API wrapper defaults `overrideAccess` to `true`; the portal gateway must therefore set `overrideAccess: false` explicitly on every user-driven call.
2. `createLocalReq` assigns the supplied `user` directly when it has a `collection` property. It does not require that collection to exist or be authentication-enabled.
3. If a supplied user lacks `collection`, Payload clones it and silently assigns `payload.config.admin.user`. In this repository that would be `cms-users`. Operational callers must always use an explicit non-CMS collection discriminator, and access functions must exact-match it to the attested principal.
4. `createLocalReq` shallow-merges `req.context` and Local API `context`. It does not serialize the values. An opaque nested token therefore retains object identity across the proven operations.
5. Collection access is executed through `executeAccess` only when `overrideAccess` is false. `false` denies; a query constraint is combined with the caller query.
6. Field read access receives the same `req`, including `req.user` and `req.context`, and removes a denied field from the returned document.
7. Collection hooks receive `context: req.context` and the same request. The proof asserted reference equality in `beforeChange`, `afterChange`, `beforeDelete`, and a nested audit hook.
8. Relationship population uses the request-scoped DataLoader and performs a nested `payload.find` with the same `req` and inherited `overrideAccess`. Related collection access therefore runs. When related access returns no document, Payload leaves the relationship ID instead of populated fields.
9. Nested hook operations preserve the opaque token and narrow user only when the same `req` is passed. This is mandatory.
10. Transactional create, update, delete, and nested operations use `req.transactionID`. The proof observed the same transaction UUID in parent hooks, nested access, and nested hooks.
11. Payload clones document `data` for create/update, but the proof observed no serialization or cloning of the opaque token value or the explicit user object in the accepted path.
12. Caller-controlled context reaches hooks by design, but remains untrusted because no lookalike token exists in the module-private capability registry.

Relevant installed implementation locations are:

- `node_modules/payload/dist/utilities/createLocalReq.js:4-20,65-107`;
- `node_modules/payload/dist/collections/operations/local/find.js:4-29` and the equivalent create/update/delete wrappers;
- `node_modules/payload/dist/auth/executeAccess.js:2-23`;
- `node_modules/payload/dist/collections/operations/find.js:43-74,205-272`;
- `node_modules/payload/dist/fields/hooks/afterRead/promise.js:223-264`;
- `node_modules/payload/dist/fields/hooks/afterRead/relationshipPopulationPromise.js:4-49,84-197`;
- `node_modules/payload/dist/collections/dataloader.js:9-115`;
- `node_modules/payload/dist/collections/operations/create.js:23-32,68-75,93-149,244-303,323-329`; and
- `node_modules/payload/dist/utilities/initTransaction.js:1-25`.

These are version-specific implementation facts, not API guarantees for later Payload releases. A Payload upgrade requires this gate to be rerun.

### Disposable experiments

The proof lived only at `/tmp/payload-bridge-proof-agent1` and used an isolated `postgres:17.10-bookworm` container bound to `127.0.0.1:55433`. Its minimal collections modeled a CMS identity, CMS-only editorial data, Clients, client-owned records, relationships, protected fields, and nested audit writes. The operational `user.collection` was deliberately `portal-principals`, a slug that was not a configured or authentication-enabled collection.

The tested architecture was:

```text
server-validated Better Auth session
        |
        v
module-private principal resolver
        |
        +-- frozen narrow PortalPayloadUser (explicit portal-principals discriminator)
        |
        +-- frozen opaque token -> private WeakMap -> canonical principal
                                   |
                                   v
               enumerable req.context capability slot
                                   |
                                   v
PortalPayloadGateway -> Payload Local API -> overrideAccess: false
                                   |
                                   v
          collection access + field access + invariant hooks
```

The normal proof covered `find`, `findByID`, `create`, `update`, `delete`, field access, authorized and unauthorized relationship resolution, collection hooks, nested reads, nested writes, and PostgreSQL transactions. A focused `createLocalReq` probe covered context cloning, symbol-only loss, opaque token preservation, and missing-collection relabeling.

### Positive results

| Scenario                                             | Result                                                                                                                                         |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner-like Staff `find` with `overrideAccess: false` | Pass; three records returned and collection/field access ran.                                                                                  |
| Client `find`                                        | Pass; only the two records owned by that Client returned.                                                                                      |
| Client `findByID`                                    | Pass; own record returned with protected field.                                                                                                |
| Owner-like Staff `create`                            | Pass; collection access, invariant hook, nested read, field access, after-change hook, and nested audit create all received valid attestation. |
| Owner-like Staff `update`                            | Pass with the same controls and nested operations.                                                                                             |
| Owner-like Staff `delete`                            | Pass; delete access and `beforeDelete` received valid attestation.                                                                             |
| Staff/Client distinction                             | Pass; the same collection policy returned all records to Staff and an ownership constraint to Client.                                          |
| Non-Payload operational identity                     | Pass; `portal-principals` was not a configured collection and was not auth-enabled.                                                            |
| Authorized relationship                              | Pass; Client A's related Client A record populated and field access ran.                                                                       |
| Nested transaction propagation                       | Pass; parent and nested operations shared the same transaction ID.                                                                             |

### Forgery results

| Attack                                                                  | Expected | Actual      | Result |
| ----------------------------------------------------------------------- | -------- | ----------- | ------ |
| Lookalike operational user                                              | Deny     | `Forbidden` | Pass   |
| Caller-supplied `role: owner`                                           | Deny     | `Forbidden` | Pass   |
| Caller-supplied Client ID                                               | Deny     | `Forbidden` | Pass   |
| Lookalike context fields and token object                               | Deny     | `Forbidden` | Pass   |
| JSON-serialized/deserialized valid-looking principal, user, and context | Deny     | `Forbidden` | Pass   |
| Owner user paired with Client B capability                              | Deny     | `Forbidden` | Pass   |
| Valid expected user without context                                     | Deny     | `Forbidden` | Pass   |
| Valid capability context without user                                   | Deny     | `Forbidden` | Pass   |
| Direct Local API update with attacker-created inputs                    | Deny     | `Forbidden` | Pass   |

Serialization produced a new plain token object that was absent from the private `WeakMap`; matching fields did not help. The mismatch test failed because the complete user projection did not match the principal bound to the genuine token. Missing halves failed closed.

### Relationship finding and limitation

Payload did not populate unauthorized Client B fields through a Client A-readable parent. It reran Client access with the propagated attestation, received no related document, and returned the raw Client B relationship ID. The ID behavior is explicit in the installed relationship population implementation.

Therefore `depth: 0` is mandatory by default, but it is not by itself a policy for whether a stored relationship ID may be disclosed: depth zero also returns the ID. Portal collection and field policies must prevent unauthorized references from being readable, or the gateway must exclude the relationship field with `select`. Any `depth > 0`, `populate`, join, or relationship field exposed to a portal response requires an explicit authorization and data-disclosure review plus a regression test.

### CMS isolation

The bridge requires none of the following: changing `admin.user`, replacing `cms-users`, changing CMS cookies, adding Better Auth to `/api/cms`, mapping CMS roles to portal roles, or changing editorial hooks and public content projection.

The disposable proof preserved a separate auth-enabled CMS collection and showed both directions of denial: the CMS administrator retained CMS editorial read access but had no portal access without a runtime capability, and the attested portal owner had no CMS editorial access because its explicit collection discriminator was not the CMS collection. Repository access helpers additionally require `collection === 'cms-users'` and an allowlisted editorial role. Matching email is not part of either decision.

The Local API's ability to accept a caller-supplied user is unrelated to HTTP authentication for Payload Admin or `/api/cms`. Payload's HTTP auth operation sets `req.user` only from configured authentication strategies. The portal gateway must remain server-only and must never attach its principal to an incoming `/api/cms` request.

### Better Auth boundary revalidation

The bridge relies only on the server-side session validation already proven for Better Auth `1.6.23` in the disposable compatibility spike recorded below. The expected session supplies an immutable Better Auth user ID and server-validated session/account state; the resolver then loads application-owned PortalIdentity/Staff/Client facts and issues the runtime capability. No raw session, role, Staff ID, Client ID, assignment ID, or reconstructed principal from a browser may enter the gateway as authority.

The bridge does not require the Better Auth Admin plugin, provider-administrator authority, impersonation, or Better Auth role fields. Application `owner` is an application authorization role only and never implies Better Auth administrator. The previously generated Admin-plugin schema remains informational and must not be enabled for Slice 1.

### Architectures considered

| Candidate                                                        | Decision                    | Reason                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Attested Local API principal and context                         | Selected                    | Preserves Payload collection/field defense-in-depth, requires no operational Payload auth collection, and passed all positive and forgery tests.                                                                                                                                                                                                   |
| Payload custom authentication strategy                           | Rejected for Slice 1        | Payload supports per-auth-collection strategies, so a separate collection may be isolatable, but it would add a second Payload authentication domain and couple Better Auth to Payload HTTP auth without solving a need demonstrated by the proof. Adding a strategy to `cms-users` is prohibited because it would influence Admin and `/api/cms`. |
| Application authorization gateway plus privileged Payload bypass | Rejected as the normal path | It can work, but makes application authorization the sole normal boundary and loses Payload access-control defense-in-depth. Reserve it only for narrowly reviewed system operations.                                                                                                                                                              |

### Mandatory downstream contract

Agents implementing Slice 1 must encode all of the following:

1. A server-only resolver validates the Better Auth session and loads canonical application identity and authorization facts. It accepts no browser-supplied principal fields.
2. Only that resolver/gateway module can issue opaque tokens. The private registry and issuance function are not exported to feature or client code.
3. Each token is bound to one immutable canonical principal. Every access helper exact-matches the full narrow user projection to that bound principal before evaluating roles or ownership.
4. `PortalPayloadUser.collection` is an explicit portal-only discriminator and must never be omitted, `cms-users`, or derived from email. Access code must reject all other discriminators.
5. The capability token is the value of an enumerable string-keyed request-context slot. Do not attest the context object, use a symbol-only slot, serialize the token, or treat the property name as a secret.
6. Every user-driven Payload call explicitly sets `overrideAccess: false`, `user`, `context`, `depth: 0`, and a narrow `select`. A typed gateway wrapper must make omission unrepresentable and must not expose `overrideAccess`, `req`, `depth`, `populate`, or joins as caller-controlled parameters.
7. Hooks and nested Local API calls pass the same `req` only within the same immutable principal and transaction. Critical hooks independently resolve attestation and fail closed; they do not trust `overrideAccess`, role strings, IDs, or mutable document data. A `beforeDelete` hook must independently authorize the target resource before any side effect because Payload runs it before proving a query access constraint against the target document.
8. A top-level gateway call always lets Payload create a fresh request. A `PayloadRequest`, its context, and its DataLoader are never cached or reused across principals. Cross-principal request reuse can leak a relationship document already cached under a more privileged principal.
9. Relationship fields, joins, `populate`, and `depth > 0` are denied by convention until individually reviewed and tested. Raw relationship ID disclosure must be considered explicitly.
10. Portal policies never accept `cms-users`; CMS policies never accept portal principals. Neither side links identities by email.
11. A `staff-enrollment` principal is never accepted by the operational Payload data gateway. It remains limited to the frozen `enroll-mfa`, `verify-mfa`, and `sign-out` boundary until it is replaced by a newly resolved active, MFA-verified Staff principal.
12. Normal and system gateways are separate modules and capabilities. The normal gateway cannot request bypass. A system gateway uses a different private allowlisted capability, requires a nonempty reason and audit event, exposes only named operations, and is never callable from user-controlled routes without separate authorization.
13. `owner` does not grant Better Auth provider administration. The Better Auth Admin plugin remains disabled.
14. Any Payload, Better Auth, relationship policy, context construction, nested-operation, transaction, or DataLoader behavior change requires regression tests; a Payload upgrade requires this disposable proof to be rerun.

### Security invariant disposition

| Invariant       | Result               | Evidence                                                                                                                |
| --------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| AUTH-BRIDGE-001 | Pass                 | Fake user, role, Client ID, context, and direct calls were denied.                                                      |
| AUTH-BRIDGE-002 | Pass                 | All normal operations ran collection access only with explicit `overrideAccess: false`; attacks threw `Forbidden`.      |
| AUTH-BRIDGE-003 | Pass                 | Staff received boolean access; Client received an ownership constraint from the attested principal.                     |
| AUTH-BRIDGE-004 | Pass                 | Protected field access received the same attested request and removed fields when untrusted.                            |
| AUTH-BRIDGE-005 | Pass                 | Hooks reference-checked context, resolved attestation independently, and performed nested invariant reads.              |
| AUTH-BRIDGE-006 | Pass with limitation | Unauthorized related fields did not populate; raw relationship IDs remain visible and require `select`/policy controls. |
| AUTH-BRIDGE-007 | Pass                 | Both isolation directions were denied; CMS access remained functional and configuration need not change.                |
| AUTH-BRIDGE-008 | Pass                 | No Better Auth Admin plugin or provider-admin authority is involved.                                                    |
| AUTH-BRIDGE-009 | Pass                 | Separate runtime capability namespaces proved normal and reason-bearing system paths are viable.                        |
| AUTH-BRIDGE-010 | Pass                 | JSON reconstruction lost token identity and was denied.                                                                 |

**Slice 1 is approved to proceed with this exact constrained architecture.** This is an approval of a contract, not permission to generalize caller-supplied Payload users or context as trusted.

### 2026-08-10 merged-branch revalidation

The gate was rerun after the ADR and Agent 2 domain contracts were merged. The revalidation baseline was branch `user-structure`, commit `c1024527c0375e5482285a611ce12d83521e0428`, with a clean worktree. It used Node.js `24.18.0`, Payload and PostgreSQL adapter `3.86.0`, and a disposable `postgres:17.10-bookworm` database. Better Auth remains intentionally absent from production dependencies; the selected and previously compatibility-proven version remains `1.6.23`.

The proof lived at `/tmp/payload-bridge-proof-agent1-20260810` and was not added to production source. It repeated `find`, `findByID`, `create`, `update`, `delete`, collection access, field access, hooks, nested reads, nested audit writes, relationship population, transaction propagation, CMS crossover denials, `createLocalReq` cloning behavior, and all nine required forgery attacks. The positive and forgery results reproduced the earlier gate: all legitimate scenarios passed and every fake user, fake role, fake Client ID, fake context, reconstructed value, mismatch, missing half, and direct attacker-created Local API call was denied with `Forbidden`.

The revalidation also added two adversarial probes:

| Probe                                                                                               | Observed result                                                                                                                                    | Required response                                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reuse one `PayloadRequest` first as Staff and then as Client while populating the same relationship | The Client call received the relationship document already cached by the Staff call. The DataLoader cache did not rerun related collection access. | The gateway must create a fresh top-level request per immutable principal, never accept `req` from callers, and never reuse a request or DataLoader across principals. `depth: 0` and narrow `select` remain the default. |
| Inspect constrained delete ordering                                                                 | Collection delete access runs first, but `beforeDelete` runs before Payload looks up the target under the returned query constraint.               | A side-effecting delete hook must load and authorize resource evidence independently before acting. Attestation proves the caller identity, not target ownership.                                                         |

The first behavior follows from the request-scoped DataLoader implementation: relationship cache keys carry collection, document, depth, transaction, and access mode, but not the opaque capability or full principal. The second follows from the installed `deleteByID` operation order. These are not reasons to reject the bridge because the gateway can make cross-principal request reuse unrepresentable and critical hooks can enforce resource authorization independently. They are mandatory limitations of the approval, not optional hardening.

The merged provider-independent principal contract now includes `staff-enrollment` in addition to Staff and Client. That principal is intentionally incapable of operational Payload data access: its only allowed operations are MFA enrollment, MFA verification, and sign-out. Agent 10 must reject it before issuing gateway arguments; Agent 11 may replace it with a fully resolved Staff principal only after active Staff status and verified MFA are re-established.

The 2026-08-10 revalidation therefore preserves the **Approve** decision, with the expanded mandatory contract above. AUTH-BRIDGE-006 remains a pass only for fresh requests and reviewed relationship exposure; deliberate cross-principal request reuse is proven unsafe and prohibited.

## Tested compatibility matrix

| Component         | Exact version tested                                                                                                  | Finding                                                                                                                                                                                                                                                                            |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js           | `24.18.0` (`node:24.18.0-bookworm`, digest `sha256:5711a0d445a1af54af9589066c646df387d1831a608226f4cd694fc59e745059`) | Pass. All spike commands ran in this container because the host shell was Node `23.1.0`, not the selected runtime.                                                                                                                                                                 |
| pnpm              | `10.33.0`                                                                                                             | Pass. Strict peer installation completed.                                                                                                                                                                                                                                          |
| Better Auth       | `1.6.23`                                                                                                              | Pass. The package and matching `auth` CLI were pinned exactly.                                                                                                                                                                                                                     |
| Next.js           | `16.2.10`                                                                                                             | Pass. Better Auth declares Next `14`, `15`, or `16` as an optional peer. The disposable App Router handler and RSC session page production-built successfully.                                                                                                                     |
| React / React DOM | `19.2.7`                                                                                                              | Pass. Better Auth declares React `18` or `19` as optional peers.                                                                                                                                                                                                                   |
| Payload           | `3.86.0` (`payload`, `@payloadcms/next`, and `@payloadcms/db-postgres`)                                               | Pass with an architectural boundary. Payload documents Next `16.2.6+` support, strict peer installation succeeded, its supported entry points loaded alongside Better Auth, and the clean Payload application verification passed. There is no direct Payload/Better Auth adapter. |
| PostgreSQL        | `17.10` (`postgres:17.10-bookworm`)                                                                                   | Pass. Better Auth generated SQL, migrated its non-default schema, created sessions, and read them through `pg` `8.20.0`.                                                                                                                                                           |
| TypeScript        | `6.0.3`                                                                                                               | Pass. The disposable integration and the clean application typechecked.                                                                                                                                                                                                            |

The first module-coexistence probe attempted the unsupported package-root import `@payloadcms/next` and received `ERR_PACKAGE_PATH_NOT_EXPORTED`. Inspection confirmed that the package intentionally exports subpaths. The corrected probe used `@payloadcms/next/withPayload`, matching Payload's public API, and passed. This was not a Better Auth collision.

## Disposable spike design

The workspace was created at `/tmp/client-services-portal-better-auth-spike.<random>` and mounted only into an isolated Node container. It was never placed under the repository. An isolated Docker network connected that container to a disposable PostgreSQL container.

The proof contained:

- Better Auth `1.6.23`, matching `auth` CLI `1.6.23`, and the application's exact framework/CMS packages;
- the recommended Next.js `toNextJsHandler` catch-all route;
- a React Server Component calling `auth.api.getSession({ headers: await headers() })`;
- a direct server proof that registered a disposable user, captured its session cookie, and read the session;
- an HTTP proof that registered through the built Next server and rendered the authenticated RSC;
- a rejected state-changing request from `https://evil.example` through the actual Better Auth HTTP handler;
- generated core SQL plus generated Admin and two-factor plugin deltas; and
- a non-default `portal_auth` schema beside a `public`-schema boundary marker.

No production application source, route, dependency, environment variable, migration, or database was used by the spike.

## Commands and observed results

Credentials and random temporary suffixes are deliberately redacted. All values existed only in disposable containers.

```sh
mktemp -d /tmp/client-services-portal-better-auth-spike.XXXXXX
docker network create <spike-network>
docker run --detach --name <spike-db> --network <spike-network> \
  --env POSTGRES_DB=<disposable-db> --env POSTGRES_USER=<disposable-user> \
  --env POSTGRES_PASSWORD=<disposable-password> postgres:17.10-bookworm
docker exec <spike-db> pg_isready --username <disposable-user> --dbname <disposable-db>
docker exec <spike-db> psql ... --command 'SHOW server_version;'
# Result: 17.10 (Debian 17.10-1.pgdg12+1)

docker run --detach --name <spike-node> --network <spike-network> \
  --volume <spike-workspace>:/spike --workdir /spike \
  --env DATABASE_URL=<disposable-url> node:24.18.0-bookworm sleep infinity
docker exec <spike-node> node --version
docker exec <spike-node> corepack prepare pnpm@10.33.0 --activate
docker exec <spike-node> pnpm --version
# Results: v24.18.0 and 10.33.0

docker exec <spike-node> pnpm install --strict-peer-dependencies
# Result: PASS; exact Better Auth, Next, React, Payload, pg, and TypeScript pins installed.

docker exec <spike-node> pnpm schema:generate
# Result: PASS; schema.sql generated.

docker exec <spike-db> psql ... --command \
  'CREATE SCHEMA portal_auth; CREATE TABLE public.payload_boundary_marker (...); \
   ALTER ROLE <disposable-user> IN DATABASE <disposable-db> SET search_path TO portal_auth, public;'
docker exec <spike-node> pnpm schema:migrate
docker exec <spike-db> psql ... --command '<list portal_auth and public tables>'
# Result: portal_auth.account, portal_auth.session, portal_auth.user,
# portal_auth.verification, and only public.payload_boundary_marker.

docker exec <spike-node> pnpm proof
# Corrected result: PASS; server session read, en preference, and HTTP 403 for an
# untrusted-origin sign-out mutation.

docker exec <spike-node> pnpm typecheck
docker exec <spike-node> pnpm build
# Result: PASS; Next 16.2.10 built /api/auth/[...all] and dynamic /proof routes.

docker exec --detach <spike-node> pnpm exec next start --hostname 127.0.0.1 --port 3000
docker exec <spike-node> pnpm exec tsx http-proof.ts
# Result: { "httpRoute": "PASS", "rscSessionRead": "PASS" }

docker exec <spike-node> pnpm exec auth generate \
  --config auth-plugins.ts --output schema-plugins.sql --yes
# Result: PASS; Admin and two-factor schema delta inspected.

docker exec <spike-node> node --input-type=module --eval \
  "await Promise.all([import('better-auth'), import('better-auth/next-js'), \
  import('payload'), import('@payloadcms/next/withPayload'), \
  import('@payloadcms/db-postgres')])"
# Result: PASS.
```

An early security assertion incorrectly expected origin rejection on the read-only `getSession` call. A second attempt used the server-only `auth.api.signOut` method, which is not a browser request and therefore bypasses HTTP middleware. The final proof correctly sent `POST /api/auth/sign-out` through `auth.handler`; Better Auth logged `Invalid origin` and returned `403`. The finding is important: HTTP-origin/CSRF controls are exercised at the HTTP boundary, while calls made through trusted server-only APIs require the application to preserve that boundary.

## Schema and migration ownership

### Inspected Better Auth schema

The core configuration generated four tables in `portal_auth`:

- `user`: identity, normalized email, verification status, timestamps, optional image, and the spike's `preferredLanguage` field;
- `session`: unique token, expiry, timestamps, IP address, user agent, and cascading user reference;
- `account`: provider identity, password hash or provider tokens, scopes, expiries, and cascading user reference; and
- `verification`: identifier, value, expiry, and timestamps.

Indexes were generated for `session.userId`, `account.userId`, and `verification.identifier`; email and session token were unique.

The Admin plugin delta added `role`, `banned`, `banReason`, and `banExpires` to `user`, plus `impersonatedBy` to `session`. The two-factor plugin delta added `twoFactorEnabled` to `user` and a `twoFactor` table containing the TOTP secret, backup codes, verification state, failure count, and lock expiry. Plugin enablement therefore changes the auth schema and must be decided before the initial Phase 2 migration.

### Ownership decision

- Payload exclusively owns its current `public` schema and `src/modules/cms/migrations` through the Payload CLI and its `payload_migrations` ledger.
- Better Auth exclusively owns core and plugin DDL in a dedicated `portal_auth` schema. It must connect with a dedicated database role whose default `search_path` begins with `portal_auth`; it must not share Payload's role or use Payload's Drizzle push/migration workflow.
- Better Auth's CLI `generate` and `migrate` commands both worked with the built-in PostgreSQL/Kysely adapter. The spike observed no Better Auth migration-ledger table: `migrate` reconciled the live schema. For production, generate and review SQL against a production-like clone, commit it in a dedicated Phase 2 auth-migration directory, apply it through an independently locked release step, and record it in an application-owned auth migration ledger. Direct CLI `migrate` is acceptable only for disposable development databases.
- Any invitation, staff/CMS link, or audit table is application identity data, not Better Auth core and not Payload content. Put it in a third `portal_identity` schema with separately reviewed application migrations. Better Auth and Payload generators must have no DDL privilege there.
- Deployment runs Payload, Better Auth, and application-identity migrations as explicit independent jobs. Each job uses its own role, schema, ledger, backup/rollback plan, and failure boundary. No job silently runs at application request time.

The spike proved that Better Auth respects PostgreSQL `search_path`: its four tables landed in `portal_auth`, while the `public` boundary marker remained untouched.

## Future integration decisions

### API route and Next.js integration

Phase 2 will mount `toNextJsHandler(auth)` at `/api/auth/[...all]`, the recommended same-origin App Router route. `nextCookies()` may be used for Server Actions that must forward `Set-Cookie`, and it must be the last plugin. Server Components cannot refresh cookies, so mutation and refresh behavior belongs in Route Handlers or Server Actions.

Next.js `proxy.ts` may use cookie existence for an optimistic redirect only. It is never an authorization boundary. Every protected page, Route Handler, Server Action, and data service must validate the session server-side and then enforce resource authorization.

### Session access boundary

One server-only auth application service will call `auth.api.getSession` with request headers and map the result into a minimal internal principal: immutable portal user ID, domain subject ID, role set, suspension state, MFA assurance, and preferred language. Raw Better Auth sessions, tokens, adapter objects, and plugin fields do not cross into client components or public DTOs. Feature code depends on the internal principal interface, not Better Auth.

Initial sessions remain database-backed with cookie caching disabled so suspension, deletion, and session revocation take effect immediately. Any future cookie cache or secondary store requires an explicit maximum revocation delay, invalidation tests, and an incident-response decision.

### Cookie policy

Production cookies are host-only, `HttpOnly`, `Secure`, `SameSite=Lax`, and `Path=/`; no `Domain` attribute and no cross-subdomain sharing. Configure a neutral application cookie prefix and force secure cookies instead of relying only on `NODE_ENV`. Cookie lifetime must match an explicitly configured session lifetime; do not inherit the seven-day default silently. `SameSite=None`, third-party cookies, and a separate auth domain are prohibited without a new cross-site threat review. TLS is mandatory.

The exact session lifetime and reauthentication interval remain a Phase 2 security/product decision. Staff and administrator sensitive operations require a fresh, MFA-verified session regardless of the general client session lifetime.

### Origin and CSRF policy

Use a static canonical `baseURL` for each environment. `trustedOrigins` is an exact allowlist containing only that environment's canonical origin and any separately approved first-party origin. Development and preview origins are isolated from production. Do not accept wildcards, reflect request headers, or enable `disableCSRFCheck` or `disableOriginCheck`. Trust proxy headers only behind a named trusted proxy configuration.

Retain Better Auth's layered protections: non-simple JSON requests for mutations, origin validation, Fetch Metadata checks for first-login requests, `SameSite=Lax`, and OAuth state/nonce checks. Add automated negative tests for hostile `Origin`, hostile callback URLs, cross-site navigation, missing/forged Fetch Metadata, and every state-changing custom endpoint. Server-only `auth.api` calls bypass the browser HTTP boundary and must never receive untrusted request data without application authorization.

### Registration and client defaults

Public registration, if approved for launch, creates only a `client` role. The role is server-owned, cannot be supplied by the request, and has no staff, administrator, CMS, invitation, or user-management permission. Require verified email before a session is created and disable automatic sign-in after registration to retain email-enumeration protections. Use generic responses and distributed rate limiting.

If the business chooses invite-only client onboarding, reject public sign-up through a server-side policy hook or disable it globally; hiding the UI is insufficient. This launch choice must be made before Phase 2 implementation.

### Staff invitation and administrator provisioning

Do not use the Organization plugin solely to obtain invitations; the portal has no approved multi-tenant organization model. Implement an application-owned `portal_identity.staff_invitations` workflow with a cryptographically random, hashed, single-use token; exact invited email; allowlisted role; inviter ID; 24-hour expiry; revocation and consumption timestamps; and immutable audit events. Acceptance requires email verification, an active invitation, and MFA enrollment before staff authorization is granted. Invitation endpoints are server-only and require a fresh MFA-verified administrator session.

The first portal administrator is provisioned by a one-time, non-web, audited bootstrap procedure with no committed password. Later administrators are invited or promoted only by an existing administrator using fresh MFA, explicit reauthentication, and dual approval. Public registration and ordinary staff invitation can never create or promote an administrator.

### Account recovery and transactional email

Phase 2 depends on a selected transactional email provider, verified sending domain, SPF, DKIM, DMARC, bounce/complaint handling, provider sandbox, delivery monitoring, and approved English and Spanish templates. Provider credentials remain server-only. Logs must omit tokens, reset URLs, passwords, and full message bodies.

Configure Better Auth's verification and password-reset callbacks with short-lived single-use links, exact trusted callback URLs, generic responses, rate limiting, and asynchronous delivery that does not leak timing. Password reset revokes all existing sessions. Define support identity-verification and break-glass procedures before launch; support staff may not manually set or disclose passwords. Test expired, reused, tampered, wrong-locale, and wrong-origin links.

### MFA direction

Use Better Auth's two-factor plugin with TOTP and one-time backup codes for portal staff and administrators. MFA is mandatory before privileged access and before accepting a staff role; clients may remain optional unless the threat model changes. Backup codes are shown once, stored only as Better Auth intends, and regenerated after use or recovery. Email OTP is not the primary second factor because the same email channel handles password recovery. Passkeys/WebAuthn can be evaluated later as phishing-resistant MFA, but were not tested here.

The plugin's schema, trusted-device duration, backup-code recovery, lockout behavior, step-up enforcement, and administrator recovery runbook require integration tests. A privileged session must carry an application-verified MFA assurance; a role string alone is insufficient.

### Preferred language

Better Auth's user profile owns the canonical authenticated preference as a validated `preferredLanguage` additional field restricted to `en` or `es`. The spike proved that `en` was returned in the server session. The explicit URL locale remains authoritative for rendering. An explicit switch persists to the Better Auth profile and the device locale cookie; a failed profile write does not reverse navigation. Anonymous preference remains cookie-owned.

### Suspension, deletion, and audit behavior

The earlier Phase 2 candidate of using the Admin plugin's ban capability is superseded for Slice 1. The Admin plugin is not enabled. Slice 1 keeps suspension state in the application identity boundary, makes the server-only resolver fail closed on that state, and must separately prove the selected core-session revocation procedure before launch. Enabling the Admin plugin later would require a new schema, privilege, and migration decision; its provider roles could never be inferred from application `owner` or administrator roles.

Account deletion is an application workflow, not a raw cascade initiated from the browser. It revokes sessions, disables links, records an immutable audit event, detaches credentials from the durable domain subject, and then deletes or anonymizes identity data according to the approved legal retention policy. It must never cascade-delete client service, tax, document, CMS, or audit records. A deleted or missing Better Auth identity fails closed for portal and linked CMS access.

### Portal/CMS separation and optional linking

Portal identities and Payload `CmsUsers` remain separate by default. They have distinct credentials, sessions, recovery, MFA, roles, tables, and lifecycle policies. Never link records by matching email, even when both emails are verified.

If CMS single sign-on is approved later, add an audited staff-only link table containing its own immutable ID, Better Auth user ID, stable numeric `CmsUsers` ID, status, creator/approver IDs, timestamps, reason, and unlink history. Create a link only after an authorized administrator explicitly selects both records and verifies the live portal identity; use dual approval for administrator links. Enforce unique active links on both IDs. Suspension, deletion, unlinking, role mismatch, or a missing record fails closed without deleting the `CmsUsers` audit record.

### Rollback from a future Payload custom strategy

Adopt any custom Payload strategy additively:

1. Add the nullable link and audit events without changing Payload login.
2. Link one pilot administrator explicitly by stable IDs.
3. Put the Better Auth-backed strategy behind a server-side feature flag.
4. Run both login paths during a bounded rollback window and test login, logout, role changes, suspension, deletion, recovery, and session revocation.
5. Disable Payload password login only for a successfully linked account after acceptance evidence is recorded.

Rollback disables the custom strategy, revokes Better Auth-derived Payload sessions, and restores the still-controlled Payload login path or break-glass procedure. Preserve the stable `CmsUsers` ID and its content/audit relationships. Never recreate or relink a CMS identity by email.

## Test strategy for Phase 2

- Unit tests: exact config, role/default-field input controls, origin allowlist construction, cookie attributes, invitation policy, locale validation, principal mapping, suspension/deletion transitions, and email redaction.
- PostgreSQL integration tests: clean generated migration, upgrade migration, rollback/restore rehearsal, schema/role isolation, constraints, token expiry/single use, session revocation, banned user behavior, and concurrent invitation acceptance.
- Better Auth HTTP tests: registration, verification, sign-in/out, recovery, enumeration resistance, rate limits, cookie flags, hostile origins/callbacks, CSRF/Fetch Metadata, session fixation, MFA/TOTP, backup codes, trusted devices, and fresh-session step-up.
- Authorization tests: client/staff/admin matrix, ownership/IDOR checks, server-only API bypass attempts, suspended/deleted users, and stale cached sessions.
- Next.js tests: handler and Server Action cookie propagation, RSC reads, proxy-as-redirect-only behavior, locale preservation after login, and no secrets in client bundles.
- Payload-link tests, if enabled: explicit stable-ID link, dual approval, no email auto-link, fail-closed propagation, unlink audit, parallel-login window, and rollback.
- End-to-end tests: English and Spanish registration/recovery/MFA paths, accessibility, mail-provider sandbox delivery, and multi-device revocation.

## Phase 2 entry criteria

All items are mandatory before adding Better Auth to the application:

1. Business owners approve public versus invite-only client registration, portal staff roles, administrator provisioning, suspension, deletion, privacy, retention, and support recovery policies.
2. Security owners approve explicit session lifetime, fresh-session interval, cookie policy, exact production/staging origins, trusted proxy behavior, rate-limit storage, and audit requirements.
3. A transactional email provider and verified domain are operational with SPF/DKIM/DMARC, English/Spanish templates, monitoring, and secret management.
4. Staff/administrator TOTP enrollment, backup-code handling, lost-factor recovery, step-up rules, and break-glass ownership are approved and testable.
5. PostgreSQL roles and the `portal_auth` and `portal_identity` schemas are designed with least privilege; Payload, Better Auth, and application migrations have separate directories, ledgers, locks, and deployment/rollback procedures.
6. The exact Better Auth version is pinned and its core, Admin, and two-factor generated SQL is reviewed. Any version newer than `1.6.23` repeats this spike's install, build, schema-diff, session, origin, and migration tests.
7. The server-only principal/session boundary and resource-authorization matrix are reviewed; no client-side or proxy cookie check is accepted as authorization.
8. The invitation data model and client-role non-escalation controls are implemented in tests before registration endpoints are exposed.
9. Suspension, deletion, session revocation, audit retention, and domain-record non-cascade behavior pass integration tests.
10. Any CMS linking decision is explicit. If enabled, stable-ID linking, dual approval, fail-closed propagation, bounded dual-login rollout, and rollback are implemented and tested; email auto-linking is prohibited.
11. Clean migration and restore rehearsals pass on a production-like PostgreSQL 17 clone, and the complete application quality/security suite passes.

## Known unresolved risks

- The business has not yet selected public versus invite-only client registration or approved portal role ownership.
- Transactional email provider, sender-domain controls, delivery monitoring, bilingual templates, and support recovery procedures are undecided.
- Session lifetime, reauthentication interval, distributed rate-limit storage, trusted-device use, and proxy-header ownership need threat-model approval.
- Better Auth's direct Kysely `migrate` reconciles live state without the migration ledger observed in Payload; the proposed reviewed-SQL ledger and rollback workflow still needs implementation proof.
- Admin and two-factor plugins were schema-inspected but their complete runtime flows, recovery edge cases, and role-escalation controls were not production-validated.
- TOTP is not phishing-resistant. Passkeys/WebAuthn, device loss, and staff break-glass recovery remain future decisions.
- Account deletion and anonymization depend on legal retention rules for tax, administrative, document, and audit records.
- The optional Payload custom strategy and identity link were designed but not built; Payload upgrade behavior and rollback must be tested if that option is approved.
- Framework, CMS, database, and Better Auth upgrades can change peer ranges, schema, cookie behavior, or integration guidance. Exact versions must remain pinned and deliberately retested.
- The spike used isolated containers and synthetic identities. It is compatibility evidence, not a penetration test, deliverability test, operational load test, or production security certification.

## Cleanup and clean-application verification

Cleanup permanently removed both disposable containers, their PostgreSQL data and test identities, the isolated Docker network, and the complete `/tmp` workspace. That workspace included the Better Auth dependency, route, secrets, generated core/plugin SQL, migration proof, build output, lockfile, and test credentials. Follow-up checks found no matching containers, network, or workspace path.

An aggregate SHA-256 over `package.json`, `pnpm-lock.yaml`, `.nvmrc`, `compose.yml`, `payload.config.ts`, and every file under `src` was captured before documentation work and repeated after cleanup and verification. Both values were identical:

```text
573253e3c1c5c2d577312aab06cd363da5df1cc656f13e7139b4762eadefa4c5
```

The clean application commands ran with Node `24.18.0` and pnpm `10.33.0`:

| Command             | Final result                                                                                                                                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm install`      | Pass; lockfile up to date, dependencies already up to date.                                                                                                                                                                                                                          |
| `pnpm lint`         | Pass.                                                                                                                                                                                                                                                                                |
| `pnpm format:check` | Pass after applying the repository's Prettier version to this ADR only.                                                                                                                                                                                                              |
| `pnpm typecheck`    | Pass. The first sandboxed attempt could not write the ignored incremental cache; the permitted rerun passed.                                                                                                                                                                         |
| `pnpm test`         | Pass: 28 files passed, 1 database integration file skipped; 136 tests passed, 1 skipped. The first sandboxed attempt could not write Vite's ignored temporary cache; the permitted rerun passed.                                                                                     |
| `pnpm build`        | Pass; Next `16.2.10` compiled, typechecked, generated 19 pages, and completed route optimization. The configured CMS database was unavailable, so the existing public-safe fallback emitted `cms-unavailable` diagnostics; the build exited successfully and exposed no credentials. |

The final runtime scan covered `package.json`, `pnpm-lock.yaml`, the ignored local environment, `.env.example`, `src`, `compose.yml`, and `payload.config.ts`. It searched for the Better Auth package name, Better Auth environment keys, handler/session/cookie helper APIs, the disposable schema, generated core-table DDL, and auth route files. It returned no match. Documentation and `.codex` planning references were intentionally outside this runtime scan because this ADR must record the future route and tested dependency.

## Architecture-conformance checklist

- [x] Research and proof ran outside the application source tree.
- [x] Better Auth version and the actual pinned stack were tested exactly.
- [x] Minimal direct and over-HTTP server-side session reads passed.
- [x] Core, Admin, and two-factor schema effects were inspected.
- [x] Better Auth and Payload schemas and migration ownership are separate.
- [x] Future route, cookie, origin, CSRF, session, registration, roles, invitations, provisioning, recovery, email, MFA, locale, lifecycle, testing, linking, and rollback decisions are recorded.
- [x] The ADR contains a go/no-go conclusion, Phase 2 entry criteria, and unresolved risks.
- [x] Disposable workspace, containers, network, database objects, credentials, routes, schemas, generated files, and migrations removed.
- [x] Application dependencies, source, environment example, and lockfile contain no Better Auth runtime infrastructure.
- [x] Clean application install, lint, format, typecheck, test, and build pass.
- [x] Final forbidden-artifact search is documented.

## Sources

- [Better Auth installation](https://better-auth.com/docs/installation)
- [Better Auth Next.js integration](https://better-auth.com/docs/integrations/next)
- [Better Auth database and schema](https://better-auth.com/docs/concepts/database)
- [Better Auth CLI and migration tooling](https://better-auth.com/docs/concepts/cli)
- [Better Auth PostgreSQL adapter](https://better-auth.com/docs/adapters/postgresql)
- [Better Auth security and CSRF controls](https://better-auth.com/docs/reference/security)
- [Better Auth cookie defaults](https://better-auth.com/docs/concepts/cookies)
- [Better Auth session management](https://better-auth.com/docs/concepts/session-management)
- [Better Auth email and recovery](https://better-auth.com/docs/concepts/email)
- [Better Auth Admin plugin](https://better-auth.com/docs/plugins/admin)
- [Better Auth two-factor plugin](https://better-auth.com/docs/plugins/2fa)
- [Better Auth rate limiting](https://better-auth.com/docs/concepts/rate-limit)
- [Payload installation and supported versions](https://payloadcms.com/docs/getting-started/installation)
- [Payload PostgreSQL adapter](https://payloadcms.com/docs/database/postgres)
- [Payload migration workflow](https://payloadcms.com/docs/database/migrations)
- [Next.js 16 upgrade requirements](https://nextjs.org/docs/app/guides/upgrading/version-16)
