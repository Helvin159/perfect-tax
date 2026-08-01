import { createInterface } from 'node:readline/promises';

import { parseCmsBootstrapCredentials } from './credentials';

type TtyInput = NodeJS.ReadStream & { setRawMode(mode: boolean): void };

/** Reads a secret from an interactive terminal without echoing its value. */
export async function readHiddenTerminalValue(
  prompt: string,
  input: NodeJS.ReadStream = process.stdin,
  output: NodeJS.WriteStream = process.stdout,
): Promise<string> {
  if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== 'function') {
    throw new Error(
      'Interactive credential input requires a TTY; use secure environment variables instead.',
    );
  }

  const ttyInput = input as TtyInput;
  const wasRaw = input.isRaw;
  output.write(prompt);

  return new Promise<string>((resolve, reject) => {
    let value = '';

    const cleanup = () => {
      input.off('data', onData);
      ttyInput.setRawMode(Boolean(wasRaw));
      output.write('\n');
    };

    const onData = (chunk: Buffer | string) => {
      const text = chunk.toString();

      for (const character of text) {
        if (character === '\u0003') {
          cleanup();
          reject(new Error('CMS bootstrap cancelled.'));
          return;
        }

        if (character === '\r' || character === '\n') {
          cleanup();
          resolve(value);
          return;
        }

        if (character === '\u007f' || character === '\b') {
          value = value.slice(0, -1);
          continue;
        }

        if (character >= ' ') value += character;
      }
    };

    ttyInput.setRawMode(true);
    input.resume();
    input.on('data', onData);
  });
}

/** Collects and confirms bootstrap credentials without echoing either password. */
export async function promptForCmsBootstrapCredentials() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      'Interactive credential input requires a TTY; set CMS_BOOTSTRAP_EMAIL and CMS_BOOTSTRAP_PASSWORD securely.',
    );
  }

  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const email = await readline.question('CMS administrator email: ');
  readline.close();

  const password = await readHiddenTerminalValue(
    'CMS administrator password: ',
  );
  const confirmation = await readHiddenTerminalValue('Confirm password: ');

  if (password !== confirmation) {
    throw new Error('CMS administrator passwords do not match.');
  }

  return parseCmsBootstrapCredentials({ email, password });
}
