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
  const be = await getBackend((globalThis as any).AUTOJOBS_D1);
  if (action === 'approve') {
    const updated = await be.approveReview(reviewId, 'dashboard-operator', note);
    return NextResponse.json({ data: updated });
  }

  if (action === 'reject') {
    const updated = await be.rejectReview(reviewId, 'dashboard-operator', note);
    return NextResponse.json({ data: updated });
  }

  if (action === 'snooze') {
    const until = note && !isNaN(Date.parse(note)) ? new Date(note) : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const updated = await be.snoozeReview(reviewId, until, 'dashboard-operator');
    return NextResponse.json({ data: updated });
  }

  return NextResponse.json({ error: 'unsupported_action', data: { reviewId, action } }, { status: 400 });
}
