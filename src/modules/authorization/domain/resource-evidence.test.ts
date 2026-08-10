import { describe, expect, it } from 'vitest';

import {
  parseAssignedClientResource,
  parseClientOwnedResource,
} from './resource-evidence';

describe('trusted ownership and assignment policy input', () => {
  it('parses minimal Client ownership evidence', () => {
    expect(parseClientOwnedResource({ clientId: 20 })).toEqual({
      clientId: 20,
    });
  });

  it('preserves empty assignment evidence as zero assigned Staff IDs', () => {
    const evidence = parseAssignedClientResource({
      assignedStaffIds: [],
      clientId: 20,
    });

    expect(evidence).toEqual({ assignedStaffIds: [], clientId: 20 });
    expect(evidence?.assignedStaffIds).toHaveLength(0);
  });

  it('parses unique, valid assigned Staff IDs', () => {
    expect(
      parseAssignedClientResource({
        assignedStaffIds: [10, 11],
        clientId: 20,
      }),
    ).toEqual({ assignedStaffIds: [10, 11], clientId: 20 });
  });

  it.each([
    { clientId: 0 },
    { clientId: '20' },
    { clientId: 20, source: 'browser' },
    null,
  ])('rejects malformed ownership evidence %#', (value) => {
    expect(parseClientOwnedResource(value)).toBeUndefined();
  });

  it.each([
    { assignedStaffIds: [0], clientId: 20 },
    { assignedStaffIds: ['10'], clientId: 20 },
    { assignedStaffIds: [10, 10], clientId: 20 },
    { assignedStaffIds: [10], clientId: -1 },
    { assignedStaffIds: 10, clientId: 20 },
    { assignedStaffIds: [10], clientId: 20, role: 'case-worker' },
  ])('rejects malformed assignment evidence %#', (value) => {
    expect(parseAssignedClientResource(value)).toBeUndefined();
  });
});
