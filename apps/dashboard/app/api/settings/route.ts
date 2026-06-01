import { NextResponse } from 'next/server';

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || 'https://autojobs-worker.marciojunior5872.workers.dev';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id') || 'default';
    const res = await fetch(`${WORKER_URL}/settings?id=${id}`);
    const data = await res.json();
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    return NextResponse.json({ data: {} });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const res = await fetch(`${WORKER_URL}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to update settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 400 });
  }
}
