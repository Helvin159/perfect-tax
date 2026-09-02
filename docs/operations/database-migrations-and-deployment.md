# Slice 1 migrations, readiness, and deployment

## Ownership and environment

Payload migrations in `src/modules/cms/migrations` own the `public` schema, including operational collections, and run with `pnpm cms:migrate`. Better Auth SQL in `src/modules/auth/migrations` owns `portal_auth` and runs with `pnpm auth:migrate`. Their ledgers and authorities are independent. Schema push is disabled; application startup never creates schema.

Production requires `DATABASE_URL`, `PAYLOAD_SECRET`, `SITE_URL`, `EMAIL_NAME`, `EMAIL_ADDRESS`, `EMAIL_PASSWORD`, `PORTAL_AUTH_DATABASE_URL`, and `BETTER_AUTH_SECRET`. `SITE_URL` is the complete trusted origin; production requires HTTPS. `BETTER_AUTH_SECRET` and `PAYLOAD_SECRET` must each be generated secrets of at least 32 bytes. `BETTER_AUTH_TRUSTED_ORIGINS` is prohibited.

Development uses the same runtime variables with local secrets. Test-only `AGENT15_TEST_DATABASE_URL` is an administrator URL ending in `_test`; never set it to production or a shared database.

## Deployment order

1. Confirm backup/restore posture and forward-compatible rollback plan.
2. Provision the four deployment roles and schemas using `scripts/database/provision-roles.sql` as a database administrator.
3. Apply Payload migrations with the Payload migration authority.
4. Apply Better Auth migrations with the Better Auth migration authority.
5. Apply reviewed `apply-payload-runtime-grants.sql` and `apply-auth-runtime-grants.sql` after their respective migrations.
6. Deploy the application using only the runtime roles.
7. Run readiness; it must validate both ledgers, the Payload physical contract, and reachable `portal_auth` without disclosing details.
8. Smoke test public CMS/site routes and the allowlisted `/api/auth` routes.
9. On the first deployment only, run the [primary Owner ceremony](primary-owner-bootstrap.md), then have the Owner enroll TOTP and verify the SecurityEvent.

`/api/health/ready` returns unavailable when a Payload migration is missing, a Better Auth migration is missing, or `portal_auth` is unavailable. It returns ready only when all are current. `/api/health/live` is process liveness only.

## Rollback

Migrations are forward-only operational changes. Do not promise destructive down-migrations. Roll back application code only when it remains compatible with the applied schema; otherwise use a rehearsed database backup/restore and incident process. Treat `portal_auth` and `public` as separate migration and recovery domains, preserving both ledgers and Better Auth credential/session/MFA state. Reapply grants after a compatible forward migration.

The existing Nodemailer/Ethereal adapter is preserved for CMS testing. Slice 1 does not activate Staff or Client invitations, portal activation, password recovery, or portal email lifecycle.
