# Revised Admin Portal Identity & Authorization Foundation

## A. Revision Summary

This revision preserves the original separation of CMS, Staff, Client, ownership, assignment, Local API, migration, and review boundaries, while reducing the first implementation phase to a strong identity and authorization foundation.

- Payload CMS Admin remains the editorial surface; the Better Auth-backed operational portal is a separate business-operations surface.
- Operational Staff roles are owner, administrator, case-worker, and intake. Content-editor remains exclusively a CMS role.
- Slice 1 excludes invitations, activation, email delivery/templates, public activation UI/routes, ordinary Staff lifecycle, and throttling for those deferred workflows.
- The Payload Local API bridge is an early proof gate, not an implementation assumption.

## B. Current Repository Facts

- Payload 3.86.0 uses cms-users as the sole auth-enabled collection and Payload Admin identity source. Its roles are editor, bilingual-reviewer, publisher, and cms-admin.
- Current CMS access and workflow code depends on req.user being a cms-users identity. Existing CMS users, roles, editorial history, authorship links, and bilingual workflow are preservation zones.
- Payload Local API defaults to bypassing access. With overrideAccess: false it supports caller-supplied user and request context; the project must wrap those inputs so a caller cannot forge an operational principal.
- Current bypasses are limited to public projections and CMS bootstrap. Better Auth is not yet a runtime dependency; ADR 0010 records a compatibility proof only.

Repository evidence: payload.config.ts, src/modules/cms/users, src/modules/content/workflow, src/modules/content/infrastructure/public-payload-read-policy.ts, and docs/adr/0010-better-auth-compatibility-and-boundary.md.

## C. Final Identity Architecture

    Payload CMS Admin                         Operational Staff Portal
    -----------------                         ------------------------
    CmsUser                                  Better Auth account
      ├─ editorial CMS roles                   ├─ login email
      └─ CMS-only authority                    ├─ credentials/sessions
                                               └─ TOTP/backup codes
                                                         │
                                                         v
                                                   PortalIdentity
                                                    /            \
                                                   v              v
                                                Staff           Client
                                             owner/admin/       domain/contact
                                             case-worker/       status; no role
                                             intake

### Administrative domains

CMS users and portal identities are separate. Neither direction of identity or authority is inferred from matching email. CMS permissions remain in cms-users; operational permissions remain in Staff/Client policies.

### Records

- Staff: role, active|disabled domain status, names, normalized workEmail, primary-owner marker, timestamps. No credential, session, MFA, or Better Auth role fields.
- Clients: server-generated clientNumber, names, normalized contactEmail, phone where required, active|inactive business status, timestamps. No credentials, role, portal status, case state, address, tax/immigration identifiers, or documents in Slice 1.
- clientNumber: generate CL-XXXX-XXXX with eight Crockford Base32 characters from cryptographic randomness. Enforce database uniqueness and retry on collision. Database ID stays internal.
- PortalIdentity: unique Better Auth authUserId, subjectType staff|client, exactly one Staff or Client relation, timestamps. Subject type and relationship are immutable; there is no PortalIdentity status.

## D. Authentication vs Authorization Responsibilities

Better Auth owns login email, credentials, sessions, session revocation, TOTP secrets, backup codes, and MFA assurance. Staff and Client own business/domain status. PortalIdentity owns immutable account-to-subject binding only.

Login email, Staff workEmail, Client contactEmail, and Slice 2 invitation intendedEmail are distinct concepts. They may initially match, but none propagates automatically. Login-email changes are future security-sensitive credential operations; profile edits cannot change authentication credentials.

Slice 1 does not enable Better Auth's Admin plugin. Application owner never means Better Auth administrator. Provider roles, bans, impersonation, password changes, email changes, account deletion, and administrative session controls are unavailable to ordinary Staff and Client principals.

### Selected Payload bridge: attested server principal

    Better Auth session validation
      → server-only principal resolver
      → runtime-attested VerifiedPortalPrincipal
      → PortalPayloadGateway
      → Payload Local API:
          overrideAccess: false
          narrow PortalPayloadUser
          attested req.context capability
      → collection/field access functions

