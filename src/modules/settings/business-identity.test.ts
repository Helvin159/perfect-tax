import { describe, expect, it } from 'vitest';

import { BusinessIdentity } from './business-identity';

describe('BusinessIdentity configuration', () => {
  it('initializes a configurable public display name', () => {
    const displayName = BusinessIdentity.fields.find(
      (field) => 'name' in field && field.name === 'publicDisplayName',
    );

    expect(displayName).toMatchObject({
      defaultValue: 'Perfect Tax',
      required: true,
      type: 'text',
    });
    expect(BusinessIdentity.slug).toBe('business-identity');
  });

  it('keeps identity content localized and versioned without fallback semantics', () => {
    const localizedNames = BusinessIdentity.fields
      .filter((field) => 'localized' in field && field.localized)
      .map((field) => ('name' in field ? field.name : null));

    expect(localizedNames).toEqual(
      expect.arrayContaining([
        'tagline',
        'businessDescription',
        'serviceAreaDescription',
        'publicDisclaimer',
      ]),
    );
    expect(BusinessIdentity.versions).toMatchObject({
      drafts: { autosave: false },
    });
  });
});
