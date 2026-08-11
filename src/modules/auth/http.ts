import 'server-only';

import {
  isPortalAuthHttpOperation,
  PORTAL_AUTH_BASE_PATH,
} from './config/policy';
import {
  handleStaffMfaHttpRequest,
  isStaffMfaHttpPath,
  type StaffMfaHttpBoundaryOptions,
} from './mfa-http';

type AuthHandler = Readonly<{
  $context: Parameters<typeof handleStaffMfaHttpRequest>[0]['$context'];
  api: Parameters<typeof handleStaffMfaHttpRequest>[0]['api'];
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
export function createPortalAuthHttpHandler(
  auth: AuthHandler,
  options: StaffMfaHttpBoundaryOptions = {},
) {
  return async function handlePortalAuthRequest(request: Request) {
    const relativePath = getPortalAuthRelativePath(request);

    if (
      !relativePath ||
      !isPortalAuthHttpOperation(request.method, relativePath)
    ) {
      return new Response('Not Found', { status: 404 });
    }

    if (isStaffMfaHttpPath(relativePath)) {
      return handleStaffMfaHttpRequest(auth, request, relativePath, options);
    }

    return auth.handler(request);
  };
}
