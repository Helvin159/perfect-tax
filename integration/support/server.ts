import { spawn, type ChildProcess } from 'node:child_process';

export type TestServer = Readonly<{
  origin: string;
  stop(): Promise<void>;
}>;

async function waitForExit(child: ChildProcess, timeoutMs: number) {
  if (child.exitCode !== null) return;
  await Promise.race([
    new Promise<void>((resolve) => child.once('exit', () => resolve())),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

export async function startNextTestServer(
  environment: NodeJS.ProcessEnv,
  port: number,
): Promise<TestServer> {
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn(
    'pnpm',
    ['exec', 'next', 'dev', '--hostname', '127.0.0.1', '--port', String(port)],
    {
      cwd: process.cwd(),
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let output = '';
  const collect = (chunk: Buffer) => {
    output = `${output}${chunk.toString()}`.slice(-8_000);
  };
  child.stdout?.on('data', collect);
  child.stderr?.on('data', collect);

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Next test server exited before readiness.\n${output}`);
    }
    try {
      const response = await fetch(`${origin}/api/health/live`);
      if (response.ok) {
        return Object.freeze({
          origin,
          async stop() {
            if (child.exitCode !== null) return;
            child.kill('SIGTERM');
            await waitForExit(child, 10_000);
            if (child.exitCode === null) {
              child.kill('SIGKILL');
              await waitForExit(child, 5_000);
            }
          },
        });
      }
    } catch {
      // Expected while Next compiles the first route.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  child.kill('SIGTERM');
  await waitForExit(child, 5_000);
  throw new Error(`Next test server did not become ready.\n${output}`);
}

export function cookieFromHttpResponse(response: Response, name: string) {
  const getSetCookie = (
    response.headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie;
  const cookies =
    typeof getSetCookie === 'function'
      ? getSetCookie.call(response.headers)
      : [response.headers.get('set-cookie') ?? ''];
  const expression = new RegExp(`(${name}=[^;,]+)`);
  for (const cookie of cookies) {
    const match = cookie.match(expression);
    if (match?.[1]) return match[1];
  }
  throw new Error(`Missing ${name} cookie.`);
}
