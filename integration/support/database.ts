import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { promisify } from 'node:util';

import { Client } from 'pg';

import { DATABASE_ROLES } from '@/modules/database/operational-schema';

const execFileAsync = promisify(execFile);

export type Agent15Database = Readonly<{
  adminURL: string;
  authMigrationURL: string;
  authRuntimeURL: string;
  databaseName: string;
  destroy(): Promise<void>;
  payloadMigrationURL: string;
  payloadRuntimeURL: string;
  roles: Readonly<{
    authMigration: string;
    authRuntime: string;
    payloadMigration: string;
    payloadRuntime: string;
  }>;
  targetAdminURL: string;
}>;

const TEST_ENVIRONMENT = Object.freeze({
  BETTER_AUTH_SECRET: 'agent-15-better-auth-test-secret-0123456789abcdef',
  EMAIL_ADDRESS: 'agent15@example.test',
  EMAIL_NAME: 'Perfect Tax Agent 15',
  EMAIL_PASSWORD: 'agent-15-email-capture-only',
  PAYLOAD_SECRET: 'agent-15-payload-test-secret-0123456789abcdef',
  SITE_URL: 'http://localhost:3000',
});

function quoteIdentifier(value: string) {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(value)) {
    throw new Error('Unsafe PostgreSQL test identifier.');
  }
  return `"${value}"`;
}

function databaseURL(
  base: string,
  database: string,
  role?: string,
  password?: string,
) {
  const url = new URL(base);
  url.pathname = `/${database}`;
  if (role) url.username = role;
  if (password) url.password = password;
  return url.toString();
}

function psqlConnection(connectionString: string) {
  const url = new URL(connectionString);
  return {
    args: [
      '--host',
      url.hostname,
      '--port',
      url.port || '5432',
      '--username',
      decodeURIComponent(url.username),
      '--dbname',
      decodeURIComponent(url.pathname.slice(1)),
      '--no-psqlrc',
    ],
    password: decodeURIComponent(url.password),
  };
}

async function runPsql(
  connectionString: string,
  script: string,
  variables: Readonly<Record<string, string>>,
) {
  const connection = psqlConnection(connectionString);
  const variableArguments = Object.entries(variables).flatMap(
    ([name, value]) => ['--set', `${name}=${value}`],
  );

  await execFileAsync(
    'psql',
    [...connection.args, ...variableArguments, '--file', script],
    {
      cwd: process.cwd(),
      env: { ...process.env, PGPASSWORD: connection.password },
    },
  );
}

function requiredTestAdminURL() {
  const value = process.env.AGENT15_TEST_DATABASE_URL;
  if (!value) {
    throw new Error(
      'AGENT15_TEST_DATABASE_URL is required for the Agent 15 integration suite.',
    );
  }

  const url = new URL(value);
  const database = decodeURIComponent(url.pathname.slice(1));
  if (!/^[a-zA-Z0-9_]+_test$/.test(database)) {
    throw new Error('AGENT15_TEST_DATABASE_URL must name a *_test database.');
  }
  return url.toString();
}

async function runMigrations(database: Agent15Database) {
  const payloadEnvironment = {
    ...process.env,
    ...TEST_ENVIRONMENT,
    DATABASE_URL: database.payloadMigrationURL,
  };
  await execFileAsync('pnpm', ['cms:migrate'], {
    cwd: process.cwd(),
    env: payloadEnvironment,
  });
  await execFileAsync('pnpm', ['cms:migrate'], {
    cwd: process.cwd(),
    env: payloadEnvironment,
  });

  await execFileAsync('pnpm', ['auth:migrate'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...TEST_ENVIRONMENT,
      PORTAL_AUTH_DATABASE_URL: database.authMigrationURL,
    },
  });
  await execFileAsync('pnpm', ['auth:migrate'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...TEST_ENVIRONMENT,
      PORTAL_AUTH_DATABASE_URL: database.authMigrationURL,
    },
  });

  await runPsql(
    database.payloadMigrationURL,
    path.resolve('scripts/database/apply-payload-runtime-grants.sql'),
    { payload_runtime_role: database.roles.payloadRuntime },
  );
  await runPsql(
    database.authMigrationURL,
    path.resolve('scripts/database/apply-auth-runtime-grants.sql'),
    { auth_runtime_role: database.roles.authRuntime },
  );
}

