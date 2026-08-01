import type { PublicContentLocale } from '@/modules/content/workflow/types';

const PUBLICATION_POLICIES = [
  'evergreen',
  'legal',
  'urgent-announcement',
] as const;

type RecordValue = Record<string, unknown>;

export class InvalidPublicContentError extends Error {
  readonly code = 'invalid-public-content';

  constructor(resource: string) {
    super(`The published ${resource} record is invalid.`);
    this.name = 'InvalidPublicContentError';
  }
}

export class CmsUnavailableError extends Error {
  readonly code = 'cms-unavailable';

  constructor(resource: string, options?: ErrorOptions) {
    super(`The ${resource} repository is temporarily unavailable.`, options);
    this.name = 'CmsUnavailableError';
  }
}

export function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function currentPublishedRevision(
  record: RecordValue,
  locale: PublicContentLocale,
): boolean {
  const workflow = record.translationWorkflow;
  const revision = record.workingRevision;
  if (
    !isRecord(workflow) ||
    !Number.isInteger(revision) ||
    Number(revision) < 1
  ) {
    return false;
  }

  const localeWorkflow = workflow[locale];
  return (
    isRecord(localeWorkflow) &&
    localeWorkflow.state === 'published' &&
    localeWorkflow.sourceRevision === revision
  );
}

export function isPublicationEligible(
  value: unknown,
  locale: PublicContentLocale,
  now = new Date(),
): value is RecordValue {
  if (!isRecord(value) || value._status !== 'published') return false;
  if (
    !PUBLICATION_POLICIES.includes(
      value.contentPolicy as (typeof PUBLICATION_POLICIES)[number],
    )
  ) {
    return false;
  }
  if (!currentPublishedRevision(value, locale)) return false;

  if (value.contentPolicy === 'evergreen' || value.contentPolicy === 'legal') {
    return (
      currentPublishedRevision(value, 'en') &&
      currentPublishedRevision(value, 'es')
    );
  }

  const controls = value.urgentPublicationControls;
  if (!isRecord(controls) || typeof controls.expiresAt !== 'string')
    return false;
  const expiresAt = Date.parse(controls.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > now.getTime();
}

export function publishedLocales(
  value: unknown,
  now = new Date(),
): PublicContentLocale[] {
  return (['en', 'es'] as const).filter((locale) =>
    isPublicationEligible(value, locale, now),
  );
}

export function optionalText(
  record: RecordValue,
  key: string,
  maximumLength: number,
  resource: string,
): string | undefined {
  const value = record[key];
  if (value === undefined || value === null || value === '') return undefined;
  if (
    typeof value !== 'string' ||
    value.length > maximumLength ||
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value)
  ) {
    throw new InvalidPublicContentError(resource);
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function requiredText(
  record: RecordValue,
  key: string,
  maximumLength: number,
  resource: string,
): string {
  const value = optionalText(record, key, maximumLength, resource);
  if (!value) throw new InvalidPublicContentError(resource);
  return value;
}

export function optionalRecord(
  record: RecordValue,
  key: string,
  resource: string,
): RecordValue | undefined {
  const value = record[key];
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value)) throw new InvalidPublicContentError(resource);
  return value;
}
