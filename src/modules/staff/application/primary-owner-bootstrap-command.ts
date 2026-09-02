import 'server-only';

import {
  PRIMARY_OWNER_BOOTSTRAP_ENVIRONMENT_KEYS,
  PrimaryOwnerBootstrapError,
  readPrimaryOwnerBootstrapEnvironment,
  type PrimaryOwnerBootstrapInput,
} from './primary-owner-bootstrap';

type PrimaryOwnerBootstrapCommandDependencies = Readonly<{
  environment: NodeJS.ProcessEnv;
  execute(input: PrimaryOwnerBootstrapInput): Promise<void>;
  stderr: Pick<NodeJS.WriteStream, 'write'>;
  stdout: Pick<NodeJS.WriteStream, 'write'>;
}>;

/**
 * Non-web command adapter. The credential is accepted only through the
 * server process environment, never argv, and is removed immediately after
 * collection so later runtime initialization cannot reread it.
 */
export async function runPrimaryOwnerBootstrapCommand({
  environment,
  execute,
  stderr,
  stdout,
}: PrimaryOwnerBootstrapCommandDependencies): Promise<0 | 1> {
  try {
    const input = readPrimaryOwnerBootstrapEnvironment(environment);
    delete environment[PRIMARY_OWNER_BOOTSTRAP_ENVIRONMENT_KEYS.password];

    await execute(input);
    stdout.write('Primary owner created. Sign in normally to enroll MFA.\n');
    return 0;
  } catch (error) {
    delete environment[PRIMARY_OWNER_BOOTSTRAP_ENVIRONMENT_KEYS.password];
    const safeError =
      error instanceof PrimaryOwnerBootstrapError
        ? error
        : new PrimaryOwnerBootstrapError('BOOTSTRAP_FAILED');
    stderr.write(`${safeError.message}\n`);
    return 1;
  }
}
