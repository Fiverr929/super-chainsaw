import { deleteProduct, ProductStoreError } from '@/lib/workspaceProductStore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type DeleteRequest = { drafts?: { id: string; revision: number }[] };

export async function POST(request: Request) {
  let body: DeleteRequest;
  try { body = await request.json() as DeleteRequest; }
  catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
  if (!Array.isArray(body.drafts) || body.drafts.length < 1 || body.drafts.length > 100) {
    return Response.json({ error: 'Choose between 1 and 100 drafts.' }, { status: 400 });
  }
  const ids = body.drafts.map(draft => draft?.id);
  if (new Set(ids).size !== ids.length || body.drafts.some(draft => !draft || typeof draft.id !== 'string' || !Number.isSafeInteger(draft.revision) || draft.revision < 1)) {
    return Response.json({ error: 'Invalid or repeated draft selection.' }, { status: 400 });
  }
  const deleted: string[] = [];
  const failed: { id: string; error: string }[] = [];
  for (const draft of body.drafts) {
    try { await deleteProduct(draft.id, draft.revision); deleted.push(draft.id); }
    catch (error) { failed.push({ id: draft.id, error: error instanceof ProductStoreError ? error.message : 'Could not delete draft.' }); }
  }
  return Response.json({ deleted, failed }, { headers: { 'Cache-Control': 'no-store' } });
}
