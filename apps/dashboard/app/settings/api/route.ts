import { NextResponse } from 'next/server';
import { getBackend } from '../../../lib/services/backend';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  const be = await getBackend((globalThis as any).AUTOJOBS_D1);
  // single settings record expected; use 'default' as id
  const settings = await be.getSettings('default');
  return NextResponse.json({ data: settings });
}

export async function POST(request: Request) {
  const be = await getBackend((globalThis as any).AUTOJOBS_D1);
  const body = await request.json();
  await be.upsertSettings(body);
  return NextResponse.json({ data: body });
}
