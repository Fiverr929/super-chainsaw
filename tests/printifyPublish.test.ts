import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrintifyProduct, printifyExternalListingId, publishPrintifyProduct } from '../src/lib/printify.ts';

test('Printify product uses sheet prices and publishes through the connected shop', async () => {
  const previousToken = process.env.printify_api;
  const previousFetch = globalThis.fetch;
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  process.env.printify_api = 'test-token';
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify({ id: 'product-123', variants: [] }), { status: 200 });
  };
  try {
    const product = await createPrintifyProduct(25886833, 'Shirt', 706, 99, [11, 12], 'image-1', 'center', undefined, {
      description: 'Product description', tags: ['graphic tee'], prices: { 11: 2202, 12: 2408 }
    });
    await publishPrintifyProduct(25886833, product.id);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, 'https://api.printify.com/v1/shops/25886833/products.json');
    assert.deepEqual(calls[0].body.variants, [
      { id: 11, price: 2202, is_enabled: true },
      { id: 12, price: 2408, is_enabled: true }
    ]);
    assert.equal(calls[0].body.description, 'Product description');
    assert.equal(calls[1].url, 'https://api.printify.com/v1/shops/25886833/products/product-123/publish.json');
    assert.equal(calls[1].body.variants, true);
    assert.equal(printifyExternalListingId({ id: 'product-123', title: 'Shirt', variants: [], external: [{ id: 'etsy-456' }] }), 'etsy-456');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousToken === undefined) delete process.env.printify_api;
    else process.env.printify_api = previousToken;
  }
});
