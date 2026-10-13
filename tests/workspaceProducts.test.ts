import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';
import sharp from 'sharp';
import JSZip from 'jszip';
import { productArchive, exportProductFolder, saveProduct, readProduct, listProducts, deleteProduct, ProductStoreError } from '../src/lib/workspaceProductStore.ts';
import { artworkForFrame, galleryItems, productInputSignature, mergeProductIntoListing, triggerListingCopy, type WorkspaceProduct } from '../src/lib/workspaceProducts.ts';
import { readListingSheet, readListingSheetSnapshot, writeListingSheet, migrateListingSheet, listListingRecords, ListingConflictError } from '../src/lib/workspaceListingStore.ts';

async function fixture() {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'workstation-products-'));
  const image = `data:image/png;base64,${(await sharp({ create: { width: 16, height: 16, channels: 4, background: '#aabbcc' } }).png().toBuffer()).toString('base64')}`;
  const product: WorkspaceProduct = { id: randomUUID(), revision: 0, name: 'Test tee', createdAt: '', updatedAt: '', designDataUrl: image, generated: [{ id: 'front', name: 'front.png', dataUrl: image }], renderState: 'ready', preset: { id: 'tee', name: 'Tee', color: 'Black', productType: 'T-Shirt', frames: [{ id: 'front', name: 'Front', role: 'Front', imageDataUrl: image, applyDesign: true, placement: { x: 30, y: 20, width: 30, height: 40, opacity: 96, margin: 7, realism: 18, softness: 1 } }] } };
  return { cwd, product, cleanup: () => fs.rm(cwd, { recursive: true, force: true }) };
}

test('routes each prepared product to its marketplace copy generator', async () => {
  const calls: string[] = [];
  const generators = {
    etsy: async (row: number) => { calls.push(`etsy:${row}`); },
    amazon: async (row: number) => { calls.push(`amazon:${row}`); },
  };
  await triggerListingCopy('amazon', 4, generators);
  await triggerListingCopy('etsy', 7, generators);
  assert.deepEqual(calls, ['amazon:4', 'etsy:7']);
});

test('exports a worksheet folder and protects assets referenced by a saved listing', async () => {
  const f = await fixture();
  try {
    const product = await saveProduct(f.product, f.cwd);
    const result = await exportProductFolder(product.id, 'etsy', f.cwd);
    assert.equal(result.folder, `product-${product.id}`);
    const folder = path.join(f.cwd, 'public', 'listings-physical', result.folder);
    assert.ok((await fs.readdir(folder)).some(name => name.endsWith('.png')));
    assert.equal(JSON.parse(await fs.readFile(path.join(folder, 'manifest.json'), 'utf8')).productId, product.id);
    const firstManifest = JSON.parse(await fs.readFile(path.join(folder, 'manifest.json'), 'utf8'));
    const replacement = `data:image/png;base64,${(await sharp({ create: { width: 16, height: 16, channels: 4, background: '#44aa11' } }).png().toBuffer()).toString('base64')}`;
    const revised = await saveProduct({ ...product, generated: [{ ...product.generated[0], dataUrl: replacement }] }, f.cwd);
    await exportProductFolder(product.id, 'etsy', f.cwd);
    const secondManifest = JSON.parse(await fs.readFile(path.join(folder, 'manifest.json'), 'utf8'));
    assert.notEqual(secondManifest.media[0], firstManifest.media[0]);
    assert.ok((await fs.stat(path.join(folder, firstManifest.media[0]))).size > 0);
    await writeListingSheet('etsy-physical', [{ workspace_product_id: product.id, status: 'Draft' }], f.cwd);
    assert.equal((await readListingSheet('etsy-physical', f.cwd))?.[0].workspace_product_id, product.id);
    await assert.rejects(deleteProduct(product.id, revised.revision, f.cwd), /used by/);
    assert.equal((await readProduct(product.id, f.cwd)).id, product.id);
    await writeListingSheet('etsy-physical', [], f.cwd);
    await deleteProduct(product.id, revised.revision, f.cwd);
    await assert.rejects(fs.stat(folder), { code: 'ENOENT' });
  } finally { await f.cleanup(); }
});

