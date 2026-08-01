## Agent 1 — Repository and Framework Baseline

You are Agent 1 for the client-services-portal project.

Implement Phase 1 Task 1 only: repository and framework baseline.

Repository path:

/Users/helvinrymer/Desktop/Projects/perfect-tax

The repository is currently empty.

Objective

Create a clean, neutral, production-quality Next.js foundation that later agents can extend with PostgreSQL, localization, Payload CMS, public content, and the bilingual homepage.

Required Decisions

Before installing dependencies, verify the current official compatibility intersection among:

* Node.js LTS.
* Next.js App Router.
* React.
* Payload CMS.
* Better Auth.
* Tailwind CSS.
* TypeScript.
* Vitest.

Payload and Better Auth are not installed in this task, but their documented compatibility requirements must influence the Node.js and Next.js versions selected.

Use official documentation and package metadata. Do not rely solely on memory.

Record the selected versions and compatibility rationale in repository documentation.

Implementation Requirements

* Initialize the internal application as client-services-portal.
* Use pnpm.
* Use the Next.js App Router.
* Use src/app.
* Enable TypeScript strict mode.
* Pin the selected Node.js version in:
    * .nvmrc or .node-version.
    * package.json#engines.
    * repository documentation.
* Pin exact dependency versions.
* Configure Tailwind CSS using the stable release compatible with the selected stack.
* Add a minimal shadcn/ui-compatible setup.
* Add components.json if required by the selected shadcn setup.
* Do not install unnecessary shadcn components.
* Add ESLint using flat configuration.
* Add Prettier.
* Add Vitest.
* Add useful scripts for:
    * development
    * build
    * start
    * lint
    * formatting
    * formatting check
    * type checking
    * testing
* Add a minimal application page only as needed to confirm build health.
* Keep internal naming neutral.
* Initialize Git only if the workspace is not already managed externally and repository initialization is expected by the project workflow.

Do Not Implement

* Payload CMS.
* Better Auth.
* PostgreSQL.
* Docker.
* next-intl.
* Locale routes.
* Business identity.
* The Perfect Tax brand.
* Homepage sections.
* Environment variables.
* Authentication.
* PWA behavior.
* Future feature-module directories that contain no code.

Do not hardcode Perfect Tax anywhere in application code.

Do not add speculative NEXT_PUBLIC_* variables.

Quality Requirements

* Avoid any.
* Use clear import aliases.
* Keep the root application minimal.
* Do not introduce business logic.
* Do not create abstraction layers without an immediate use.
* Add JSDoc to exported non-trivial utilities or configuration helpers where their purpose is not self-evident.
* Keep the repository buildable.

Verification

Run:

pnpm install
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build

Required Report

Return:

1. Changed files.
2. Selected Node.js and package versions.
3. Compatibility evidence and reasoning.
4. Verification results.
5. Any warnings relevant to Payload, Better Auth, or Task 2.
6. Architecture-conformance checklist.

Do not begin Task 2.

⸻

## Agent 2 — Environment and PostgreSQL Infrastructure

You are Agent 2 for the client-services-portal project.

Implement Phase 1 Task 2 only: environment validation and PostgreSQL local infrastructure.

Read before changing code:

.codex/phase-1-architecture-plan.md

Inspect the completed Task 1 implementation and preserve its conventions.

Objective

Add a secure, documented local PostgreSQL environment and typed server-only configuration foundation without adding application schema, Payload CMS, authentication, or business features.

Version Selection

Verify which stable PostgreSQL major is supported by:

* The selected Payload CMS release.
* Payload’s PostgreSQL adapter.
* The underlying database driver or ORM.
* The likely production hosting options.
* Backup and restore tooling.

Select a compatibility-first version.

Pin the Docker image version, including the patch version where practical.

Document the rationale.

Implementation Requirements

Add:

* docker-compose.yml or compose.yml.
* A PostgreSQL service.
* A named persistent volume.
* A PostgreSQL container healthcheck.
* Local-only development credentials sourced from environment variables.
* .env.example.
* An ignored local environment-file strategy.
* A typed server-side environment validation module.
* Documentation for starting, stopping, resetting, and inspecting the database.

Phase 1 server-only configuration should include only what is currently needed:

DATABASE_URL
PAYLOAD_SECRET
SITE_URL
DEPLOYMENT_ENV

DEPLOYMENT_ENV is optional if it adds meaningful behavior beyond NODE_ENV.

Do not add both APP_ENV and DEPLOYMENT_ENV.

The environment validation architecture must distinguish:

* Server-only configuration.
* Client-visible configuration.
* Future CMS-managed configuration.

