# Client Services Portal

Reviewable foundation for a bilingual client-services portal. It includes the
localized public site, allowlisted CMS projections, independently authenticated
Payload administration, the reviewed Better Auth/session boundary, PostgreSQL
migrations, public contact actions, metadata/PWA foundations, health endpoints,
and focused security tests. Production portal authentication and sensitive
client workflows remain intentionally deferred.

The current Slice 1 security architecture and operator procedures are
[documented here](docs/architecture/portal-identity-authorization.md), with
[bootstrap](docs/operations/primary-owner-bootstrap.md),
[deployment](docs/operations/database-migrations-and-deployment.md), and
[security validation](docs/operations/security-validation.md) runbooks. These
documents supersede older agent handoffs when they conflict.

## Prerequisites

- Node.js `24.18.0`
- pnpm `10.33.0`
- Docker Desktop or Docker Engine with Compose v2

Use the pinned runtime before installing dependencies:

```sh
nvm install
nvm use
corepack enable
pnpm install
```

CI and deployment environments must use the exact Node.js version in `.nvmrc` and `package.json#engines`. Runtime upgrades should update both pins in the same change and rerun the full verification suite.

## Local Environment

Copy the documented local-only defaults, then replace the Payload secret instruction with a generated value:

```sh
cp .env.example .env
openssl rand -base64 48
```

Paste the command output into `PAYLOAD_SECRET` in `.env`. Every `.env*` file is ignored except `.env.example`; never commit `.env`, reuse its database password outside local development, or place production credentials in Compose. Production and preview environments must inject secrets through their deployment platform.

`DEPLOYMENT_ENV` is not introduced yet. `NODE_ENV` covers current behavior, and an additional deployment label should be added only with a concrete staging/preview behavior that needs it.

## PostgreSQL

Local development uses the pinned Docker Official Image `postgres:17.10-bookworm`. PostgreSQL 17 is supported upstream through November 2029, while `17.10` is its current fix release. It is a compatibility-first choice over major 18: Payload `3.86.0` uses Drizzle `0.45.2` and `node-postgres` `8.20.0`; PostgreSQL 17 is supported by that stack and is mature across likely hosts including AWS RDS, Neon, and Supabase. The Debian variant is explicit so a moving default distribution does not change the image unexpectedly.

Use the same PostgreSQL major in CI, staging, and production. Before any major upgrade, test Payload migrations and a logical backup/restore with client tools at least as new as the server.

Validate and start the database:

```sh
docker compose config
docker compose up -d
docker compose ps
```

`postgres` should report `healthy`. The service binds only to `127.0.0.1`, and data persists in the Compose-managed `postgres_data` named volume.

For architecture-parity local runs, use the Compose database user only as the
provisioning administrator, then run
`psql --file scripts/database/provision-roles.sql` with the four role variables
and point `DATABASE_URL` at `perfect_tax_payload_runtime` and
`PORTAL_AUTH_DATABASE_URL` at `perfect_tax_auth_runtime`. Apply the migration
and grant commands in the Migrations section before starting the application.
The disposable integration test performs this setup automatically.

Inspect logs, open `psql`, or print the server version:

```sh
docker compose logs -f postgres
docker compose exec postgres sh -c 'psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB"'
docker compose exec postgres sh -c 'psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --command "SELECT version();"'
```

Stop containers without deleting data:

```sh
docker compose stop
docker compose down
```

Reset only when local data may be permanently deleted. This removes the named volume and requires explicit recreation:

```sh
docker compose down --volumes
docker compose up -d
```

For a logical inspection backup, keep `pg_dump` from the pinned container aligned with the server major:

```sh
docker compose exec -T postgres sh -c 'pg_dump --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --format=custom' > local.dump
docker compose exec -T postgres sh -c 'pg_restore --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --clean --if-exists' < local.dump
```

The restore command is destructive to objects already present in that local database. It is documentation only and is not run by routine verification.

## Configuration Ownership

Server-only configuration is `DATABASE_URL`, `PAYLOAD_SECRET`, `SITE_URL`, `EMAIL_NAME`, `EMAIL_ADDRESS`, and `EMAIL_PASSWORD`. Application modules access it through `getServerEnvironment()` in `src/config/env/server.ts`; the module imports `server-only`, validates values without logging them, and cannot be safely imported into a Client Component. The root Payload config uses the same parser from `src/config/env/values.ts` because the Payload CLI runs outside the Next.js runtime guard.

