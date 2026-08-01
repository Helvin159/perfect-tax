# ADR 0011: Phase 1 Foundation Boundaries

- Status: Accepted
- Date: 2026-07-18
- Scope: Phase 1 Tasks 1-11

## Context

Phase 1 must deliver a reproducible bilingual public site and usable content-management boundary without introducing partially secured portal features. The application will eventually handle sensitive client workflows, but this phase has no portal identity, client record, private upload, form intake, messaging, payment, or scheduling capability.

The initial public name is configurable. `client-services-portal` is the stable technical identity; `Perfect Tax` is limited to the typed development fallback and initial CMS seed.

## Decisions

### Runtime and dependency compatibility

Use Node.js `24.18.0` and pnpm `10.33.0`, pinned in `.nvmrc`, `package.json#engines`, and `package.json#packageManager`. Direct dependencies and development dependencies use exact versions, with the lockfile as the complete resolved graph. Next.js `16.2.10`, React `19.2.7`, Payload packages `3.86.0`, next-intl `4.13.2`, Tailwind `4.3.3`, TypeScript `6.0.3`, and Vitest `4.1.10` form the selected compatibility baseline. Upgrade them together only after install, lint, format, typecheck, test, migration, build, and browser smoke verification.

### PostgreSQL

Use PostgreSQL `17.10` through the pinned `postgres:17.10-bookworm` image. Bind local PostgreSQL only to `127.0.0.1`, persist it in a named volume, and require explicit migrations with schema push disabled. The readiness check requires the committed Payload migration names, not only a successful TCP connection. CI, staging, and production must remain on PostgreSQL major 17 until an explicitly tested upgrade.

### Localization and routing

Use next-intl with explicit `/en` and `/es` prefixes, English as the default, and no implicit locale fallback. An explicit URL controls rendering. Root negotiation uses profile preference when a future authenticated adapter exists, then the `CLIENT_SERVICES_LOCALE` cookie, `Accept-Language`, and English. Only the language switcher persists the cookie. It preserves the equivalent route and only constrained `ref`, `utm_campaign`, `utm_medium`, and `utm_source` values; all other query data is discarded.

### Translation workflow

Code owns navigation, shell, status, placeholder, and safety labels. Payload owns localized public identity, homepage, service, portal-notice, and contact instructions. Public records use a server-enforced revision and locale workflow with `draft`, `needs-review`, `reviewed`, and `published` states. Evergreen and legal changes require eligible English and Spanish states at one revision and publish atomically. Legal review must be independent of the recorded author. Urgent one-locale publication requires an owner, follow-up deadline, and expiry. Review notes are editorial-only, validated for common sensitive identifiers, and may change only during an authorized editorial transition.

Public repositories request only the last Payload-published version, disable locale fallback, explicitly select approved fields, and pass unknown records through versioned DTO projectors. The projector independently rejects drafts, stale revisions, incomplete bilingual state, expired urgent content, invalid values, and internal workflow metadata.

### CMS and portal authentication

Payload `CmsUsers` is a dedicated CMS-only credential store with `editor`, `bilingual-reviewer`, `publisher`, and `cms-admin` roles. Public first-user registration and incomplete password recovery are blocked. The first administrator is created by an explicit one-time bootstrap command using hidden input or temporary secret-manager environment values. There is no default password, automatic startup bootstrap, public role input, or self-role change.

Portal authentication is deferred. Better Auth is absent from Phase 1 dependencies, routes, environment variables, schemas, cookies, and runtime code. ADR 0010 records the disposable compatibility spike, separate migration ownership, security design, optional staff-only CMS linking, rollback, and mandatory Phase 2 entry criteria. CMS and future portal identities must never be linked by email alone.

### Contact channels

Phase 1 converts through confirmed business-controlled telephone, WhatsApp, and general email settings rather than collecting form data. WhatsApp is primary only when confirmed and enabled. Telephone remains visible and becomes primary when WhatsApp is absent. Email is secondary. Written-channel actions display approved warnings against sending sensitive identifiers or documents. Unknown or invalid channel values are omitted. Contact forms and scheduling are deferred.