No client-visible runtime environment variables are currently needed.

Security Requirements

* Do not commit secrets.
* Do not expose database credentials through browser bundles.
* Do not add NEXT_PUBLIC_* variables.
* Do not put production secrets directly in Compose.
* Ensure server-only environment modules cannot safely be imported into client components.
* Do not add placeholder values that resemble production secrets.
* Use a high-entropy placeholder instruction for PAYLOAD_SECRET, not a shared real value.

Do Not Implement

* Payload initialization.
* Database migrations.
* Better Auth.
* Business tables.
* Locale routing.
* Homepage content.
* Health endpoints.
* CMS globals.
* Seeded business data.

Verification

Run:

docker compose config
docker compose up -d
docker compose ps
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build

Confirm the PostgreSQL healthcheck reaches healthy status.

Do not delete developer data unless a clean reset is explicitly part of your test and clearly reported.

Required Report

Return:

1. Changed files.
2. Selected PostgreSQL image and compatibility rationale.
3. Environment ownership model.
4. Compose startup and health results.
5. Verification results.
6. Risks or follow-up notes for Payload integration.
7. Architecture-conformance checklist.

Do not begin Task 3.

⸻

## Agent 3 — Localization and Locale Routing

You are Agent 3 for the client-services-portal project.

Implement Phase 1 Task 3 only: localization and locale-prefixed routing.

Read:

.codex/phase-1-architecture-plan.md

Inspect the existing repository and preserve prior decisions.

Objective

Introduce first-class English and Spanish routing with next-intl, deterministic locale negotiation, and localized placeholder routes.

Required Locale Contract

Supported locales:

en
es

Default locale:

en

Use locale prefixes consistently:

/en
/es

The root route / must redirect using this precedence:

1. Explicit authenticated profile preference, when one exists in the future.
2. Locale cookie.
3. Accept-Language.
4. Default en.

Because authentication does not exist in Phase 1, implement the profile-preference boundary as an interface or deferred hook only. Do not create fake authentication.

An explicit locale-prefixed URL must always be authoritative.

Never redirect /es/... to English because of a cookie, browser preference, or geography.

Implementation Requirements

* Install and configure next-intl.
* Add locale definitions and typed locale helpers.
* Add locale-prefixed routing.
* Add root negotiation.
* Add English and Spanish message dictionaries.
* Add minimal localized placeholder pages at:
    * /en
    * /es
* Add correct route-level lang behavior.
* Add safe unsupported-locale handling.
* Add utilities for:
    * supported-locale validation
    * best locale matching
    * route locale extraction
    * root redirect selection
* Preserve the thin app directory principle.
* Put localization logic in a focused module.
* Use server rendering where appropriate.
* Avoid unnecessary global client state.

Cookie Rules

Use a clearly named locale cookie.

The cookie must:

* Store only supported locale values.
* Be updated later by an explicit language-switch action.
* Not override an explicit URL locale.
* Use reasonable security and same-site settings.
* Not contain personal information.

Do Not Implement

* Payload CMS content.
* Language switcher UI.
* Homepage content.
* Better Auth.
* Profile persistence.
* CMS localization.
* SEO metadata beyond what is needed for route health.
* Portal functionality.

Tests

Add tests for:

* Supported locale recognition.
* Unsupported locale handling.
* Root selection using cookie.
* Root selection using Accept-Language.
* Default fallback.
* Explicit URL authority.
* English and Spanish route rendering.
* No geographic locale inference.

Verification

Run:

pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build

Manually verify /, /en, and /es.

Required Report

Return:

1. Changed files.
2. Localization architecture.
3. Root negotiation behavior.
4. Cookie behavior.
5. Test and build results.
6. Any selected Next.js middleware/proxy conventions.
7. Risks or Task 4 notes.
8. Architecture-conformance checklist.

Do not begin Task 4.

⸻

## Agent 4 — Payload CMS and CMS Authentication

You are Agent 4 for the client-services-portal project.

Implement Phase 1 Task 4 only: Payload initialization and dedicated CMS authentication.

Read:

.codex/phase-1-architecture-plan.md

Inspect all existing code and preserve established conventions.

Objective

Introduce a usable Payload CMS backed by PostgreSQL, with English and Spanish localization and an isolated CMS-only authentication boundary.

Critical Identity Boundary

Phase 1 must use a dedicated auth-enabled Payload collection:

CmsUsers

This collection exists only for Payload administration.

It must not represent:

* Portal clients.
* Portal staff identities.
* Better Auth users.
* Future public registrations.

Better Auth must remain completely absent from the merged application.

Payload Requirements

