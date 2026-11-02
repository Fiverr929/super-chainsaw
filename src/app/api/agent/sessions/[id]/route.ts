import { NextResponse } from 'next/server';
import { AgentStoreError, readAgentSession } from '@/lib/agent/store';
import { rejectNonLocalAgentRequest } from '@/lib/agent/requestGuard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const denied = rejectNonLocalAgentRequest(_request); if (denied) return denied;
  try { const { id } = await params; return NextResponse.json({ session: await readAgentSession(id) }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return NextResponse.json({ error: error instanceof AgentStoreError ? error.message : 'Could not load Agent session.' }, { status: error instanceof AgentStoreError ? error.status : 500 }); }
}
