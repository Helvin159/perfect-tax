# Phase 1 Architecture Plan: Client Services Portal

> **Historical scope notice (2026-09-02):** This is the original Phase 1
> architecture plan. Its statement that production portal authentication begins
> in Phase 2 predates the merged Slice 1 identity foundation. For current Slice
> 1 architecture, operations, and deferred work, use ADR 0012 and
> `docs/architecture/portal-identity-authorization.md`.

Date: 2026-07-18

Internal application identifier: `client-services-portal`

Initial configured public business name: `Perfect Tax`

## 1. Executive Summary

Build a phased, bilingual client-service portal foundation for an established New York City administrative-services business. Phase 1 should establish the application shell, locale-aware routing, CMS-backed public business identity, localized public content, placeholder sign-in and portal routes, local infrastructure, tests, documentation, and an authentication architecture ADR. Production portal authentication begins in Phase 2.

Do not implement production document upload, tax workflows, immigration form generation, payments, staff assignment, messaging, or sensitive data workflows in Phase 1.

Firm recommendations:

- Use Next.js App Router, React, TypeScript strict mode, Tailwind CSS, shadcn/ui-compatible components, Payload CMS, Better Auth, PostgreSQL, Docker Compose, pnpm, ESLint, Prettier, and Vitest. Resolve and pin mutually supported stable versions during implementation rather than hardcoding unsupported future majors in the architecture.
- Use PostgreSQL as the application database.
- Use `next-intl` for localization.
- Use explicit locale-prefixed routes for every user-facing public, auth, and portal path: `/en`, `/es`, `/en/sign-in`, `/es/sign-in`, `/en/portal`, `/es/portal`.
- Keep the app directory thin. Business logic belongs in feature modules and server-side application services.
- Treat `Perfect Tax` as configurable public identity, not as the permanent product, package, namespace, database prefix, storage bucket name, or infrastructure identity.

## 2. Current Repository Findings

Confirmed repository state:

- The repository directory is empty.
- No `package.json`, framework files, source tree, `.git`, `.env`, `README`, `AGENTS.md`, or existing application code were present during inspection.
- The local workspace path is `/Users/helvinrymer/Desktop/Projects/perfect-tax`.
- Local tools available during planning included Node, pnpm, Docker, Docker Compose, and Git.

Important implication: there are no existing code patterns to preserve. Phase 1 should initialize the repository deliberately and document decisions as it goes.

## 3. Assumptions

- The business provides administrative support, document preparation assistance, income tax preparation, notary services, and related client support.
- The business is not being represented as a law firm.
- Final legal, tax, immigration, privacy, consent, and compliance copy must be reviewed by the business owner and, where appropriate, qualified legal or compliance reviewers.
- Public registration is intended only for clients.
- Staff and administrator accounts will be invitation-based or created by an authorized administrator.
- English and Spanish are required from the first scaffold, with Spanish treated as a complete first-class experience.
- The database is not yet selected, so Phase 1 should select and configure one.
- Production document uploads are intentionally deferred.

## 4. Recommended Technology Decisions

- Runtime: the newest active or maintenance LTS Node.js release that is officially supported by the selected stable versions of Next.js, Payload, and Better Auth. Verify the intersection before scaffolding, record it in `.nvmrc` or `.node-version` and `package.json#engines`, and pin it in CI and deployment configuration.
- Package manager: pnpm.
- Framework: the latest stable Next.js App Router release supported by the selected Payload release; pin the exact package version.
- UI: the React, Tailwind CSS, shadcn/ui-compatible, and Radix versions compatible with that framework selection; pin exact package versions.
- CMS: the latest stable Payload release compatible with the selected Next.js and Node.js versions; pin all Payload packages to the same version.
- Authentication: Better Auth is the Phase 2 portal authentication direction. Phase 1 performs a time-boxed compatibility spike and records an ADR without installing or initializing production authentication.
- Database: a stable PostgreSQL major that is supported by Payload's Postgres adapter, its underlying driver/ORM, the production hosting provider, and the backup/restore tooling. Use the same major in local development, CI, staging, and production.
- Testing: Vitest for unit and integration tests, React Testing Library for components, Playwright later for route and accessibility smoke tests.
- Formatting and linting: Prettier and ESLint.
- Infrastructure: Docker Compose for local PostgreSQL and future supporting services.
- PWA: manifest and metadata in Phase 1; service worker deferred until authenticated caching boundaries are designed.

Compatibility and operational stability take priority over selecting the newest major version. A new runtime or database major can be technically available before framework adapters, native dependencies, hosting platforms, migration tooling, or operational documentation have caught up. At each dependency-upgrade cycle, verify official support, run the full build and integration suite, test database migrations and restore procedures, and upgrade deliberately. Architecture decisions should define compatibility constraints; lockfiles, toolchain files, Compose images, and deployment manifests should record the exact versions selected for a particular implementation.

## 5. PostgreSQL Versus MongoDB Comparison

| Criterion | PostgreSQL | MongoDB |
| --- | --- | --- |
| Payload CMS support | Supported by Payload through the Postgres adapter | Supported by Payload through the MongoDB adapter |
| Better Auth support | Strong fit through relational schema and SQL adapters | Supported, but document modeling adds less value for auth/session relations |
| Client and case workflows | Strong fit for relational clients, cases, assignments, requests, statuses, and audit joins | Possible, but relationship integrity must be enforced more in application code |
| Document metadata | Excellent fit for metadata, ownership, retention, scan status, and access history | Flexible metadata shape, but weaker relational reporting |
| Audit history | Strong fit for append-only event tables, indexes, constraints, and reporting | Possible, but cross-record audit analysis is less straightforward |
| Staff assignments | Natural relational model with constraints | Requires careful document references and consistency handling |
| Reporting | Strong SQL reporting, aggregation, views, and export paths | Good aggregation support, but operational reporting is usually more complex |
| Backups and migration | Mature PITR, schema migrations, constraints, and operational tooling | Mature backup tooling, but schema evolution discipline is more application-driven |
| Operational simplicity | One relational database can support CMS, auth, portal, audit, and reporting | Simpler for flexible documents, less ideal for relational workflows |

## 6. Final Database Recommendation

Use PostgreSQL.

The application’s core data is relational: users, clients, service requests, cases, staff assignments, documents, access history, audit records, notifications, consents, and future reporting. PostgreSQL gives stronger integrity, clearer migrations, better reporting, and more predictable authorization queries than MongoDB for this domain.

MongoDB is viable for Payload content, but its flexibility is not the dominant need here. The dominant need is reliable relationships, constraints, auditability, reporting, and operational confidence around sensitive records.

## 7. Localization Library Comparison

| Option | Assessment |
| --- | --- |
| `next-intl` | Strong App Router support, server-rendered messages, route integration, middleware/proxy support, typed message patterns, metadata support, and active use in modern Next.js apps. |
| `next-i18next` | Historically useful for Pages Router, but less aligned with App Router-first architecture. |
| Custom dictionaries only | Simple initially, but quickly becomes fragile for routing, metadata, formatting, missing translations, and locale negotiation. |

## 8. Final Localization Recommendation

Use `next-intl`.

It aligns with Next.js App Router, supports server-rendered translations, locale-aware routing, localized metadata, validation messages, and predictable fallback behavior. It also keeps localization as a system capability rather than a homepage-only feature.

