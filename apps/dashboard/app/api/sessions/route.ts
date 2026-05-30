import { NextResponse } from 'next/server';
import { getBackend } from '../../../lib/services/backend';

export const dynamic = 'force-dynamic';

export async function GET() {
  const be = await getBackend();
  const sessions = await be.getSessions();
  return NextResponse.json({ data: sessions });
}