* Install mutually compatible stable Payload packages.
* Pin all Payload packages to the same exact version.
* Configure the PostgreSQL adapter.
* Configure Payload localization for:
    * en
    * es
* Configure /admin.
* Configure Payload API routes required by the supported integration.
* Disable GraphQL unless required by the selected integration.
* Add migration support.
* Generate and commit an initial migration if appropriate for the selected Payload workflow.
* Ensure a clean database can be initialized consistently.

CmsUsers Requirements

Use an auth-enabled collection with roles:

editor
publisher
cms-admin

Requirements:

* No public registration.
* Only authorized CMS administrators may create additional CMS users.
* Apply least-privilege access controls.
* Protect role updates.
* Prevent self-escalation.
* Prevent editors from creating or promoting CMS administrators.
* Configure appropriate login throttling or lockout behavior supported by Payload.
* Avoid returning unnecessary user fields publicly.
* Do not allow this collection to be read publicly.

First-Administrator Bootstrap

Create an explicit secure bootstrap command or script.

It must:

* Require credentials through interactive input or secure environment variables.
* Refuse weak or missing values.
* Avoid logging passwords.
* Avoid committing a default account.
* Avoid automatically creating a shared administrator on application startup.
* Be idempotent or fail safely when an administrator already exists.
* Clearly document how production bootstrap differs from local development.

Architecture Requirements

* Keep Payload integration behind server/module boundaries.
* Do not scatter Payload Local API calls throughout pages.
* Use overrideAccess: false for protected operations when applicable.
* Add JSDoc to non-trivial exported access-control helpers and bootstrap utilities.
* Keep the application buildable.

Do Not Implement

* Better Auth.
* Portal users.
* Client registration.
* CMS single sign-on.
* Business identity globals.
* Homepage content.
* Services collection.
* Public media.
* Translation workflow.
* Portal authentication.
* MFA integration.

Tests

Add tests for:

* Payload configuration.
* CmsUsers access rules.
* Role escalation prevention.
* Public registration rejection.
* Unauthorized CMS access.
* Bootstrap validation.
* Clean migration application.

Where full integration tests require PostgreSQL, use a documented test database strategy.

Verification

Run:

docker compose up -d
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build

Apply migrations to a clean development or test database.

Exercise /admin login using a securely bootstrapped local CMS administrator.

Required Report

Return:

1. Changed files.
2. Payload and adapter versions.
3. Migration strategy.
4. CmsUsers role and access model.
5. Bootstrap procedure.
6. Verification and admin-login results.
7. Security risks or limitations.
8. Architecture-conformance checklist.

Do not begin Task 5.

⸻

## Agent 5 — Business Identity, Public Content, and Translation Workflow

You are Agent 5 for the client-services-portal project.

Implement Phase 1 Task 5 only: business identity, public content, public media, and translation workflow.

Read:

.codex/phase-1-architecture-plan.md

Preserve the Payload and repository conventions already established.

Objective

Create focused CMS models for configurable public identity and bilingual public content while ensuring unreviewed or ineligible content cannot enter the future public projection.

Required Payload Globals

Implement focused globals:

BusinessIdentity
ContactSettings
PortalSettings
HomepageContent

Required Collections

Implement:

Services
PublicMedia

Do not mix public media with future private client documents.

Initial Public Identity

Seed or initialize the public display name as:

Perfect Tax

This must remain CMS-configurable.

Do not use Perfect Tax as:

* Package name.
* Module name.
* Database prefix.
* Infrastructure identifier.
* Storage bucket name.
* Permanent application identifier.

Field Modeling

Implement only fields needed for Phase 1 and clearly justified near-term use.

Avoid implementing every candidate field in the architecture document merely because it is listed.

At minimum support:

BusinessIdentity

* Legal business name.
* Public display name.
* Short name.
* Localized tagline.
* Localized business description.
* Localized service-area description.
* Localized public disclaimer.
* Logo relationships.
* Branding status or rebranding notice where justified.

ContactSettings

* Approved telephone.
* Approved WhatsApp number.
* Approved general email.
* Office address.
* Business hours.
* Channel-enabled flags.
* Localized contact safety instructions.

PortalSettings

* Portal availability state.
* Localized transition notice.
* Localized sign-in placeholder messaging.

HomepageContent

* Localized hero.
* Localized services introduction.
* Localized process steps.
* Localized portal introduction.
* Localized trust section.
* Localized CTA copy.
* Localized footer copy where appropriate.

Services

* Stable internal identifier.
* Localized title.
* Localized summary.
* Localized detailed description.
* Display order.
* Active/public status.
* Translation workflow.

