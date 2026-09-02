# Slice 1 security integration suite

This directory owns the maintained Agent 15 composition tests. The suite starts
from a disposable empty PostgreSQL database, applies the committed Payload and
Better Auth migrations twice, installs the reviewed runtime grants, initializes
the real runtimes, and removes the database and temporary roles afterward. It
does not use schema push.

Use a dedicated PostgreSQL 17 test cluster and an administrator URL whose
database name ends in `_test`:

```sh
AGENT15_TEST_DATABASE_URL=postgresql://test-admin:<password>@127.0.0.1:5432/agent15_test \
  pnpm test:integration:security
```

The URL is used only as an administrative base for randomly named databases.
The harness refuses a URL without the `_test` suffix. Do not point it at a
shared or production cluster: the physical role-separation tests create and
remove the four fixed role names from the approved database contract. Secrets
must be supplied by CI or the operator and must never be committed.

The required CI/deployment gate is:

```sh
pnpm test:security:gate
```

The suite includes expected-success regressions for repaired A15-H01
(primary-owner bootstrap), A15-H02 (real PortalIdentity Local API creation),
and A15-M01 (independent Better Auth migration readiness). Do not invert, skip,
or weaken those assertions.

Test ownership is split by boundary:

- `auth/`: Better Auth session/MFA through canonical resolution and the real
  portal Payload gateway.
- `bootstrap/`: production system CLI and persisted fail-closed state.
- `cms-isolation/`: real Next/Payload HTTP, CMS roles, private REST, Admin,
  GraphQL, public pages, globals, media, and readiness.
- `database/`: clean ledgers, constraints, grants, runtime roles, schema
  separation, and physical Client-number retry.
- `payload-access/`: registered-collection behavior that must work through the
  real Local API.
- `readiness/`: migration-owned fail-closed startup checks.
- `security-events/`: Agent 7's real Payload-backed recorder, application
  immutability, database append-only enforcement, and secret safety.
- `support/`: disposable database, real auth, and local HTTP server fixtures.

The suite is intentionally single-worker because the reviewed role names are
cluster-global. Test-only direct SQL fixtures are labeled in their callers and
are used only to keep downstream integration boundaries testable when a
blocking upstream provisioning path is red; they are not evidence that the
blocked provisioning path works.
