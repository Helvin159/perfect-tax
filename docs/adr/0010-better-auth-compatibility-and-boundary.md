# ADR 0010: Better Auth compatibility and portal identity boundary

- Status: Accepted for Phase 2 entry, with prerequisites
- Decision date: 2026-07-18
- Scope: Phase 1 Task 10 research and disposable proof only
- Tested Better Auth version: `1.6.23`

## Decision

**Go**, conditionally, with Better Auth `1.6.23` as the Phase 2 portal-authentication candidate. The spike proved that this exact release installs, typechecks, builds, migrates, rejects an untrusted-origin mutation, and reads a server-side session with the repository's pinned stack.

This is not approval to add production authentication in Phase 1. Better Auth remains absent from the application until every Phase 2 entry criterion below is met. A dependency update requires a fresh compatibility and migration review; `1.6.23` is evidence, not a floating-version approval.

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

Use the Admin plugin's ban capability for suspension because it prevents sign-in and revokes existing sessions. Every authorization path must also fail closed on suspended state. Suspension propagates to application access and any CMS link, while client records and audit history remain intact.

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
