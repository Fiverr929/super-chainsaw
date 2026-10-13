import fs from 'node:fs/promises';
import path from 'node:path';
import { assertProductId } from '@/lib/workspaceProductStore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: Promise<{ id: string; file: string }> }) {
  const { id, file } = await context.params;
  try {
    assertProductId(id);
    if (!/^[0-9a-f]{64}\.(png|jpg|webp|mp4|webm)$/.test(file)) return new Response('Not found', { status: 404 });
    const bytes = await fs.readFile(path.join(process.cwd(), 'public', 'workspace-products', id, file));
    return new Response(bytes, { headers: {
      'Content-Type': file.endsWith('.png') ? 'image/png' : file.endsWith('.jpg') ? 'image/jpeg' : file.endsWith('.webp') ? 'image/webp' : file.endsWith('.mp4') ? 'video/mp4' : 'video/webm',
      'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff',
    } });
  } catch { return new Response('Not found', { status: 404 }); }
}
