declare const authUserIdBrand: unique symbol;
declare const clientIdBrand: unique symbol;
declare const staffIdBrand: unique symbol;

/** Immutable Better Auth account identifier, not an email or domain ID. */
export type AuthUserId = string & {
  readonly [authUserIdBrand]: 'AuthUserId';
};

/** Numeric Payload identifier for an application-owned Client record. */
export type ClientId = number & { readonly [clientIdBrand]: 'ClientId' };

/** Numeric Payload identifier for an application-owned Staff record. */
export type StaffId = number & { readonly [staffIdBrand]: 'StaffId' };

export function parseAuthUserId(value: unknown): AuthUserId | undefined {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 255 ||
    value.trim() !== value
  ) {
    return undefined;
  }

  return value as AuthUserId;
}

export function parseClientId(value: unknown): ClientId | undefined {
  return Number.isSafeInteger(value) && Number(value) > 0
    ? (value as ClientId)
    : undefined;
}

export function parseStaffId(value: unknown): StaffId | undefined {
  return Number.isSafeInteger(value) && Number(value) > 0
    ? (value as StaffId)
    : undefined;
}

export function isAuthUserId(value: unknown): value is AuthUserId {
  return parseAuthUserId(value) !== undefined;
}

export function isClientId(value: unknown): value is ClientId {
  return parseClientId(value) !== undefined;
}

export function isStaffId(value: unknown): value is StaffId {
  return parseStaffId(value) !== undefined;
}