Client-visible runtime configuration is empty in Phase 1. There are no `NEXT_PUBLIC_*` variables. Future browser-visible values require an exposure and data-flow review rather than re-exporting server configuration.

Future CMS-managed configuration includes approved business identity, public contact details, portal presentation settings, and localized homepage content. Secrets, infrastructure addresses, authentication configuration, and unapproved internal settings must never be stored in CMS globals.

## Payload CMS

Payload `3.86.0`, `@payloadcms/next` `3.86.0`, and `@payloadcms/db-postgres` `3.86.0` are pinned together. The administration panel is `/admin`, the REST integration is `/api/cms`, and GraphQL is disabled. Content localization is configured for `en` and `es`, defaults to English, and does not fall back across locales.

`CmsUsers` is the only authentication-enabled collection. It is exclusively for Payload administration and has no relationship to portal, client, staff, or public identities. Anonymous reads and writes are denied. Authenticated editors, bilingual reviewers, and publishers can read and update only their own profile; only `cms-admin` users can create accounts, read all accounts, or update another account's role. No user can change their own role or delete their own active account. Login locks for 30 minutes after five failed attempts, API keys are disabled, and auth tokens are omitted from JSON responses.

Payload's built-in first-user registration endpoint is blocked and its UI is replaced with bootstrap instructions. Password recovery is also blocked until a production email delivery, ownership, and recovery policy exists; this prevents Payload's development console-email adapter from logging recovery links. Additional CMS users must be created by an authenticated `cms-admin` in `/admin`.

### Email Testing

