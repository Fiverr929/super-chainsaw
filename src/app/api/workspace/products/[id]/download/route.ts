import { productArchive, ProductStoreError } from '@/lib/workspaceProductStore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const archive = await productArchive(id);
    const filename = `${archive.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 100)}.zip`;
    return new Response(new Uint8Array(archive.bytes).buffer, { headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    } });
  } catch (error) {
    return Response.json({ error: error instanceof ProductStoreError ? error.message : 'Could not export saved images. Try regenerating the mockups.' }, { status: error instanceof ProductStoreError ? error.status : 500 });
  }
}