## 9. Locale Routing Strategy

Use explicit prefixed routes for all supported languages:

- `/en`
- `/es`
- `/en/services`
- `/es/services`
- `/en/sign-in`
- `/es/sign-in`
- `/en/portal`
- `/es/portal`

Default locale: `en`.

Prefix the default locale too. Consistent prefixes simplify canonical URLs, language switching, analytics, route testing, and future SEO.

Root `/` behavior:

- If a valid authenticated profile exists, use its preferred locale.
- Otherwise use a valid locale cookie.
- If neither exists, use `Accept-Language`.
- If detection is inconclusive, fall back to `en`.
- Redirect only from `/` to the selected locale.
- Never redirect a user away from an explicit `/en` or `/es` route based on geography or browser settings.

Do not infer language from country, citizenship, residency, service jurisdiction, or current location.

Deterministic precedence:

1. A supported locale in the current URL controls that request.
2. For an unprefixed entry point only, an authenticated profile preference controls the redirect.
3. Otherwise, a supported locale cookie controls the redirect.
4. Otherwise, the best supported `Accept-Language` match controls the redirect.
5. Otherwise, use `en`.

The URL is always authoritative for rendering. Profile, cookie, and browser preferences must never redirect or replace an explicit locale-prefixed URL.

Behavior by user state and entry path:

- Anonymous users: `/` uses cookie, then `Accept-Language`, then `en`. An explicit prefixed URL renders as requested. The language switcher navigates to the equivalent localized route and writes the locale cookie.
- Authenticated users: `/` uses the profile preference, then the same anonymous fallbacks. Explicit prefixed URLs still render as requested, even when they differ from the profile.
- Language changes after login: the language switcher navigates first, then persists the selected locale to both the profile and cookie. Failure to persist the profile must not undo the navigation; surface a non-sensitive retry state and keep the cookie as the current-device preference.
- Login on a locale-prefixed route: successful login preserves that route locale. Login must not suddenly redirect from `/es` to `/en` or vice versa because of a pre-existing profile preference.
- Bookmarks and search results: explicit locale-prefixed destinations are honored and do not silently rewrite the profile or cookie. Only an explicit language-switch action changes the durable preference.
- Unsupported or missing locale prefixes: normalize through the root negotiation rules or return the appropriate not-found response; never guess from geography.

## 10. Translation Ownership Strategy

Code-owned translations:

- Navigation labels.
- Buttons.
- Form labels.
- Validation messages.
- Error messages.
- Status labels.
- Accessibility labels.
- Authentication UI.
- Portal UI.
- Empty states.
- Notification UI shell text.

CMS-owned localized content:

- Homepage headings and body copy.
- Service descriptions.
- FAQs.
- Announcements.
- Seasonal tax notices.
- Business notices.
- Office instructions.
- Portal onboarding messages.
- Public disclaimers.
- Privacy and terms content where appropriate.

Do not translate operational identifiers, permissions, document IDs, case IDs, internal status codes, object keys, or audit event names.

## 11. Payload Localization Strategy

Payload default locale: `en`.

Supported locales:

- `en`
- `es`

Fallback recommendation: disable public fallback for localized CMS fields where missing translated content could create misleading or incomplete pages. Use explicit per-locale workflow state instead.

Localized fields:

- Tagline.
- Business description.
- Service-area description.
- Public disclaimer.
- Footer text.
- Portal-transition notice.
- Homepage sections.
- Service titles and descriptions.
- FAQ questions and answers.
- Announcements.
- Office-visit instructions.
- Contact instructions.
- Accessibility statements.

Shared fields:

- Legal business name by default.
- Public display name by default.
- Phone numbers.
- Email addresses.
- URLs.
- Logos.
- Favicon.
- PWA icons.
- Legal identifiers.
- Internal status values.
- Permissions.
- Document IDs.
- Case IDs.

Use a required `contentPolicy` classification (`evergreen`, `legal`, or `urgent-announcement`) plus a structured `translationWorkflow` group keyed by locale, rather than independent booleans. Each locale record should contain:

- `state`: `draft`, `needs-review`, `reviewed`, or `published`.
- `sourceRevision`: the source-content version against which the translation was prepared.
- `reviewedBy` and `reviewedAt`.
- `publishedBy` and `publishedAt`.
- Optional `reviewNotes` for editorial context, never client-sensitive data.

Payload drafts and versions preserve the content history; the translation workflow controls whether a locale is eligible for the public projection. Editing a reviewed or published localized field resets that locale's working state to `draft` while the last published version remains live. Editors move content from `draft` to `needs-review`; an authorized bilingual reviewer moves it to `reviewed`; an authorized publisher moves it to `published`. A person should not approve legally sensitive translations they authored unless an explicitly documented emergency policy permits it.

Enforce transitions in server-side hooks or application services, not only with Admin UI controls. A publication command must validate roles, review metadata, matching `sourceRevision`, and the selected `contentPolicy`; for bilingual evergreen or legal revisions it must publish both eligible locale states atomically or publish neither. The public repository must independently filter by workflow eligibility as defense in depth.

Publication policies:

- Evergreen marketing pages: both `en` and `es` must be `reviewed` before either new revision is published. Public fallback for substantive copy is prohibited; retain the last published locale or omit a nonessential section.
- Legal, privacy, consent, tax, immigration, and disclaimer content: both locales require independent qualified review and `published` state for the same source revision. Cross-locale fallback is prohibited. If either locale is unavailable, do not publish the changed legal revision publicly.
- Urgent announcements: one locale may be published first after an expedited review by an authorized publisher. The record must include an expiry time, translation owner, and follow-up deadline. The other locale may show a short, pre-approved neutral availability notice, but must not receive an automatic translation or a fallback containing unreviewed operational or legal instructions.

Fallback is acceptable only for non-substantive, low-risk presentation content explicitly approved for fallback, such as a missing decorative caption. It is prohibited for legal obligations, deadlines, eligibility statements, fees, required documents, safety instructions, or service claims. Phase 1 evergreen homepage and service content requires reviewed English and Spanish content.

Localized slugs should be supported for public CMS pages later. Phase 1 can use stable route slugs and localized page titles while the route map remains code-owned.

## 12. Proposed Directory Structure

```text
src/
  app/
    [locale]/
      (marketing)/
        page.tsx
        privacy/
        terms/
        accessibility/
      (auth)/
        sign-in/
      (portal)/
        portal/
      layout.tsx
    admin/
    api/
      health/
        live/
        ready/
    layout.tsx
    globals.css
  modules/
    auth/
    users/
    clients/
    staff/
    services/
    service-requests/
    cases/
    documents/
    messaging/
    notifications/
    audit/
    content/
    localization/
    settings/
  components/
    ui/
    layout/
    shared/
  config/
  lib/
  server/
  styles/
  types/
```

The `app` directory should compose routes, metadata, layouts, and thin server components. Business logic should live in modules.

## 13. Module Ownership and Responsibilities

