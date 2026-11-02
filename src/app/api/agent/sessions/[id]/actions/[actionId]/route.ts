import { NextResponse } from 'next/server';
import { AgentStoreError, claimBrowserAction, completeBrowserAction, readAgentSession } from '@/lib/agent/store';
import { updateAgentSession } from '@/lib/agent/store';
import { rejectNonLocalAgentRequest } from '@/lib/agent/requestGuard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string; actionId: string }> };
function response(error: unknown) { const status = error instanceof AgentStoreError ? error.status : 500; if (status >= 500) console.error('Agent browser action failed:', error); return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not update Agent action.' }, { status }); }

export async function GET(_request: Request, { params }: Context) {
  const denied = rejectNonLocalAgentRequest(_request); if (denied) return denied;
  try { const { id, actionId } = await params; const session = await readAgentSession(id); const action = session.actions.find(item => item.id === actionId); if (!action) return NextResponse.json({ error: 'Action not found.' }, { status: 404 }); return NextResponse.json({ action }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return response(error); }
}

export async function POST(_request: Request, { params }: Context) {
  const denied = rejectNonLocalAgentRequest(_request); if (denied) return denied;
  try { const { id, actionId } = await params; const result = await claimBrowserAction(id, actionId); return NextResponse.json({ action: result.result }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return response(error); }
}

export async function PUT(request: Request, { params }: Context) {
  const denied = rejectNonLocalAgentRequest(request); if (denied) return denied;
  try {
    const { id, actionId } = await params; const body = await request.json();
    if (typeof body.claim !== 'string' || !['completed','failed','reconciliation-required'].includes(body.status)) return NextResponse.json({ error: 'Invalid action result.' }, { status: 400 });
    const output = body.output && typeof body.output === 'object' && !Array.isArray(body.output) ? body.output as Record<string, unknown> : {};
    if (JSON.stringify(output).length > 18_000 || JSON.stringify(output).includes('data:image/')) return NextResponse.json({ error: 'Action result is too large or contains inline image data.' }, { status: 413 });
    const result = await completeBrowserAction(id, actionId, body.claim, body.status, output, typeof body.error === 'string' ? body.error : undefined);
    await updateAgentSession(id, session => {
      const stored = session.actions.find(item => item.id === actionId);
      if (stored?.name === 'mockups.render' && body.status === 'completed' && typeof output.productId === 'string') {
        session.brief.productId = output.productId; if (typeof output.productRevision === 'number') session.brief.productRevision = output.productRevision;
      }
      if ((stored?.name === 'product.configure' || stored?.name === 'product.artwork.apply') && body.status === 'completed' && typeof output.productId === 'string' && typeof output.productRevision === 'number') {
        session.brief.productId = output.productId; session.brief.productRevision = output.productRevision;
      }
      if (stored?.name === 'preset.select' && body.status === 'completed') {
        const mockup = output.mockupPreset; const listing = output.listingPreset;
        if (mockup && typeof mockup === 'object' && typeof (mockup as Record<string,unknown>).id === 'string') session.brief.selectedMockupPreset = mockup as Record<string,unknown>;
        if (listing && typeof listing === 'object' && typeof (listing as Record<string,unknown>).id === 'string') { session.brief.selectedListingPreset = listing as Record<string,unknown>; session.brief.listingPresetId = String((listing as Record<string,unknown>).id); }
      }
      if (session.actions.some(action => action.status === 'queued' && action.location === 'browser')) session.status = 'waiting-for-browser';
      else if (body.status === 'completed' && (stored?.silent || body.pauseAfter === true)) session.status = 'idle';
      else if (session.status === 'waiting-for-browser') session.status = 'running';
    });
    const nextActionId = actionId.replace(/^[0-9a-f]/i, first => ((parseInt(first,16)+1)%16).toString(16));
    return NextResponse.json({ action: result.result, resumeCommandId: nextActionId }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return response(error); }
}