The gateway and access helper use module-private runtime registries (for example WeakSet-backed capabilities). Access functions require both a matching PortalPayloadUser and an attested context capability. A browser or ordinary Local API caller cannot forge these by sending lookalike JSON, user, role, Client ID, or context objects. The gateway accepts only an attested principal issued by the resolver.

Option A, a global custom Payload auth strategy, is rejected for Slice 1 because Payload collects collection strategies globally and it risks coupling Better Auth cookies to /api/cms and CMS request behavior. Option C, broad privileged application operations, is rejected for normal user operations because it removes Payload policy defense-in-depth.

The only new privileged bypass is the non-web primary-owner bootstrap. It requires a dedicated server capability, PostgreSQL advisory lock, narrow invariant hook, operation reason, and append-only audit event. Existing public-read and CMS-bootstrap bypasses remain separately allowlisted.

## E. Identity and Status State Machines

| State concern | Authoritative owner | Rule |
| --- | --- | --- |
| Credentials, login email, sessions, MFA | Better Auth | Never edited through Staff/Client profiles. |
| Staff authorization | Staff | active required; disabled denies. |
| Client standing | Client | active required for future portal access. |
| Account-subject mapping | PortalIdentity | Immutable binding; no status. |
| Invitations/activation | Slice 2 | Not stored as Slice 1 portal state. |

Primary owner path: bootstrap creates Staff(active), Better Auth credential, and PortalIdentity atomically; before TOTP verification the resolver yields enrollment-only access; after verification it yields a fully authorized Staff principal. Disabling a domain subject denies access and revokes sessions through a trusted service.

Clients can exist without credentials in Slice 1. Slice 2 creates a Client credential and PortalIdentity through invitation activation. Missing binding, invalid session, disabled domain subject, credential suspension if later approved, or missing Staff MFA all deny.

## F. Security Invariants

- DOMAIN-001: CMS and operational portal identities/roles are different administrative domains.
- IDENTITY-001: One PortalIdentity binds one Better Auth account to exactly one Staff or Client.
- IDENTITY-002: Email equality never authorizes or creates a binding.
- STATE-001: Better Auth owns credential/MFA state; Staff/Client own domain state; PortalIdentity has no state.
- OWNER-001: Exactly one primary owner exists; normal operations cannot create, promote, demote, disable, or delete it.
- STAFF-001: Staff access requires active Staff state and verified MFA.
- STAFF-002: Case-worker role without trusted assignment evidence grants zero Client access.
- CLIENT-001: Client ownership derives only from the trusted PortalIdentity binding.
- AUTHZ-001: Undefined, inconsistent, browser-supplied, or forged authorization inputs deny.
- AUTHZ-002: User-driven Payload calls use overrideAccess: false and an attested capability.
- AUTHZ-003: Better Auth administrative authority is never granted to application principals.
- SYSTEM-001: Elevated operations are explicit, server-only, allowlisted, reasoned, and audited.
- AUDIT-001: Security events are append-only and exclude credentials, tokens, MFA data, email bodies, and private content.

## G. Slice 1 — Identity & Authorization Foundation

Implement:

- Better Auth core, secure session/cookie/origin boundary, disabled public registration/recovery, and isolated auth schema/migration ownership.
- Staff MFA via TOTP and backup codes.
- Staff, Client, PortalIdentity, and append-only security-event collections.
- Primary owner bootstrap only.
- Fixed roles, Client identifiers, status guards, ownership/assignment policy contracts, principal resolution, and attested Payload gateway.
- Private collection registration, additive migrations, generated types, clean/upgrade testing, and independent review.

Do not implement invitations, activation, email sending/templates, public activation endpoints, recovery, Staff management, cases, documents, messages, appointments, payments, notifications, or portal UI.

## H. Slice 1 Agent Breakdown

### Agent 1 — Payload Bridge Proof and ADR Gate

**Mission:** Prove the exact Better Auth-to-Payload capability bridge in a disposable environment and update the ADR.

**Scope:** Session validation, overrideAccess false, supplied user, attested context, forged-context denial, and CMS Admin isolation.

**Non-goals:** Runtime edits, dependencies, schemas, routes, migrations.

**Dependencies / parallelism:** First and sequential.