- `auth`: Phase 1 ADR and compatibility-spike results; Phase 2 Better Auth configuration, session access, auth UI boundaries, invitation direction, password policy, and MFA policy.
- `users`: Identity mapping, profile language preference, suspension state, account lifecycle.
- `clients`: Client profile records, contact preferences, separated language, country, address, and jurisdiction concepts.
- `staff`: Staff profile, staff-only access boundaries, future invitation workflow.
- `services`: Public service definitions and localized service descriptions.
- `service-requests`: Future intake requests and request status.
- `cases`: Future operational case records.
- `documents`: Future secure document metadata, storage abstraction, scan status, access history.
- `messaging`: Future staff-client messaging and localized templates.
- `notifications`: Future transactional notices and preference-based language selection.
- `audit`: Append-only event records and access history.
- `content`: CMS-owned public content repository boundaries.
- `localization`: locale routing, messages, formatting, fallback behavior, tests.
- `settings`: business identity, contact settings, portal settings, public-safe settings projection.

## 14. Route Map for English and Spanish

Initial routes:

- `/` redirects to `/en` or `/es` based on locale preference.
- `/en`, `/es`: localized homepage.
- `/en/sign-in`, `/es/sign-in`: placeholder localized sign-in route.
- `/en/portal`, `/es/portal`: placeholder localized future portal route.
- `/en/privacy`, `/es/privacy`: placeholder privacy page.
- `/en/terms`, `/es/terms`: placeholder terms page.
- `/en/accessibility`, `/es/accessibility`: placeholder accessibility page.
- `/admin`: Payload admin.
- `/api/health/live`: liveness endpoint.
- `/api/health/ready`: readiness endpoint.
- Better Auth API route under `/api/auth/[...all]` in Phase 2, once production portal authentication is introduced.
- Payload API/admin routes according to the final Payload Next integration.

## 15. Payload CMS Integration Strategy

Payload owns business content, public CMS content, CMS-managed media, and administrative editing workflows.

Do not expose Payload internals throughout route components. Access Payload through typed repositories and application services.

Recommended initial Payload objects:

- Globals: `BusinessIdentity`, `ContactSettings`, `PortalSettings`, `HomepageContent`.
- Collections: `Services`, `PublicMedia`, `CmsUsers`.

Disable GraphQL initially unless there is a concrete requirement.

Use the Payload Local API on the server behind module-level repositories. Protected operations should pass the authenticated CMS user and use `overrideAccess: false`.

### Phase 1 `/admin` authentication

Payload administration and portal authentication are separate security boundaries:

- **Portal authentication** is the future client and staff application identity system. Better Auth will own its credentials, sessions, account recovery, MFA, and profile preference in Phase 2.
- **CMS administration authentication** exists only for editors and administrators who manage public content in Payload. During Phase 1, Payload owns this narrow authentication boundary through a dedicated auth-enabled `CmsUsers` collection configured as `admin.user`.

Phase 1 administrators log into `/admin` with Payload-managed credentials created by an explicit bootstrap command or by an existing authorized CMS administrator. There is no public CMS registration. `CmsUsers` contains only CMS editors and administrators, uses least-privilege roles such as `editor`, `publisher`, and `cms-admin`, enforces Payload access controls, and should enable appropriate login throttling and lockout controls. Bootstrap credentials must never be committed, seeded with a shared default password, or exposed through public configuration.

This does create a dedicated CMS credential store in Phase 1, but it does not create a second portal authentication system: client and portal staff accounts do not exist in Payload, cannot log into `/admin`, and are not copied into `CmsUsers`. Keeping the boundary explicit makes the CMS usable now without coupling public-content delivery to unfinished portal authentication.

## 16. Better Auth Integration Strategy

Better Auth remains the selected direction for Phase 2 portal authentication, where it should own portal credentials, sessions, account recovery, and future MFA. Installing it in Phase 1 would create auth routes, secrets, schema, and adapter choices that cannot be exercised through a complete registration or sign-in workflow. That partial infrastructure adds integration and security risk without delivering a reviewable user capability.

Phase 1 therefore contains a time-boxed architecture spike and ADR only. The spike must verify the selected Better Auth release against the pinned Node.js, Next.js, PostgreSQL, and Payload versions; prove a disposable server-side session read; inspect generated schema and migration ownership; and document the intended route, cookie, CSRF/origin, email-delivery, account-recovery, MFA, and test strategy. Spike code and disposable schema are not merged into the application. `better-auth`, `/api/auth/[...all]`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and Better Auth tables are introduced together in the first executable Phase 2 authentication task.

This preserves the long-term architecture while minimizing Phase 1 risk: Payload can deliver an independently usable CMS, the public site has no dormant authentication surface, and Phase 2 begins with evidence about the exact dependency versions it will use.

### CMS and portal identity relationship

- Phase 1 `CmsUsers` identities remain completely separate from portal users in credentials, sessions, provisioning, and authorization. Portal clients must never be mapped into `CmsUsers`.
- Separation should remain the default long-term policy. A CMS administrator does not automatically need a portal account, and a portal staff or client account never implies CMS access.
- If single sign-on later has a demonstrated operational benefit, only approved staff identities may be linked. Add a nullable, unique `betterAuthUserId` (or provider-neutral external subject) to `CmsUsers`; keep CMS role and publication permissions authoritative in Payload rather than inferring them from a portal role.
- Do not link accounts by email alone. An existing CMS administrator must initiate an invitation or controlled claim, the user must authenticate to both identities or complete a verified recovery flow, and the link must be audited.
- Migrate in stages: add the nullable link and audit events; link a pilot administrator; add and test a Payload custom authentication strategy backed by Better Auth; run both login paths during a bounded rollback window; verify access, logout, suspension, and recovery; then disable Payload password login only for successfully linked accounts. Keep the stable `CmsUsers` record ID so content ownership and history do not change.
- Unlinking, Better Auth suspension, or account deletion must fail closed for CMS access without deleting the CMS audit record. Emergency CMS recovery must use a separately controlled break-glass procedure.

Preferred language:

- Store the canonical authenticated preference in the Better Auth user profile or a user-owned profile table in Phase 2.
- Before authentication, store an explicit language-switch selection in a locale cookie.
- Use the precedence and no-surprise login behavior defined in Sections 9 and 20.
- A separate transactional communication locale override may be added later if the business needs it.

## 17. Role and Authorization Model

Initial roles:

- Guest: public marketing pages, sign-in page, public legal pages.
- Client: future client portal, own profile, own service requests, own documents, own communications.
- Staff: future staff workspace, assigned client records, document review, service request handling.
- Administrator: staff provisioning, CMS administration, settings, higher-risk operational actions.

Authorization requirements:

- Every protected operation must validate authorization server-side.
- Client-side checks are only presentation hints.
- Role escalation must be impossible from public registration or user-editable profile fields.
- Staff/admin accounts must be invitation-based or admin-created.
- Phase 1 Payload access rules derive identity and CMS roles from the authenticated `CmsUsers` request user.
- If staff-only CMS single sign-on is adopted later, the custom strategy must resolve the Better Auth session to an explicitly linked `CmsUsers` record before Payload access rules run.
- One client must never access another client’s records through direct IDs or guessed URLs.

## 18. Public Content Model

CMS-editable public content:

- Business name and public brand identity.
- Logos and public brand media.
- Contact information.
- Office hours.
- Homepage sections.
- Services.
- FAQs.
- Announcements.
- Supported languages.
- Disclaimers.
- Privacy and terms links.
- Social links.
- Portal availability messaging.
- Seasonal tax notices.

Code-owned content:

- Navigation structure.
- Route labels.
- Form and validation messages.
- Auth and portal UI shell text.
- Accessibility labels.
- Error states and status labels.

