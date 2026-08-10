# Better Auth core runtime handoff

## Downstream interfaces

- `readAuthenticatedPortalSession(headers)` in `session.ts` performs a
  server-side Better Auth database lookup. It returns `null` or a frozen
  `AuthenticatedPortalSession` containing only `authUserId`, `sessionId`,
  `createdAt`, and `expiresAt`. Tokens, login email, adapter objects, provider
  fields, and roles do not cross this boundary.
- `AuthUserId` is Agent 2's branded, non-empty string in
  `portal-identity/domain/identifiers.ts`. It is the immutable Better Auth
  `user.id`, never an email, Staff ID, Client ID, or Payload user ID.
- `isFreshPortalSession(session)` implements the separate 900-second freshness
  check. It does not imply MFA assurance; Agent 9 owns MFA.
- `revokePortalUserSessions(authUserId)` deletes every database session for one
  validated Better Auth user ID. The public HTTP surface also exposes the
  authenticated user's list/revoke-one/revoke-all/revoke-other primitives.
- `provisionBootstrapCredential(input, finalize)` in `bootstrap.ts` is
  server-only. It creates only a Better Auth user plus `credential` account,
  returns only the branded auth user ID to the trusted callback, and deletes the
  just-created auth user when that callback fails. It creates no Staff, Client,
  PortalIdentity, role, invitation, session, or MFA record. No deletion or
  arbitrary provider-account mutation primitive is exported.

Agent 11 should consume the session reader, then load the immutable
PortalIdentity and domain state itself. Agent 12 should put all Staff,
PortalIdentity, owner-invariant, and audit work inside the bootstrap callback so
ordinary failures trigger credential compensation.

## Runtime contract

- Exact package: Better Auth `1.6.23`.
- Static base URL and complete trusted-origin allowlist: canonical `SITE_URL`
  only. `BETTER_AUTH_TRUSTED_ORIGINS` is rejected because Better Auth otherwise
  appends it implicitly. Proxy headers are not trusted.
- Session: database-backed, `expiresIn = 28_800`,
  `disableSessionRefresh = true`, `freshAge = 900`, cookie cache explicitly
  disabled, and no secondary store.
- Session cookie: neutral `portal-auth` prefix, host-only, `HttpOnly`,
  `SameSite=Lax`, `Path=/`, no `Domain`, and `Secure` whenever canonical
  `SITE_URL` is HTTPS. Production rejects non-HTTPS `SITE_URL`.
- HTTP route: `/api/auth/[...all]`. Slice 1 allowlists only email/password login,
  logout, session read/list, and session revocation. Signup, recovery (including
  tokenized reset paths), user/profile/password/email mutation, account deletion,
  provider administration, impersonation, and unknown routes return 404.
- Email/password remains enabled for login, while provider `disableSignUp` is
  also true as defense in depth. No reset callback is configured.
- No Better Auth plugin is enabled. Agent 9 must add only its reviewed MFA plugin
  and exact MFA HTTP operations; it must not add Admin or Organization plugins.

## Provider-specific constraints

Better Auth exposes no core server-only “create credential while public signup
is disabled” API. The bootstrap service therefore uses the pinned `1.6.23`
`auth.$context` password hasher and `internalAdapter` to create `user` and
`credential` account rows, matching that version's own email-signup operation.
This is intentionally isolated in one module and is an upgrade revalidation
point. A Better Auth upgrade must prove hashing, normalized email behavior,
account linking, cleanup, session creation, origin enforcement, and schema again.

The callback compensation handles application errors but cannot make Payload and
Better Auth transactions atomically commit across separate database roles. Agent
12's advisory lock/idempotency/audit design and Agent 14's operational recovery
procedure must cover process termination between stores.

## Exact core schema requirements for Agent 14

Agent 14 owns reviewed SQL, the dedicated migration ledger/lock, deployment,
rollback, and final migrations. Generate the schema from the final merged
Better Auth `1.6.23` configuration after Agent 9 adds MFA. Core requirements are
four tables in `portal_auth`, each with a provider-generated string primary key
and timestamps as listed:

- `user`: required `name`, unique required `email`, required
  `emailVerified` default false, optional `image`, required `createdAt` and
  `updatedAt`.
- `session`: required unique `token`, required `expiresAt`, required timestamps,
  optional `ipAddress` and `userAgent`, and indexed required `userId` referencing
  `user.id` with cascade delete.
- `account`: required `accountId`, `providerId`, timestamps, indexed required
  `userId` referencing `user.id` with cascade delete; optional `accessToken`,
  `refreshToken`, `idToken`, access/refresh expiry, `scope`, and `password`.
- `verification`: indexed required `identifier`, required `value`, required
  `expiresAt`, and required timestamps.

The dedicated connection is `PORTAL_AUTH_DATABASE_URL`. Runtime connections set
`search_path=portal_auth,public`; the database role must independently default to
that search path, own only Better Auth DDL/DML in `portal_auth`, and have no
Payload DDL or cross-schema ownership. Payload's `DATABASE_URL`, migrations,
ledger, schema push setting, generated types, `payload.config.ts`, `/api/cms`,
`cms-users`, and CMS cookies remain unchanged.
