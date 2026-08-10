import { toNextJsHandler } from 'better-auth/next-js';

import { createPortalAuthHttpHandler } from '@/modules/auth/http';
import { auth } from '@/modules/auth/runtime';

const handler = toNextJsHandler({
  handler: createPortalAuthHttpHandler(auth),
});

export const GET = handler.GET;
export const POST = handler.POST;
