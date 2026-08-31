# Better Auth core runtime and Staff MFA handoff

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
- The Better Auth two-factor plugin is the only enabled plugin. Admin,
  Organization, email OTP, trusted-device bypass, passkeys, and provider
  administration remain disabled.

## Staff MFA boundary (Agent 9)

- The plugin is pinned to TOTP (six digits, 30-second period), ten encrypted
  ten-character backup codes, a ten-minute pending challenge, the provider's
  ten-failure/15-minute account lockout, and no trusted-device lifetime.
- The HTTP allowlist adds only `POST /two-factor/enable`,
  `POST /two-factor/verify-totp`, and
  `POST /two-factor/verify-backup-code`. Disable, TOTP-secret retrieval,
  backup-code regeneration/viewing, OTP/email, and all administration routes
  remain unreachable.
- `createPortalAuthHttpHandler(auth, { isStaffMfaSubject })` requires a trusted
  server callback before an authenticated session can start enrollment or use
  an authenticated verification path. The production route intentionally omits
  the callback and therefore denies enrollment until Agent 11 wires canonical
  PortalIdentity plus active-Staff resolution. A browser role, Staff ID,
  `authUserId`, `mfaVerified`, Client-shaped object, issuer, `trustDevice`, or
  `disableSession` field is rejected and cannot influence the callback.
- First-time enrollment returns the provider's TOTP URI and backup-code list at
  that one sensitive, no-store response boundary. Starting enrollment leaves
  `user.twoFactorEnabled` false and the provider row unverified. Re-running an
  interrupted enrollment replaces the unverified material. No application
  code stores the raw values.
- Successful provider verification is committed to the exact Better Auth
  session using the additional `mfaMethod` and `mfaVerifiedAt` session fields.
  The boundary re-reads a rotated session through Better Auth's signed response
  cookie, verifies the account's provider `twoFactor` row, updates that session,
  and returns only `{ "status": true }`. Failed, stale, or interrupted flows
  leave assurance unverified.
- Better Auth `1.6.23` initial TOTP verification rotates the authenticated
  enrollment session. Although the plugin passes the active session to
  `createSession`, the provider's implementation overwrites `createdAt` with
  the rotation time and `expiresAt` with rotation time plus eight hours; its
  cookie writer independently emits the full configured `Max-Age`. The
  `databaseHooks.session.create.before` hook now restores the trusted active
  session's original `createdAt` and caps the new row's `expiresAt` to the
  original deadline, but only on `/two-factor/verify-totp`, only for a distinct
  replacement token, and only when old and new rows have the same provider user
  ID. The HTTP boundary then caps the signed replacement cookie's `Max-Age` and
  `Expires` attributes to that persisted deadline. Neither clock is accepted
  from request data.
- Enrollment rotation therefore changes MFA assurance without creating a new
  authentication epoch. An old non-fresh session remains non-fresh, a
  near-expiry session retains only its original remaining lifetime, ordinary
  reads remain non-sliding, and failed TOTP verification performs no clock
  write. A genuinely new completed TOTP or backup-code login has no active
  enrollment session in provider context and correctly receives a new normal
  authentication epoch.
- `readStaffMfaAssurance(headers)` in `mfa.ts` is Agent 11's narrow interface.
  It returns `null` without a valid session, otherwise a frozen result with:
  `authUserId`, `enrollment` (`required | complete`), `sessionAssurance`
  (`unverified | verified`), `enrollmentOnly`, and either `null` or frozen
  evidence (`provider: better-auth`, `method: totp | backup-code`, `sessionId`,
  `verifiedAt`). Enrollment is complete only when both the trusted provider user
  flag and verified provider row agree. Session assurance is verified only when
  the current unexpired database session carries internally written evidence.
- Agent 11 must exact-match the returned `authUserId` to its canonical active
  Staff/PortalIdentity resolution. It may issue an operational `StaffPrincipal`
  only for `enrollment === 'complete'`,
  `sessionAssurance === 'verified'`, and `enrollmentOnly === false`. It must
  issue only the frozen `StaffEnrollmentPrincipal` operations otherwise. The
  assurance reader never decides role, Staff status, PortalIdentity validity,
  Client status, or freshness.
