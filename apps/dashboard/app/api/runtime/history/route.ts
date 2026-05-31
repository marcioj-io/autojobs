import { NextResponse } from 'next/server';
import { getBackend } from '../../../../lib/services/backend';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  const be = await getBackend((globalThis as any).AUTOJOBS_D1);
  const history = await be.getRuntimeHistory();
  return NextResponse.json({ data: history });
}