## 19. Homepage Structure and Component Breakdown

The Phase 1 homepage should be professional, trustworthy, responsive, and localized.

Sections:

- Header: configured public business name, navigation, language switcher, placeholder sign-in action, and contact CTA.
- Hero: neutral explanation that the business helps clients organize and complete important administrative processes.
- Services overview: immigration-related document preparation assistance, income tax preparation, notary services, general administrative/document assistance.
- How it works: contact the business, receive guidance, submit documents securely in a future portal, review and follow up with staff.
- Client portal introduction: phased digital transition and coming secure document exchange.
- Trust section: established local service, personal support, English and Spanish assistance, secure digital transition.
- CTA: WhatsApp or call the office, with an existing-client sign-in placeholder clearly marked as unavailable until Phase 2.
- Footer: contact placeholders, hours placeholders, privacy, terms, accessibility, disclaimer, language switcher.

Do not fabricate years in business, credentials, testimonials, licenses, statistics, guarantees, or legal representation.

### Phase 1 conversion path

Use direct, business-controlled contact rather than collecting intake data in the new application:

- Primary CTA: WhatsApp, once the business confirms an official business number and approves the channel. This matches a communication pattern familiar to many Dominican clients and supports bilingual, mobile-first contact. Use a neutral prefilled message such as a request for a callback; never prefill or ask for Social Security numbers, tax documents, immigration records, account credentials, or other sensitive details.
- Co-primary fallback: a visible `tel:` action using the confirmed office number. Telephone must remain equally discoverable for users who do not use WhatsApp or do not consent to a third-party messaging service.
- Email: show a confirmed general-contact address in `ContactSettings`, with nearby copy stating that sensitive documents and identifiers must not be emailed. Email is not the primary CTA.
- Contact form: defer. A form introduces data classification, consent, retention, spam, notification, and access-control obligations without being needed to validate Phase 1 conversion.
- Appointment request: defer until the business defines scheduling ownership, confirmation behavior, cancellation policy, minimum fields, retention, and an approved provider or workflow.

The public-safe `ContactSettings` projection controls which approved channels are rendered. If WhatsApp is not confirmed at launch, telephone becomes the primary CTA. Record only aggregate, consent-aware CTA events if analytics is later enabled; do not place client-entered message content in analytics.

## 20. Language Switcher Behavior

Phase 1 acceptance requirements:

- Switch between English and Spanish.
- Preserve equivalent current route when possible.
- Preserve supported query parameters.
- Drop sensitive auth callback or token-like query parameters unless explicitly allowed.
- Be keyboard accessible.
- Have an accessible label.
- Work in desktop and mobile navigation.
- Work without authentication.
- Continue working after authentication is added.
- For anonymous users, persist an explicit switch in the locale cookie.
- For authenticated users, persist an explicit switch to both profile and cookie without blocking navigation on a profile-write failure.
- Avoid hydration mismatches.
- Avoid hard page failures when a translation is missing.
- Follow the deterministic precedence in Section 9 and the content fallback policy in Section 11.
- Update localized metadata.
- Avoid country flags as the only language indicator.
- Display labels such as `English` and `Espanol`.

Changing language should not log the user out or discard unsaved state without warning.

Visiting a locale-prefixed link is a navigation choice for that request, not proof of a new durable preference. Only the language switcher or an explicit profile setting updates the profile or cookie. Authentication completion preserves the current URL locale and never performs a surprise language switch.

## 21. PWA Foundation

Phase 1 should include:

- Web app manifest.
- Installable app metadata.
- Theme color.
- Mobile viewport behavior.
- App icon placeholders.
- Localized app name and description where supported.

Defer:

- Service worker.
- Offline authenticated portal behavior.
- Upload retry queues.
- Caching of private API responses.
- Caching of authenticated documents.

Future service worker strategy:

- Cache public shell and public content only.
- Provide localized offline fallback pages.
- Never cache sensitive documents or private API responses.

## 22. Secure Document Storage Direction

Future storage abstraction should support:

- Amazon S3.
- Cloudflare R2.
- Another S3-compatible private object store.
- Local development storage adapter.

The database stores document metadata and authorization relationships, not large file binaries.

Future document model:

- Document ID.
- Owner client ID.
- Related service request or case ID.
- Original filename.
- Safe display filename.
- MIME type.
- Size.
- Storage key.
- Checksum.
- Upload status.
- Malware-scan status.
- Uploaded-by identity.
- Created timestamp.
- Last-accessed timestamp.
- Retention category.
- Archived/deleted state.
- Audit metadata.
- Optional localized client-facing description.
- Language of document instructions where relevant.

Phase 1 must not implement real document upload unless a secure, reviewed storage abstraction already exists. It does not.

## 23. Docker and Local Development Architecture

Use Docker Compose for local dependencies:

- The exact stable PostgreSQL major selected through the compatibility policy in Section 4.
- Named volume for database data.
- Healthcheck for Postgres.
- Optional app service profile later.

Default local development can run Next.js on the host with `pnpm dev`, connected to Dockerized Postgres.

Pin the full container image tag, including patch version where practical, so local and CI behavior does not drift. Use the same PostgreSQL major planned for production and test backup/restore before a major upgrade.

Do not put production secrets in Compose files. Use `.env.example` and an ignored local `.env` for development-only values.

### Phase 1 health endpoints

Phase 1 should implement both health signals because the web process can remain alive while the CMS/database dependency is unavailable:

- `GET /api/health/live`: liveness only. Return `200` when the Next.js process can serve requests. Do not query PostgreSQL, Payload, Better Auth, storage, or third-party providers. Orchestrators may restart the process after repeated liveness failure.
- `GET /api/health/ready`: readiness. Perform a short, bounded check that Payload can initialize and PostgreSQL is reachable with the expected schema/migration state. Return `200` when the instance can serve Phase 1 traffic and `503` otherwise. Load balancers may remove an unready instance without restarting it.

Responses must be minimal and non-cacheable, for example `{ "status": "ok" }`, `{ "status": "ready" }`, or `{ "status": "unavailable" }`. Do not expose versions, connection strings, hostnames, database names, stack traces, migration identifiers, environment names, uptime, memory data, or exception messages. Detailed failure context belongs in access-controlled server logs with secret redaction. Use strict timeouts so readiness cannot hang or exhaust the connection pool.

## 24. Environment Variables

Configuration has three explicit owners.

Server-only Phase 1 environment variables:

- `DATABASE_URL`: PostgreSQL connection string.
- `PAYLOAD_SECRET`: high-entropy Payload signing/encryption secret.
- `SITE_URL`: canonical absolute public origin used by server-rendered metadata, canonical links, and trusted-origin configuration.
- `DEPLOYMENT_ENV`: optional deployment label such as `development`, `staging`, or `production` only when behavior cannot be derived safely from the framework-provided `NODE_ENV`. Do not introduce both `APP_ENV` and `DEPLOYMENT_ENV`.

Public runtime environment variables:

- None are required in Phase 1.

Do not expose an application identifier, site URL, business name, contact detail, locale list, or portal URL through `NEXT_PUBLIC_*`. The application identifier and supported/default locales are code-owned constants; canonical URLs are composed on the server from `SITE_URL`; public business data reaches client components only through the typed public-safe projection. Add a browser-visible environment variable later only when client-side code must talk directly to a third-party public endpoint and the value is intentionally non-secret.

