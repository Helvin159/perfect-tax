import 'server-only';

import { auth } from './runtime';
import { createPortalSessionRevoker } from './session-revocation';

export const revokePortalUserSessions = createPortalSessionRevoker(auth);
