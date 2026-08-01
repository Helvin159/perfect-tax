import {
  InvalidPublicContentError,
  isPublicationEligible,
  requiredText,
  optionalText,
} from './publication';
import type { PublicContentLocale } from '../workflow/types';
import type { PublicServiceV1, PublicServicesV1 } from './public-services';

function projectService(
  value: unknown,
  locale: PublicContentLocale,
  now: Date,
): PublicServiceV1 | null {
  if (!isPublicationEligible(value, locale, now)) return null;
  if (value.isActive !== true) return null;
  if (!Number.isInteger(value.displayOrder) || Number(value.displayOrder) < 0) {
    throw new InvalidPublicContentError('services');
  }
  const key = requiredText(value, 'stableIdentifier', 160, 'services');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key)) {
    throw new InvalidPublicContentError('services');
  }

  return Object.freeze({
    key,
    title: requiredText(value, 'title', 160, 'services'),
    summary: requiredText(value, 'summary', 500, 'services'),
    detailedDescription: optionalText(
      value,
      'detailedDescription',
      3_000,
      'services',
    ),
    displayOrder: Number(value.displayOrder),
  });
}

export function projectPublicServices(
  values: readonly unknown[],
  locale: PublicContentLocale,
  now = new Date(),
): PublicServicesV1 {
  const items = values
    .map((value) => projectService(value, locale, now))
    .filter((value): value is PublicServiceV1 => value !== null)
    .sort(
      (left, right) =>
        left.displayOrder - right.displayOrder ||
        left.key.localeCompare(right.key),
    );

  return Object.freeze({
    schemaVersion: 1,
    locale,
    items: Object.freeze(items),
  });
}