Payload uses its official Nodemailer adapter with explicit SMTP configuration. Local development and integration environments use [Ethereal](https://ethereal.email), which captures messages for inspection and never delivers them to real recipients. Create a reusable Ethereal account, copy `.env.example` to `.env.local`, and set `EMAIL_NAME`, `EMAIL_ADDRESS`, and `EMAIL_PASSWORD` from that account. `EMAIL_ADDRESS` is both the SMTP username and sender address. The adapter is intentionally pinned to Ethereal's `smtp.ethereal.email:587` STARTTLS endpoint so this test configuration cannot be redirected to a real mail provider through environment configuration alone.

The application does not auto-create an Ethereal account because Payload's convenience mode prints the generated username and password to the process console. SMTP values are validated at startup and remain server-only. Transport verification is deferred until the first send so builds and CLI configuration loading do not depend on outbound network access. Payload email can be sent from server-side code through `payload.sendEmail(...)`; do not log credentials, reset URLs, tokens, recipient data, or message bodies.

Configuring the test adapter does not enable CMS password recovery. The recovery route remains blocked until the production delivery, account-ownership, rate-limiting, monitoring, and recovery policies are approved and implemented.

### First Administrator

Local development can use hidden interactive input after migrations are applied:

```sh
pnpm cms:migrate
pnpm cms:bootstrap
```

For non-interactive environments, provide both `CMS_BOOTSTRAP_EMAIL` and `CMS_BOOTSTRAP_PASSWORD` through a secret manager or protected process environment. Do not put the password on a command line, in source control, in Compose, or in deployment configuration that persists after the one-off task. The password must be 16-128 characters, use at least three character classes, and not contain the email's local part or a known weak value. The command never prints the password.

Production bootstrap is a one-time release/operator action after migrations and before enabling administrative traffic. Run the command in a restricted one-off job with the production `DATABASE_URL`, `PAYLOAD_SECRET`, and temporary bootstrap variables injected by the deployment secret manager, then remove the temporary variables. The web application never bootstraps an account at startup. An advisory lock serializes concurrent attempts, and the command refuses to change anything when a `cms-admin` already exists.

For the local CMS login workflow, apply migrations, bootstrap once, start the application, and open `http://localhost:3000/admin`:

```sh
pnpm cms:migrate
pnpm cms:bootstrap
pnpm dev
```

Use the email and password entered through the hidden bootstrap prompts. The command will not print or recover the password. Additional CMS users are created by a logged-in `cms-admin`; there is no public registration page.

### Migrations

PostgreSQL schema push is disabled. The committed Payload migrations in
`src/modules/cms/migrations` are the schema source of truth for both CMS and
Slice 1 operational tables. The current operational migration is
`20260831_171654_agent_14_operational_schema`; it owns `staff`, `clients`,
`portal_identities`, and `security_events` in the existing `public` schema.
Generate a migration only after an intentional Payload schema change, review
both the TypeScript and JSON snapshot, and commit the generated migration and
`index.ts` together:

```sh
pnpm cms:migrate:create descriptive_name
pnpm cms:generate:types
pnpm cms:generate:importmap
```

Apply migrations explicitly with `pnpm cms:migrate` before starting a new application release. Production startup does not auto-migrate; production changes require a backup, reviewed migration, one-off migration job, and rollback plan.

Better Auth has an independent `portal_auth` schema and ledger. Its reviewed
`1.6.23` core/MFA SQL is applied with `PORTAL_AUTH_DATABASE_URL` and
`pnpm auth:migrate`; it never runs through Payload and is never registered as a
Payload collection. Production provisions the dedicated migration/runtime roles
and applies `scripts/database/apply-payload-runtime-grants.sql` and
`scripts/database/apply-auth-runtime-grants.sql` only after the corresponding
migrations complete. Run `scripts/database/provision-roles.sql` once as a
database administrator during database provisioning. See
[ADR 0010](docs/adr/0010-better-auth-compatibility-and-boundary.md) for the
ownership matrix, deployment ordering, and rollback policy.

The clean-database integration test is opt-in because it requires PostgreSQL and drops/recreates its target. It refuses any database name that does not end in `_test`. The Compose database user may create the disposable database:

```sh
CMS_TEST_DATABASE_URL=postgresql://client_services_portal:local-development-only@localhost:5432/client_services_portal_migration_test pnpm test
```

Without `CMS_TEST_DATABASE_URL`, normal unit tests skip only the PostgreSQL
integration cases. With it, the test creates a clean database, applies the
Payload and Better Auth migrations twice, verifies the CMS/public and
operational tables, both migration ledgers, ownership/grants, immutable
bindings, append-only events, transaction rollback, and advisory-lock
serialization, then removes the database.

## Public CMS Content and Translation Workflow

Task 5 adds four focused globals and two public collections:

- `BusinessIdentity`: legal name, configurable public display name, localized identity copy, public logos, and branding status. A new installation initializes `publicDisplayName` to `Perfect Tax`; editors can change it in CMS without changing any technical identifier.
- `ContactSettings`: approved public telephone, WhatsApp, email, office address, hours, enabled-channel flags, and localized safety instructions.
- `PortalSettings`: portal availability plus localized transition and placeholder sign-in messages.
- `HomepageContent`: localized hero, services introduction, process, portal, trust, CTA, and footer copy.
- `Services`: immutable stable key, localized public descriptions, ordering, active state, versions, and translation workflow.
- `PublicMedia`: public brand and marketing raster images only.

Each public-content record uses a server-managed working revision and explicit English and Spanish workflow states: `draft`, `needs-review`, `reviewed`, and `published`. Editors change copy and submit it; `bilingual-reviewer` users review it; publishers publish eligible revisions. CMS administrators may perform each operation but cannot bypass revision, bilingual, or publication checks. Changing tracked content increments the working revision, resets both locale states to draft, and saves through Payload drafts so the last published version remains available.

`evergreen` and `legal` revisions publish English and Spanish atomically at the same source revision. Legal copy also prevents the recorded author from performing its review. `urgent-announcement` may publish one reviewed locale first only when a publisher records a translation owner, a future follow-up deadline, and a later expiry. No workflow helper falls back from missing Spanish legal or substantive content to English. Review notes are length-limited, reject common sensitive-identifier patterns, and must contain editorial context only—never client information.

Raw globals and `Services` remain available only to authenticated CMS identities; Task 6 will add the allowlisted typed public projection. This task intentionally adds no public-site query, DTO, or caching layer.

### Public Media Boundary

`PublicMedia` accepts only AVIF, JPEG, PNG, and WebP brand or marketing images. Editor uploads begin as drafts, publishers control publication, anonymous reads are restricted to published assets, and only CMS administrators may delete assets. It is a public storage policy, not a private document system, and must never contain:

- Tax records.
- Identity documents.
- Immigration records.
- Client photographs.
- Private uploads.
- Case evidence.

Private client documents require the separate storage, authorization, scanning, retention, and audit design deferred to a later phase.

### Business Identity and Contact Updates

Log into `/admin` and edit the focused globals under **Public settings**. `BusinessIdentity.publicDisplayName` is the single controlled source for the public brand name; the typed development fallback and initial migration seed are the only approved raw `Perfect Tax` values. A rebrand does not require package, database, route, or module renaming.

Configure only confirmed public channels in `ContactSettings`. A channel renders only when its enabled flag and approved value are both present. WhatsApp is primary when confirmed, telephone remains visible and becomes primary when WhatsApp is unavailable, and email is secondary with a warning not to send sensitive information. Unknown values remain omitted. There is no contact form or appointment workflow.

For each changed global or service, edit English and Spanish separately, submit both locale states for review, obtain bilingual review, and publish the same revision. Evergreen and legal content publish atomically across both locales. Legal content requires a reviewer other than its recorded author. Urgent announcements may temporarily publish one locale only with an owner, follow-up deadline, and expiry. Do not place client data in review notes. Draft, stale, expired, and workflow-ineligible values are rejected again by the public projection.

## Locale Routing

All user-facing routes use an explicit English or Spanish prefix. The public routes are `/en`, `/es`, the corresponding `/sign-in` and `/portal` placeholders, and the corresponding `/privacy`, `/terms`, and `/accessibility` placeholders. The root `/` redirects using the future profile preference boundary, then the `CLIENT_SERVICES_LOCALE` cookie, then `Accept-Language`, and finally English.

Explicit prefixed URLs are authoritative. Browser preferences and cookies cannot replace `/en` or `/es`, unsupported locale prefixes return not found, and geographic headers are not inputs to negotiation. `next-intl` automatic locale detection and automatic cookie writes are disabled. The language switcher writes only `en` or `es` to the HTTP-only, same-site locale cookie and preserves only constrained `ref` and `utm_*` attribution parameters. Tokens, callbacks, auth state, URLs, free text, and every unlisted query value are dropped. Merely visiting a prefixed URL does not persist a preference.

## Metadata, Manifest, and Health Checks

Localized public pages generate metadata through `src/modules/metadata/public-metadata.ts`. The helper uses the server-only `SITE_URL`, the typed public business identity projection, localized page copy, and published homepage content when available. It emits canonical URLs, English and Spanish alternates, `x-default`, Open Graph, Twitter summary metadata, an identity-driven site name, and a locale-specific manifest link. The initial public brand is not used as a technical fallback inside metadata helpers.

The localized web app manifest is served from `/{locale}/manifest.webmanifest`. It uses the public identity display name and short name, localized description fallback copy, a neutral stable internal identifier (`client-services-portal`), theme/background colors, and placeholder SVG icons. Replace `public/app-icon.svg` and `public/app-icon-maskable.svg` with approved brand icons before launch. Keep the same file names or update `src/modules/pwa/manifest.ts`; provide an ordinary icon and a maskable icon with enough safe padding for mobile launchers. No service worker, offline authenticated content, upload retry, private API caching, or document caching is implemented in Phase 1.

Operational health endpoints are intentionally minimal:

- `GET /api/health/live` returns `{"status":"ok"}` if the Next.js process can respond. It does not query PostgreSQL, initialize Payload, or call third parties.
- `GET /api/health/ready` checks the required Payload migration ledger and bounded Payload initialization, returning `{"status":"ready"}` with HTTP 200 or `{"status":"unavailable"}` with HTTP 503.

Both health endpoints are non-cacheable and never expose versions, hostnames, database names, migration IDs, connection strings, stack traces, environment names, memory usage, uptime, or exception messages. Server logs contain only redacted diagnostic codes.

## Commands

```sh
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm format
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:integration:security
pnpm test:integration:database
pnpm test:security:regressions
pnpm test:security:gate
pnpm cms:migrate
pnpm cms:bootstrap
pnpm cms:generate:types
pnpm cms:generate:importmap
```

Run the complete review gate with the pinned Node.js runtime and a running PostgreSQL container:

```sh
pnpm install --frozen-lockfile
docker compose config
docker compose up -d
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
CMS_TEST_DATABASE_URL=postgresql://client_services_portal:local-development-only@localhost:5432/client_services_portal_migration_test pnpm test
pnpm build
```

The Agent 15 security gate additionally requires a dedicated PostgreSQL 17 test
cluster. Supply its administrator URL through `AGENT15_TEST_DATABASE_URL`; the
database name must end in `_test`. The harness creates clean random databases,
applies both migration systems twice, provisions production-like runtime roles,
and destroys its fixtures. See
[`integration/README.md`](integration/README.md) and the
[`Agent 15 security review`](docs/reviews/agent-15-end-to-end-security-review.md).
The maintained regressions explicitly re-prove the repaired A15-H01, A15-H02,
and A15-M01 boundaries against real Payload and PostgreSQL runtimes.

The `_test` suffix is mandatory for the clean-migration test, which drops and recreates only that disposable database. `pnpm build` does not run ESLint in Next.js 16, so lint remains a separate required gate.

## Compatibility Baseline

Verified on 2026-07-18 using official project documentation and npm registry package metadata.

| Concern           | Selected or evaluated version | Compatibility decision                                                                                                                                                                                                          |
| ----------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js           | `24.18.0`                     | Newest LTS release. It satisfies Next.js and Payload's `>=20.9.0` requirement, Vitest's `>=24.0.0` branch, and ESLint's `>=24` branch. Node 26 is still Current, not LTS.                                                       |
| Next.js           | `16.2.10`                     | Latest stable package release and inside Payload `3.86.0`'s supported `>=16.2.6 <17.0.0` peer range. Uses App Router.                                                                                                           |
| React / React DOM | `19.2.7`                      | Accepted by Next.js `16.2.10` and Payload UI `3.86.0` (`^19.2.1`).                                                                                                                                                              |
| next-intl         | `4.13.2`                      | Pinned App Router localization dependency. Uses the Next.js 16 `proxy.ts` convention, always-prefixed routes, server-rendered dictionaries, and application-owned root negotiation.                                             |
| Payload CMS       | `3.86.0` installed            | Its official installation guide supports Next.js `16.2.6+`; package metadata caps that range below Next.js 17. It requires Node.js `20.9.0+`.                                                                                   |
| Tailwind CSS      | `4.3.3`                       | Current stable Tailwind v4 package; configured through its official PostCSS plugin. shadcn/ui supports Tailwind v4 and React 19.                                                                                                |
| TypeScript        | `6.0.3`                       | Chosen instead of `7.0.2` because the current typescript-eslint support window used by the Next.js lint stack is `>=4.8.4 <6.1.0`.                                                                                              |
| Vitest            | `4.1.10`                      | Supports Node.js `^20`, `^22`, or `>=24`; the selected runtime is supported.                                                                                                                                                    |
| ESLint            | `9.39.5`                      | Flat configuration. ESLint 9 is the newest line supported across every plugin bundled by `eslint-config-next@16.2.10`; ESLint 10 produces peer-range warnings from its import, accessibility, and React plugins.                |
| Prettier          | `3.9.5`                       | Current stable formatter package.                                                                                                                                                                                               |
| PostgreSQL        | `17.10`                       | Current PostgreSQL 17 fix release; upstream support runs through November 2029. Chosen over major 18 for broader mature hosting compatibility while remaining fully supported by Payload's Drizzle/node-postgres adapter stack. |
| Payload Postgres  | `3.86.0` installed            | The adapter depends on Drizzle `0.45.2` and node-postgres `8.20.0`. Payload documents PostgreSQL as an official adapter; node-postgres supports PostgreSQL 8.x through the current release.                                     |

### Evidence

- [Node.js release status and latest LTS](https://nodejs.org/en/about/previous-releases)
- [Next.js installation requirements](https://nextjs.org/docs/app/getting-started/installation)
- [Next.js 16 upgrade requirements](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [Next.js npm metadata](https://www.npmjs.com/package/next)
- [Payload installation and supported Next.js ranges](https://payloadcms.com/docs/getting-started/installation)
- [Payload npm metadata](https://www.npmjs.com/package/payload)
- [Tailwind CSS Next.js installation](https://tailwindcss.com/docs/installation/framework-guides/nextjs)
- [shadcn/ui Tailwind v4 and React 19 support](https://ui.shadcn.com/docs/tailwind-v4)
- [typescript-eslint supported dependency versions](https://typescript-eslint.io/users/dependency-versions/)
- [Vitest 4 migration prerequisites](https://vitest.dev/guide/migration)
- [Payload PostgreSQL adapter](https://payloadcms.com/docs/database/postgres)
- [Drizzle PostgreSQL drivers](https://orm.drizzle.team/docs/get-started-postgresql)
- [node-postgres database compatibility](https://node-postgres.com/)
- [PostgreSQL versioning and support policy](https://www.postgresql.org/support/versioning/)
- [PostgreSQL `pg_dump` compatibility](https://www.postgresql.org/docs/current/app-pgdump.html)
- [PostgreSQL Docker Official Image tags](https://hub.docker.com/_/postgres)
- [AWS RDS PostgreSQL release calendar](https://docs.aws.amazon.com/AmazonRDS/latest/PostgreSQLReleaseNotes/postgresql-release-calendar.html)
- [Neon PostgreSQL compatibility](https://neon.com/docs/reference/compatibility)
- [Supabase PostgreSQL 17 upgrade guidance](https://supabase.com/docs/guides/self-hosting/postgres-upgrade-17)

## Current Scope

Phase 1 Tasks 1-11 and the reviewed Agent 3-14 identity foundation are
represented in the scaffold. Public pages consume only versioned allowlisted
DTOs through server-only repositories. Payload drafts, workflow eligibility,
locale-aware cache keys, publication hooks, direct contact fallbacks, localized
metadata, the manifest, placeholder portal pages, the constrained Better Auth
HTTP surface, and health behavior are implemented and tested. The public
sign-in and portal pages remain placeholders; no client workflow is enabled.

The consolidated Phase 1 decisions are recorded in [`docs/adr/0011-phase-1-foundation-boundaries.md`](docs/adr/0011-phase-1-foundation-boundaries.md). The Better Auth compatibility spike and Phase 2 entry criteria are recorded separately in [`docs/adr/0010-better-auth-compatibility-and-boundary.md`](docs/adr/0010-better-auth-compatibility-and-boundary.md).

## Deferred Features

Production portal launch, client registration, private document uploads,
tax-return processing, immigration form generation, payments, scheduling,
contact forms, client messaging, staff assignment, case automation,
notifications, analytics, offline/service-worker behavior, and portal-to-CMS
identity linking are deferred. Better Auth's reviewed core/MFA runtime and
isolated `portal_auth` schema are present, but production enablement still
requires the ADR 0010 entry criteria, operational ownership, and Agent 15
end-to-end security review.

## Security Limitations

This remains a public-site/CMS foundation, not a production security
certification. Payload CMS credentials are a narrow administrative boundary and
are separate from portal identities. Better Auth sessions and MFA are isolated
behind the reviewed server-only boundary, but complete portal resource
authorization, private storage, malware scanning, retention enforcement,
distributed rate limiting, production email, and client-workflow audit remain
future launch requirements. Public media is locally stored and intentionally
public after publication.

The locale cookie is a non-sensitive preference. Public contact actions hand users to telephone, email, or WhatsApp and cannot prevent a user from sending sensitive data after leaving the site; approved bilingual warnings and business handling procedures remain required. Health logs contain only fixed diagnostic codes, but production log access, retention, and alerting still require an operational policy.

## Production Launch Blockers

- Confirm the legal and public business identities, domain, office details, telephone, email, WhatsApp ownership, hours, and approved channel policy.
- Obtain business-owner and qualified review of English and Spanish service, tax, immigration, notary, disclaimer, privacy, terms, and accessibility content.
- Replace placeholder PWA icons and legal pages with approved assets and published bilingual content.
- Name production CMS owners and approve MFA, recovery, break-glass, invitation, least-privilege, monitoring, backup, restore, migration, and incident procedures.
- Configure TLS, production secret management, exact trusted origins, managed PostgreSQL 17, backups, restore evidence, log access/retention, and deployment health probes.
- Complete the Phase 2 entry criteria before exposing any portal credentials, registration, private records, or document workflow.
