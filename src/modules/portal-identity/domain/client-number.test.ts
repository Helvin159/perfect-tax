import { describe, expect, it } from 'vitest';

import { normalizeClientNumber, parseClientNumber } from './client-number';

describe('ClientNumber contract', () => {
  it.each(['CL-7F4K-92MX', 'CL-0000-0000', 'CL-ZZZZ-ZZZZ'])(
    'accepts canonical Crockford value %s',
    (value) => {
      expect(parseClientNumber(value)).toBe(value);
    },
  );

  it.each([
    'XX-7F4K-92MX',
    'CL7F4K-92MX',
    'CL-7F4K92MX',
    'CL-7F4K-92M',
    'CL-7F4K-92MXX',
    'CL-IF4K-92MX',
    'CL-7F4L-92MX',
    'CL-7F4K-9OMX',
    'CL-7F4K-9UMX',
    'cl-7f4k-92mx',
    null,
    undefined,
  ])('rejects noncanonical value %s', (value) => {
    expect(parseClientNumber(value)).toBeUndefined();
  });

  it('normalizes case and surrounding whitespace only when explicitly asked', () => {
    expect(normalizeClientNumber('  cl-7f4k-92mx\n')).toBe('CL-7F4K-92MX');
    expect(normalizeClientNumber('CL7F4K92MX')).toBeUndefined();
    expect(normalizeClientNumber('CL-OF4K-92MX')).toBeUndefined();
  });
});
