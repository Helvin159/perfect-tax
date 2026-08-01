const SENSITIVE_NOTE_PATTERNS = [
  /\b(?:ssn|social security|itin|taxpayer identification)\b/i,
  /\b(?:passport|alien registration|a[- ]?number)\b/i,
  /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/,
  /\b\d{8,12}\b/,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
] as const;

export function validateReviewNotes(value: unknown): true | string {
  if (value === undefined || value === null || value === '') return true;
  if (typeof value !== 'string') return 'Review notes must be text.';
  if (value.length > 1_000) {
    return 'Review notes must be 1,000 characters or fewer.';
  }
  if (SENSITIVE_NOTE_PATTERNS.some((pattern) => pattern.test(value))) {
    return 'Review notes must not contain client identifiers or sensitive client information.';
  }

  return true;
}