PublicMedia

* Public brand and marketing assets only.
* Appropriate MIME restrictions.
* Public editorial access controls.
* No client-document semantics.

Translation Workflow

Implement structured per-locale workflow states:

draft
needs-review
reviewed
published

Also include:

* sourceRevision
* reviewedBy
* reviewedAt
* publishedBy
* publishedAt
* reviewNotes

Use a required content policy:

evergreen
legal
urgent-announcement

Enforcement Requirements

Enforce transitions server-side.

Do not rely only on disabled Admin UI controls.

Rules:

* Editors may draft and submit for review.
* Authorized bilingual reviewers may mark content reviewed.
* Publishers may publish eligible content.
* Users must not self-escalate roles.
* Legal content requires reviewed English and Spanish for the same source revision.
* Evergreen homepage and service content requires reviewed English and Spanish before a new revision becomes public.
* Urgent announcements may use the documented expedited policy.
* Editing reviewed or published localized content resets the working revision to draft.
* The last eligible published version should remain available until a new eligible revision is published.
* Public fallback must not silently replace missing Spanish legal or substantive content with English.
* Workflow metadata must not contain client-sensitive information.

Use Payload drafts and versions where appropriate.

Public Media Boundary

Document and enforce that PublicMedia is not suitable for:

* Tax records.
* Identity documents.
* Immigration records.
* Client photographs.
* Private uploads.
* Case evidence.

Do Not Implement

* Public website queries.
* Typed DTO projection.
* Cache invalidation.
* Homepage UI.
* Private document storage.
* Better Auth.
* Portal accounts.
* Contact forms.
* Messaging.

Tests

Add tests for:

* Workflow transitions.
* Unauthorized review or publication.
* Stale sourceRevision.
* Legal bilingual publication rules.
* Evergreen bilingual publication rules.
* Prohibited fallback.
* Role restrictions.
* Business identity configurability.
* Public media access boundaries.

Verification

Run:

pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build

Exercise the workflow through Payload Admin where practical.

Required Report

Return:

1. Changed files.
2. CMS object summary.
3. Phase 1 field-model decisions.
4. Translation workflow behavior.
5. Access-control behavior.
6. Test results.
7. Any intentionally deferred fields.
8. Architecture-conformance checklist.

Do not begin Task 6.

⸻

## Agent 6 — Typed Public Access Layer and Caching

You are Agent 6 for the client-services-portal project.

Implement Phase 1 Task 6 only: typed CMS access, public-safe projections, caching, and invalidation.

Read:

.codex/phase-1-architecture-plan.md

Inspect all Payload globals and collections created in Task 5.

Objective

Prevent route components and client components from reading raw Payload documents.

Create a typed server-side application layer that retrieves only publication-eligible public content and returns explicit allowlisted DTOs.

Required Module Shape

Use focused module boundaries similar to:

src/modules/settings/
  domain/
  application/
  infrastructure/
  presentation/
src/modules/content/
  domain/
  application/
  infrastructure/

Adapt to the repository conventions rather than copying this mechanically.

Required Services

Create typed retrieval services for at least:

* Business identity.
* Contact settings.
* Portal settings.
* Homepage content.
* Public services.

Projection Rules

Every public DTO must be:

* Explicitly allowlisted.
* Locale-aware.
* Validated before serialization.
* Independent from raw Payload generated types where appropriate.
* Versioned or structured so new CMS fields are not exposed automatically.
* Free of drafts.
* Free of internal notes.
* Free of workflow metadata.
* Free of CMS user references.
* Free of access-control fields.
* Free of unpublished localized values.
* Free of regulated fields not explicitly approved for public display.

Do not pass raw Payload documents to React client components.

Fallback Rules

Implement safe development fallback behavior for:

* Missing business identity.
* Temporarily unavailable Payload during local development.
* Missing optional public contact fields.

The initial display-name fallback may be:

Perfect Tax

Do not fabricate telephone numbers, addresses, emails, credentials, or office hours.

Unknown contact fields must be omitted.

Fallback must not bypass translation publication policy.

Caching Requirements

Use framework-appropriate server caching.

Cache keys and tags must account for:

* Resource type.
* Locale.
* Publication eligibility.

Draft edits must not invalidate or replace the last published public projection.

Eligible publication changes should invalidate affected public tags using Payload hooks.

Avoid one global cache-clearing mechanism if focused invalidation is possible.

Document which content is:

* Request-cached.
* Persistently server-cached.
* Not cached.

Error Handling

