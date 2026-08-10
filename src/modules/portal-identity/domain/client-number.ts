declare const clientNumberBrand: unique symbol;

/** Business-facing reference. It is neither a database ID nor a credential. */
export type ClientNumber = string & {
  readonly [clientNumberBrand]: 'ClientNumber';
};

export const CLIENT_NUMBER_PATTERN =
  /^CL-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

export function isClientNumber(value: unknown): value is ClientNumber {
  return typeof value === 'string' && CLIENT_NUMBER_PATTERN.test(value);
}

/** Accepts canonical values only; it never changes case or ambiguous glyphs. */
export function parseClientNumber(value: unknown): ClientNumber | undefined {
  return isClientNumber(value) ? value : undefined;
}

/**
 * Explicit user-input normalization trims surrounding whitespace and folds
 * ASCII letters to uppercase. It never removes separators or substitutes the
 * excluded Crockford glyphs I, L, O, or U.
 */
export function normalizeClientNumber(
  value: unknown,
): ClientNumber | undefined {
  if (typeof value !== 'string') return undefined;

  return parseClientNumber(value.trim().toUpperCase());
}
