import { NextResponse } from 'next/server';
import { getBackend } from '../../../lib/services/backend';

export const dynamic = 'force-dynamic';

export async function GET() {
  const be = await getBackend();
  const anomalies = await be.getAnomalies();
  return NextResponse.json({ data: anomalies });
}
