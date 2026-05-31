import { NextResponse } from 'next/server';
import { getBackend } from '../../../../lib/services/backend';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const be = await getBackend((globalThis as any).AUTOJOBS_D1);
  const app = await be.getApplicationById(params.id);
  if (!app) return new Response('Not Found', { status: 404 });
  return NextResponse.json({ data: app });
}
