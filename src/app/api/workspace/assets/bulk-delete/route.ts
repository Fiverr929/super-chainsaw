import { AssetStoreError, deleteListingAssetFolder } from '@/lib/workspaceAssets';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return Response.json({ error: 'Open Assets in the workstation to delete folders.' }, { status: 403 });
  let body: { ids?: unknown };
  try { body = await request.json(); }
  catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
  if (!body || !Array.isArray(body.ids) || body.ids.length < 1 || body.ids.length > 100 || body.ids.some(id => typeof id !== 'string' || !/^\d{8,15}$/.test(id)) || new Set(body.ids).size !== body.ids.length) {
    return Response.json({ error: 'Choose 1 to 100 unique listing folders.' }, { status: 400 });
  }
  const deleted: string[] = [];
  const failed: { id: string; error: string }[] = [];
  for (const id of body.ids as string[]) {
    try { await deleteListingAssetFolder(id); deleted.push(id); }
    catch (error) { failed.push({ id, error: error instanceof AssetStoreError ? error.message : 'Could not delete this asset folder.' }); }
  }
  return Response.json({ deleted, failed }, { headers: { 'Cache-Control': 'no-store' } });
}
