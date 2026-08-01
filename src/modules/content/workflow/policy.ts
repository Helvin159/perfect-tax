import { APIError } from 'payload';

import { isCmsIdentity } from '@/modules/cms/users/roles';

import { validateReviewNotes } from './review-notes';
import {
  CONTENT_POLICIES,
  PUBLIC_CONTENT_LOCALES,
  TRANSLATION_STATES,
  type ContentPolicy,
  type EditorialRecord,
  type LocaleWorkflow,
  type PublicContentLocale,
  type TranslationState,
  type TranslationWorkflow,
  type WorkflowIdentity,
} from './types';

export type EditorialWorkflowOptions = Readonly<{
  localizedFields: readonly string[];
  sharedFields?: readonly string[];
}>;

export type ApplyEditorialWorkflowArgs = EditorialWorkflowOptions &
  Readonly<{
    data: EditorialRecord;
    locale?: unknown;
    now?: Date;
    operation: 'create' | 'update';
    originalDoc?: EditorialRecord | null;
    user: unknown;
  }>;

function forbidden(message: string): never {
  throw new APIError(message, 403);
}

function invalid(message: string): never {
  throw new APIError(message, 400);
}

function isPolicy(value: unknown): value is ContentPolicy {
  return CONTENT_POLICIES.includes(value as ContentPolicy);
}

function isState(value: unknown): value is TranslationState {
  return TRANSLATION_STATES.includes(value as TranslationState);
}

function identityId(value: unknown): number | string | null {
  if (typeof value === 'number' || typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === 'number' || typeof id === 'string' ? id : null;
  }
  return null;
}

function sameIdentity(left: unknown, right: unknown): boolean {
  const leftId = identityId(left);
  const rightId = identityId(right);
  return (
    leftId !== null && rightId !== null && String(leftId) === String(rightId)
  );
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function valuesDiffer(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? null) !== JSON.stringify(right ?? null);
}

function requestedLocale(locale: unknown): PublicContentLocale {
  if (locale === 'es') return 'es';
  return 'en';
}

function defaultLocaleWorkflow(revision: number): LocaleWorkflow {
  return {
    state: 'draft',
    sourceRevision: revision,
    reviewedBy: null,
    reviewedAt: null,
    publishedBy: null,
    publishedAt: null,
    reviewNotes: null,
    lastEditedBy: null,
    lastEditedAt: null,
  };
}

function normalizeLocaleWorkflow(
  value: unknown,
  revision: number,
): LocaleWorkflow {
  if (!value || typeof value !== 'object') {
    return defaultLocaleWorkflow(revision);
  }
  const candidate = value as Partial<LocaleWorkflow>;
  return {
    ...defaultLocaleWorkflow(revision),
    ...candidate,
    state: isState(candidate.state) ? candidate.state : 'draft',
    sourceRevision:
      typeof candidate.sourceRevision === 'number'
        ? candidate.sourceRevision
        : revision,
  };
}

function normalizeWorkflow(
  value: unknown,
  revision: number,
): TranslationWorkflow {
  const candidate =
    value && typeof value === 'object'
      ? (value as Partial<TranslationWorkflow>)
      : {};
  return {
    en: normalizeLocaleWorkflow(candidate.en, revision),
    es: normalizeLocaleWorkflow(candidate.es, revision),
  };
}

function assertNotesSafe(workflow: TranslationWorkflow): void {
  for (const locale of PUBLIC_CONTENT_LOCALES) {
    const result = validateReviewNotes(workflow[locale].reviewNotes);
    if (result !== true) invalid(result);
  }
}

function canDraft(user: WorkflowIdentity): boolean {
  return user.role === 'editor' || user.role === 'cms-admin';
}

function canReview(user: WorkflowIdentity): boolean {
  return user.role === 'bilingual-reviewer' || user.role === 'cms-admin';
}

function canPublish(user: WorkflowIdentity): boolean {
  return user.role === 'publisher' || user.role === 'cms-admin';
}