### Health endpoints and logging

`/api/health/live` reports only process liveness and never calls dependencies. `/api/health/ready` uses a two-second bound for the required PostgreSQL migration ledger and Payload initialization. Responses are non-cacheable and limited to `ok`, `ready`, or `unavailable`. Logs contain fixed diagnostic codes only; exceptions, hostnames, database names, migration names, connection strings, credentials, versions, uptime, and memory details are not serialized.

### Public and private storage

`PublicMedia` is a public brand/marketing image collection restricted to AVIF, JPEG, PNG, and WebP. Editors create drafts, publishers publish, anonymous access is limited to published records, and only CMS administrators delete. Its storage, access, cache, and retention policy must never be reused for client documents. Private documents require a future private object-store abstraction, authorization, malware scanning, signed access, retention, deletion, and audit design.

### Business identity and rebranding

`BusinessIdentity` is the controlled source for public display identity. Header, footer, homepage, metadata, and manifest consume its allowlisted projection with a typed fallback. Cache keys include resource, locale, publication eligibility, and schema version; eligible publication hooks invalidate only affected tags. Domain and trusted-origin changes remain an operational migration. Rebranding must not rename packages, routes, database identities, authorization code, storage identifiers, or feature modules.

## Consequences

The Phase 1 public site remains useful when Payload is temporarily unavailable because typed, non-contact fallbacks are safe and deterministic. This availability tradeoff means operators must monitor fixed CMS diagnostics and readiness separately. Draft edits do not replace the last cached published projection; an eligible publication invalidates the affected locale tags.

The CMS can be reviewed locally without creating a dormant portal authentication surface. It is not launch-ready until production CMS ownership, MFA, recovery, email, backups, monitoring, and legal/content approvals are complete. Public contact channels also depend on business procedures because the site cannot control what a user sends after following an external link.

## Rejected Alternatives

- MongoDB: weaker fit for the future relational authorization, case, audit, and reporting model.
- Unprefixed default-locale routes or geography-based detection: less deterministic and capable of overriding explicit language intent.
- Cross-locale CMS fallback: risks exposing unreviewed or misleading substantive and legal copy.
- Direct Payload documents in pages or Client Components: expands the public schema implicitly and can leak workflow metadata.
- Better Auth runtime scaffolding in Phase 1: creates unused routes, schema, secrets, and session decisions without a complete user workflow.
- A public contact form or private upload collection: introduces sensitive-data, retention, spam, authorization, and incident obligations outside this phase.
- One media collection for public and private files: mixes incompatible access, caching, scanning, retention, and disclosure policies.

## Deferred Risks and Launch Conditions

Production launch requires approved bilingual identity, service, regulated, disclaimer, privacy, terms, and accessibility content; confirmed public channels; branded PWA assets; TLS and secret management; named CMS administrators; MFA, recovery, break-glass, and invitation procedures; managed PostgreSQL backups and restore evidence; controlled logs and alerts; and deployment probe configuration.

Portal launch additionally requires every ADR 0010 Phase 2 entry criterion. Private document handling, client messaging, payments, scheduling, analytics, notifications, service workers, and automated translation remain separate future decisions.

## Sources

- [Node.js release schedule](https://nodejs.org/en/about/previous-releases)
- [Next.js installation requirements](https://nextjs.org/docs/app/getting-started/installation)
- [Payload installation and compatibility](https://payloadcms.com/docs/getting-started/installation)
- [Payload PostgreSQL adapter](https://payloadcms.com/docs/database/postgres)
- [Payload localization](https://payloadcms.com/docs/configuration/localization)
- [Payload authentication](https://payloadcms.com/docs/authentication/overview)
- [Payload drafts](https://payloadcms.com/docs/versions/drafts)
- [PostgreSQL versioning policy](https://www.postgresql.org/support/versioning/)
- [next-intl App Router setup](https://next-intl.dev/docs/getting-started/app-router)