**Tests / acceptance:** Valid Staff/Client-shaped calls succeed only with attestation; forged user/context and /api/cms coupling fail. Handoff is the approved capability protocol; failure blocks Slice 1.

### Agent 2 — Shared Identity Contracts

**Mission:** Define provider-independent roles, statuses, principal kinds, state guards, Client-number format, email ownership types, and denial codes.

**Scope:** Shared domain modules and unit tests only.

**Non-goals:** Payload, Better Auth, routes, persistence, policies.

**Dependencies:** Agent 1. **Parallel-safe:** none until accepted.

**Acceptance:** No content-editor Staff role, PortalIdentity status, or Client portal status. Handoff: frozen contracts/runtime guards.

### Agent 3 — Better Auth Core Runtime

**Mission:** Implement core credentials, sessions, cookies, trusted origins, auth route, registration/recovery denial, and bootstrap-only credential provision.

**Non-goals:** MFA policy, Admin plugin, Staff/Client schemas, invitations, email, lifecycle UI.

**Dependencies:** 1, 2. **Parallel-safe:** 4–8.

**Tests / acceptance:** login/logout/revocation, hostile origins, cookie flags, route coexistence, denied public registration/recovery, no provider admin authority. Handoff: authenticated-session reader and bootstrap provisioning interface.

### Agent 4 — Staff Domain Schema

**Mission:** Implement Staff collection and owner-field invariants.

**Scope:** Staff fields/hooks/schema tests. **Non-goals:** registration, bootstrap service, lifecycle, invitations, CMS links.

**Dependencies:** 2. **Parallel-safe:** 5–8.

**Tests / acceptance:** role/status/email validation, owner-marker protection, absent credential fields. Handoff: Staff configuration/hooks.

### Agent 5 — Client Domain Schema

**Mission:** Implement Client collection and human-readable Client-number service.

**Non-goals:** authorization, activation, invitations, cases, addresses, sensitive data.

**Dependencies:** 2. **Parallel-safe:** 4, 6–8.

**Tests / acceptance:** format, secure generation, unique retry, immutability, contact normalization, status validation. Handoff: Client configuration/service.

### Agent 6 — PortalIdentity Binding

**Mission:** Implement immutable Better Auth-to-domain binding and uniqueness constraints.

**Non-goals:** principal resolution, email inference, invitations, status state.

**Dependencies:** 2, 4, 5. **Parallel-safe:** 7, 8.

**Tests / acceptance:** duplicate, dual-subject, and mutation rejection. Handoff: binding repository and narrow PortalPayloadUser shape.

### Agent 7 — Minimal Security Events

**Mission:** Implement append-only event schema, action catalog, redaction rules, and recorder.

**Non-goals:** audit UI, analytics, retention, invitations.

**Dependencies:** 2. **Parallel-safe:** 4–6, 8.

**Tests / acceptance:** normal update/delete denied; secret redaction proven. Handoff: recorder and event types.

### Agent 8 — Pure Authorization Policies

**Mission:** Implement deterministic role, Client ownership, future assignment-evidence, field, and denial policies.

**Non-goals:** Payload/database/session/routes/schema.

**Dependencies:** 2. **Parallel-safe:** 3–7.

**Tests / acceptance:** full role matrix; empty assignment evidence denies Case Worker access. Handoff: typed policy functions.

### Agent 9 — Staff MFA Boundary

**Mission:** Add Better Auth two-factor integration, MFA assurance reader, enrollment-only behavior, and tests.

**Non-goals:** invitations, Client MFA, email OTP, trusted-device policy, role management.

**Dependencies:** 2, 3. **Parallel-safe:** 4–8.

**Acceptance:** Staff cannot obtain operational principal before TOTP verification. Handoff: MFA assurance adapter.

### Agent 10 — Attested Payload Gateway

**Mission:** Implement the approved Local API gateway and capability protocol.

**Non-goals:** schemas, routes, broad bypass, policy redesign.

**Dependencies:** 1, 2, 6, 8. **Parallel-safe:** 9.

**Tests / acceptance:** fake user/context/mismatched capability fails; all normal calls use overrideAccess false, explicit select, depth zero. Handoff: PortalPayloadGateway/system-capability interface.

### Agent 11 — Principal Resolution

