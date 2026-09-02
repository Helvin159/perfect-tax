\set ON_ERROR_STOP on

-- Run as the Better Auth migration role after reviewed auth SQL. Better Auth
-- receives DML only in portal_auth and no authority over Payload/public DDL.

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA portal_auth TO :"auth_runtime_role";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA portal_auth TO :"auth_runtime_role";

-- Runtime can only read the dedicated Better Auth migration ledger so bounded
-- application readiness can prove this independent persistence domain is current.
REVOKE ALL ON TABLE portal_auth.perfect_tax_auth_migrations FROM :"auth_runtime_role";
GRANT SELECT ON TABLE portal_auth.perfect_tax_auth_migrations TO :"auth_runtime_role";
