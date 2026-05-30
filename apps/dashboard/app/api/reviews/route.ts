import { NextResponse } from 'next/server';
import { getBackend } from '../../../lib/services/backend';

export const dynamic = 'force-dynamic';

export async function GET() {
  const be = await getBackend();
  const reviews = await be.getReviews();
  return NextResponse.json({ data: reviews });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { reviewId, action, note } = body;
  if (!reviewId || !action) {
    return new Response('Missing reviewId or action', { status: 400 });
  }

  const be = await getBackend();
  let result: any;

  switch (action) {
    case 'approve':
      result = await be.approveReview(reviewId, 'dashboard-operator', note);
      break;
    case 'reject':
      result = await be.rejectReview(reviewId, 'dashboard-operator', note);
      break;
    case 'snooze':
      result = await be.snoozeReview(reviewId, new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), 'dashboard-operator');
      break;
    default:
      return new Response('Unsupported review action', { status: 400 });
  }

  if (!result) return new Response('Not Found', { status: 404 });
  return NextResponse.json({ data: result });
}
