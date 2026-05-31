import { NextResponse } from 'next/server';
import { getBackend } from '../../../../../lib/services/backend';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json();
  const reviewer = body?.reviewer ?? 'dashboard-operator';
  const notes = body?.notes ?? body?.note ?? null;

  const backend = await getBackend((globalThis as any).AUTOJOBS_D1);
  if (!backend.approveReview) {
    return new Response('Review approval not available', { status: 500 });
  }

  try {
    const result = await backend.approveReview(params.id, reviewer, notes ?? undefined);
    if (!result) return new Response('Not Found', { status: 404 });
    return NextResponse.json({ data: result });
  } catch (error) {
    return new Response(String(error instanceof Error ? error.message : error), { status: 400 });
  }
}
