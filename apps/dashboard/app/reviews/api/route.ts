import { NextResponse } from 'next/server';
import { getBackend } from '../../../lib/services/backend';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  const be = await getBackend((globalThis as any).AUTOJOBS_D1);
  const reviews = await be.getReviews();
  return NextResponse.json({ data: reviews });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { reviewId, action, note } = body;
  // TODO: wire to persistence update via PersistenceService
  return NextResponse.json({ data: { reviewId, action, note } });
}
