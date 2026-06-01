import { NextResponse } from 'next/server';

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || 'https://autojobs-worker.marciojunior5872.workers.dev';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await fetch(`${WORKER_URL}/profiles`);
    const data = await res.json();
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Failed to fetch profiles:', error);
    return NextResponse.json({ data: [] });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const res = await fetch(`${WORKER_URL}/profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to create profile:', error);
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const res = await fetch(`${WORKER_URL}/profiles`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to update profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing profile id' }, { status: 400 });
    }
    const res = await fetch(`${WORKER_URL}/profiles?id=${id}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to delete profile:', error);
    return NextResponse.json({ error: 'Failed to delete profile' }, { status: 400 });
  }
}
