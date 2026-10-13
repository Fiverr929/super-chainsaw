import { deleteProduct, readProduct, ProductStoreError } from '@/lib/workspaceProductStore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return Response.json({ product: await readProduct(id) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status = error instanceof ProductStoreError ? error.status : 500;
    return Response.json({ error: error instanceof ProductStoreError ? error.message : 'Could not load product.' }, { status });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const revision = Number(new URL(request.url).searchParams.get('revision'));
    if (!Number.isSafeInteger(revision) || revision < 1) return Response.json({ error: 'Invalid draft revision.' }, { status: 400 });
    await deleteProduct(id, revision);
    return Response.json({ deleted: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status = error instanceof ProductStoreError ? error.status : 500;
    return Response.json({ error: error instanceof ProductStoreError ? error.message : 'Could not delete draft.' }, { status });
  }
}
