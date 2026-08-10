import 'server-only';

import { auth } from './runtime';
import { createAuthenticatedSessionReader } from './session-reader';

export type { AuthenticatedPortalSession } from './session-reader';
export { isFreshPortalSession } from './session-reader';

export const readAuthenticatedPortalSession =
  createAuthenticatedSessionReader(auth);
