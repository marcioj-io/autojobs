import { NextResponse } from 'next/server';
import { getBackend } from '../../../../lib/services/backend';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST() {
  const backend = await getBackend((globalThis as any).AUTOJOBS_D1);
  if (!backend.controlRuntime) {
    return new Response('Runtime control not available', { status: 500 });
  }

  try {
    const result = await backend.controlRuntime('stop');
    return NextResponse.json({ data: result });
  } catch (error) {
    return new Response(String(error instanceof Error ? error.message : error), { status: 400 });
  }
}