**Mission:** Resolve Better Auth sessions and bindings into attested Staff, enrollment-only Staff, or Client principals.

**Non-goals:** bootstrap, lifecycle, invitations, CMS auth.

**Dependencies:** 3, 6, 9, 10. **Parallel-safe:** none on resolver files.

**Acceptance:** missing/mismatched/disabled/MFA-incomplete identities fail closed. Handoff: require-principal functions.

### Agent 12 — Primary Owner Bootstrap

**Mission:** Create exactly one audited primary owner through a non-web serialized command.

**Non-goals:** ordinary Staff lifecycle, owner transfer, CMS changes, invitations.

**Dependencies:** 3, 4, 6, 7, 9, 11. **Parallel-safe:** 13 after interfaces stabilize.

**Tests / acceptance:** concurrent/second bootstrap rejection, partial-failure safety, audit, pre-MFA denial, no browser endpoint. Handoff: bootstrap command/evidence.

### Agent 13 — Private Payload Registration

**Mission:** Register private collections without changing CMS auth/workflows.

**Scope:** payload.config.ts and configuration tests only.

**Dependencies:** current email work and 4–7. **Parallel-safe:** 11–12 after config ownership release.

**Acceptance:** cms-users remains Admin user; private collections hidden from Admin/public REST; existing email/public CMS behavior remains intact.

### Agent 14 — Migrations, Types, Compatibility

**Mission:** Sole owner of additive Payload migration, Better Auth reviewed SQL/ledger, generated types, readiness, and upgrade fixtures.

**Dependencies:** 3–7, 13. **Parallel-safe:** none touching schema/type artifacts.

**Acceptance:** clean install and populated Phase 1 upgrade preserve CMS users/roles/workflow/public content/globals/media; no destructive reset.

### Agent 15 — Security Integration Tests

**Mission:** Prove combined Slice 1 security behavior.

**Dependencies:** 3–14. **Non-goals:** feature implementation.

**Acceptance:** every invariant covered at HTTP, service, or Payload boundary; deterministic CI evidence and targeted defects only.

### Agent 16 — Documentation and Review Preparation

**Mission:** Document the implementation, operator procedures, bridge, MFA, bootstrap, and deferrals.

**Dependencies:** 14–15. **Non-goals:** code/migrations.

**Acceptance:** reproducible setup/deployment/review instructions.

## I. Slice 1 Dependency Graph

    1 → 2
          ├─ 3 ─┐
          ├─ 4 ─┼─ 6 ─┐
          ├─ 5 ─┘     ├─ 10 ─ 11 ─ 12
          ├─ 7         │
          └─ 8 ────────┘
                3 → 9 ─┘
    4–7 → 13
    3–7,13 → 14 → 15 → 16 → independent review

## J. Slice 1 Collision Ownership

| Area | Owner |
| --- | --- |
| Current email-adapter files | Current email agent, then Agent 13 only for central config registration. |
| Dependencies, lockfile, core auth config/route | Agent 3; Agent 9 follows only for MFA plugin addition. |
| Shared identity types | Agent 2. |
| Staff / Client / PortalIdentity schemas | Agents 4 / 5 / 6 respectively. |
| Policies / Local API gateway / resolver | Agents 8 / 10 / 11 respectively. |
| payload.config.ts | Agent 13 only. |
| Migrations, generated types, readiness | Agent 14 only. |
| Security test infrastructure | Agent 15 only. |
| CMS workflow modules | Preservation zone. |

## K. Slice 1 Authorization Test Matrix

| Actor | CMS editorial work | Portal principal | Private Client access | Owner mutation | Case-worker Client access | Better Auth admin APIs | User-driven Payload bypass | Trusted system operation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Anonymous | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY |
| CMS editorial user | SCOPED by CMS role | DENY unless separately bound | DENY | DENY | DENY | DENY | DENY | DENY |
| Owner | Separate CMS identity required | ALLOW after MFA | SCOPED | DENY normally | future policy only | DENY | DENY | N/A |
| Administrator | Separate CMS identity required | ALLOW after MFA | SCOPED policy only | DENY | DENY without evidence | DENY | DENY | N/A |
| Case worker | Separate CMS identity required | ALLOW after MFA | DENY in Slice 1 | DENY | DENY: zero evidence | DENY | DENY | N/A |
| Intake | Separate CMS identity required | ALLOW after MFA | SCOPED future basic-contact policy | DENY | DENY | DENY | DENY | N/A |
| Client | DENY | Not provisioned in Slice 1 | Self only when later bound | DENY | N/A | DENY | DENY | N/A |
| Trusted system capability | DENY | N/A | allowlisted only | bootstrap only | N/A | DENY | explicit/audited only | SCOPED |

