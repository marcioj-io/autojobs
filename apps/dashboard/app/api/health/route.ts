import { NextResponse } from 'next/server';
import { getBackend } from '../../../lib/services/backend';

export const dynamic = 'force-dynamic';

export async function GET() {
  const backend = await getBackend();
  if (!backend.getHealthOverview) {
    return new Response('Health overview not available', { status: 500 });
  }

  try {
    const data = await backend.getHealthOverview();
    return NextResponse.json({ data });
  } catch (error) {
    return new Response(String(error instanceof Error ? error.message : error), { status: 400 });
  }
}
