import 'server-only';

import {
  isPortalAuthHttpOperation,
  PORTAL_AUTH_BASE_PATH,
} from './config/policy';

type AuthHandler = Readonly<{
  handler(request: Request): Promise<Response>;
}>;

function getPortalAuthRelativePath(request: Request) {
  const pathname = new URL(request.url).pathname;
  if (!pathname.startsWith(`${PORTAL_AUTH_BASE_PATH}/`)) return undefined;
  return pathname.slice(PORTAL_AUTH_BASE_PATH.length);
}

/**
 * Fail-closed HTTP surface. Better Auth has more core endpoints than Slice 1
 * permits; they remain unreachable even if a library default changes.
 */
export function createPortalAuthHttpHandler(auth: AuthHandler) {
  return async function handlePortalAuthRequest(request: Request) {
    const relativePath = getPortalAuthRelativePath(request);

    if (
      !relativePath ||
      !isPortalAuthHttpOperation(request.method, relativePath)
    ) {
      return new Response('Not Found', { status: 404 });
    }

    return auth.handler(request);
  };
}
