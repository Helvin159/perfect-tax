const PAYLOAD_SECRET_MINIMUM_BYTES = 32;
const PAYLOAD_SECRET_INSTRUCTION =
  'replace-with-output-of-openssl-rand-base64-48';

export type ServerEnvironment = Readonly<{
  DATABASE_URL: string;
  PAYLOAD_SECRET: string;
  SITE_URL: string;
}>;

type EnvironmentSource = Readonly<Record<string, string | undefined>>;

export class ServerEnvironmentError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid server environment:\n- ${issues.join('\n- ')}`);
    this.name = 'ServerEnvironmentError';
    this.issues = Object.freeze([...issues]);
  }
}

function readRequired(
  source: EnvironmentSource,
  name: keyof ServerEnvironment,
  issues: string[],
) {
  const value = source[name]?.trim();

  if (!value) {
    issues.push(`${name} is required`);
    return undefined;
  }

  return value;
}

function parseDatabaseUrl(value: string | undefined, issues: string[]) {
  if (!value) return undefined;

  try {
    const url = new URL(value);

    if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
      issues.push('DATABASE_URL must use the postgres or postgresql protocol');
    }

    if (!url.hostname || url.pathname === '/' || url.pathname === '') {
      issues.push('DATABASE_URL must include a host and database name');
    }
  } catch {
    issues.push('DATABASE_URL must be a valid PostgreSQL connection URL');
  }

  return value;
}

function parsePayloadSecret(value: string | undefined, issues: string[]) {
  if (!value) return undefined;

  if (
    Buffer.byteLength(value, 'utf8') < PAYLOAD_SECRET_MINIMUM_BYTES ||
    value === PAYLOAD_SECRET_INSTRUCTION
  ) {
    issues.push(
      `PAYLOAD_SECRET must be a generated secret of at least ${PAYLOAD_SECRET_MINIMUM_BYTES} bytes`,
    );
  }

  return value;
}

function parseSiteUrl(value: string | undefined, issues: string[]) {
  if (!value) return undefined;

  try {
    const url = new URL(value);
    const isOriginOnly =
      url.pathname === '/' &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password;

    if (!['http:', 'https:'].includes(url.protocol) || !isOriginOnly) {
      issues.push('SITE_URL must be an absolute HTTP(S) origin without a path');
      return value;
    }

    return url.origin;
  } catch {
    issues.push('SITE_URL must be a valid absolute URL');
    return value;
  }
}

export function parseServerEnvironment(
  source: EnvironmentSource,
): ServerEnvironment {
  const issues: string[] = [];
  const databaseUrl = parseDatabaseUrl(
    readRequired(source, 'DATABASE_URL', issues),
    issues,
  );
  const payloadSecret = parsePayloadSecret(
    readRequired(source, 'PAYLOAD_SECRET', issues),
    issues,
  );
  const siteUrl = parseSiteUrl(
    readRequired(source, 'SITE_URL', issues),
    issues,
  );

  if (issues.length > 0) {
    throw new ServerEnvironmentError(issues);
  }

  return Object.freeze({
    DATABASE_URL: databaseUrl!,
    PAYLOAD_SECRET: payloadSecret!,
    SITE_URL: siteUrl!,
  });
}

export function getServerEnvironment() {
  return parseServerEnvironment(process.env);
}