function workflowWithTrustedMetadata(
  requested: TranslationWorkflow,
  original: TranslationWorkflow,
): TranslationWorkflow {
  return {
    en: {
      ...original.en,
      state: requested.en.state,
      reviewNotes: requested.en.reviewNotes,
    },
    es: {
      ...original.es,
      state: requested.es.state,
      reviewNotes: requested.es.reviewNotes,
    },
  };
}

function assertReviewNoteAuthorization(
  requested: TranslationWorkflow,
  original: TranslationWorkflow,
  user: WorkflowIdentity,
): void {
  for (const locale of PUBLIC_CONTENT_LOCALES) {
    if (requested[locale].reviewNotes === original[locale].reviewNotes) {
      continue;
    }

    const from = original[locale].state;
    const to = requested[locale].state;
    const editorWrite =
      canDraft(user) &&
      from === 'draft' &&
      (to === 'draft' || to === 'needs-review');
    const reviewerWrite =
      canReview(user) &&
      from === 'needs-review' &&
      (to === 'draft' || to === 'reviewed');

    if (!editorWrite && !reviewerWrite) {
      forbidden(
        `Review notes for ${locale} may be changed only during an authorized editorial transition.`,
      );
    }
  }
}

function assertCurrentRevision(
  locale: PublicContentLocale,
  workflow: LocaleWorkflow,
  revision: number,
): void {
  if (workflow.sourceRevision !== revision) {
    invalid(
      `${locale} workflow is stale for source revision ${revision}; resubmit it for review.`,
    );
  }
}

function applyTransition(args: {
  current: LocaleWorkflow;
  locale: PublicContentLocale;
  now: string;
  policy: ContentPolicy;
  requested: LocaleWorkflow;
  revision: number;
  user: WorkflowIdentity;
}): LocaleWorkflow {
  const { current, locale, now, policy, requested, revision, user } = args;
  const from = current.state;
  const to = requested.state;

  if (from === to) return requested;
  assertCurrentRevision(locale, current, revision);

  if (from === 'draft' && to === 'needs-review') {
    if (!canDraft(user))
      forbidden('Only editors may submit content for review.');
    return {
      ...requested,
      sourceRevision: revision,
      reviewedBy: null,
      reviewedAt: null,
      publishedBy: null,
      publishedAt: null,
    };
  }

  if (from === 'needs-review' && to === 'reviewed') {
    if (!canReview(user)) {
      forbidden('Only authorized bilingual reviewers may review content.');
    }
    if (policy === 'legal' && sameIdentity(current.lastEditedBy, user.id)) {
      forbidden(
        'Legal content must be reviewed by someone other than its author.',
      );
    }
    return {
      ...requested,
      sourceRevision: revision,
      reviewedBy: user.id,
      reviewedAt: now,
      publishedBy: null,
      publishedAt: null,
    };
  }

  if (from === 'needs-review' && to === 'draft') {
    if (!canReview(user) && user.role !== 'cms-admin') {
      forbidden('Only a reviewer may return submitted content to draft.');
    }
    return {
      ...requested,
      sourceRevision: revision,
      reviewedBy: null,
      reviewedAt: null,
      publishedBy: null,
      publishedAt: null,
    };
  }

  if (from === 'reviewed' && to === 'published') {
    if (!canPublish(user)) forbidden('Only publishers may publish content.');
    if (!current.reviewedBy || !current.reviewedAt) {
      invalid(`${locale} is missing required review metadata.`);
    }
    return {
      ...requested,
      sourceRevision: revision,
      publishedBy: user.id,
      publishedAt: now,
    };
  }

  if (
    policy === 'urgent-announcement' &&
    from === 'needs-review' &&
    to === 'published'
  ) {
    if (!canPublish(user)) {
      forbidden('Only publishers may use expedited urgent publication.');
    }
    return {
      ...requested,
      sourceRevision: revision,
      reviewedBy: user.id,
      reviewedAt: now,
      publishedBy: user.id,
      publishedAt: now,
    };
  }

  invalid(`Invalid ${locale} workflow transition from ${from} to ${to}.`);
}

