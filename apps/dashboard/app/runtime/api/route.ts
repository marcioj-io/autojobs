import { NextResponse } from 'next/server';
import { getBackend } from '../../../lib/services/backend';

export const dynamic = 'force-dynamic';

export async function GET() {
  const be = await getBackend();
  const overview = await be.getRuntimeOverview();
  const events = await be.getRuntimeHistory();
  return NextResponse.json({ data: { overview, events } });
}

export async function POST(request: Request) {
  const body = await request.json();
  // For control actions we currently rely on the dashboard control endpoint.
  // Forwarding to the top-level API is preferable; here we accept the action and return it.
  const { action } = body;
  // TODO: wire to RuntimeService update if available
  return NextResponse.json({ data: { action } });
}
