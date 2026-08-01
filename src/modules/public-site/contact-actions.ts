import type { Locale } from '@/modules/localization/locales';
import type { PublicContactSettingsV1 } from '@/modules/settings/domain/public-settings';

import { getPublicSiteCopy } from './copy';

export type PublicContactAction = Readonly<{
  channel: 'email' | 'telephone' | 'whatsapp';
  displayValue: string;
  emphasis: 'primary' | 'secondary' | 'text';
  href: string;
  label: string;
}>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function phoneDigits(value: string | undefined): string | null {
  if (!value || !/^[+()\-.\s\d]{3,40}$/.test(value)) return null;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15 ? digits : null;
}

function telephoneHref(value: string, digits: string): string {
  return `tel:${value.trim().startsWith('+') ? '+' : ''}${digits}`;
}

/**
 * Converts a public-safe contact DTO into ordered conversion actions. The
 * helper validates channel values again at the rendering boundary so an
 * invalid or incomplete value can never become a browser link.
 */
export function getPublicContactActions(
  contact: PublicContactSettingsV1,
  locale: Locale,
  labels?: Readonly<{ primary?: string; secondary?: string }>,
): readonly PublicContactAction[] {
  const copy = getPublicSiteCopy(locale).cta;
  const whatsAppDigits = phoneDigits(contact.whatsApp);
  const telephoneDigits = phoneDigits(contact.telephone);
  const email = contact.email?.trim();
  const actions: PublicContactAction[] = [];

  if (whatsAppDigits) {
    const message =
      locale === 'es'
        ? 'Hola. Por favor, comuníquense conmigo sobre sus servicios o llámenme.'
        : 'Hello. Please contact me about your services or call me back.';
    actions.push({
      channel: 'whatsapp',
      displayValue: 'WhatsApp',
      emphasis: 'primary',
      href: `https://wa.me/${whatsAppDigits}?text=${encodeURIComponent(message)}`,
      label: labels?.primary ?? copy.whatsappLabel,
    });
  }

  if (telephoneDigits && contact.telephone) {
    actions.push({
      channel: 'telephone',
      displayValue: contact.telephone,
      emphasis: whatsAppDigits ? 'secondary' : 'primary',
      href: telephoneHref(contact.telephone, telephoneDigits),
      label: whatsAppDigits
        ? (labels?.secondary ?? copy.callLabel)
        : (labels?.primary ?? copy.callLabel),
    });
  }

  if (email && email.length <= 254 && EMAIL_PATTERN.test(email)) {
    actions.push({
      channel: 'email',
      displayValue: email,
      emphasis: 'text',
      href: `mailto:${email}`,
      label: copy.emailLabel,
    });
  }

  return Object.freeze(actions);
}

/** Returns the safest available direct href, preserving CTA priority. */
export function getPrimaryContactHref(
  contact: PublicContactSettingsV1,
  locale: Locale,
): string | null {
  return getPublicContactActions(contact, locale)[0]?.href ?? null;
}
