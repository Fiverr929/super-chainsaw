import { NextResponse } from 'next/server';
import { listProducts, saveProduct, ProductStoreError } from '@/lib/workspaceProductStore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try { return NextResponse.json({ products: await listProducts() }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { console.error('Workspace product load failed:', error); return NextResponse.json({ error: 'Could not load products from disk.' }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    // Bound the stream as well as Content-Length; clients may omit that header.
    const reader = request.body?.getReader();
    if (!reader) return NextResponse.json({ error: 'Missing product.' }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 150 * 1024 * 1024) { await reader.cancel(); return NextResponse.json({ error: 'Product upload exceeds 150 MB. Use smaller images or fewer frames.' }, { status: 413 }); }
      chunks.push(value);
    }
    const product = await saveProduct(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    return NextResponse.json({ product });
  } catch (error) {
    if (error instanceof ProductStoreError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'Invalid product JSON.' }, { status: 400 });
    console.error('Workspace product save failed:', error instanceof Error ? error.stack : error);
    return NextResponse.json({ error: 'Could not save product. Your source images are unchanged. Please retry.' }, { status: 500 });
  }
}
