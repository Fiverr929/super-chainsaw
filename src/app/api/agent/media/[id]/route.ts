import { cloudStorageErrorResponse } from '@/lib/workspaceFs';
import { NextResponse } from 'next/server';
import { AgentMediaError, getAgentImage } from '@/lib/agent/mediaStore';
import { rejectNonLocalAgentRequest } from '@/lib/agent/requestGuard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = rejectNonLocalAgentRequest(_request); if (denied) return denied;
  try { const { id } = await params; const image = await getAgentImage(id); return new Response(image.bytes, { headers: { 'Content-Type': image.mime, 'Content-Length': String(image.bytes.length), 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' } }); }
  catch (error) { const storageError = cloudStorageErrorResponse(error); if (storageError) return storageError; return NextResponse.json({ error: error instanceof AgentMediaError ? error.message : 'Could not load Agent artwork.' }, { status: error instanceof AgentMediaError ? error.status : 500 }); }
}
