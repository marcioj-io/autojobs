import { NextResponse } from 'next/server';

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || 'https://autojobs-worker.marciojunior5872.workers.dev';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await fetch(`${WORKER_URL}/logs`);
    const data = await res.json();
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Failed to fetch logs:', error);
    return NextResponse.json({ data: [] });
  }
}
