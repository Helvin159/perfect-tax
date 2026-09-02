import { describe, expect, it } from 'vitest';

import { isSystemOperation, SYSTEM_OPERATIONS } from './system-operation';

describe('elevated operation vocabulary', () => {
  it('contains only primary owner bootstrap', () => {
    expect(SYSTEM_OPERATIONS).toEqual(['primary-owner-bootstrap']);
    expect(isSystemOperation('primary-owner-bootstrap')).toBe(true);
  });

  it.each(['super-admin', 'root', 'system-user', 'owner', undefined])(
    'rejects non-system operation %s',
    (value) => {
      expect(isSystemOperation(value)).toBe(false);
    },
  );
});
