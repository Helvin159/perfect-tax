const FIRST_USER_REGISTRATION_PATH = ['cms-users', 'first-register'] as const;

export function isFirstUserRegistrationPath(slug: readonly string[]) {
  return (
    slug.length === FIRST_USER_REGISTRATION_PATH.length &&
    slug.every(
      (segment, index) => segment === FIRST_USER_REGISTRATION_PATH[index],
    )
  );
}

export function isDisabledCmsRecoveryPath(slug: readonly string[]) {
  return slug[0] === 'cms-users' && slug[1] === 'forgot-password';
}
