import { describe, expect, it } from 'vitest';

import { applyEditorialWorkflowChange, resolveEligibleLocale } from './policy';
import type {
  EditorialRecord,
  LocaleWorkflow,
  TranslationWorkflow,
} from './types';

const editor = { collection: 'cms-users', id: 10, role: 'editor' } as const;
const reviewer = {
  collection: 'cms-users',
  id: 20,
  role: 'bilingual-reviewer',
} as const;
const publisher = {
  collection: 'cms-users',
  id: 30,
  role: 'publisher',
} as const;
const administrator = {
  collection: 'cms-users',
  id: 40,
  role: 'cms-admin',
} as const;
const now = new Date('2026-07-18T18:00:00.000Z');
const options = {
  localizedFields: ['title'] as const,
  sharedFields: ['isActive'] as const,
};

function localeWorkflow(
  state: LocaleWorkflow['state'],
  sourceRevision = 1,
): LocaleWorkflow {
  return {
    state,
    sourceRevision,
    lastEditedBy: editor.id,
    lastEditedAt: '2026-07-18T17:00:00.000Z',
    reviewedBy:
      state === 'reviewed' || state === 'published' ? reviewer.id : null,
    reviewedAt:
      state === 'reviewed' || state === 'published'
        ? '2026-07-18T17:30:00.000Z'
        : null,
    publishedBy: state === 'published' ? publisher.id : null,
    publishedAt: state === 'published' ? '2026-07-18T17:45:00.000Z' : null,
    reviewNotes: null,
  };
}

function record(
  en: LocaleWorkflow['state'],
  es: LocaleWorkflow['state'],
  policy: EditorialRecord['contentPolicy'] = 'evergreen',
): EditorialRecord {
  return {
    _status: en === 'published' || es === 'published' ? 'published' : 'draft',
    contentPolicy: policy,
    isActive: true,
    title: 'Public content',
    translationWorkflow: {
      en: localeWorkflow(en),
      es: localeWorkflow(es),
    },
    workingRevision: 1,
  };
}

function request(
  originalDoc: EditorialRecord,
  workflow: TranslationWorkflow,
  user: unknown,
  data: EditorialRecord = {},
) {
  return applyEditorialWorkflowChange({
    ...options,
    data: {
      _status: originalDoc._status,
      contentPolicy: originalDoc.contentPolicy,
      translationWorkflow: workflow,
      workingRevision: originalDoc.workingRevision,
      ...data,
    },
    locale: 'en',
    now,
    operation: 'update',
    originalDoc,
    user,
  });
}