* Do not expose Payload errors to the browser.
* Log only safe diagnostic context.
* Do not log content bodies or sensitive CMS metadata unnecessarily.
* Distinguish temporary CMS unavailability from invalid content.
* Provide deterministic fallbacks.

Do Not Implement

* Homepage UI.
* Header or footer.
* Language switcher.
* Client authentication.
* Better Auth.
* Private document storage.
* External caching providers.
* Client-side data fetching.

Tests

Add tests for:

* Public DTO allowlists.
* Raw field non-leakage.
* Locale eligibility.
* Draft filtering.
* Translation workflow filtering.
* Missing optional fields.
* Payload-unavailable fallback.
* Cache keys.
* Locale-aware caching.
* Publication-triggered invalidation.
* Draft changes not replacing published content.

Verification

Run:

pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build

Required Report

Return:

1. Changed files.
2. Module and repository boundaries.
3. Public DTO definitions.
4. Fallback behavior.
5. Cache strategy.
6. Invalidation strategy.
7. Verification results.
8. Security review of exposed fields.
9. Architecture-conformance checklist.

Do not begin Task 7.

⸻

## Agent 7 — Shared Layout and Language Switcher

You are Agent 7 for the client-services-portal project.

Implement Phase 1 Task 7 only: shared public/auth/portal layout shell and language switcher.

Read:

.codex/phase-1-architecture-plan.md

Use the typed services from Task 6. Do not query Payload directly.

Objective

Create an accessible, responsive shared shell that uses centralized business identity and supports deterministic English/Spanish switching across public, placeholder-auth, and placeholder-portal routes.

Required Layout Surfaces

Create shared structures for:

* Public marketing pages.
* Placeholder authentication pages.
* Placeholder portal pages.

Reuse appropriate components without tightly coupling all surfaces to one oversized layout.

Header Requirements

Use public-safe business identity.

Include:

* Public display name or approved logo.
* Public navigation.
* Language switcher.
* Contact CTA.
* Placeholder sign-in action.
* Mobile navigation.

Do not hardcode Perfect Tax in components.

Footer Requirements

Use typed public content and contact settings.

Include:

* Configured identity.
* Approved contact channels.
* Privacy link.
* Terms link.
* Accessibility link.
* Public disclaimer where eligible.
* Language switcher.
* Appropriate channel safety copy.

Language Switcher Requirements

The switcher must:

* Display English and Español.
* Not rely on flags alone.
* Preserve the equivalent current route.
* Preserve allowlisted query parameters.
* Drop token-like, callback, authentication, and sensitive query parameters unless explicitly safe.
* Update the locale cookie only after an explicit switch.
* Use the URL locale as authoritative.
* Work on desktop and mobile.
* Be keyboard accessible.
* Have an accessible name.
* Avoid hydration mismatch.
* Preserve login state in future architecture.
* Not create a fake profile write in Phase 1.
* Use a deferred profile-preference interface for Phase 2.
* Not silently change locale after login.
* Not discard unsaved state without warning.

Query Preservation

Create an explicit query-parameter allowlist.

Do not forward arbitrary query parameters between locales.

Document the allowlist and why each value is safe.

Accessibility Requirements

* Semantic landmarks.
* Skip link.
* Visible focus.
* Correct lang behavior.
* Keyboard navigation.
* Proper accessible names.
* Mobile menu operability.
* No inaccessible custom select behavior.

Do Not Implement

* Final homepage.
* Real sign-in.
* Real portal.
* Better Auth.
* Profile persistence.
* Contact forms.
* Messaging.
* CMS editing features.
* New public business fields.

Tests

Add tests for:

* Route preservation.
* Locale switching.
* Query allowlisting.
* Sensitive-query dropping.
* Cookie updates.
* Explicit URL authority.
* Keyboard behavior.
* Accessible names.
* Mobile navigation.
* Public/auth/portal shell rendering.
* Business identity fallback rendering.

Verification

Run:

pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build

Manually verify the switcher on English and Spanish routes.

Required Report

Return:

1. Changed files.
2. Layout architecture.
3. Switcher route logic.
4. Query allowlist.
5. Cookie behavior.
6. Accessibility results.
7. Verification results.
8. Architecture-conformance checklist.

Do not begin Task 8.

⸻

## Agent 8 — Localized Homepage and Placeholder Pages

You are Agent 8 for the client-services-portal project.

Implement Phase 1 Task 8 only: localized homepage, conversion actions, and placeholder pages.

Read:

.codex/phase-1-architecture-plan.md

Use only the typed CMS application services from Task 6.

Objective

Build the first complete bilingual public experience without collecting sensitive client data or pretending that the future portal is operational.

Homepage Requirements

