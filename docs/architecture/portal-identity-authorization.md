# Slice 1 portal identity and authorization architecture

This is the authoritative operational architecture for Slice 1. It supersedes earlier planning and handoff guidance where they conflict. The final evidence is the implementation and the Agent 15 security integration review.

## Trust chain

```text
Better Auth credential/session
  -> trusted session validation -> AuthUserId -> PortalIdentity
  -> canonical active Staff or Client subject -> role/status
  -> Staff MFA assurance -> canonical principal -> runtime attestation
  -> authorization -> registered private Payload access (`overrideAccess: false`)
  -> PostgreSQL integrity
```

Parsing an object shape is never trust. A request field, browser value, email, TypeScript type, `Object.freeze()`, or JSON reconstruction cannot create a principal, capability, assignment, ownership evidence, or system authority.

## Separate identity systems

`cms-users` is the only Payload Admin identity collection. Its roles are `editor`, `bilingual-reviewer`, `publisher`, and `cms-admin`. Operational Staff roles are `owner`, `administrator`, `case-worker`, and `intake`.

CMS authority is not portal authority. Matching email is not identity binding. A person needing both areas has two separately created, explicitly authorized identities. CMS identity cannot access the private operational collections, and a portal principal is never a Payload CMS user.

## Better Auth, sessions, and MFA

Better Auth owns credentials, accounts, database sessions, verification state, and MFA-provider state in the `portal_auth` schema. It does not own Staff role or status, Client status, PortalIdentity, CMS role, or operational authorization.

Staff sessions have an eight-hour absolute lifetime (`expiresIn: 28800`), no session refresh, and a separate 15-minute freshness window (`freshAge: 900`). Session validity, freshness, and MFA assurance are independent facts. Initial TOTP enrollment/verification preserves the original session creation time and absolute expiry; it must not make an old session fresh. A genuine new login can start a new session clock.

Every Staff role requires TOTP plus provider backup codes. Slice 1 has no SMS or email MFA, trusted-device bypass, Owner bypass, CMS-MFA substitution, or Client MFA lifecycle. Before verified MFA, an active Staff member resolves only to `StaffEnrollmentPrincipal`, which can enroll MFA, verify MFA, or sign out; it has no operational Payload authority. After verified TOTP or backup code, canonical resolution can issue a Staff principal.

## Domain records and PortalIdentity

Staff records contain `firstName`, `lastName`, `workEmail`, `role`, `status`, and the server-owned `isPrimaryOwner` marker. Staff status is `active` or `disabled`. `workEmail` is contact information, never a Better Auth identity binding.

There is exactly one primary Owner after bootstrap. Ordinary authority cannot create, promote, demote, disable, unmark, or delete that Staff record. The Owner role is not system capability.

Clients are customer/person records, not accounts. Their fields are `clientNumber`, `firstName`, `lastName`, `contactEmail`, and `status` (`active` or `inactive`). They contain no password, role, Better Auth user ID, MFA state, invitation lifecycle, or case/document data. `clientNumber` is an immutable, unique, cryptographically random eight-character Crockford Base32 reference in `CL-XXXX-XXXX` form; it is business-name independent.

PortalIdentity is the only explicit binding: one `AuthUserId` maps to exactly one Staff or one Client. It holds no role, status, email, MFA state, or CMS identity. The database enforces unique AuthUserId and subject keys, exactly one subject relation, restrictive foreign keys, and row/truncate immutability; application hooks deny update and delete as well.

Payload normalizes relationship fields before selected hooks. The infrastructure accepts only the reviewed Payload create representation, narrowly normalizes it, then applies strict canonical PortalIdentity validation:

```text
Payload relationship representation -> narrow normalization -> strict validation
```

It does not accept arbitrary relationship objects. Email matching never creates a PortalIdentity. Production Client credential activation is deliberately disabled: a canonical Client binding still resolves fail-closed until Slice 2.

## Authorization and Payload gateway

The model is Staff RBAC plus assignment evidence, and Client authentication plus ownership evidence. Owner, Administrator, and Intake are policy-eligible to read Clients; Case Worker requires trusted assignment evidence and currently has zero Client access because assignments do not exist. The registered Slice 1 gateway exposes read-only fixed Client summaries and a Client self-profile shape; it exposes no generic Payload query or mutation API. Intake's actual Client field vocabulary is only `id`, `clientNumber`, `firstName`, `lastName`, `contactEmail`, `status`, `createdAt`, and `updatedAt`; no `phone` field exists.

Client ownership cannot be proved by a request `clientId`, browser field, or email. The model exists, but production Client login is not enabled.