function urgentControls(record: EditorialRecord) {
  const nested =
    record.urgentPublicationControls &&
    typeof record.urgentPublicationControls === 'object'
      ? (record.urgentPublicationControls as Record<string, unknown>)
      : {};
  return {
    expiresAt: nested.expiresAt,
    translationFollowUpDeadline: nested.translationFollowUpDeadline,
    translationOwner: nested.translationOwner,
  };
}

function assertPublicationPolicy(
  record: EditorialRecord,
  workflow: TranslationWorkflow,
  revision: number,
  now: Date,
): void {
  for (const locale of PUBLIC_CONTENT_LOCALES) {
    if (
      workflow[locale].state === 'reviewed' ||
      workflow[locale].state === 'published'
    ) {
      assertCurrentRevision(locale, workflow[locale], revision);
    }
  }

  if (
    record.contentPolicy === 'evergreen' ||
    record.contentPolicy === 'legal'
  ) {
    if (
      !PUBLIC_CONTENT_LOCALES.every(
        (locale) => workflow[locale].state === 'published',
      )
    ) {
      invalid(
        `${record.contentPolicy} content requires English and Spanish to publish atomically.`,
      );
    }
    return;
  }

  const publishedLocales = PUBLIC_CONTENT_LOCALES.filter(
    (locale) => workflow[locale].state === 'published',
  );
  if (publishedLocales.length === 2) return;

  const controls = urgentControls(record);
  const expiresAt =
    typeof controls.expiresAt === 'string'
      ? new Date(controls.expiresAt)
      : new Date(Number.NaN);
  const followUp =
    typeof controls.translationFollowUpDeadline === 'string'
      ? new Date(controls.translationFollowUpDeadline)
      : new Date(Number.NaN);
  if (
    !identityId(controls.translationOwner) ||
    Number.isNaN(expiresAt.valueOf()) ||
    Number.isNaN(followUp.valueOf()) ||
    expiresAt <= now ||
    followUp <= now ||
    followUp > expiresAt
  ) {
    invalid(
      'Expedited urgent publication requires a translation owner, a future follow-up deadline, and a later future expiry.',
    );
  }
}

function changedFields(
  data: EditorialRecord,
  originalDoc: EditorialRecord,
  fields: readonly string[],
): string[] {
  return fields.filter(
    (field) =>
      hasOwn(data, field) && valuesDiffer(data[field], originalDoc[field]),
  );
}