export async function createAgent15Database(
  label: string,
): Promise<Agent15Database> {
  const base = requiredTestAdminURL();
  const suffix = `${process.pid}_${randomBytes(4).toString('hex')}`;
  const normalizedLabel = label.replaceAll(/[^a-z0-9]/g, '').slice(0, 10);
  const databaseName = `a15_${normalizedLabel}_${suffix}_test`;
  const rolePassword = `a15-${randomBytes(16).toString('hex')}`;
  const roles = DATABASE_ROLES;
  const adminURL = databaseURL(base, 'postgres');
  const targetAdminURL = databaseURL(base, databaseName);
  const database = {
    adminURL,
    authMigrationURL: databaseURL(
      base,
      databaseName,
      roles.authMigration,
      rolePassword,
    ),
    authRuntimeURL: databaseURL(
      base,
      databaseName,
      roles.authRuntime,
      rolePassword,
    ),
    databaseName,
    payloadMigrationURL: databaseURL(
      base,
      databaseName,
      roles.payloadMigration,
      rolePassword,
    ),
    payloadRuntimeURL: databaseURL(
      base,
      databaseName,
      roles.payloadRuntime,
      rolePassword,
    ),
    roles,
    targetAdminURL,
  } as Omit<Agent15Database, 'destroy'>;

  const admin = new Client({ connectionString: adminURL });
  let createdDatabase = false;
  const createdRoles: string[] = [];
  await admin.connect();

  async function destroy() {
    await admin.query(
      `DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)} WITH (FORCE)`,
    );
    for (const role of [...createdRoles].reverse()) {
      await admin.query(`DROP ROLE IF EXISTS ${quoteIdentifier(role)}`);
    }
    await admin.end();
  }

  try {
    for (const role of Object.values(roles)) {
      await admin.query(
        `CREATE ROLE ${quoteIdentifier(role)} LOGIN PASSWORD '${rolePassword}'`,
      );
      createdRoles.push(role);
    }
    await admin.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
    createdDatabase = true;

    await runPsql(
      targetAdminURL,
      path.resolve('scripts/database/provision-roles.sql'),
      {
        auth_migration_role: roles.authMigration,
        auth_runtime_role: roles.authRuntime,
        payload_migration_role: roles.payloadMigration,
        payload_runtime_role: roles.payloadRuntime,
      },
    );

    const fixture = Object.freeze({ ...database, destroy });
    await runMigrations(fixture);
    return fixture;
  } catch (error) {
    if (createdDatabase || createdRoles.length > 0) {
      await destroy();
    } else {
      await admin.end();
    }
    throw error;
  }
}

export function activateAgent15Environment(
  database: Agent15Database,
  siteURL: string = TEST_ENVIRONMENT.SITE_URL,
) {
  Object.assign(process.env, TEST_ENVIRONMENT, {
    DATABASE_URL: database.payloadRuntimeURL,
    PORTAL_AUTH_DATABASE_URL: database.authRuntimeURL,
    SITE_URL: siteURL,
  });
  delete process.env.BETTER_AUTH_TRUSTED_ORIGINS;
}

export function agent15Environment(
  database: Agent15Database,
  siteURL: string = TEST_ENVIRONMENT.SITE_URL,
) {
  return {
    ...process.env,
    ...TEST_ENVIRONMENT,
    DATABASE_URL: database.payloadRuntimeURL,
    PORTAL_AUTH_DATABASE_URL: database.authRuntimeURL,
    SITE_URL: siteURL,
  };
}