## L. Slice 1 Migration/Compatibility Strategy

- Additive-only Payload tables and constraints: Staff, Clients, PortalIdentity, SecurityEvents, Client-number uniqueness, owner enforcement.
- Better Auth core/MFA tables live in portal_auth with a separate role, reviewed SQL, migration directory, lock, and application ledger. Payload and Better Auth have no cross-schema DDL privilege.
- Run clean installation and populated Phase 1 upgrade tests. Populate the upgrade fixture with CMS identities, all roles, editorial relationships, bilingual content, globals, public media, and current migration history.
- Do not seed an owner in a migration. Run primary-owner bootstrap post-deployment.
- Recheck public EN/ES routes, CMS login/editorial flows, metadata, health/readiness, and existing email-adapter behavior.

## M. Slice 1 Final Integration/Security Review

An independent read-only reviewer inspects Better Auth and MFA configuration, provider-admin exposure, every Local API/overrideAccess/context call, capability forgery resistance, CMS/portal separation, owner bootstrap, principal propagation, Client ownership, Case Worker zero-access, private collection visibility, migrations/types, public-site regression, clean install, and populated upgrade.

The reviewer runs broad validation and reports Critical/High findings as narrowly scoped repair tasks. It does not rewrite subsystems.

## N. Slice 2 — Account Provisioning & Activation

Slice 2 may add Staff/Client invitations, activation/consumption, account provisioning, bilingual email templates and delivery, Ethereal verification, public activation endpoints/UI, generic errors, callback validation, throttling, ordinary Staff lifecycle, Client portal enablement, login-email changes, and recovery. It must consume Slice 1 bindings, principal/gateway capability, policies, and audit recorder; email matching remains activation-only.

## O. Deferred Product Capabilities

Cases and assignments persistence; documents/storage/scanning/retention; messaging; appointments; payments; notifications/SMS; dashboard and Staff UI; CMS SSO; owner transfer/multiple owners; production transactional email; configurable permissions; audit UI; households/matter participants; multi-business onboarding and branding.

## P. Remaining Risks/Open Decisions

### Must resolve before Slice 1

- Agent 1 must prove the exact attested bridge and forged-context denial.
- Agent 1/3 must prove bootstrap-only credential provision while public signup is denied.
- Better Auth core/two-factor version, generated SQL, least-privilege database roles, migration ledger, backup/rollback, and owner backup-code/recovery runbook require approval.
- Current email-adapter work must complete green before central configuration changes.

### Safe to defer

Better Auth Admin plugin/suspension, invitations, activation, production email, recovery, cases, assignments, UI, CMS SSO, owner transfer, Client self-editing, and sensitive Client data.

## Q. Final Recommended Execution Order

1. Finish email-adapter work and establish a green baseline.
2. Agent 1, then Agent 2.
3. Run Agents 3, 4, 5, 7, and 8 in parallel; Agent 6 after Staff/Client contracts.
4. Run Agent 9, then Agents 10, 11, and 12 sequentially.
5. Run Agent 13, then Agent 14.
6. Run Agents 15 and 16.
7. Complete the independent final review before Slice 2.

## Sources

- [Payload Local API types](/Users/helvinrymer/Desktop/Projects/perfect-tax/node_modules/payload/dist/index.bundled.d.ts:8788)
- [Payload local request construction](/Users/helvinrymer/Desktop/Projects/perfect-tax/node_modules/payload/dist/utilities/createLocalReq.js:65)
- [Better Auth options](https://better-auth.com/docs/reference/options)
- [Better Auth two-factor plugin](https://better-auth.com/docs/plugins/2fa)
- [Better Auth admin plugin](https://better-auth.com/docs/plugins/admin)
