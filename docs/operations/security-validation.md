# Slice 1 security validation

Run the following from a clean, configured checkout:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm test:security:regressions
pnpm test:integration:security
pnpm test:integration:database
pnpm test:security:gate
pnpm format:check
git diff --check
```

The supported production build validation is HTTPS-configured `next build --webpack` with all production runtime variables supplied through a safe build environment. The default Turbopack build is not the accepted Slice 1 production validation path.

## Disposable PostgreSQL 17 integration database

Use an isolated local test cluster only:

```sh
docker run \
  --name perfect-tax-agent15-postgres \
  -e POSTGRES_USER=agent15 \
  -e POSTGRES_PASSWORD='<local-test-password>' \
  -e POSTGRES_DB=agent15_test \
  -p 5432:5432 \
  -d postgres:17.10-bookworm

export AGENT15_TEST_DATABASE_URL='postgresql://agent15:<local-test-password>@127.0.0.1:5432/agent15_test'
pnpm test:integration:security
pnpm test:integration:database
pnpm test:security:gate
```

The harness refuses an administrator database URL whose name does not end in `_test`. It creates disposable databases, applies Payload and Better Auth migrations twice, applies reviewed runtime grants, creates required temporary roles, and removes its test databases/roles afterward. It is single-worker because role names are cluster-global. Never target production, staging, or a shared cluster.

The integration suite proves the real session-to-principal-to-attestation-to-Payload-to-PostgreSQL path, private REST/CMS isolation, GraphQL unavailability, bootstrap/rollback/concurrency behavior, migration/readiness failure modes, and append-only events. See [integration README](../../integration/README.md) for test-boundary ownership.
