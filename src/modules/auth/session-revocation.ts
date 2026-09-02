import 'server-only';

import {
  parseAuthUserId,
  type AuthUserId,
} from '@/modules/portal-identity/domain/identifiers';

type SessionRevocationRuntime = Readonly<{
  $context: Promise<{
    internalAdapter: {
      deleteUserSessions(userId: string): Promise<void>;
    };
  }>;
}>;

export function createPortalSessionRevoker(runtime: SessionRevocationRuntime) {
  return async function revokePortalUserSessions(authUserId: AuthUserId) {
    const validatedId = parseAuthUserId(authUserId);
    if (!validatedId) throw new TypeError('A valid auth user ID is required.');

    const context = await runtime.$context;
    await context.internalAdapter.deleteUserSessions(validatedId);
  };
}
