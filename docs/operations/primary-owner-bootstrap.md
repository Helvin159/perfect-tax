# Primary Owner bootstrap runbook

Use this ceremony only for the first deployment of Slice 1. It creates the single initial primary Owner; it is not an Owner-management or recovery tool.

## Preconditions

1. Confirm backup/restore posture and that Payload and Better Auth migrations are applied.
2. Apply the reviewed production roles/grants and deploy the application with `DATABASE_URL` using the Payload runtime role and `PORTAL_AUTH_DATABASE_URL` using the Better Auth runtime role.
3. Confirm `GET /api/health/ready` returns `200 {"status":"ready"}`.
4. Confirm there is no existing Owner/primary Owner. Do not use this command to repair, transfer, or replace one.
5. Run a restricted one-off process with production secrets supplied by the secret manager. Production `SITE_URL` must be HTTPS.

Set only these transient command inputs; use placeholders, never real values in shell history, source control, `.env`, argv, logs, or tickets:

```sh
export PRIMARY_OWNER_BOOTSTRAP_FIRST_NAME='<first-name>'
export PRIMARY_OWNER_BOOTSTRAP_LAST_NAME='<last-name>'
export PRIMARY_OWNER_BOOTSTRAP_WORK_EMAIL='<work-email>'
export PRIMARY_OWNER_BOOTSTRAP_LOGIN_EMAIL='<login-email>'
export PRIMARY_OWNER_BOOTSTRAP_PASSWORD='<secret-manager-injected-password>'
pnpm portal:bootstrap-primary-owner
```

The command consumes and removes its password variable before normal local environment loading. A password in `.env` is intentionally not an input.

## Success, verification, and MFA

Expected safe output is:

```text
Primary owner created. Sign in normally to enroll MFA.
```

The persisted result is one Better Auth credential/account, one active `Staff(role=owner, isPrimaryOwner=true)`, one Staff PortalIdentity, and one mandatory `primary-owner.bootstrap.succeeded` SecurityEvent. MFA is not yet complete. The Owner signs in, receives only `StaffEnrollmentPrincipal`, enrolls and verifies TOTP, then resolves as an operational Owner Staff principal.

Verify the success event and the single binding through approved operator database/audit procedures; do not expose credential, TOTP, backup-code, or session data. Store the provider-issued backup codes in the approved secure operator process, not in the repository or audit record.

## Failure, repeat, and concurrency behavior

Readiness failure stops before credential provisioning/capability issuance and returns a safe nonzero error. A repeated invocation fails with `ALREADY_COMPLETED` and creates no additional credential, Staff, identity, or Owner. A PostgreSQL advisory lock serializes concurrent command processes; the accepted result is exactly one success and one effective Owner authority.

Credential, Staff, PortalIdentity, and mandatory-success-event failures fail closed. Payload transaction failures roll back operational records and trigger credential compensation where possible; a failed mandatory success append does not emit a misleading second terminal event. Required bootstrap failure events are attempted only through the trusted system recorder and contain no secrets.

## Recovery and escalation

Do not rerun bootstrap to work around a failure, modify the primary Owner with raw SQL, or use a CMS/Owner account as a system capability. Preserve the safe command result and correlation/audit evidence, verify readiness and migration state, and escalate to the approved database/security operator. A restore or forward repair requires an incident-controlled decision using backups and the reviewed migration policy; owner transfer and break-glass recovery are not implemented in Slice 1.
