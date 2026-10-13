import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { deleteListingAssetFolder, listListingAssets, saveListingAssets } from '../src/lib/workspaceAssets.ts';

test('Etsy images stay ordered and repeated imports preserve earlier files', async () => {
  const cwd = await fs.mkdtemp(path.join(process.cwd(), 'scratch', 'workstation-assets-'));
  try {
    const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#e11d48' } }).jpeg().toBuffer();
    const image = (position: number) => ({ position, sourceUrl: `https://i.etsystatic.com/123/il_fullxfull.${position}.jpg`, file: new File([new Uint8Array(bytes)], `${position}.jpg`, { type: 'image/jpeg' }) });
    const first = await saveListingAssets({ id: '4518818715', sourceUrl: 'https://www.etsy.com/listing/4518818715/example', title: 'Example', images: [image(2), image(1)] }, cwd);
    assert.deepEqual(first.images.map(item => item.position), [1, 2]);
    const second = await saveListingAssets({ id: '4518818715', sourceUrl: 'https://www.etsy.com/listing/4518818715/example', title: 'Example', images: [image(1)] }, cwd);
    assert.equal(second.imports.length, 2);
    const repeated = await saveListingAssets({ id: '4518818715', sourceUrl: 'https://www.etsy.com/listing/4518818715/example', title: 'Example', images: [image(1)] }, cwd);
    assert.equal(repeated.imports.length, 2);
    assert.equal(repeated.images[0].url, second.images[0].url);
    assert.notEqual(first.images[0].url, second.images[0].url);
    assert.equal((await listListingAssets(cwd))[0].images.length, 1);
    assert.deepEqual(await fs.readFile(path.join(cwd, 'public', first.images[0].url.slice(1))), bytes);
    const localized = await saveListingAssets({ id: '4503518677', sourceUrl: 'https://www.etsy.com/in-en/listing/4503518677/vintage-dr-jack-abbot-shirt', title: 'Localized listing', images: [image(1)] }, cwd);
    assert.equal(localized.id, '4503518677');
    await assert.rejects(saveListingAssets({ id: '4503518677', sourceUrl: 'https://www.etsy.com/in-en/listing/4503518677/vintage-dr-jack-abbot-shirt', title: 'Review photo', images: [{ ...image(1), sourceUrl: 'https://i.etsystatic.com/iap/review/iap_640x640.review.jpg' }] }, cwd), /Only Etsy listing images/);
    const folderDirectory = path.join(cwd, 'public', 'workspace-assets', 'etsy', '4503518677');
    const before = await fs.readdir(folderDirectory);
    await assert.rejects(saveListingAssets({ id: '4503518677', sourceUrl: 'https://www.etsy.com/in-en/listing/4503518677/vintage-dr-jack-abbot-shirt', title: 'Broken import', images: [image(2), { ...image(3), file: new File(['not an image'], 'bad.jpg', { type: 'image/jpeg' }) }] }, cwd));
    assert.deepEqual(await fs.readdir(folderDirectory), before);
  } finally { await fs.rm(cwd, { recursive: true, force: true }); }
});

test('bulk deletion removes listing files but protects assets linked to saved products', async () => {
  const cwd = await fs.mkdtemp(path.join(process.cwd(), 'scratch', 'workstation-assets-delete-'));
  try {
    const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#e11d48' } }).jpeg().toBuffer();
    const folder = await saveListingAssets({ id: '4503518677', sourceUrl: 'https://www.etsy.com/listing/4503518677/example', title: 'Example', images: [{ position: 1, sourceUrl: 'https://i.etsystatic.com/123/il_fullxfull.1.jpg', file: new File([new Uint8Array(bytes)], '1.jpg', { type: 'image/jpeg' }) }] }, cwd);
    const productDirectory = path.join(cwd, '.workspace-data', 'products');
    await fs.mkdir(productDirectory, { recursive: true });
    const productFile = path.join(productDirectory, `${randomUUID()}.json`);
    await fs.writeFile(productFile, JSON.stringify({ id: randomUUID(), updatedAt: new Date().toISOString(), origin: { sourceAssetUrl: folder.images[0].url } }));
    await assert.rejects(deleteListingAssetFolder(folder.id, cwd), /Used by 1 saved product/);
    assert.equal((await listListingAssets(cwd)).length, 1);
    await fs.unlink(productFile);
    await deleteListingAssetFolder(folder.id, cwd);
    assert.deepEqual(await listListingAssets(cwd), []);
    await assert.rejects(fs.access(path.join(cwd, 'public', folder.images[0].url.slice(1))), { code: 'ENOENT' });
    await assert.rejects(deleteListingAssetFolder(folder.id, cwd), /Asset folder not found/);
    await assert.rejects(deleteListingAssetFolder('../4503518677', cwd), /Invalid Etsy listing ID/);
  } finally { await fs.rm(cwd, { recursive: true, force: true }); }
});