test('rejects a stale worksheet save from another window', async () => {
  const f = await fixture();
  try {
    const revision = await writeListingSheet('amazon', [{ local_listing_id: 'one', status: 'Draft' }], f.cwd, '0');
    await writeListingSheet('amazon', [{ local_listing_id: 'one', status: 'Submitted' }], f.cwd, revision);
    await assert.rejects(writeListingSheet('amazon', [{ local_listing_id: 'one', status: 'Published' }], f.cwd, revision), ListingConflictError);
    assert.equal((await readListingSheetSnapshot('amazon', f.cwd))?.rows[0].status, 'Submitted');
  } finally { await f.cleanup(); }
});

test('migrates saved listings with a backup and exposes stable channel records', async () => {
  const f = await fixture();
  try {
    await writeListingSheet('etsy-physical', [{ folder: 'old-folder', listing_id: '123', status: 'Published' }], f.cwd);
    const migrated = await migrateListingSheet('etsy-physical', f.cwd);
    const id = migrated?.rows[0].local_listing_id;
    assert.equal(typeof id, 'string');
    assert.equal((await migrateListingSheet('etsy-physical', f.cwd))?.rows[0].local_listing_id, id);
    const backup = path.join(f.cwd, '.workspace-data', 'listings', 'etsy-physical.json.pre-migration.json');
    assert.equal(JSON.parse(await fs.readFile(backup, 'utf8')).rows[0].local_listing_id, undefined);
    const records = await listListingRecords(f.cwd);
    assert.deepEqual(records.map(record => [record.id, record.channel, record.remoteListingId]), [[id, 'etsy', '123']]);
  } finally { await f.cleanup(); }
});

