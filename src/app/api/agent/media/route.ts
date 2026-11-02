import { cloudStorageErrorResponse } from '@/lib/workspaceFs';
import { NextResponse } from 'next/server';
import { AgentMediaError, saveAgentImage } from '@/lib/agent/mediaStore';
import { rejectNonLocalAgentRequest } from '@/lib/agent/requestGuard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const config = { api: { bodyParser: false } };

export async function POST(request: Request) {
  const denied = rejectNonLocalAgentRequest(request); if (denied) return denied;
  try {
    const form = await request.formData(); const image = form.get('image');
    if (!(image instanceof File) || !['image/png','image/jpeg','image/webp'].includes(image.type)) return NextResponse.json({ error: 'Choose a PNG, JPEG or WebP image.' }, { status: 400 });
    if (image.size > 25 * 1024 * 1024) return NextResponse.json({ error: 'Image must be under 25 MB.' }, { status: 413 });
    return NextResponse.json(await saveAgentImage(Buffer.from(await image.arrayBuffer()), image.type), { status: 201 });
  } catch (error) { const storageError = cloudStorageErrorResponse(error); if (storageError) return storageError; return NextResponse.json({ error: error instanceof AgentMediaError ? error.message : 'Could not save Agent artwork.' }, { status: error instanceof AgentMediaError ? error.status : 500 }); }
}
