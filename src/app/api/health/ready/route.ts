import { NextResponse } from 'next/server';

import {
  createReadyCheckDependencies,
  HEALTH_HEADERS,
  healthStatusCode,
  readinessBody,
} from '@/modules/operations/health';

export async function GET() {
  const body = await readinessBody(createReadyCheckDependencies());

  return NextResponse.json(body, {
    headers: HEALTH_HEADERS,
    status: healthStatusCode(body),
  });
}
