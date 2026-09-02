-- Generated from Better Auth 1.6.23 + the approved two-factor configuration
-- with the pinned Kysely/PostgreSQL adapter. The output was reviewed on
-- 2026-08-31; this file is intentionally applied outside Payload's ledger.
-- The runner sets search_path to portal_auth,public and records the migration
-- in portal_auth.perfect_tax_auth_migrations in the same transaction.

create table "user" (
  "id" text not null primary key,
  "name" text not null,
  "email" text not null unique,
  "emailVerified" boolean not null,
  "image" text,
  "createdAt" timestamptz default CURRENT_TIMESTAMP not null,
  "updatedAt" timestamptz default CURRENT_TIMESTAMP not null,
  "twoFactorEnabled" boolean
);

create table "session" (
  "id" text not null primary key,
  "expiresAt" timestamptz not null,
  "token" text not null unique,
  "createdAt" timestamptz default CURRENT_TIMESTAMP not null,
  "updatedAt" timestamptz not null,
  "ipAddress" text,
  "userAgent" text,
  "userId" text not null references "user" ("id") on delete cascade,
  "mfaMethod" text,
  "mfaVerifiedAt" timestamptz
);

create table "account" (
  "id" text not null primary key,
  "accountId" text not null,
  "providerId" text not null,
  "userId" text not null references "user" ("id") on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  "scope" text,
  "password" text,
  "createdAt" timestamptz default CURRENT_TIMESTAMP not null,
  "updatedAt" timestamptz not null
);

create table "verification" (
  "id" text not null primary key,
  "identifier" text not null,
  "value" text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz default CURRENT_TIMESTAMP not null,
  "updatedAt" timestamptz default CURRENT_TIMESTAMP not null
);

create table "twoFactor" (
  "id" text not null primary key,
  "secret" text not null,
  "backupCodes" text not null,
  "userId" text not null references "user" ("id") on delete cascade,
  "verified" boolean,
  "failedVerificationCount" integer,
  "lockedUntil" timestamptz
);

create index "session_userId_idx" on "session" ("userId");
create index "account_userId_idx" on "account" ("userId");
create index "verification_identifier_idx" on "verification" ("identifier");
create index "twoFactor_secret_idx" on "twoFactor" ("secret");
create index "twoFactor_userId_idx" on "twoFactor" ("userId");

comment on table "user" is 'perfect-tax:migration-owner=better-auth;ledger=portal_auth.perfect_tax_auth_migrations;migration=20260831_172000_agent_14_better_auth_core_mfa';
comment on table "session" is 'perfect-tax:migration-owner=better-auth;ledger=portal_auth.perfect_tax_auth_migrations;migration=20260831_172000_agent_14_better_auth_core_mfa';
comment on table "account" is 'perfect-tax:migration-owner=better-auth;ledger=portal_auth.perfect_tax_auth_migrations;migration=20260831_172000_agent_14_better_auth_core_mfa';
comment on table "verification" is 'perfect-tax:migration-owner=better-auth;ledger=portal_auth.perfect_tax_auth_migrations;migration=20260831_172000_agent_14_better_auth_core_mfa';
comment on table "twoFactor" is 'perfect-tax:migration-owner=better-auth;ledger=portal_auth.perfect_tax_auth_migrations;migration=20260831_172000_agent_14_better_auth_core_mfa';
