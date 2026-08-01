import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const rootFile = (path: string) => new URL(`../../${path}`, import.meta.url);

describe('repository security configuration', () => {
  it('keeps the environment example instructional and server-only', async () => {
    const example = await readFile(rootFile('.env.example'), 'utf8');

    expect(example.match(/^PAYLOAD_SECRET=/gm)).toHaveLength(1);
    expect(example).toContain(
      'PAYLOAD_SECRET=replace-with-output-of-openssl-rand-base64-48',
    );
    expect(example).not.toMatch(/^NEXT_PUBLIC_/m);
  });

  it('pins the Node.js runtime and every direct dependency exactly', async () => {
    const [packageSource, nodeVersion] = await Promise.all([
      readFile(rootFile('package.json'), 'utf8'),
      readFile(rootFile('.nvmrc'), 'utf8'),
    ]);
    const packageJson = JSON.parse(packageSource) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      engines?: { node?: string };
    };
    const exactVersion = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

    expect(packageJson.engines?.node).toBe(nodeVersion.trim());
    for (const versions of [
      packageJson.dependencies,
      packageJson.devDependencies,
    ]) {
      for (const version of Object.values(versions ?? {})) {
        expect(version).toMatch(exactVersion);
      }
    }
  });
});
