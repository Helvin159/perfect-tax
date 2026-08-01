import { NextResponse } from 'next/server';

import { HEALTH_HEADERS, livenessBody } from '@/modules/operations/health';

export function GET() {
  return NextResponse.json(livenessBody(), {
    headers: HEALTH_HEADERS,
    status: 200,
  });
}