- Session validity remains the core eight-hour absolute lifetime. MFA evidence
  does not make a session fresh; `isFreshPortalSession` remains the independent
  15-minute check.

### MFA audit handoff

Agent 7's MFA actions require a `staff-enrollment` actor with a canonical
`StaffId`. This auth layer intentionally has only `AuthUserId` and must not
resolve or accept a browser Staff ID. Agent 11 must record
`mfa.enrollment.succeeded`, `mfa.verification.succeeded`, and
`mfa.verification.failed` after it binds the auth result to the canonical Staff
record. Metadata must remain `{}`. No TOTP code, URI, secret, backup code,
session token, request body, or credential may be included.

### Exact MFA schema requirements for Agent 14

Generate/review SQL from the final Better Auth `1.6.23` options. In addition to
the core schema below, the Staff MFA boundary requires:

- `user.twoFactorEnabled`: nullable boolean with provider default `false`;
- `session.mfaMethod`: nullable text;
- `session.mfaVerifiedAt`: nullable timestamp;
- new `twoFactor` table with provider string primary key `id`, required
  `secret`, required `backupCodes`, indexed required `userId` referencing
  `user.id`, nullable `verified` with provider default `true`, nullable
  `failedVerificationCount` with provider default `0`, and nullable
  `lockedUntil`; and
- provider indexes for `twoFactor.secret` and `twoFactor.userId` exactly as
  generated by `1.6.23`.

The secret and backup-code columns contain Better Auth-encrypted ciphertext.
Agent 14 still owns all reviewed SQL and deployment; Agent 9 creates no
production migration.

The session-clock repair adds no further column. It safely preserves the
standard provider `session.createdAt` and `session.expiresAt` values through the
official session-create database hook, and only rewrites lifetime attributes on
the provider-signed replacement cookie. Agent 14's schema handoff is unchanged.

### Provider-specific residual behavior

- Backup-code consumption uses the provider's guarded atomic update: a replay
  fails and consuming one code preserves unrelated codes.
- A successful sign-in consumes the pending two-factor challenge, so the same
  challenge cookie cannot be replayed. Better Auth accepts a valid TOTP for the
  current or adjacent 30-second timestep and does not persist a per-user TOTP
  counter; the same code can therefore be accepted in a separately created
  challenge while still in the provider window. Slice 1 adds no custom TOTP
  replay database.
- Lost device plus exhausted backup codes has no email/provider-admin bypass.
  A separately approved owner recovery/break-glass runbook remains an
  operational launch requirement.

### Agent 3 shared files touched by Agent 9

- `config/options.ts`: adds only the two-factor plugin and the two
  session-assurance fields plus the narrow session-create continuity hook while
  preserving core cookies, session policy values, origins, registration,
  recovery, and provider-administration settings.
- `config/policy.ts`: adds only the three reviewed MFA POST operations.
- `http.ts`: routes those operations through strict body filtering, the trusted
  Staff-subject callback, generic failures, provider confirmation, assurance
  commit, response token stripping, and no-store headers.
- `mfa-http.ts`: after trusted provider verification, caps any replacement
  session cookie to the provider-persisted original deadline; it does not
  change signing, token selection, or ordinary login behavior.
- `auth-runtime.test.ts`: updates the core configuration assertion to recognize
  the single approved plugin without weakening any Agent 3 regression test.

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
that search path, receive only the Better Auth DML required at runtime in
`portal_auth`, and have no DDL or cross-schema ownership. A separate auth
migration/deployment authority applies the reviewed Better Auth DDL and cannot
alter Payload tables. Payload migration authority cannot alter `portal_auth`.
Payload's `DATABASE_URL`, migrations, ledger, schema push setting, generated
types, `payload.config.ts`, `/api/cms`, `cms-users`, and CMS cookies remain
unchanged.

Agent 14 implemented these requirements in
`src/modules/auth/migrations/20260831_172000_agent_14_better_auth_core_mfa.sql`.
`scripts/database/apply-auth-migrations.ts` applies the reviewed SQL under the
auth migration role, takes a dedicated advisory lock, and records the result in
`portal_auth.perfect_tax_auth_migrations`. The runtime grant script gives
Better Auth DML only in `portal_auth`; it cannot read or mutate that ledger and
has no Payload/public schema authority.