Build a responsive, professional, trustworthy homepage in English and Spanish.

Required sections:

1. Header through the shared layout.
2. Hero.
3. Services overview.
4. How it works.
5. Client portal introduction.
6. Trust section.
7. Contact CTA.
8. Footer.

Copy Requirements

Use neutral, accurate language.

Permitted concepts include:

* Document preparation assistance.
* Administrative support.
* Tax preparation services.
* Notary services.
* Client document coordination.

Do not claim:

* The business is a law firm.
* Attorney representation.
* Guaranteed immigration outcomes.
* Guaranteed tax outcomes.
* Fabricated credentials.
* Fabricated licenses.
* Fabricated years in business.
* Fabricated testimonials.
* Fabricated statistics.

Clearly mark unapproved regulated copy as requiring business review.

Conversion Requirements

The homepage must provide a real Phase 1 conversion path without a contact form.

Use CMS-configured channel availability:

1. WhatsApp when a confirmed approved business number exists.
2. Telephone as a co-primary or fallback.
3. General email as secondary contact.

Behavior:

* If WhatsApp is enabled and valid, render it safely.
* If WhatsApp is unavailable, telephone becomes the primary CTA.
* Do not render fake contact information.
* Do not display disabled links with placeholder values.
* Use a neutral WhatsApp prefilled message requesting contact or a callback.
* Do not prefill sensitive information.
* Near email and WhatsApp actions, state that sensitive documents and identifiers must not be sent through these channels.
* Do not add a contact form.
* Do not add appointment scheduling.

Placeholder Routes

Implement localized pages for:

/en/sign-in
/es/sign-in
/en/portal
/es/portal
/en/privacy
/es/privacy
/en/terms
/es/terms
/en/accessibility
/es/accessibility

Sign-in and portal pages must:

* Clearly state that online account access is not yet available.
* Avoid fake login forms.
* Avoid storing credentials.
* Provide a safe contact path.
* Preserve equal functionality in both languages.

Legal pages must be clearly marked as placeholders pending approved content and must not pretend to be finalized policies.

Technical Requirements

* Keep route files thin.
* Use reusable presentation components.
* Use public DTOs only.
* Preserve localization boundaries.
* Use semantic HTML.
* Avoid unnecessary client components.
* Do not duplicate CMS-owned copy in code except safe fallback text.
* Add JSDoc for non-trivial exported helpers.

Tests

Add tests for:

* English and Spanish route rendering.
* Equal section functionality.
* CTA priority and fallback.
* Invalid or missing contact data.
* No contact form.
* No fake login form.
* No raw CMS document leakage.
* Accessibility landmarks.
* Localized placeholder messaging.

Verification

Run:

pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build

Manually inspect responsive layouts.

Required Report

Return:

1. Changed files.
2. Homepage component structure.
3. Content source map.
4. CTA behavior.
5. Placeholder route behavior.
6. Accessibility findings.
7. Verification results.
8. Copy requiring owner or legal review.
9. Architecture-conformance checklist.

Do not begin Task 9.

⸻

## Agent 9 — SEO, PWA Metadata, and Health Endpoints

You are Agent 9 for the client-services-portal project.

Implement Phase 1 Task 9 only: localized metadata, PWA manifest foundation, and health endpoints.

Read:

.codex/phase-1-architecture-plan.md

Use centralized public business identity and typed content services.

Objective

Add identity-driven localized metadata and minimal operational health contracts without introducing a service worker or exposing internal diagnostics.

SEO Requirements

Implement:

* Localized page titles.
* Localized page descriptions.
* Canonical URLs.
* English and Spanish alternates.
* hreflang.
* Correct lang.
* Open Graph metadata.
* Social metadata where suitable.
* Identity-driven site name.
* Safe fallback metadata.

Use SITE_URL server-side.

Do not use NEXT_PUBLIC_SITE_URL.

Do not hardcode Perfect Tax in metadata helpers.

Do not expose draft CMS content.

PWA Requirements

Add:

* Web app manifest.
* Configurable public display name.
* Configurable short name.
* Localized description where supported.
* Theme color.
* Mobile viewport configuration.
* Placeholder icons.
* Documentation explaining icon replacement.

Do not implement:

* Service worker.
* Offline authenticated content.
* Upload retry.
* Private API caching.
* Document caching.

Use a neutral stable internal manifest identifier if needed. Do not make the current public brand the permanent technical identifier.

Health Endpoints

Implement:

GET /api/health/live
GET /api/health/ready

Liveness

Must:

* Return 200 if the Next.js process can respond.
* Avoid querying PostgreSQL.
* Avoid initializing Payload unnecessarily.
* Avoid third-party calls.
* Return a minimal non-cacheable response.

