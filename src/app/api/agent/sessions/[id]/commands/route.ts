import { cloudStorageErrorResponse } from '@/lib/workspaceFs';
import { NextResponse } from 'next/server';
import { AgentRuntimeError, runAgentCommand } from '@/lib/agent/runtime';
import { AgentStoreError } from '@/lib/agent/store';
import type { AgentCommand } from '@/lib/agent/contracts';
import { rejectNonLocalAgentRequest } from '@/lib/agent/requestGuard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  const denied = rejectNonLocalAgentRequest(request); if (denied) return denied;
  try {
    const raw = await request.text(); if (raw.length > 120_000) return NextResponse.json({ error: 'Agent command is too large.' }, { status: 413 });
    const { id } = await params; const input = JSON.parse(raw) as AgentCommand;
    return NextResponse.json(await runAgentCommand({ sessionId: id, command: input, request }), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { const storageError = cloudStorageErrorResponse(error); if (storageError) return storageError;
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'Invalid Agent command.' }, { status: 400 });
    const status = error instanceof AgentRuntimeError || error instanceof AgentStoreError ? error.status : 500;
    if (status >= 500) console.error('Agent command failed:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not run the Agent command.' }, { status });
  }
}
