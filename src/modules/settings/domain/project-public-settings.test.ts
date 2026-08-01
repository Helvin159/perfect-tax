import { describe, expect, it } from 'vitest';

import { InvalidPublicContentError } from '@/modules/content/domain/publication';

import {
  projectBusinessIdentity,
  projectContactSettings,
  projectHomepageContent,
  projectPortalSettings,
} from './project-public-settings';

function workflow(en = 'published', es = 'published') {
  return {
    en: {
      state: en,
      sourceRevision: 3,
      publishedBy: { id: 91, email: 'publisher@internal.invalid' },
      reviewNotes: 'Internal only',
    },
    es: {
      state: es,
      sourceRevision: 3,
      publishedBy: { id: 92, email: 'publisher@internal.invalid' },
      reviewNotes: 'Internal only',
    },
  };
}

function publishedRecord(overrides: Record<string, unknown> = {}) {
  return {
    _status: 'published',
    contentPolicy: 'evergreen',
    workingRevision: 3,
    translationWorkflow: workflow(),
    ...overrides,
  };
}

describe('public settings projections', () => {
  it('serializes only the allowlisted business identity V1 fields', () => {
    const projected = projectBusinessIdentity(
      publishedRecord({
        publicDisplayName: 'Perfect Tax',
        shortName: 'PT',
        tagline: 'Approved tagline',
        legalBusinessName: 'Internal legal entity',
        internalNotes: 'Never public',
        primaryLogo: {
          _status: 'published',
          altText: 'Perfect Tax logo',
          url: '/public-media/logo.webp',
          width: 320,
          height: 160,
          filename: 'private-storage-name.webp',
          createdAt: '2026-07-18T00:00:00.000Z',
        },
      }),
      'en',
    );
    const serialized = JSON.parse(JSON.stringify(projected));

    expect(serialized).toEqual({
      schemaVersion: 1,
      locale: 'en',
      displayName: 'Perfect Tax',
      shortName: 'PT',
      tagline: 'Approved tagline',
      primaryLogo: {
        schemaVersion: 1,
        altText: 'Perfect Tax logo',
        url: '/public-media/logo.webp',
        width: 320,
        height: 160,
      },
    });
    expect(JSON.stringify(serialized)).not.toMatch(
      /translationWorkflow|reviewNotes|publishedBy|internalNotes|legalBusinessName|filename|createdAt/,
    );
  });

  it('filters drafts and non-published translation workflow states', () => {
    expect(
      projectBusinessIdentity(
        publishedRecord({ _status: 'draft', publicDisplayName: 'Draft name' }),
        'en',
      ),
    ).toBeNull();
    expect(
      projectBusinessIdentity(
        publishedRecord({
          publicDisplayName: 'Unreviewed Spanish',
          translationWorkflow: workflow('published', 'needs-review'),
        }),
        'es',
      ),
    ).toBeNull();
  });

  it('never substitutes an eligible English value for ineligible Spanish', () => {
    const urgent = publishedRecord({
      contentPolicy: 'urgent-announcement',
      publicDisplayName: 'Perfect Tax',
      tagline: 'English-only approved text',
      translationWorkflow: workflow('published', 'draft'),
      urgentPublicationControls: {
        expiresAt: '2026-07-20T00:00:00.000Z',
      },
    });

    expect(
      projectBusinessIdentity(
        urgent,
        'en',
        new Date('2026-07-19T00:00:00.000Z'),
      ),
    ).not.toBeNull();
    expect(
      projectBusinessIdentity(
        urgent,
        'es',
        new Date('2026-07-19T00:00:00.000Z'),
      ),
    ).toBeNull();
  });

  it('omits missing or disabled optional public contact fields', () => {
    const projected = projectContactSettings(
      publishedRecord({
        approvedTelephone: '+1 212 555 0100',
        channels: {
          telephoneEnabled: false,
          whatsAppEnabled: true,
          emailEnabled: true,
        },
      }),
      'en',
    );

    expect(JSON.parse(JSON.stringify(projected))).toEqual({
      schemaVersion: 1,
      locale: 'en',
    });
  });

  it('rejects invalid approved contact values before serialization', () => {
    expect(() =>
      projectContactSettings(
        publishedRecord({
          approvedGeneralEmail: 'not-an-email',
          channels: { emailEnabled: true },
        }),
        'en',
      ),
    ).toThrow(InvalidPublicContentError);
  });

  it('projects portal and homepage fields without CMS metadata', () => {
    const portal = projectPortalSettings(
      publishedRecord({
        availabilityState: 'transitioning',
        transitionNotice: 'Approved notice',
      }),
      'es',
    );
    const homepage = projectHomepageContent(
      publishedRecord({
        hero: { heading: 'Approved heading', body: 'Approved body' },
        processSteps: [{ title: 'Step one', description: 'Approved detail' }],
      }),
      'en',
    );

    expect(JSON.parse(JSON.stringify(portal))).toEqual({
      schemaVersion: 1,
      locale: 'es',
      availability: 'transitioning',
      transitionNotice: 'Approved notice',
    });
    expect(JSON.parse(JSON.stringify(homepage))).toEqual({
      schemaVersion: 1,
      locale: 'en',
      hero: { heading: 'Approved heading', body: 'Approved body' },
      processSteps: [{ title: 'Step one', description: 'Approved detail' }],
    });
  });
});
