declare const emailOwnerBrand: unique symbol;

type EmailOwnedBy<Owner extends string> = string & {
  readonly [emailOwnerBrand]: Owner;
};

/** Credential email owned and changed only by Better Auth. */
export type LoginEmail = EmailOwnedBy<'better-auth-login'>;

/** Staff contact/profile email; changing it never changes login credentials. */
export type WorkEmail = EmailOwnedBy<'staff-work-contact'>;

/** Client contact/profile email; it never proves an account binding. */
export type ContactEmail = EmailOwnedBy<'client-contact'>;

/** Slice 2 invitation target; not persisted as Slice 1 lifecycle state. */
export type IntendedEmail = EmailOwnedBy<'invitation-intended'>;