test('saves artwork, template images and generated gallery to disk and reloads them', async () => {
  const f = await fixture();
  try {
    const saved = await saveProduct(f.product, f.cwd);
    assert.equal(saved.revision, 1);
    assert.match(saved.designDataUrl!, /^\/workspace-products\//);
    assert.equal(saved.generated[0].dataUrl, saved.designDataUrl);
    assert.deepEqual(await readProduct(saved.id, f.cwd), saved);
    assert.deepEqual(await listProducts(f.cwd), [saved]);
    assert.equal((await fs.readFile(path.join(f.cwd, 'public', saved.designDataUrl!))).length > 0, true);
    const duplicate = await saveProduct({ ...saved, id: randomUUID(), revision: 0 }, f.cwd);
    assert.notEqual(duplicate.designDataUrl, saved.designDataUrl);
    assert.equal((await listProducts(f.cwd)).length, 2);
  } finally { await f.cleanup(); }
});

test('rejects concurrent stale edits while keeping the successful save intact', async () => {
  const f = await fixture();
  try {
    const saved = await saveProduct(f.product, f.cwd);
    const results = await Promise.allSettled([
      saveProduct({ ...saved, name: 'First edit' }, f.cwd),
      saveProduct({ ...saved, name: 'Stale edit' }, f.cwd),
    ]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    const failed = results.find(r => r.status === 'rejected') as PromiseRejectedResult;
    assert.equal(failed.reason.status, 409);
    assert.equal((await readProduct(saved.id, f.cwd)).name, 'First edit');
  } finally { await f.cleanup(); }
});

test('rejects path traversal, external assets, invalid print areas and non-images', async () => {
  const f = await fixture();
  try {
    await assert.rejects(saveProduct({ ...f.product, id: '../escape' }, f.cwd), ProductStoreError);
    await assert.rejects(saveProduct({ ...f.product, designDataUrl: 'https://example.com/image.png' }, f.cwd), /PNG/);
    await assert.rejects(saveProduct({ ...f.product, designDataUrl: 'data:image/png;base64,aGVsbG8=' }, f.cwd), /decoded/);
    const invalid = structuredClone(f.product);
    invalid.preset.frames[0].placement.width = 90;
    await assert.rejects(saveProduct(invalid, f.cwd), /exceeds/);
    assert.equal((await listProducts(f.cwd)).length, 0);
  } finally { await f.cleanup(); }
});

test('persists artwork positioning separately from the print region and validates scale', async () => {
  const f = await fixture();
  try {
    f.product.preset.frames[0].placement.artwork = { x: 76, y: 53, scale: 60 };
    const saved = await saveProduct(f.product, f.cwd);
    const restored = await readProduct(saved.id, f.cwd);
    assert.deepEqual(restored.preset.frames[0].placement.artwork, { x: 76, y: 53, scale: 60 });
    assert.equal(restored.preset.frames[0].placement.x, 30);
    assert.equal(restored.preset.frames[0].placement.width, 30);
    restored.preset.frames[0].placement.artwork!.scale = 1000;
    await assert.rejects(saveProduct(restored, f.cwd), /artwork placement/);
  } finally { await f.cleanup(); }
});

test('listing handoff is idempotent and preserves listing IDs, copy and pricing', async () => {
  const f = await fixture();
  try {
    const product = await saveProduct(f.product, f.cwd);
    const rows = mergeProductIntoListing([{ status: '', title: '', price: '25' }], product);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].price, '25');
    const manual = [{ ...rows[0], title: 'My edited title', description: 'My copy', listing_id: 'remote-123', status: 'Published' }];
    const reimported = mergeProductIntoListing(manual, { ...product, revision: 2 });
    assert.equal(reimported.length, 1);
    assert.equal(reimported[0].title, 'My edited title');
    assert.equal(reimported[0].listing_id, 'remote-123');
    assert.equal(reimported[0].status, 'Published');
    assert.equal((reimported[0] as Record<string, unknown>).workspace_product_revision, 2);
    assert.throws(() => mergeProductIntoListing([], { ...product, generated: [] }), /Generate/);
    assert.throws(() => mergeProductIntoListing([], { ...product, generated: Array(11).fill(product.generated[0]) }), /10/);
  } finally { await f.cleanup(); }
});


test('saves a multi-megabyte PNG without overflowing the image parser and rejects corrupt encoding', async () => {
  const f = await fixture();
  try {
    const bytes = await sharp(randomBytes(1400 * 1400 * 3), { raw: { width: 1400, height: 1400, channels: 3 } }).png().toBuffer();
    assert.ok(bytes.length > 4 * 1024 * 1024);
    f.product.designDataUrl = `data:image/png;base64,${bytes.toString('base64')}`;
    const saved = await saveProduct(f.product, f.cwd);
    assert.deepEqual(await fs.readFile(path.join(f.cwd, 'public', saved.designDataUrl!)), bytes);
    const reloaded = await saveProduct({ ...saved, name: 'Large PNG reloaded' }, f.cwd);
    assert.equal(reloaded.revision, 2);
    await assert.rejects(saveProduct({ ...reloaded, designDataUrl: `${f.product.designDataUrl}!` }, f.cwd), /encoding/);
    await assert.rejects(saveProduct({ ...reloaded, designDataUrl: 'data:image/png;base64,aGVsbG8===' }, f.cwd), /encoding/);
    assert.equal((await readProduct(saved.id, f.cwd)).revision, 2);
  } finally { await f.cleanup(); }
});

test('missing saved image gives an actionable error and preserves the product', async () => {
  const f = await fixture();
  try {
    const saved = await saveProduct(f.product, f.cwd);
    await fs.unlink(path.join(f.cwd, 'public', saved.designDataUrl!));
    await assert.rejects(saveProduct(saved, f.cwd), /source image is missing/);
    assert.equal((await readProduct(saved.id, f.cwd)).revision, 1);
  } finally { await f.cleanup(); }
});


