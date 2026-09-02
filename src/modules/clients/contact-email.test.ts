import { describe, expect, it } from 'vitest';

import { normalizeContactEmail } from './contact-email';

describe('Client contact email', () => {
  it('trims and lowercases contact data', () => {
    expect(normalizeContactEmail('  Client.Name@Example.COM\n')).toBe(
      'client.name@example.com',
    );
  });

  it.each([
    '',
    'not-an-email',
    'client@example',
    'client..name@example.com',
    null,
    undefined,
  ])('rejects invalid contact data %s', (value) => {
    expect(normalizeContactEmail(value)).toBeUndefined();
  });
});
