import { toNextJsHandler } from 'better-auth/next-js';

import { createPortalAuthHttpHandler } from '@/modules/auth/http';
import { isCanonicalActiveStaffMfaSubject } from '@/modules/auth/portal-principal-composition';
import { auth } from '@/modules/auth/runtime';

const handler = toNextJsHandler({
  handler: createPortalAuthHttpHandler(auth, {
    isStaffMfaSubject: isCanonicalActiveStaffMfaSubject,
  }),
});

export const GET = handler.GET;
export const POST = handler.POST;