describe('translation workflow policy', () => {
  it('allows editors to draft and submit, then reviewers to review', () => {
    const draft = record('draft', 'draft');
    const submittedWorkflow = structuredClone(
      draft.translationWorkflow,
    ) as TranslationWorkflow;
    submittedWorkflow.en.state = 'needs-review';

    const submitted = request(draft, submittedWorkflow, editor);
    expect(submitted.translationWorkflow?.en?.state).toBe('needs-review');

    const reviewedWorkflow = structuredClone(
      submitted.translationWorkflow,
    ) as TranslationWorkflow;
    reviewedWorkflow.en.state = 'reviewed';
    const reviewed = request(submitted, reviewedWorkflow, reviewer);

    expect(reviewed.translationWorkflow?.en).toMatchObject({
      state: 'reviewed',
      reviewedAt: now.toISOString(),
      reviewedBy: reviewer.id,
      sourceRevision: 1,
    });
  });

  it('rejects unauthorized review and publication', () => {
    const submitted = record('needs-review', 'needs-review');
    const reviewRequest = structuredClone(
      submitted.translationWorkflow,
    ) as TranslationWorkflow;
    reviewRequest.en.state = 'reviewed';
    expect(() => request(submitted, reviewRequest, editor)).toThrow(
      'bilingual reviewers',
    );

    const reviewed = record('reviewed', 'reviewed');
    const publication = structuredClone(
      reviewed.translationWorkflow,
    ) as TranslationWorkflow;
    publication.en.state = 'published';
    publication.es.state = 'published';
    expect(() =>
      request(reviewed, publication, reviewer, { _status: 'published' }),
    ).toThrow('Only publishers');
  });

  it('reserves content edits for editors and policy changes for administrators', () => {
    const draft = record('draft', 'draft');
    expect(() =>
      request(
        draft,
        draft.translationWorkflow as TranslationWorkflow,
        reviewer,
        { title: 'Reviewer-authored content' },
      ),
    ).toThrow('Only editors may change');

    expect(() =>
      request(draft, draft.translationWorkflow as TranslationWorkflow, editor, {
        contentPolicy: 'legal',
      }),
    ).toThrow('Only CMS administrators may reclassify');
  });

  it('rejects stale source revisions', () => {
    const stale = record('needs-review', 'needs-review');
    stale.workingRevision = 2;
    const requested = structuredClone(
      stale.translationWorkflow,
    ) as TranslationWorkflow;
    requested.en.state = 'reviewed';

    expect(() => request(stale, requested, reviewer)).toThrow(
      'stale for source revision 2',
    );
  });

  it.each(['legal', 'evergreen'] as const)(
    'requires atomic reviewed English and Spanish publication for %s content',
    (contentPolicy) => {
      const reviewed = record('reviewed', 'reviewed', contentPolicy);
      const oneLocale = structuredClone(
        reviewed.translationWorkflow,
      ) as TranslationWorkflow;
      oneLocale.en.state = 'published';

      expect(() =>
        request(reviewed, oneLocale, publisher, { _status: 'published' }),
      ).toThrow('English and Spanish');

      const bothLocales = structuredClone(
        reviewed.translationWorkflow,
      ) as TranslationWorkflow;
      bothLocales.en.state = 'published';
      bothLocales.es.state = 'published';
      const published = request(reviewed, bothLocales, publisher, {
        _status: 'published',
      });

      expect(published.translationWorkflow).toMatchObject({
        en: { publishedBy: publisher.id, state: 'published' },
        es: { publishedBy: publisher.id, state: 'published' },
      });
    },
  );

  it('requires independent review for legal content', () => {
    const submitted = record('needs-review', 'needs-review', 'legal');
    (submitted.translationWorkflow as TranslationWorkflow).en.lastEditedBy =
      administrator.id;
    const authoredByAdministrator = structuredClone(
      submitted.translationWorkflow,
    ) as TranslationWorkflow;
    authoredByAdministrator.en.state = 'reviewed';

    expect(() =>
      request(submitted, authoredByAdministrator, administrator),
    ).toThrow('someone other than its author');
  });

  it('resets both locale states and increments the working revision after content edits', () => {
    const published = record('published', 'published');
    const changed = request(
      published,
      published.translationWorkflow as TranslationWorkflow,
      editor,
      { title: 'Revised public content' },
    );

    expect(changed).toMatchObject({
      _status: 'draft',
      workingRevision: 2,
      translationWorkflow: {
        en: { sourceRevision: 2, state: 'draft' },
        es: { sourceRevision: 2, state: 'draft' },
      },
    });
  });

  it('never substitutes English for an ineligible Spanish locale', () => {
    const partiallyPublished = record(
      'published',
      'draft',
      'urgent-announcement',
    );

    expect(resolveEligibleLocale(partiallyPublished, 'en')).toBe('en');
    expect(resolveEligibleLocale(partiallyPublished, 'es')).toBeNull();
  });

  it('allows expedited urgent publication only with bounded follow-up controls', () => {
    const submitted = record('needs-review', 'draft', 'urgent-announcement');
    const expedited = structuredClone(
      submitted.translationWorkflow,
    ) as TranslationWorkflow;
    expedited.en.state = 'published';

    expect(() =>
      request(submitted, expedited, publisher, { _status: 'published' }),
    ).toThrow('translation owner');

    const published = request(submitted, expedited, publisher, {
      _status: 'published',
      urgentPublicationControls: {
        expiresAt: '2026-07-20T18:00:00.000Z',
        translationFollowUpDeadline: '2026-07-19T18:00:00.000Z',
        translationOwner: reviewer.id,
      },
    });
    expect(published.translationWorkflow?.en).toMatchObject({
      publishedBy: publisher.id,
      reviewedBy: publisher.id,
      state: 'published',
    });
  });

  it('blocks obvious client-sensitive information in review notes', () => {
    const submitted = record('needs-review', 'draft');
    const unsafe = structuredClone(
      submitted.translationWorkflow,
    ) as TranslationWorkflow;
    unsafe.en.reviewNotes = 'Client SSN 123-45-6789';

    expect(() => request(submitted, unsafe, reviewer)).toThrow(
      'must not contain client identifiers',
    );
  });

  it('prevents published review notes from being rewritten without a workflow transition', () => {
    const published = record('published', 'published');
    const tampered = structuredClone(
      published.translationWorkflow,
    ) as TranslationWorkflow;
    tampered.en.reviewNotes = 'Rewritten after publication';

    for (const user of [editor, reviewer, publisher]) {
      expect(() => request(published, tampered, user)).toThrow(
        'authorized editorial transition',
      );
    }
  });
});