Agent 10's gateway constructs each portal operation from a canonical principal and a module-private, request-bound, non-serializable runtime capability. The opaque capability is bound in a private `WeakMap`; a shaped or copied object, `parse()`, freezing, and JSON reconstruction cannot reproduce it. The gateway uses `overrideAccess: false`, `depth: 0`, fixed narrow selects, and a fresh top-level Payload request for each principal/operation. It accepts no arbitrary Payload query passthrough. Nested same-principal reuse is permitted only through the accepted request propagation path.

`staff`, `clients`, `portal-identities`, and `security-events` are registered Payload-managed application collections. Registered does not mean CMS accessible. They are hidden from the Admin UI, excluded from GraphQL, have no collection endpoints, and fail closed against anonymous callers, CMS users, fake portal-shaped users/context, and enrollment principals. Hidden UI is only a usability property; backend access control is the boundary. Agent 15 verified unauthorized private REST access is denied and GraphQL is unavailable.

System capability is a separate namespace. The primary-owner bootstrap capability cannot be acquired from Owner, Administrator, CMS admin, StaffEnrollmentPrincipal, or ClientPrincipal. Portal and system capabilities cannot be reused for one another.

## SecurityEvents

SecurityEvents are append-only audit infrastructure. Trusted principal/system source and target provenance, a fixed action vocabulary, and allowlisted scalar metadata are required. Application hooks and PostgreSQL grants/triggers prevent mutation; the runtime appends only through the narrow database function.

Never record passwords, session tokens, TOTP secrets or codes, backup codes, capabilities, authorization headers, cookies, raw request bodies, or other credentials. The model permits an anonymous `authentication.failed` event, but Slice 1 does not wire the HTTP sign-in failure path to a safe anonymous source-bound recorder. This is deferred operational audit work, not evidence of an implemented event path.

## Database and readiness

Payload owns the existing `public` application schema and the `public.payload_migrations` ledger. Its operational tables are `staff`, `clients`, `portal_identities`, and `security_events`. Better Auth owns `portal_auth` and `portal_auth.perfect_tax_auth_migrations`. The earlier separate physical `portal_identity` schema proposal is historical and superseded; there is no such schema.

Four deployment-created roles are deliberately separated: `perfect_tax_payload_migrator` owns Payload DDL, `perfect_tax_payload_runtime` has narrowly granted operational runtime access, `perfect_tax_auth_migrator` owns `portal_auth` DDL, and `perfect_tax_auth_runtime` has Better Auth DML only in `portal_auth` (plus read-only access to its ledger for readiness). Role provisioning does not create credentials; the deployment platform does. Local development/test authority can be broader and is not proof of production grants.

Readiness is fail-closed and does not create schemas. It requires all committed Payload migrations, the operational contract/least-privilege grants, and the Better Auth migration ledger. A missing Payload migration, missing Better Auth migration, or unavailable `portal_auth` yields `503 {"status":"unavailable"}`; a current dual-schema deployment yields `200 {"status":"ready"}`.

## Integrity matrix

| Invariant                                       | Application                           | PostgreSQL                                     |
| ----------------------------------------------- | ------------------------------------- | ---------------------------------------------- |
| Exactly one active primary Owner                | capability, hooks, preflight          | checks, partial unique index, trigger          |
| Client number format, uniqueness, immutability  | generator/invariant hook              | check, unique index, trigger                   |
| PortalIdentity uniqueness and one-subject shape | strict parser/hook                    | unique indexes, check, foreign keys            |
| PortalIdentity immutability                     | update/delete denial                  | row and truncate triggers, grants              |
| SecurityEvents append-only                      | capability/provenance recorder, hooks | grants, append function, row/truncate triggers |
| Staff/Client operational authorization          | canonical principal and policy        | intentionally application-owned                |
| Payload/Better Auth schema isolation            | gateway/runtime configuration         | separate schemas, owners, roles, grants        |

## Non-negotiable invariants

1. Runtime shape is not trust.
2. PortalIdentity is the only AuthUserId-to-domain binding; email is never evidence.
3. CMS identity never becomes portal authority.
4. Case Worker role alone grants no Client access.
5. Owner is not system authority.
6. MFA is mandatory for every Staff role; MFA, freshness, and validity stay separate.
7. Portal operations require runtime attestation and `overrideAccess: false`.
8. Top-level operations do not reuse principal/request caches.
9. PortalIdentity and SecurityEvents are immutable; one primary Owner remains.
10. Better Auth and Payload migration ownership remain separate.
11. Client login remains disabled until deliberately implemented.

## Deferred to Slice 2

Staff invitations, activation, ordinary Staff lifecycle, Client portal enablement and credential provisioning, recovery, login-email changes, abuse controls, and email lifecycle are deferred. So are Cases, assignments, documents, messages, payments, appointments, and notifications. Assignment and Client-ownership policy hooks are not completed product workflows.