CMS-managed configuration:

- `BusinessIdentity`: approved public name, localized descriptions, brand assets, and public-safe identity fields.
- `ContactSettings`: approved telephone, WhatsApp, email, addresses, hours, social links, and channel availability.
- `PortalSettings`: public portal availability and transition messaging. Derive same-origin portal URLs from `SITE_URL`; store a CMS-managed URL only if it is editorial and validated, or use a server-only variable if it identifies separate infrastructure.
- `HomepageContent`: localized, workflow-controlled public content.

`Perfect Tax` remains a typed development fallback and initial CMS seed value, not an environment variable. Unknown contact values must be omitted instead of populated from fallback environment variables.

Future server-only variables are added with the feature that consumes them: Better Auth secrets and trusted origin in Phase 2; object storage, malware scanning, transactional email, SMS/WhatsApp provider credentials, rate limiting, and private analytics configuration in later phases. Public provider identifiers may use `NEXT_PUBLIC_*` only after an explicit data-flow and exposure review.

Validate server configuration at startup, keep server and client schemas separate, and ensure server-only modules cannot be imported into client bundles. Do not store secrets, API keys, private credentials, authentication configuration, infrastructure hostnames, or unapproved internal settings in Payload CMS globals.

## 25. Testing Strategy

Phase 1 tests:

- TypeScript typecheck.
- ESLint.
- Prettier check.
- Vitest unit tests for locale routing helpers.
- Vitest tests for business identity fallback and projection.
- Route tests for `/en`, `/es`, `/en/sign-in`, `/es/sign-in`, `/en/portal`, `/es/portal`, `/api/health/live`, and `/api/health/ready`.
- Component tests for language switcher.
- Payload configuration, `CmsUsers` access-control, translation-workflow, and public-projection tests.
- Health tests proving liveness does not call dependencies, readiness returns `503` on a database failure, and neither response exposes diagnostics.

Later tests:

- Playwright browser smoke tests.
- Accessibility scans.
- Auth session integration tests.
- Authorization and access-control tests.
- Secure document access tests.

## 26. Localization Testing Strategy

Test:

- Every public route exists in English and Spanish.
- Language switcher preserves route and supported query parameters.
- Missing translation behavior does not crash the page.
- Metadata is localized.
- `hreflang` links exist for localized routes.
- Dates and numbers format according to locale.
- Validation messages come from localized dictionaries.
- Spanish is not silently replaced by English where public content requires reviewed Spanish.

## 27. Accessibility Requirements

Target WCAG 2.2 AA.

Requirements:

- Semantic landmarks.
- Keyboard-accessible navigation and language switcher.
- Visible focus states.
- Accessible names for buttons, links, and controls.
- Sufficient color contrast.
- Responsive text and layout.
- No language switching based only on flags.
- Correct `lang` attribute per route.
- Skip link.
- Accessible form labels and validation messages.

## 28. Security and Privacy Risks

Plan for:

- Server-side authorization on every protected operation.
- Secure session handling.
- MFA for staff and administrators.
- TLS in production.
- Encryption at rest.
- Private object storage.
- Time-limited signed download URLs.
- File size restrictions.
- File type validation.
- Malware scanning.
- Image metadata handling.
- Audit logs.
- Document access and download history.
- Record retention, deletion, and archival workflows.
- Backup and recovery.
- Secrets management.
- Rate limiting and brute-force protection.
- Account recovery.
- Consent and privacy disclosures in English and Spanish.
- Separation between marketing analytics and authenticated portal data.
- Protection against insecure direct object references.
- Safe logging and redaction.
- No sensitive content in translation logs or missing-translation reports.

## 29. Legal or Business Copy Review Flags

Require business-owner and potentially legal/compliance review for:

- Immigration-related wording.
- Tax preparation claims.
- Notary service wording.
- Credentials, jurisdictions, and professional titles.
- Privacy policy.
- Terms.
- Consent text.
- Portal document-request instructions.
- Spanish translations of legally sensitive content.
- Any copy that could imply attorney representation, guaranteed immigration outcomes, guaranteed tax outcomes, or unauthorized services.

Use neutral wording in the scaffold:

- Document preparation assistance.
- Administrative support.
- Tax preparation services.
- Notary services.
- Client document coordination.

## 30. Initial Implementation Phases

Phase 1: foundation, localization, independently authenticated CMS administration, CMS identity and translation workflow, public homepage and conversion path, placeholder portal routes, Better Auth architecture spike/ADR, health endpoints, tests, and docs.

Phase 2: production-ready Better Auth initialization, client registration, account profiles, portal staff/admin provisioning, MFA, and an optional controlled link from approved staff identities to existing `CmsUsers` records.

Phase 3: client portal service requests and basic case tracking.

Phase 4: secure document storage, scan pipeline, signed URLs, audit trails.

Phase 5: staff workflows, messaging, notifications, reporting, retention workflows.

## 31. Exact Phase 1 Scaffold Tasks

Task 1: repository and framework baseline.

- Goal: initialize neutral Next.js foundation.
- Files/areas: `package.json`, `pnpm-lock.yaml`, `.nvmrc` or `.node-version`, `src/app`, `tsconfig.json`, lint/format/test config.
- Details: verify the official compatibility intersection and pin an LTS Node.js release plus exact mutually supported Next.js, React, Tailwind, and UI package versions; use strict TypeScript and a minimal shadcn-compatible setup.
- Dependencies: none.
- Tests: typecheck, lint, format, Vitest empty smoke test, build.
- Acceptance: project builds; the selected runtime is pinned in local, package, CI guidance; exact dependencies are locked; the compatibility evidence is recorded; and there is no business-specific hardcoding beyond neutral identifiers.
- Out of scope: Payload, auth, database, homepage.
- Risks: choosing a recently released major before all framework integrations support it.

Task 2: environment and PostgreSQL local infrastructure.

- Goal: add Postgres development setup.
- Files/areas: `docker-compose.yml`, `.env.example`, README.
- Details: select and pin a stable PostgreSQL major supported by Payload, the driver/ORM, production hosting, and backup tooling; add a named volume, container healthcheck, documented `DATABASE_URL`, and the server-only environment schema from Section 24.
- Dependencies: Task 1.
- Tests: Compose config validates; app can read env schema.
- Acceptance: documented local database startup uses the same planned production major and no unnecessary `NEXT_PUBLIC_*` variables exist.
- Out of scope: schema migrations.
- Risks: local Docker availability.

Task 3: localization and route foundation.

- Goal: introduce `next-intl`, locale-prefixed routing, root negotiation.
- Files/areas: `src/app/[locale]`, localization module, middleware/proxy, messages.
- Details: `en` and `es`, default `en`, prefix always.
- Dependencies: Task 1.
- Tests: locale helpers and route smoke tests.
- Acceptance: `/en` and `/es` render localized placeholders.
- Out of scope: CMS content.
- Risks: proxy/middleware API differences in the selected Next.js release.

Task 4: Payload initialization and dedicated CMS authentication.

