import { workspaceStorageContext } from '@/lib/workspaceFs';
import { cloudStorageErrorResponse } from '@/lib/workspaceFs';
import { NextResponse } from 'next/server';
import { listProducts, saveProduct, ProductStoreError } from '@/lib/workspaceProductStore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try { return NextResponse.json({ products: await listProducts() }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { const storageError = cloudStorageErrorResponse(error); if (storageError) return storageError; console.error('Workspace product load failed:', error); return NextResponse.json({ error: 'Could not load products from disk.' }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    // Bound the stream as well as Content-Length; clients may omit that header.
    const reader = request.body?.getReader();
    if (!reader) return NextResponse.json({ error: 'Missing product.' }, { status: 400 });
    const uploadLimit = workspaceStorageContext() ? 32 * 1024 * 1024 : 150 * 1024 * 1024;
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > uploadLimit) { await reader.cancel(); return NextResponse.json({ error: 'Product upload is too large. Use smaller images or fewer frames.' }, { status: 413 }); }
      chunks.push(value);
    }
    const product = await saveProduct(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    return NextResponse.json({ product });
  } catch (error) { const storageError = cloudStorageErrorResponse(error); if (storageError) return storageError;
    if (error instanceof ProductStoreError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'Invalid product JSON.' }, { status: 400 });
    console.error('Workspace product save failed:', error instanceof Error ? error.stack : error);
    return NextResponse.json({ error: 'Could not save product. Your source images are unchanged. Please retry.' }, { status: 500 });
  }
}