test('exports a ZIP with saved image bytes and rejects assets outside the product', async () => {
  const f = await fixture();
  try {
    const saved = await saveProduct(f.product, f.cwd);
    const archive = await productArchive(saved.id, f.cwd);
    const zip = await JSZip.loadAsync(archive.bytes);
    assert.deepEqual(Object.keys(zip.files), ['01-front.png']);
    assert.deepEqual(await zip.file('01-front.png')!.async('nodebuffer'), await fs.readFile(path.join(f.cwd, 'public', saved.generated[0].dataUrl)));
    saved.generated[0].dataUrl = '/../../secret.png';
    await fs.writeFile(path.join(f.cwd, '.workspace-data', 'products', `${saved.id}.json`), JSON.stringify(saved));
    await assert.rejects(productArchive(saved.id, f.cwd), /Invalid saved/);
  } finally { await f.cleanup(); }
});


test('persists placement lock and fill mode without invalidating rendered pixels for lock changes', async () => {
  const f = await fixture();
  try {
    const before = productInputSignature(f.product);
    f.product.preset.frames[0].placement.locked = true;
    assert.equal(productInputSignature(f.product), before);
    f.product.preset.frames[0].placement.artwork = { x: 50, y: 50, scale: 100, fit: 'cover' };
    assert.notEqual(productInputSignature(f.product), before);
    const saved = await saveProduct(f.product, f.cwd);
    assert.equal(saved.preset.frames[0].placement.locked, true);
    assert.equal(saved.preset.frames[0].placement.artwork!.fit, 'cover');
    const invalid = structuredClone(saved);
    (invalid.preset.frames[0].placement.artwork as Record<string, unknown>).fit = 'stretch';
    await assert.rejects(saveProduct(invalid, f.cwd), /artwork fit/);
  } finally { await f.cleanup(); }
});

test('new Workspace listing receives Etsy preset and reimport preserves edits', async () => {
  const f = await fixture();
  try {
    const product = await saveProduct(f.product, f.cwd);
    const preset = {
      id: 'shirt', name: 'Shirt', price: '29.00', enable_pod: true,
      pod_blueprint_id: 706, pod_print_provider_id: 39,
      ai_title_rules: 'Describe the visible design',
      variations: { properties: [], combinations: [{ id: 's', isEnabled: true }], priceOnProperty: [], quantityOnProperty: [], skuOnProperty: [] },
    };
    const [draft] = mergeProductIntoListing([], product, preset);
    assert.equal(draft.title, '');
    assert.equal(draft.price, '29.00');
    assert.equal(draft.enable_pod, true);
    assert.equal(draft.pod_blueprint_id, 706);
    assert.equal(draft.listing_preset_id, 'shirt');
    assert.deepEqual(draft.variations, preset.variations);
    const [updated] = mergeProductIntoListing([{ ...draft, title: 'Edited title', price: '32.00' }], { ...product, revision: 2 }, preset);
    assert.equal(updated.title, 'Edited title');
    assert.equal(updated.price, '32.00');
  } finally { await f.cleanup(); }
});

