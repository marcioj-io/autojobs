import { NextResponse } from 'next/server';

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || 'https://autojobs-worker.marciojunior5872.workers.dev';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await fetch(`${WORKER_URL}/reviews`);
    const data = await res.json();
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Failed to fetch reviews:', error);
    return NextResponse.json({ data: [] });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { reviewId, action, note } = body;
    if (!reviewId || !action) {
      return new Response('Missing reviewId or action', { status: 400 });
    }

    const endpoint = action === 'approve' 
      ? `${WORKER_URL}/reviews/${reviewId}/approve`
      : action === 'reject'
      ? `${WORKER_URL}/reviews/${reviewId}/reject`
      : action === 'snooze'
      ? `${WORKER_URL}/reviews/${reviewId}/snooze`
      : null;

    if (!endpoint) {
      return new Response('Unsupported review action', { status: 400 });
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note, reviewer: 'dashboard-operator' })
    });
    
    if (!res.ok) {
      throw new Error(`Worker API returned ${res.status}`);
    }
    
    const data = await res.json();
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Failed to perform review action:', error);
    return NextResponse.json({ error: 'Failed to perform review action' }, { status: 400 });
  }
}
