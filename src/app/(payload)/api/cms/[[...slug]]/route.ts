import config from '@payload-config';
import {
  REST_DELETE,
  REST_GET,
  REST_OPTIONS,
  REST_PATCH,
  REST_POST,
  REST_PUT,
} from '@payloadcms/next/routes';

import {
  isDisabledCmsRecoveryPath,
  isFirstUserRegistrationPath,
} from '@/modules/cms/http/public-registration';

type PayloadRouteContext = {
  params: Promise<{ slug?: string[] }>;
};

const payloadPost = REST_POST(config);

export const DELETE = REST_DELETE(config);
export const GET = REST_GET(config);
export const OPTIONS = REST_OPTIONS(config);
export const PATCH = REST_PATCH(config);
export const PUT = REST_PUT(config);

export async function POST(request: Request, context: PayloadRouteContext) {
  const { slug = [] } = await context.params;

  if (isFirstUserRegistrationPath(slug)) {
    return Response.json(
      { errors: [{ message: 'Public CMS registration is disabled.' }] },
      { status: 403 },
    );
  }

  if (isDisabledCmsRecoveryPath(slug)) {
    return Response.json(
      { errors: [{ message: 'CMS password recovery is unavailable.' }] },
      { status: 403 },
    );
  }

  return payloadPost(request, context);
}
