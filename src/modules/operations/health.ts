import 'server-only';

import { Pool } from 'pg';

import { getServerEnvironment } from '@/config/env/server';
import { REQUIRED_CMS_MIGRATIONS } from '@/modules/cms/required-migrations';

export type HealthStatus = 'ok' | 'ready' | 'unavailable';

export type HealthResponseBody = Readonly<{
  status: HealthStatus;
}>;

type ReadyCheckDiagnosticCode =
  'database-unavailable' | 'payload-unavailable' | 'ready-timeout';

export type ReadyCheckDiagnostic = Readonly<{
  code: ReadyCheckDiagnosticCode;
}>;

export type ReadyCheckDependencies = Readonly<{
  checkDatabase: () => Promise<void>;
  initializePayload: () => Promise<void>;
  log: (diagnostic: ReadyCheckDiagnostic) => void;
  timeoutMs: number;
}>;

export const HEALTH_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
} as const;

export const READINESS_TIMEOUT_MS = 2_000;
export function livenessBody(): HealthResponseBody {
  return { status: 'ok' };
}

export function healthStatusCode(body: HealthResponseBody): 200 | 503 {
  return body.status === 'unavailable' ? 503 : 200;
}

export function logReadyCheckDiagnostic(diagnostic: ReadyCheckDiagnostic) {
  console.error('[health-ready]', diagnostic);
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error('ready-timeout')), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function checkPostgresReachable(databaseUrl: string) {
  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: READINESS_TIMEOUT_MS,
    idleTimeoutMillis: 1_000,
    max: 1,
    query_timeout: READINESS_TIMEOUT_MS,
  });

  try {
    const result = await pool.query<{ name: string }>(
      `SELECT name
         FROM payload_migrations
        WHERE name = ANY($1::text[])`,
      [REQUIRED_CMS_MIGRATIONS],
    );
    const applied = new Set(result.rows.map(({ name }) => name));

    if (!REQUIRED_CMS_MIGRATIONS.every((name) => applied.has(name))) {
      throw new Error('cms-schema-unavailable');
    }
  } finally {
    await pool.end().catch(() => undefined);
  }
}

export async function initializePayloadForReadiness() {
  const { getPayload } = await import('payload');
  const { default: config } = await import('@payload-config');
  await getPayload({ config });
}

export function createReadyCheckDependencies(): ReadyCheckDependencies {
  const environment = getServerEnvironment();

  return {
    checkDatabase: () => checkPostgresReachable(environment.DATABASE_URL),
    initializePayload: initializePayloadForReadiness,
    log: logReadyCheckDiagnostic,
    timeoutMs: READINESS_TIMEOUT_MS,
  };
}

export async function readinessBody(
  dependencies: ReadyCheckDependencies,
): Promise<HealthResponseBody> {
  try {
    await withTimeout(dependencies.checkDatabase(), dependencies.timeoutMs);
  } catch (error) {
    dependencies.log({
      code:
        error instanceof Error && error.message === 'ready-timeout'
          ? 'ready-timeout'
          : 'database-unavailable',
    });
    return { status: 'unavailable' };
  }

  try {
    await withTimeout(dependencies.initializePayload(), dependencies.timeoutMs);
  } catch (error) {
    dependencies.log({
      code:
        error instanceof Error && error.message === 'ready-timeout'
          ? 'ready-timeout'
          : 'payload-unavailable',
    });
    return { status: 'unavailable' };
  }

  return { status: 'ready' };
}
