export const CLIENT_STATUSES = ['active', 'inactive'] as const;

export type ClientStatus = (typeof CLIENT_STATUSES)[number];

const clientStatusSet = new Set<string>(CLIENT_STATUSES);

export function isClientStatus(value: unknown): value is ClientStatus {
  return typeof value === 'string' && clientStatusSet.has(value);
}

export function parseClientStatus(value: unknown): ClientStatus | undefined {
  return isClientStatus(value) ? value : undefined;
}