- Goal: configure a usable Payload CMS with Postgres, localization, and an explicit Phase 1 admin login boundary.
- Files/areas: `payload.config.ts`, `src/app/admin`, `CmsUsers`, CMS access controls, bootstrap command, initial migrations.
- Details: configure `en/es`; use auth-enabled, invite/admin-created `CmsUsers` as `admin.user`; define `editor`, `publisher`, and `cms-admin` roles; prohibit public registration; keep Better Auth absent.
- Dependencies: Tasks 1-3.
- Tests: Payload config compiles; migrations apply to a clean database; bootstrap creates the first administrator without a committed default password; login to `/admin` succeeds; an unauthorized user cannot access admin operations.
- Acceptance: `/admin` is exercisable end to end with dedicated CMS credentials, access controls are typed, and no Better Auth package, route, table, secret, or identity bridge exists.
- Out of scope: portal users, CMS single sign-on, public registration, production email recovery, and MFA integration.
- Risks: Payload/Next route integration and secure first-administrator provisioning.

Task 5: business identity, public content, and translation workflow.

- Goal: create CMS globals and collections for public identity/content.
- Files/areas: `src/modules/settings`, `src/modules/content`, Payload globals.
- Details: initial fallback public name `Perfect Tax`; localized descriptions and disclaimers; structured per-locale workflow; Payload drafts/versions; evergreen, legal, and urgent-announcement publication rules.
- Dependencies: Task 4.
- Tests: workflow transition, role, stale-source-revision, and prohibited-fallback tests.
- Acceptance: business name is centralized and configurable, editors can exercise the complete workflow, and unreviewed or ineligible localized content cannot enter the public projection.
- Out of scope: private settings and secrets.
- Risks: oversized settings model and workflow rules that are enforced only in the UI instead of server-side hooks/access controls.

Task 6: typed access layer and caching.

- Goal: prevent direct Payload queries from pages.
- Files/areas: settings/content application services and repositories.
- Details: server-side retrieval, request/framework caching, safe fallback, cache invalidation plan.
- Dependencies: Task 5.
- Tests: Payload-unavailable fallback, locale/workflow filtering, public-safe projection, cache-key, and invalidation behavior.
- Acceptance: page code consumes typed services only; draft, internal, and unapproved fields cannot reach client components; cache entries are locale-aware and invalidated by Payload hooks.
- Out of scope: complex cache tagging for every collection.
- Risks: stale content if invalidation is incomplete.

Task 7: layout shell and language switcher.

- Goal: implement accessible shared header/footer/auth/portal layout shell.
- Files/areas: `components/layout`, `modules/localization/presentation`.
- Details: visible switcher, route preservation, query allowlist, explicit-switch cookie persistence, URL-authoritative rendering, and a Phase 2 profile-persistence interface with no active authentication dependency.
- Dependencies: Tasks 3 and 6.
- Tests: component, precedence, bookmark/search-entry, post-login contract, cookie, and helper tests.
- Acceptance: switcher works on public, placeholder auth, placeholder portal, and mobile layouts without hydration mismatch or an unexpected language change.
- Out of scope: authenticated nav personalization.
- Risks: hydration mismatch if client/server locale state diverges.

Task 8: localized homepage, conversion actions, and placeholder pages.

- Goal: build CMS-backed public homepage and placeholder routes.
- Files/areas: marketing routes, components, content module.
- Details: neutral copy, configurable service sections, approved WhatsApp/telephone conversion actions from `ContactSettings`, email safety copy, no contact form, and no legal guarantees.
- Dependencies: Tasks 5-7.
- Tests: route, localization, CTA channel/fallback, public-projection, and accessibility smoke tests.
- Acceptance: English and Spanish have equal functionality; confirmed WhatsApp and telephone actions render safely; telephone becomes primary when WhatsApp is unavailable; placeholder sign-in performs no authentication.
- Out of scope: production document upload.
- Risks: copy approval.

Task 9: SEO, PWA metadata, and health endpoints.

- Goal: localized metadata, `hreflang`, manifest, icon placeholders.
- Files/areas: metadata helpers, manifest route, public assets, `/api/health/live`, `/api/health/ready`.
- Details: identity-driven localized metadata/app name plus minimal liveness and bounded Payload/Postgres readiness contracts.
- Dependencies: Tasks 2 and 5-8.
- Tests: metadata helpers; liveness dependency isolation; readiness success, timeout, and database-failure behavior; diagnostic-leak assertions.
- Acceptance: metadata consumes centralized identity; both health endpoints return only the documented statuses and readiness returns `503` when the Phase 1 dependency chain is unavailable.
- Out of scope: service worker.
- Risks: PWA icon replacement may require deployment; readiness checks can become expensive without strict scope and timeout.

Task 10: Better Auth architecture spike and ADR.

- Goal: retire Phase 2 integration unknowns without merging dormant authentication infrastructure.
- Files/areas: disposable spike workspace outside application source; committed ADR and dependency-compatibility notes only.
- Details: verify the pinned stack; exercise a disposable server session; inspect schema/migration ownership; decide Phase 2 route, cookie, trusted-origin, email, recovery, MFA, locale-profile, and test boundaries; document optional staff-only `CmsUsers` linking and rollback.
- Dependencies: Tasks 1, 2, and 4.
- Tests: run the spike against a disposable database and record commands/results in the ADR; rerun the application verification after removing spike artifacts.
- Acceptance: the ADR has a go/no-go conclusion and Phase 2 entry criteria; the merged application has no Better Auth dependency, routes, tables, secrets, generated schema, or unreachable code.
- Out of scope: production authentication, public registration, account UI, staff invites, identity linking, and application migrations.
- Risks: treating a successful proof as production security validation or accidentally committing disposable artifacts.

Task 11: security, tests, and documentation pass.

- Goal: make the scaffold reviewable.
- Files/areas: README, ADRs, tests, security notes.
- Details: consolidate runtime, CMS/portal authentication, storage, localization, translation, health, contact-channel, and deferred-risk decisions.
- Dependencies: Tasks 1-10.
- Tests: clean-database migration, lint, format, typecheck, Vitest, build, secret/public-bundle checks, and a manual `/admin` login smoke test.
- Acceptance: repo stays buildable and implementation boundaries are documented.
- Out of scope: production workflows.
- Risks: missing business-owner decisions.

## 32. Acceptance Criteria

- Next.js app builds with strict TypeScript.
- Locale-prefixed routes work for English and Spanish.
- Language switcher is accessible and preserves route context.
- Business identity is centralized and initialized with `Perfect Tax`.
- Header, footer, homepage, and metadata consume the centralized identity.
- Payload localization is configured for `en` and `es`.
- A compatible Node.js and PostgreSQL version set is verified, pinned, and documented.
- PostgreSQL local infrastructure is documented and matches the planned production major.
- `/admin` login works through a dedicated, non-public `CmsUsers` collection with least-privilege roles.
- Portal users and Better Auth application infrastructure do not exist in the Phase 1 runtime or database.
- The Better Auth spike ADR records compatibility evidence, Phase 2 entry criteria, and the optional staff-only CMS identity-link migration.
- Placeholder sign-in and portal routes are localized.
- Privacy, terms, and accessibility placeholder routes exist in both languages.
- Both liveness and readiness endpoints exist, return correct status codes, and expose no diagnostics.
- Locale behavior follows URL, profile, cookie, `Accept-Language`, then default precedence without post-login switching.
- Translation workflow and public repositories prevent publication or fallback that violates content-type policy.
- The homepage exposes an approved WhatsApp/telephone conversion path without collecting sensitive form data.
- No unnecessary `NEXT_PUBLIC_*` configuration exists.
- Tests cover localization, workflow enforcement, CMS access control, health behavior, contact fallback, and identity fallback/projection.
- README documents setup and business identity updates.
- ADRs or equivalent docs capture runtime/database compatibility, localization, translation workflow, CMS/portal authentication boundary, Better Auth timing, contact-channel, health, and storage decisions.