Readiness

Must:

* Perform a bounded dependency check.
* Confirm PostgreSQL is reachable.
* Confirm Payload can initialize sufficiently to serve Phase 1 traffic.
* Use a strict timeout.
* Return 200 when ready.
* Return 503 when unavailable.

Do not expose:

* Versions.
* Hostnames.
* Database names.
* Migration IDs.
* Connection strings.
* Stack traces.
* Environment names.
* Memory usage.
* Uptime.
* Exception messages.

Use minimal response bodies such as:

{ "status": "ok" }
{ "status": "ready" }
{ "status": "unavailable" }

Detailed failure information belongs only in safely redacted server logs.

Tests

Add tests for:

* Localized metadata.
* Canonical URLs.
* hreflang.
* Identity-driven naming.
* Manifest output.
* Liveness dependency isolation.
* Readiness success.
* Readiness timeout.
* Database failure.
* Payload initialization failure.
* 503 behavior.
* Diagnostic non-leakage.
* Non-cacheable responses.

Verification

Run:

docker compose up -d
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build

Manually call both health endpoints.

Required Report

Return:

1. Changed files.
2. Metadata architecture.
3. Manifest behavior.
4. Health-check implementation.
5. Timeout and failure behavior.
6. Verification results.
7. Operational risks.
8. Architecture-conformance checklist.

Do not begin Task 10.

⸻

## Agent 10 — Better Auth Compatibility Spike and ADR

You are Agent 10 for the client-services-portal project.

Perform Phase 1 Task 10 only: Better Auth compatibility spike and architecture decision record.

Read:

.codex/phase-1-architecture-plan.md

This is a research and disposable proof task.

Critical Rule

Do not merge Better Auth runtime infrastructure into the application.

The final repository must not contain:

* better-auth as an application dependency.
* /api/auth/[...all].
* Better Auth secrets.
* Better Auth tables.
* Better Auth migrations.
* Better Auth-generated schema.
* Dormant session helpers.
* Fake authentication UI.
* Unreachable authentication code.

Only the ADR, compatibility evidence, and safe documentation should remain.

Objective

Retire the most important Phase 2 integration unknowns against the actual pinned project stack.

Spike Requirements

Using a disposable workspace and disposable database:

* Verify Better Auth compatibility with:
    * selected Node.js version
    * selected Next.js version
    * React version
    * PostgreSQL version
    * Payload version
* Prove a minimal server-side session read.
* Inspect Better Auth database schema.
* Inspect migration ownership and tooling.
* Determine how Better Auth and Payload migrations remain separate.
* Evaluate the recommended Next.js integration.
* Evaluate cookie defaults and required hardening.
* Evaluate CSRF and origin validation.
* Evaluate trusted-origin configuration.
* Evaluate sign-up and client-registration controls.
* Evaluate staff invitation design.
* Evaluate account recovery requirements.
* Evaluate transactional email requirements.
* Evaluate MFA options for staff and administrators.
* Evaluate locale preference storage.
* Evaluate suspension and deletion propagation.
* Evaluate test strategy.
* Evaluate how portal staff could optionally link to existing CmsUsers without linking by email alone.
* Evaluate rollback from a future custom Payload auth strategy.

Required ADR Decisions

The ADR must state:

* Go or no-go.
* Exact tested Better Auth version.
* Compatibility findings.
* Future API route.
* Cookie policy.
* Origin policy.
* CSRF protections.
* Session access boundary.
* Database schema owner.
* Migration owner.
* Registration policy.
* Client role defaults.
* Staff invitation policy.
* Administrator provisioning policy.
* Account recovery dependencies.
* MFA direction.
* Email provider prerequisites.
* Preferred-language ownership.
* Suspension and deletion behavior.
* Portal/CMS identity separation.
* Optional audited staff-only linking.
* Phase 2 entry criteria.
* Known unresolved risks.

Cleanup Requirements

After the spike:

* Remove Better Auth from application dependencies.
* Remove disposable routes.
* Remove disposable schema.
* Remove disposable environment variables.
* Remove disposable migrations.
* Remove generated files.
* Remove test credentials.
* Remove temporary database objects.
* Verify the main application is unchanged except for approved documentation.

Verification

Run the spike commands and record them in the ADR.

Then run against the clean application:

pnpm install
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build

Search the repository for forbidden Better Auth runtime artifacts.

Required Report

Return:

1. ADR path.
2. Spike workspace approach.
3. Tested versions.
4. Go/no-go conclusion.
5. Phase 2 entry criteria.
6. Cleanup evidence.
7. Application verification results.
8. Remaining risks.
9. Architecture-conformance checklist.

