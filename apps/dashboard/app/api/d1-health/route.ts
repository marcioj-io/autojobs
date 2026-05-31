import { NextResponse } from 'next/server';
import { getBackend } from '../../../lib/services/backend';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  const d1Binding = (globalThis as any).AUTOJOBS_D1;
  const bindingPresent = Boolean(d1Binding);

  try {
    const backend = await getBackend(d1Binding);
    const settings = await backend.getSettings('default');
    return NextResponse.json({
      status: 'ok',
      binding: 'AUTOJOBS_D1',
      bindingPresent,
      usingMock: !bindingPresent,
      settingsPresent: Boolean(settings),
      settings,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return new Response(String(error instanceof Error ? error.message : error), { status: 500 });
  }
}
