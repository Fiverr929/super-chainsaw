import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeProductIntoListing, productListingMediaState, type WorkspaceProduct } from '../src/lib/workspaceProducts.ts';

const product: WorkspaceProduct = {
  id: 'product', revision: 4, name: 'Tee', createdAt: '', updatedAt: '',
  designDataUrl: '/artwork.png', renderState: 'ready',
  preset: { id: 'shirt', name: 'Shirt', color: 'Black', productType: 'T-shirt', frames: [] },
  generated: [{ id: 'front', name: 'Front', dataUrl: '/front.png' }, { id: 'back', name: 'Back', dataUrl: '/back.png' }],
};

test('channel image freshness ignores product name and revision changes', () => {
  assert.equal(productListingMediaState({ ...product, name: 'Renamed tee', revision: 10 }, ['/front.png', '/back.png']), 'current');
});

test('channel image freshness detects changed, missing, and reordered images', () => {
  assert.equal(productListingMediaState(product, ['/old-front.png', '/back.png']), 'changed');
  assert.equal(productListingMediaState(product, ['/front.png']), 'changed');
  assert.equal(productListingMediaState(product, ['/back.png', '/front.png']), 'changed');
});

test('comparison uses the selected static gallery and excludes unconnected channel video', () => {
  const selected: WorkspaceProduct = { ...product, gallerySlots: [
    { id: 'back-slot', kind: 'mockup', label: 'Back', frameId: 'back' },
    { id: 'guide', kind: 'image', label: 'Size guide', assetUrl: '/size-guide.png' },
    { id: 'video', kind: 'video', label: 'Preview', assetUrl: '/video.mp4' },
  ] };
  assert.equal(productListingMediaState(selected, ['/back.png', '/size-guide.png']), 'current');
  assert.equal(productListingMediaState(selected, ['/front.png', '/back.png']), 'changed');
});

test('missing channel image data and unfinished renders never claim current images', () => {
  assert.equal(productListingMediaState(product, null), 'unknown');
  assert.equal(productListingMediaState({ ...product, renderState: 'draft' }, ['/front.png', '/back.png']), 'not-ready');
});

test('image refresh needs no preset and preserves listing copy, prices, and identity', () => {
  const existing = { workspace_product_id: product.id, local_listing_id: 'local-1', listing_id: 'remote-1', title: 'Edited title', description: 'Original copy', tags: 'tee,shirt', price: '29', status: 'Published', images: '/old.png' };
  const [updated] = mergeProductIntoListing([existing], product, undefined, { updateOnly: true });
  assert.deepEqual(updated, { ...existing, workspace_product_revision: 4, folder: 'product-product', images: '/front.png,/back.png', digital_file: '/artwork.png', workspace_back_artwork: '' });
  assert.equal(existing.images, '/old.png');
});

test('image refresh cannot silently recreate a deleted draft', () => {
  assert.throws(() => mergeProductIntoListing([], product, undefined, { updateOnly: true }), /no longer exists/);
});
