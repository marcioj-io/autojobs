import { NextResponse } from 'next/server';
import { getBackend } from '../../../lib/services/backend';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  const backend = await getBackend((globalThis as any).AUTOJOBS_D1);
  if (!backend.getAuditLogs) {
    return new Response('Audit logs not available', { status: 500 });
  }

  try {
    const data = await backend.getAuditLogs();
    return NextResponse.json({ data });
  } catch (error) {
    return new Response(String(error instanceof Error ? error.message : error), { status: 400 });
  }
}
