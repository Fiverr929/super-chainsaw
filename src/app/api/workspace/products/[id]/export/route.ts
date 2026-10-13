import { exportProductFolder, ProductStoreError } from '@/lib/workspaceProductStore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  let channel: unknown;
  try { channel = (await request.json()).channel; }
  catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
  if (channel !== 'etsy' && channel !== 'amazon') return Response.json({ error: 'Invalid listing channel.' }, { status: 400 });
  try { return Response.json(await exportProductFolder(id, channel)); }
  catch (error) {
    console.error('Product folder export failed:', error);
    return Response.json({ error: error instanceof Error ? error.message : 'Could not save listing folder.' }, { status: error instanceof ProductStoreError ? error.status : 500 });
  }
}
