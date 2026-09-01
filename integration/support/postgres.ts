import { expect } from 'vitest';

export async function expectPostgresError(
  operation: Promise<unknown>,
  code: string,
  constraint?: string,
) {
  await expect(operation).rejects.toMatchObject({
    code,
    ...(constraint === undefined ? {} : { constraint }),
  });
}