Do not begin production authentication work.

⸻

## Agent 11 — Security, Verification, and Documentation Pass

You are Agent 11 for the client-services-portal project.

Implement Phase 1 Task 11 only: final security, test, documentation, and architecture-conformance pass.

Read:

.codex/phase-1-architecture-plan.md

Review the complete Phase 1 repository rather than assuming earlier agents implemented everything correctly.

Objective

Make the Phase 1 scaffold reviewable, reproducible, secure within its limited scope, and ready for PR-style approval.

Do not add deferred product features.

Required Review Areas

Review and correct issues in:

* Framework configuration.
* Exact version pinning.
* Node.js version pinning.
* PostgreSQL image pinning.
* Environment validation.
* Server/client environment separation.
* Locale routing.
* Locale cookie behavior.
* Query allowlisting.
* Payload CMS integration.
* CmsUsers access controls.
* First-administrator bootstrap.
* Translation workflow enforcement.
* Public DTO allowlisting.
* Draft and workflow filtering.
* Cache keys and invalidation.
* Public/private media boundary.
* Homepage copy boundaries.
* CTA fallback behavior.
* Placeholder routes.
* Metadata.
* PWA manifest.
* Health endpoints.
* Logging and diagnostic leakage.
* Test coverage.
* README accuracy.
* ADR completeness.

Security Checks

Confirm:

* No unnecessary NEXT_PUBLIC_* variables.
* No committed secrets.
* No default CMS password.
* No public CMS registration.
* No role self-escalation.
* No raw Payload documents serialized to clients.
* No draft content exposed.
* No internal workflow metadata exposed.
* No Better Auth runtime artifacts.
* No fake login form.
* No production document upload.
* No contact form.
* No sensitive health diagnostics.
* No public/private media-policy mixing.
* No fabricated legal or professional claims.
* No arbitrary query forwarding in the language switcher.
* No unsafe logging of content or credentials.

Documentation Requirements

Ensure the README documents:

* Prerequisites.
* Selected runtime versions.
* Package manager.
* Environment setup.
* PostgreSQL startup.
* Database reset.
* Migration commands.
* Payload Admin bootstrap.
* Local CMS login workflow.
* English and Spanish routes.
* Business identity updates.
* Translation workflow.
* Contact-channel configuration.
* Health endpoints.
* Testing commands.
* Build commands.
* Deferred features.
* Security limitations.
* Production launch blockers.

Ensure ADRs document:

* Runtime and dependency compatibility.
* PostgreSQL choice.
* Localization.
* Translation workflow.
* CMS versus portal authentication.
* Better Auth deferral and spike.
* Contact-channel strategy.
* Health endpoints.
* Public versus private storage.
* Business identity and rebranding.

Test Requirements

Add or repair tests as needed for:

* Locale helpers.
* Locale routes.
* Language switching.
* Query allowlisting.
* Business identity fallback.
* Public DTO projection.
* Translation workflow.
* CmsUsers access control.
* CTA fallback.
* Placeholder routes.
* Metadata.
* Health behavior.
* Diagnostic non-leakage.

Do not introduce broad snapshot tests that hide meaningful behavior.

Full Verification

Run from a clean state where practical:

pnpm install --frozen-lockfile
docker compose config
docker compose up -d
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build

Also perform:

* Clean-database migration.
* Secure CMS administrator bootstrap.
* Manual /admin login.
* Manual /en and /es route smoke tests.
* Manual language-switch test.
* Manual CTA test.
* Manual health-endpoint test.
* Search for committed secrets.
* Search for raw Perfect Tax hardcoding outside approved fallback/seed locations.
* Search for Better Auth runtime artifacts.
* Inspect client bundles or build output for server-only variables where practical.

Change Discipline

You may fix issues discovered during review, but:

* Do not redesign approved architecture without strong evidence.
* Do not implement Phase 2 features.
* Do not add production authentication.
* Do not add uploads.
* Do not add messaging.
* Do not add payments.
* Do not add scheduling.
* Do not replace the CMS.
* Do not silently weaken tests to make them pass.

Required Final Report

Return:

1. Executive readiness verdict.
2. Changed files.
3. Defects found and corrected.
4. Security findings.
5. Verification results.
6. Manual smoke-test results.
7. Remaining launch blockers.
8. Deferred risks.
9. Architecture-conformance matrix for Tasks 1–11.
10. Recommendation:

* approve Phase 1
* approve with follow-up
* request changes

Stop after the Phase 1 review.
