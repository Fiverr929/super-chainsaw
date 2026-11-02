import fs from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { createAgentSession, AgentStoreError } from '@/lib/agent/store';
import { rejectNonLocalAgentRequest } from '@/lib/agent/requestGuard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const denied = rejectNonLocalAgentRequest(request); if (denied) return denied;
  try {
    const directory = path.join(process.cwd(), '.workspace-data', 'agent');
    const files = await fs.readdir(directory).catch(error => { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; });
    const sessions = await Promise.all(files.filter(file => /^[0-9a-f-]{36}\.json$/i.test(file)).map(async file => {
      try {
        const value = JSON.parse(await fs.readFile(path.join(directory, file), 'utf8'));
        if (value.schemaVersion !== 1 || !Array.isArray(value.messages)) return null;
        return { id: value.id, updatedAt: value.updatedAt, status: value.status, preview: value.messages.at(-1)?.text?.slice(0, 140) || 'New conversation', actions: value.actions?.length || 0 };
      } catch { return null; }
    }));
    return NextResponse.json({ sessions: sessions.filter(Boolean).sort((a, b) => b!.updatedAt.localeCompare(a!.updatedAt)).slice(0,30) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { console.error('Agent session list failed:', error); return NextResponse.json({ error: 'Could not load Agent sessions.' }, { status: 500 }); }
}

export async function POST(request: Request) {
  const denied = rejectNonLocalAgentRequest(request); if (denied) return denied;
  try { return NextResponse.json({ session: await createAgentSession() }, { status: 201, headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return NextResponse.json({ error: error instanceof AgentStoreError ? error.message : 'Could not start an Agent session.' }, { status: error instanceof AgentStoreError ? error.status : 500 }); }
}
