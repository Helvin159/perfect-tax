import type { CmsUserRole } from '@/modules/cms/users/roles';

export const PUBLIC_CONTENT_LOCALES = ['en', 'es'] as const;
export const CONTENT_POLICIES = [
  'evergreen',
  'legal',
  'urgent-announcement',
] as const;
export const TRANSLATION_STATES = [
  'draft',
  'needs-review',
  'reviewed',
  'published',
] as const;

export type PublicContentLocale = (typeof PUBLIC_CONTENT_LOCALES)[number];
export type ContentPolicy = (typeof CONTENT_POLICIES)[number];
export type TranslationState = (typeof TRANSLATION_STATES)[number];

export type WorkflowIdentity = Readonly<{
  collection: 'cms-users';
  id: number | string;
  role: CmsUserRole;
}>;

export type LocaleWorkflow = {
  state: TranslationState;
  sourceRevision: number;
  reviewedBy?: number | string | null;
  reviewedAt?: string | null;
  publishedBy?: number | string | null;
  publishedAt?: string | null;
  reviewNotes?: string | null;
  lastEditedBy?: number | string | null;
  lastEditedAt?: string | null;
};

export type TranslationWorkflow = Record<PublicContentLocale, LocaleWorkflow>;

export type EditorialRecord = Record<string, unknown> & {
  _status?: 'draft' | 'published';
  contentPolicy?: ContentPolicy;
  expiresAt?: string | null;
  translationFollowUpDeadline?: string | null;
  translationOwner?: number | string | null | { id?: number | string };
  translationWorkflow?: Partial<TranslationWorkflow>;
  workingRevision?: number;
};
