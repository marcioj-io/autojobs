import { NextResponse } from 'next/server';
import { getBackend } from '../../../lib/services/backend';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  const be = await getBackend((globalThis as any).AUTOJOBS_D1);
  const profiles = await be.getProfiles();
  return NextResponse.json({ data: profiles });
}

export async function POST(request: Request) {
  const be = await getBackend((globalThis as any).AUTOJOBS_D1);
  const body = await request.json();
  await be.createProfile(body);
  return NextResponse.json({ data: body });
}
