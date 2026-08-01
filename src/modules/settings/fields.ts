import type { Field } from 'payload';

export const officeAddressFields: Field[] = [
  { name: 'line1', type: 'text', maxLength: 120 },
  { name: 'line2', type: 'text', maxLength: 120 },
  { name: 'city', type: 'text', maxLength: 80 },
  { name: 'region', type: 'text', maxLength: 80 },
  { name: 'postalCode', type: 'text', maxLength: 20 },
  { name: 'countryCode', type: 'text', defaultValue: 'US', maxLength: 2 },
];

export function validateTime(value: unknown): true | string {
  if (value === undefined || value === null || value === '') return true;
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
    ? true
    : 'Use a 24-hour time in HH:mm format.';
}
