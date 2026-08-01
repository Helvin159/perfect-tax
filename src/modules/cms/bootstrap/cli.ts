import { getPayload } from 'payload';

import {
  CmsBootstrapValidationError,
  parseCmsBootstrapCredentials,
} from './credentials';
import { promptForCmsBootstrapCredentials } from './prompt';
import {
  bootstrapFirstCmsAdministrator,
  CmsAdministratorExistsError,
} from './service';

function loadLocalEnvironment() {
  if (process.env.NODE_ENV === 'production') return;

  try {
    process.loadEnvFile('.env');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

async function readCredentials() {
  const environmentCredentialsProvided =
    process.env.CMS_BOOTSTRAP_EMAIL !== undefined ||
    process.env.CMS_BOOTSTRAP_PASSWORD !== undefined;

  if (environmentCredentialsProvided) {
    return parseCmsBootstrapCredentials({
      email: process.env.CMS_BOOTSTRAP_EMAIL,
      password: process.env.CMS_BOOTSTRAP_PASSWORD,
    });
  }

  return promptForCmsBootstrapCredentials();
}

async function main() {
  loadLocalEnvironment();

  const [{ default: config }, credentials] = await Promise.all([
    import('../../../../payload.config'),
    readCredentials(),
  ]);
  const payload = await getPayload({ config });

  try {
    await bootstrapFirstCmsAdministrator(payload, credentials);
    process.stdout.write('CMS administrator created.\n');
  } finally {
    await payload.destroy();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    const isExpectedOperatorError =
      error instanceof CmsAdministratorExistsError ||
      error instanceof CmsBootstrapValidationError;
    const message = isExpectedOperatorError
      ? (error as Error).message
      : 'CMS bootstrap failed. Review access-controlled server diagnostics.';
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
