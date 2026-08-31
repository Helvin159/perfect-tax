\set ON_ERROR_STOP on

-- The deployment platform creates these four LOGIN roles and injects their
-- credentials. This repeatable script removes dangerous role attributes,
-- establishes disjoint schema authority, and transfers existing Payload
-- objects during an upgrade. It never creates or changes credentials.

ALTER ROLE :"payload_migration_role" NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
ALTER ROLE :"payload_runtime_role" NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
ALTER ROLE :"auth_migration_role" NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
ALTER ROLE :"auth_runtime_role" NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM :"payload_runtime_role", :"auth_migration_role", :"auth_runtime_role";
GRANT USAGE, CREATE ON SCHEMA public TO :"payload_migration_role";
GRANT USAGE ON SCHEMA public TO :"payload_runtime_role";

CREATE SCHEMA IF NOT EXISTS portal_auth AUTHORIZATION :"auth_migration_role";
ALTER SCHEMA portal_auth OWNER TO :"auth_migration_role";
REVOKE ALL ON SCHEMA portal_auth FROM PUBLIC, :"payload_migration_role", :"payload_runtime_role", :"auth_runtime_role";
GRANT USAGE, CREATE ON SCHEMA portal_auth TO :"auth_migration_role";
GRANT USAGE ON SCHEMA portal_auth TO :"auth_runtime_role";

ALTER ROLE :"payload_migration_role" SET search_path TO public;
ALTER ROLE :"payload_runtime_role" SET search_path TO public;
ALTER ROLE :"auth_migration_role" SET search_path TO portal_auth;
ALTER ROLE :"auth_runtime_role" SET search_path TO portal_auth, public;

-- Upgrade path: all pre-existing public objects are Payload-owned. Better Auth
-- objects are never selected by these catalog queries because they live in
-- portal_auth.
SELECT format(
  'ALTER %s %I.%I OWNER TO %I',
  CASE c.relkind
    WHEN 'S' THEN 'SEQUENCE'
    WHEN 'v' THEN 'VIEW'
    WHEN 'm' THEN 'MATERIALIZED VIEW'
    ELSE 'TABLE'
  END,
  n.nspname,
  c.relname,
  :'payload_migration_role'
)
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p', 'S', 'v', 'm')
  AND (
    c.relkind <> 'S'
    OR NOT EXISTS (
      SELECT 1
      FROM pg_depend AS dependency
      WHERE dependency.classid = 'pg_class'::regclass
        AND dependency.objid = c.oid
        AND dependency.deptype IN ('a', 'i')
    )
  )
ORDER BY c.relkind, c.relname
\gexec

SELECT format('ALTER TYPE %I.%I OWNER TO %I', n.nspname, t.typname, :'payload_migration_role')
FROM pg_type AS t
JOIN pg_namespace AS n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
  AND t.typtype IN ('d', 'e')
ORDER BY t.typname
\gexec

SELECT format(
  'ALTER FUNCTION %I.%I(%s) OWNER TO %I',
  n.nspname,
  p.proname,
  pg_get_function_identity_arguments(p.oid),
  :'payload_migration_role'
)
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
ORDER BY p.proname, pg_get_function_identity_arguments(p.oid)
\gexec

REVOKE ALL ON SCHEMA public FROM :"auth_migration_role", :"auth_runtime_role";
REVOKE ALL ON SCHEMA portal_auth FROM :"payload_migration_role", :"payload_runtime_role";