## 33. Deferred Features

- Production document uploads.
- Tax-return processing.
- Immigration form generation.
- Payment processing.
- Client messaging.
- Staff assignment.
- Case status automation.
- Production notifications.
- Complex dashboards.
- Native mobile apps.
- AI-generated legal, tax, or immigration guidance.
- Automatic publication of unreviewed machine translations.
- Better Auth packages, routes, schema, secrets, sessions, and production portal authentication.
- Portal-to-CMS identity linking or CMS single sign-on.
- Contact forms and appointment scheduling.

## 34. Open Questions That Genuinely Block Production, Not Phase 1

- Final public business name and branding.
- Confirmed contact information, office hours, and domain.
- Confirmation of the official WhatsApp account, channel ownership, client-facing privacy warning, and whether WhatsApp is enabled at launch.
- Approved English and Spanish public copy.
- Legal disclaimers and service boundaries.
- Portal staff/admin provisioning policy.
- Production CMS administrator ownership, recovery, MFA, and break-glass policy.
- MFA requirements and provider.
- Production object storage provider.
- Retention and deletion policy.
- Malware scanning provider.
- Transactional email/SMS/WhatsApp provider for later automated workflows.
- Privacy, terms, consent, and accessibility statement approval.

No open business question blocks the technical Phase 1 scaffold.

## 35. Global Business Identity Strategy

Separate these concepts:

- Legal identity: registered or legally recognized business name.
- Public brand: client-facing name and visual identity.
- Application identity: neutral technical name such as `client-services-portal`.
- Domain identity: public website and portal domains.

`Perfect Tax` is the initial configured public business name only. Do not use it as a package name, namespace, database prefix, storage bucket name, permanent PWA identifier, authentication-domain assumption, or duplicated hardcoded metadata value.

## 36. Payload Global Configuration Recommendation

Use focused Payload globals from the start:

- `BusinessIdentity`: legal and public brand identity.
- `ContactSettings`: contact information, addresses, office hours, social links.
- `PortalSettings`: portal availability messaging and public portal transition notices.
- `HomepageContent`: homepage sections and localized marketing content.

Do not put unrelated application behavior into one oversized settings object. Do not store secrets or authentication configuration in Payload globals.

## 37. Business Identity Field Model

Candidate fields:

- Legal business name.
- Public display name.
- Short business name.
- Previous or alternate business name.
- Business tagline.
- English and Spanish business descriptions.
- Primary logo.
- Alternate logo.
- Compact logo or icon.
- Favicon.
- PWA icons.
- Default social-sharing image.
- Primary business email.
- Primary telephone number.
- WhatsApp number.
- Office address.
- Mailing address.
- Business hours.
- Supported languages.
- Default locale.
- Public website URL.
- Client portal URL.
- Social media links.
- Tax-preparer credentials or identifiers where legally appropriate.
- Notary information where legally appropriate.
- Service-area description.
- Business registration information where appropriate.
- Public disclaimer.
- English and Spanish footer text.
- English and Spanish portal-transition notice.
- Branding status or rebranding notice if needed.

Do not assume every field is public. Mark fields as public, internal administrative, regulated/sensitive, or approval-required.

## 38. Localized Versus Shared Identity Fields

Localized fields:

- Tagline.
- Business description.
- Service-area description.
- Public disclaimer.
- Footer text.
- Portal-transition notice.
- Accessibility statements.
- Contact instructions.
- Office-visit instructions.

Shared fields:

- Telephone numbers.
- Email addresses.
- URLs.
- Logos.
- Legal identifiers.
- Most legal business name fields.

The business name should be shared by default with room for a localized display name later. Do not automatically translate the legal business name.

## 39. Public Versus Internal Configuration Boundaries

Client-side code may receive:

- Public display name.
- Short name.
- Approved public descriptions.
- Public contact details.
- Public logos.
- Public URLs.
- Approved disclaimers.

The client DTO must be built from an explicit allowlist and validated before serialization. Never pass raw Payload documents, draft/version metadata, access-control fields, or a catch-all settings object into a client component.

Server-only code may receive:

- Internal notes.
- Draft status.
- Review status.
- Administrative classification.
- Regulated credential metadata not approved for public display.

Never expose secrets, private credentials, API keys, auth configuration, or internal-only settings through CMS public projections.

## 40. Typed Business Identity Access Layer

Recommended module shape:

```text
src/modules/settings/
  domain/
    business-identity.ts
  application/
    get-business-identity.ts
  infrastructure/
    payload-business-identity-repository.ts
  presentation/
    business-identity-provider.tsx
```

The final implementation should provide:

- Typed business identity model.
- Server-side retrieval.
- Request-level or framework-appropriate caching.
- Safe fallback values.
- Locale-aware content resolution.
- Protection against unpublished or incomplete CMS content.
- Controlled public-safe projection for client components.
- Explicit public DTO/schema versioning so additive CMS fields are not exposed automatically.
- Testable behavior when Payload is unavailable during development.
- Cache invalidation when business identity changes.

## 41. Branding Asset Storage Strategy

Public brand assets belong in `PublicMedia` or a focused public brand media collection using public caching and editorial permissions.

Private client documents must use a separate future storage system with private access, signed URLs, scan workflow, retention rules, and stricter audit history.

Do not mix public logos and private client documents in the same storage policy, access-control model, cache policy, retention policy, or upload permission set.

## 42. Runtime Caching and Invalidation

Identity and public content can be cached with framework-appropriate server caching and neutral cache tags keyed by resource and locale. Payload `afterChange` hooks should invalidate only affected public tags after an eligible publication change; draft edits must not replace the last published projection.

Immediate at runtime:

- Display name.
- Tagline.
- Descriptions.
- Footer text.
- Contact information.
- Portal transition notice.

May require deployment or asset regeneration:

- Favicon files.
- Certain PWA icon files.
- Static social preview images if generated at build time.
- Domain or canonical URL infrastructure changes.

## 43. Rebranding and Migration Strategy

A future rebrand must not require:

- Renaming feature modules.
- Rewriting imports.
- Migrating core database relationships.
- Changing authorization logic.
- Replacing every string manually.
- Renaming all environment variables.
- Breaking existing user accounts.
- Changing document ownership.
- Invalidating stored files.
- Rebuilding unrelated workflows.

Use neutral infrastructure names and centralized public identity retrieval. Preserve stable media/document identifiers through rebranding, and treat domain, DNS, authentication trusted-origin, and canonical-URL changes as an operational migration with redirects and rollback rather than as editable brand copy.

## 44. Business Identity Acceptance Criteria

- `Perfect Tax` exists as the initial configured public business name.
- Public name can be changed from one controlled source.
- English and Spanish localized identity content is supported.
- Header, footer, homepage, and metadata consume centralized identity.
- No business name is duplicated across unrelated components.
- Public and internal settings are separated.
- Client-side code receives only public-safe values.
- Public projection uses an explicit allowlist and cannot expand when a CMS field is added.
- Development fallbacks exist.
- Cache keys are locale-aware and publication hooks invalidate affected public data.
- Rebrand does not require architectural changes.
- Public brand assets remain separate from private client documents.
- Tests verify configured values and fallback behavior.
- README explains how to update business identity.

