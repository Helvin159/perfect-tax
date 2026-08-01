import { describe, expect, it } from 'vitest';

import { projectPublicServices } from './project-public-services';

function service(overrides: Record<string, unknown> = {}) {
  return {
    _status: 'published',
    contentPolicy: 'evergreen',
    workingRevision: 2,
    translationWorkflow: {
      en: { state: 'published', sourceRevision: 2, reviewNotes: 'internal' },
      es: { state: 'published', sourceRevision: 2, reviewNotes: 'internal' },
    },
    stableIdentifier: 'tax-preparation',
    title: 'Tax preparation',
    summary: 'Approved summary',
    displayOrder: 20,
    isActive: true,
    internalNotes: 'never expose',
    ...overrides,
  };
}

describe('public services projection', () => {
  it('allowlists, sorts, and omits raw identifiers and workflow metadata', () => {
    const result = projectPublicServices(
      [
        service(),
        service({
          stableIdentifier: 'notary',
          title: 'Notary',
          displayOrder: 10,
          id: 888,
        }),
      ],
      'en',
    );

    expect(JSON.parse(JSON.stringify(result))).toEqual({
      schemaVersion: 1,
      locale: 'en',
      items: [
        {
          key: 'notary',
          title: 'Notary',
          summary: 'Approved summary',
          displayOrder: 10,
        },
        {
          key: 'tax-preparation',
          title: 'Tax preparation',
          summary: 'Approved summary',
          displayOrder: 20,
        },
      ],
    });
    expect(JSON.stringify(result)).not.toMatch(
      /"id"|internalNotes|translationWorkflow|reviewNotes|_status/,
    );
  });

  it('filters draft, inactive, and locale-ineligible records', () => {
    const result = projectPublicServices(
      [
        service({ _status: 'draft' }),
        service({ isActive: false }),
        service({
          translationWorkflow: {
            en: { state: 'published', sourceRevision: 2 },
            es: { state: 'draft', sourceRevision: 2 },
          },
        }),
      ],
      'es',
    );

    expect(result.items).toEqual([]);
  });
});
