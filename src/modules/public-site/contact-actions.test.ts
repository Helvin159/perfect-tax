import { describe, expect, it } from 'vitest';

import type { PublicContactSettingsV1 } from '@/modules/settings/domain/public-settings';

import { getPublicContactActions } from './contact-actions';

function contact(
  fields: Omit<PublicContactSettingsV1, 'locale' | 'schemaVersion'>,
): PublicContactSettingsV1 {
  return { locale: 'en', schemaVersion: 1, ...fields };
}

describe('public contact action priority', () => {
  it('uses confirmed WhatsApp first, telephone as a visible alternative, and email last', () => {
    const actions = getPublicContactActions(
      contact({
        email: 'hello@example.test',
        telephone: '+1 (212) 555-0100',
        whatsApp: '+1 646 555 0199',
      }),
      'en',
    );

    expect(actions.map(({ channel }) => channel)).toEqual([
      'whatsapp',
      'telephone',
      'email',
    ]);
    expect(actions[0]?.emphasis).toBe('primary');
    expect(actions[0]?.href).toContain('https://wa.me/16465550199?text=');
    expect(decodeURIComponent(actions[0]?.href ?? '')).toContain(
      'Please contact me about your services or call me back.',
    );
    expect(decodeURIComponent(actions[0]?.href ?? '')).not.toMatch(
      /social security|tax document|password/i,
    );
    expect(actions[1]).toMatchObject({
      emphasis: 'secondary',
      href: 'tel:+12125550100',
    });
    expect(actions[2]).toMatchObject({
      emphasis: 'text',
      href: 'mailto:hello@example.test',
    });
  });

  it('promotes telephone when WhatsApp is missing', () => {
    const actions = getPublicContactActions(
      contact({ telephone: '212-555-0100' }),
      'en',
    );

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      channel: 'telephone',
      emphasis: 'primary',
      href: 'tel:2125550100',
    });
  });

  it('omits invalid and missing contact values instead of producing links', () => {
    const invalid = contact({
      email: 'not-an-email',
      telephone: 'bad2125550100',
      whatsApp: '123',
    });

    expect(getPublicContactActions(invalid, 'en')).toEqual([]);
    expect(getPublicContactActions(contact({}), 'es')).toEqual([]);
  });
});
