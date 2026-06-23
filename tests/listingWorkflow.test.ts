import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  buildGeneratedMetadataResponse,
  getAmazonPublishValidationError,
  getAmazonPushResult,
  getEtsyGridStorageKey,
  planFolderImport,
} from '../src/lib/listingWorkflow.ts';
import { resolvePublicAssetPath } from '../src/lib/serverPaths.ts';

test('uses the current Etsy storage keys', () => {
  assert.equal(getEtsyGridStorageKey('digital'), 'workstation_v2_grid_data_etsy_digital');
  assert.equal(getEtsyGridStorageKey('physical'), 'workstation_v2_grid_data_etsy_physical');
});

test('allows Amazon publishing with a SKU template', () => {
  assert.equal(getAmazonPublishValidationError({ title: 'Title', description: 'Description', sku_template: 'SKU-{folder}' }, 1), null);
  assert.match(getAmazonPublishValidationError({ title: 'Title', description: 'Description' }, 2) || '', /SKU Template/);
});

test('preserves every generated metadata field returned by the AI route', () => {
  const content = {
    title: 'Title', secondary_color: 'Blue', materials: 'Cotton', sleeve_length: 'Short sleeve',
    neckline: 'Crew neck', clothing_style: 'Casual', capacity: '11 oz', dishwasher_safe: 'true',
    microwave_safe: 'false', orientation: 'Vertical', framing: 'Unframed', aspect_ratio: '2:3',
  };
  const response = buildGeneratedMetadataResponse(content);
  for (const key of Object.keys(content)) assert.equal(response[key], content[key as keyof typeof content]);
});

test('marks partial Amazon pushes as errors without fabricating an ASIN', () => {
  assert.deepEqual(getAmazonPushResult({ success: true, partial: true, asin: null, details: 'child failed' }), {
    status: 'Partial Error', asin: '', message: 'child failed', isError: true,
  });
});

test('plans folder imports synchronously and records stable scan targets', () => {
  const result = planFolderImport([{ folder: 'existing' }, {}], [{ folder: 'first' }, { folder: 'second' }]);
  assert.equal(result.rows[1].folder, 'first');
  assert.equal(result.rows[2].folder, 'second');
  assert.deepEqual(result.scanTargets, [
    { rowIndex: 1, folderName: 'first' },
    { rowIndex: 2, folderName: 'second' },
  ]);
});

test('resolves only paths inside public assets', () => {
  const cwd = path.join('C:', 'workspace');
  assert.equal(resolvePublicAssetPath('/listings/item/image.png', cwd), path.join(cwd, 'public', 'listings', 'item', 'image.png'));
  assert.equal(resolvePublicAssetPath('../tokens.json', cwd), null);
  assert.equal(resolvePublicAssetPath('https://example.com/image.png', cwd), null);
});