test('keeps front and back artwork distinct and preserves ordered static listing media', async () => {
  const f = await fixture();
  try {
    const front = f.product.designDataUrl!;
    const back = `data:image/png;base64,${(await sharp({ create: { width: 16, height: 16, channels: 4, background: '#112233' } }).png().toBuffer()).toString('base64')}`;
    f.product.artworks = { front, back };
    f.product.preset.frames.push({ ...structuredClone(f.product.preset.frames[0]), id: 'back', name: 'Back', role: 'Back' });
    f.product.generated.push({ id: 'back', name: 'back.png', dataUrl: back });
    const video = `data:video/mp4;base64,${Buffer.from('000000186674797069736f6d00000000', 'hex').toString('base64')}`;
    f.product.gallerySlots = [
      { id: 'front-view', kind: 'mockup', label: 'Front shirt', frameId: 'front' },
      { id: 'size-chart', kind: 'image', label: 'size-chart.png', assetUrl: front },
      { id: 'clip', kind: 'video', label: 'turntable.mp4', assetUrl: video },
      { id: 'back-view', kind: 'mockup', label: 'Back shirt', frameId: 'back' },
    ];
    const saved = await saveProduct(f.product, f.cwd);
    assert.notEqual(artworkForFrame(saved, 'Front'), artworkForFrame(saved, 'Back'));
    assert.deepEqual(galleryItems(saved).map(item => item.id), ['front-view', 'size-chart', 'clip', 'back-view']);
    const row = mergeProductIntoListing([], saved)[0] as Record<string, string>;
    assert.equal(row.images.split(',').length, 3);
    assert.equal(row.workspace_back_artwork, saved.artworks!.back);
    const archive = await productArchive(saved.id, f.cwd);
    const zip = await JSZip.loadAsync(archive.bytes);
    assert.deepEqual(Object.keys(zip.files), ['01-Front-shirt.png', '02-size-chart.png', '03-turntable.mp4', '04-Back-shirt.png']);
    const regenerated = await saveProduct({ ...saved, generated: [{ ...saved.generated[0], dataUrl: back }, saved.generated[1]] }, f.cwd);
    assert.deepEqual(regenerated.gallerySlots, saved.gallerySlots);
    assert.deepEqual(galleryItems(regenerated).map(item => item.id), ['front-view', 'size-chart', 'clip', 'back-view']);
  } finally { await f.cleanup(); }
});

test('uses the front artwork layer when legacy design and front layer disagree', async () => {
  const f = await fixture();
  try {
    const front = `data:image/png;base64,${(await sharp({ create: { width: 16, height: 16, channels: 4, background: '#ff2200' } }).png().toBuffer()).toString('base64')}`;
    f.product.artworks = { front };
    const saved = await saveProduct(f.product, f.cwd);
    assert.equal(saved.designDataUrl, saved.artworks?.front);
    assert.equal(artworkForFrame(saved, 'Front'), saved.designDataUrl);
    assert.deepEqual(await readProduct(saved.id, f.cwd), saved);
  } finally { await f.cleanup(); }
});

test('keeps design and mockup source links on saved drafts', async () => {
  const f = await fixture();
  try {
    f.product.origin = { designName: 'Original artwork', designKind: 'design-stage', mockupSource: 'user', mockupPresetId: 'tee', sourceAssetUrl: '/workspace-assets/etsy/4518818715/123e4567-e89b-42d3-a456-426614174000/01.jpg' };
    const saved = await saveProduct(f.product, f.cwd);
    assert.deepEqual((await readProduct(saved.id, f.cwd)).origin, f.product.origin);
    const renamed = await saveProduct({ ...saved, name: 'Renamed draft' }, f.cwd);
    assert.deepEqual(renamed.origin, f.product.origin);
  } finally { await f.cleanup(); }
});

test('deletes one local draft and its owned media with revision protection', async () => {
  const f = await fixture();
  try {
    const saved = await saveProduct(f.product, f.cwd);
    const other = await saveProduct({ ...f.product, id: randomUUID(), revision: 0 }, f.cwd);
    await assert.rejects(deleteProduct(saved.id, saved.revision - 1, f.cwd), /changed/);
    await assert.rejects(deleteProduct('../escape', saved.revision, f.cwd), /Invalid product ID/);
    await deleteProduct(saved.id, saved.revision, f.cwd);
    await assert.rejects(readProduct(saved.id, f.cwd), /not found/);
    await assert.rejects(fs.access(path.join(f.cwd, 'public', 'workspace-products', saved.id)));
    assert.equal((await readProduct(other.id, f.cwd)).id, other.id);
  } finally { await f.cleanup(); }
});
