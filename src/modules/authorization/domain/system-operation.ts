export const SYSTEM_OPERATIONS = ['primary-owner-bootstrap'] as const;

export type SystemOperation = (typeof SYSTEM_OPERATIONS)[number];

export function isSystemOperation(value: unknown): value is SystemOperation {
  return value === 'primary-owner-bootstrap';
}
