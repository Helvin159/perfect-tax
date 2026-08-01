import { describe, expect, it } from 'vitest';

import {
  isDisabledCmsRecoveryPath,
  isFirstUserRegistrationPath,
} from './public-registration';

describe('public CMS registration route guard', () => {
  it('matches only Payload first-user registration', () => {
    expect(isFirstUserRegistrationPath(['cms-users', 'first-register'])).toBe(
      true,
    );
    expect(isFirstUserRegistrationPath(['cms-users', 'login'])).toBe(false);
    expect(
      isFirstUserRegistrationPath(['portal-users', 'first-register']),
    ).toBe(false);
    expect(
      isFirstUserRegistrationPath(['cms-users', 'first-register', 'extra']),
    ).toBe(false);
  });

  it('keeps incomplete console-email recovery disabled', () => {
    expect(isDisabledCmsRecoveryPath(['cms-users', 'forgot-password'])).toBe(
      true,
    );
    expect(isDisabledCmsRecoveryPath(['cms-users', 'login'])).toBe(false);
  });
});