export function applyEditorialWorkflowChange(
  args: ApplyEditorialWorkflowArgs,
): EditorialRecord {
  if (!isCmsIdentity(args.user)) {
    forbidden('An authenticated CMS identity is required.');
  }
  const user = args.user as WorkflowIdentity;
  const data = { ...args.data };
  const original = args.originalDoc ?? {};
  const now = args.now ?? new Date();
  const nowIso = now.toISOString();
  const previousRevision =
    typeof original.workingRevision === 'number' ? original.workingRevision : 1;
  const previousPolicy = isPolicy(original.contentPolicy)
    ? original.contentPolicy
    : undefined;
  const policy = isPolicy(data.contentPolicy)
    ? data.contentPolicy
    : previousPolicy;
  if (!policy) invalid('A valid content policy is required.');
  data.contentPolicy = policy;

  if (
    args.operation === 'update' &&
    previousPolicy &&
    policy !== previousPolicy &&
    user.role !== 'cms-admin'
  ) {
    forbidden('Only CMS administrators may reclassify a content policy.');
  }

  const locale = requestedLocale(args.locale);
  const localizedChanges = changedFields(data, original, args.localizedFields);
  const sharedChanges = changedFields(data, original, args.sharedFields ?? []);
  const policyChanged =
    previousPolicy !== undefined && policy !== previousPolicy;
  const requestedRevision =
    typeof data.workingRevision === 'number'
      ? data.workingRevision
      : previousRevision;
  const originalWorkflow = normalizeWorkflow(
    original.translationWorkflow,
    previousRevision,
  );
  const requestedWorkflow = normalizeWorkflow(
    data.translationWorkflow,
    requestedRevision,
  );
  assertNotesSafe(requestedWorkflow);
  assertReviewNoteAuthorization(requestedWorkflow, originalWorkflow, user);
  const urgentControlsChanged =
    changedFields(data, original, ['urgentPublicationControls']).length > 0;
  const isExpeditedControlWrite =
    urgentControlsChanged &&
    policy === 'urgent-announcement' &&
    canPublish(user) &&
    data._status === 'published' &&
    PUBLIC_CONTENT_LOCALES.some(
      (workflowLocale) =>
        originalWorkflow[workflowLocale].state === 'needs-review' &&
        requestedWorkflow[workflowLocale].state === 'published',
    );
  const contentChanged =
    args.operation === 'create' ||
    localizedChanges.length > 0 ||
    sharedChanges.length > 0 ||
    (urgentControlsChanged && !isExpeditedControlWrite) ||
    policyChanged;

  if (contentChanged) {
    if (!canDraft(user)) forbidden('Only editors may change public content.');
    const revision = args.operation === 'create' ? 1 : previousRevision + 1;
    const sharedChanged = sharedChanges.length > 0 || policyChanged;
    const resetWorkflow = {
      en: defaultLocaleWorkflow(revision),
      es: defaultLocaleWorkflow(revision),
    };
    for (const workflowLocale of PUBLIC_CONTENT_LOCALES) {
      const localeWasEdited = sharedChanged || workflowLocale === locale;
      resetWorkflow[workflowLocale].lastEditedBy = localeWasEdited
        ? user.id
        : originalWorkflow[workflowLocale].lastEditedBy;
      resetWorkflow[workflowLocale].lastEditedAt = localeWasEdited
        ? nowIso
        : originalWorkflow[workflowLocale].lastEditedAt;
    }
    data.workingRevision = revision;
    data.translationWorkflow = resetWorkflow;
    data._status = 'draft';
    return data;
  }

  const revision = previousRevision;
  const trustedRequested = workflowWithTrustedMetadata(
    requestedWorkflow,
    originalWorkflow,
  );
  const transitioned: TranslationWorkflow = {
    en: originalWorkflow.en,
    es: originalWorkflow.es,
  };
  for (const workflowLocale of PUBLIC_CONTENT_LOCALES) {
    transitioned[workflowLocale] = applyTransition({
      current: originalWorkflow[workflowLocale],
      locale: workflowLocale,
      now: nowIso,
      policy,
      requested: trustedRequested[workflowLocale],
      revision,
      user,
    });
  }

  const hasPublishedState = PUBLIC_CONTENT_LOCALES.some(
    (workflowLocale) => transitioned[workflowLocale].state === 'published',
  );
  if (hasPublishedState) {
    assertPublicationPolicy(data, transitioned, revision, now);
    if (data._status !== 'published') {
      invalid(
        'Eligible workflow states must be published with Payload publication.',
      );
    }
  } else if (data._status === 'published') {
    invalid('Payload publication requires an eligible translation workflow.');
  }

  data.workingRevision = revision;
  data.translationWorkflow = transitioned;
  return data;
}

export function resolveEligibleLocale(
  record: Pick<EditorialRecord, 'translationWorkflow' | 'workingRevision'>,
  locale: PublicContentLocale,
): PublicContentLocale | null {
  const revision = record.workingRevision ?? 1;
  const workflow = normalizeWorkflow(record.translationWorkflow, revision);
  return workflow[locale].state === 'published' &&
    workflow[locale].sourceRevision === revision
    ? locale
    : null;
}
