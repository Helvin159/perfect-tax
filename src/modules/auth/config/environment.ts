const BETTER_AUTH_SECRET_MINIMUM_BYTES = 32;
const SECRET_INSTRUCTION = 'replace-with-output-of-openssl-rand-base64-48';

type EnvironmentSource = Readonly<Record<string, string | undefined>>;

export type PortalAuthEnvironment = Readonly<{
  baseURL: string;
  databaseURL: string;
  secret: string;
  secureCookies: boolean;
}>;

export class PortalAuthEnvironmentError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid portal auth environment:\n- ${issues.join('\n- ')}`);
    this.name = 'PortalAuthEnvironmentError';
    this.issues = Object.freeze([...issues]);
  }
}

function required(source: EnvironmentSource, name: string, issues: string[]) {
  const value = source[name]?.trim();
  if (!value) issues.push(`${name} is required`);
  return value;
}

function parseDatabaseURL(value: string | undefined, issues: string[]) {
  if (!value) return undefined;

  try {
    const url = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
      issues.push(
        'PORTAL_AUTH_DATABASE_URL must use the postgres or postgresql protocol',
      );
    }
    if (!url.username || !url.hostname || !url.pathname.slice(1)) {
      issues.push(
        'PORTAL_AUTH_DATABASE_URL must include a dedicated role, host, and database',
      );
    }
  } catch {
    issues.push('PORTAL_AUTH_DATABASE_URL must be a valid PostgreSQL URL');
  }

  return value;
}

function parseSecret(value: string | undefined, issues: string[]) {
  if (!value) return undefined;
  if (
    Buffer.byteLength(value, 'utf8') < BETTER_AUTH_SECRET_MINIMUM_BYTES ||
    value === SECRET_INSTRUCTION
  ) {
    issues.push(
      `BETTER_AUTH_SECRET must be a generated secret of at least ${BETTER_AUTH_SECRET_MINIMUM_BYTES} bytes`,
    );
  }
  return value;
}

function parseBaseURL(
  value: string | undefined,
  production: boolean,
  issues: string[],
) {
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
    }
    if (production && url.protocol !== 'https:') {
      issues.push('SITE_URL must use HTTPS in production');
    }
    return url.origin;
  } catch {
    issues.push('SITE_URL must be a valid absolute URL');
    return value;
  }
}

export function parsePortalAuthEnvironment(
  source: EnvironmentSource,
): PortalAuthEnvironment {
  const issues: string[] = [];
  const production = source.NODE_ENV === 'production';
  const databaseURL = parseDatabaseURL(
    required(source, 'PORTAL_AUTH_DATABASE_URL', issues),
    issues,
  );
  const secret = parseSecret(
    required(source, 'BETTER_AUTH_SECRET', issues),
    issues,
  );
  const baseURL = parseBaseURL(
    required(source, 'SITE_URL', issues),
    production,
    issues,
  );

  if (source.BETTER_AUTH_TRUSTED_ORIGINS?.trim()) {
    issues.push(
      'BETTER_AUTH_TRUSTED_ORIGINS is prohibited; SITE_URL is the complete trusted-origin allowlist',
    );
  }

  if (issues.length > 0) throw new PortalAuthEnvironmentError(issues);

  return Object.freeze({
    baseURL: baseURL!,
    databaseURL: databaseURL!,
    secret: secret!,
    secureCookies: new URL(baseURL!).protocol === 'https:',
  });
}

export function getPortalAuthEnvironment() {
  return parsePortalAuthEnvironment({
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_TRUSTED_ORIGINS: process.env.BETTER_AUTH_TRUSTED_ORIGINS,
    NODE_ENV: process.env.NODE_ENV,
    PORTAL_AUTH_DATABASE_URL: process.env.PORTAL_AUTH_DATABASE_URL,
    SITE_URL: process.env.SITE_URL,
  });
}