## 45. Recommended Phase 1 Sequence

1. Repository and framework baseline.
2. Environment and PostgreSQL infrastructure.
3. Localization and route foundation.
4. Payload initialization and dedicated CMS authentication.
5. Business identity, public content, and translation workflow.
6. Typed access layer and caching.
7. Layout shell and language switcher.
8. Localized homepage, conversion actions, and placeholder pages.
9. SEO, PWA metadata, and health endpoints.
10. Better Auth architecture spike and ADR.
11. Security, tests, and documentation pass.

The language system and business identity must be introduced before the final homepage so the homepage is localized and identity-driven from its first implementation. Payload precedes the Better Auth spike because Phase 1 needs a usable CMS and the spike should test against the actual pinned framework/CMS/database stack. No task merges partially exercisable portal authentication.

## 46. Readiness Assessment

The repository is ready for Phase 1 scaffold work. There are no existing implementation constraints or business decisions that block the technical foundation. Launch still requires confirmed public contact details, reviewed bilingual copy, and a named owner for production CMS administration.

Deferring Better Auth runtime initialization reduces the largest integration risk: Phase 1 no longer couples Payload delivery to an unexercised portal session bridge. Remaining technical risks are selecting a mutually supported Node.js/Next.js/Payload/PostgreSQL set, securing `CmsUsers` bootstrap and access rules, enforcing translation state server-side, keeping readiness checks bounded, and keeping public CMS content separate from future private client records.

The largest business risks are unreviewed legal/tax/immigration copy, unclear public credentials, publication of incomplete Spanish content, and clients sending sensitive information through telephone, WhatsApp, or email despite channel warnings.

Phase 1 is implementation-ready under these constraints. Phase 2 authentication is not implementation-ready until the spike ADR has a go decision and the business confirms account recovery, transactional email, staff provisioning, MFA, and privacy requirements.

## 47. Exact Prompt For The First Implementation Agent

```text
You are the first implementation agent for the client-services-portal project.

Implement Phase 1 Task 1 only: repository and framework baseline.

Current repository state: empty project directory at /Users/helvinrymer/Desktop/Projects/perfect-tax.

Requirements:
- Initialize a neutral internal application named client-services-portal.
- Use pnpm.
- Before installing packages, verify current official compatibility across stable Next.js, Payload, Better Auth, and Node.js releases. Better Auth is not installed in this task, but its documented runtime requirements remain part of the long-term compatibility intersection.
- Select the newest LTS Node.js release in that supported intersection; pin it in `.nvmrc` or `.node-version`, `package.json#engines`, and documented CI/deployment guidance.
- Select the latest stable Next.js App Router and React versions supported by the chosen stable Payload release; pin exact package versions and record the official compatibility evidence.
- Add TypeScript with strict mode.
- Use src/app structure.
- Add the stable Tailwind CSS release compatible with the selected framework/tooling and pin its exact version.
- Add a minimal shadcn/ui-compatible setup using Radix-compatible conventions, but do not add unnecessary components.
- Add ESLint flat config, Prettier, and Vitest baseline.
- Add a minimal root page or placeholder only if required for build health.
- Do not introduce Payload, Better Auth, PostgreSQL, Docker, next-intl, business identity, homepage content, or production features yet.
- Do not add `NEXT_PUBLIC_*` variables or speculative environment variables.
- Do not hardcode Perfect Tax in application code during this task.
- Do not create empty directories just to match the future architecture.
- Keep the repository buildable after this task.

Expected verification:
- pnpm install
- pnpm lint
- pnpm format:check
- pnpm typecheck
- pnpm test
- pnpm build

Deliver:
- Changed files summary.
- Version summary.
- Verification results.
- Any blockers or follow-up notes for Task 2.
```

## 48. Sources

- Next.js documentation: https://nextjs.org/docs
- Next.js installation and runtime requirements: https://nextjs.org/docs/app/getting-started/installation
- Next.js upgrade guide: https://nextjs.org/docs/app/guides/upgrading/version-16
- Payload CMS documentation: https://payloadcms.com/docs
- Payload installation and compatibility requirements: https://payloadcms.com/docs/getting-started/installation
- Payload PostgreSQL adapter documentation: https://payloadcms.com/docs/database/postgres
- Payload localization documentation: https://payloadcms.com/docs/configuration/localization
- Payload globals documentation: https://payloadcms.com/docs/configuration/globals
- Payload Admin Panel user collection documentation: https://payloadcms.com/docs/admin/overview
- Payload authentication documentation: https://payloadcms.com/docs/authentication/overview
- Payload custom authentication strategy documentation: https://payloadcms.com/docs/authentication/custom-strategies
- Payload drafts documentation: https://payloadcms.com/docs/versions/drafts
- Better Auth documentation: https://www.better-auth.com/docs
- Better Auth installation documentation: https://www.better-auth.com/docs/installation
- Better Auth database documentation: https://www.better-auth.com/docs/concepts/database
- Better Auth Next.js integration documentation: https://www.better-auth.com/docs/integrations/next
- `next-intl` documentation: https://next-intl.dev/docs/getting-started/app-router
- PostgreSQL versioning policy: https://www.postgresql.org/support/versioning/
- PostgreSQL documentation: https://www.postgresql.org/docs/
- Node.js releases: https://nodejs.org/en/about/previous-releases
- Tailwind CSS documentation: https://tailwindcss.com/docs
- shadcn/ui documentation: https://ui.shadcn.com/docs
- Vitest documentation: https://vitest.dev/guide/

## 49. Changelog: Targeted Architecture Refinements

- Architectural decisions changed: Better Auth is now a Phase 1 compatibility spike and ADR only; Phase 1 `/admin` uses a dedicated, invite/admin-created Payload `CmsUsers` collection; portal and CMS identities remain separate by default with an optional audited staff-only link migration in Phase 2; runtime and PostgreSQL choices now follow a compatibility-first policy.
- Implementation ordering changed: Payload initialization and usable CMS authentication move ahead of the Better Auth spike; business identity, translation workflow, conversion actions, and health contracts are each completed in independently buildable tasks; no Phase 1 task merges dormant portal authentication.
- New rationale: an independently usable CMS reduces integration coupling; exact versions belong in implementation lock/tooling files rather than permanent architecture; URL-authoritative locale handling prevents surprise switching; structured editorial states make publication policy enforceable; direct telephone/WhatsApp contact validates conversion without a sensitive-data form.
- Risks reduced: duplicate identity ambiguity, unfinished auth attack surface, unsupported runtime/database majors, browser configuration leakage, inconsistent locale persistence, unreviewed translation publication, sensitive contact-form collection, and diagnostic health responses.
- Business identity confirmation: branding independence, focused Payload globals, typed server access, locale-aware caching/invalidation, an allowlisted public-safe projection, public/private asset separation, and rebranding without core model changes remain the approved direction. The only refinements are explicit projection schema control and operational treatment of domain/origin changes.
- Remaining open questions: confirm production contact channels and WhatsApp policy; approve bilingual and regulated copy; name the production CMS owner and recovery/MFA process; and resolve Phase 2 email, account recovery, portal provisioning, MFA, and any staff-only CMS single-sign-on decision after the Better Auth spike.
