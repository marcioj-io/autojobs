import { NextResponse } from 'next/server';
import { getBackend } from '../../../lib/services/backend';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  const be = await getBackend((globalThis as any).AUTOJOBS_D1);
  const overview = await be.getRuntimeOverview();
  return NextResponse.json({ data: overview });
}

export async function POST(request: Request) {
  const body = await request.json();
  const action = body?.action;
  if (!action) {
    return new Response('Missing action', { status: 400 });
  }

  const be = await getBackend((globalThis as any).AUTOJOBS_D1);
  try {
    const result = await be.controlRuntime(action);
    return NextResponse.json({ data: result });
  } catch (error) {
    return new Response(String(error instanceof Error ? error.message : error), { status: 400 });
  }
}
