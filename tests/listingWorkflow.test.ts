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

const validAmazonRow = {
  title: 'Title', description: 'Description', sku: 'SKU', price: '1200', quantity: '10',
  brand: 'Yivez', outer_material: 'Cotton', bullet_points: 'Cotton T-shirt', hsn_code: '61091000',
  fit_type: 'Regular', style_name: 'Classic', item_type_name: 'T-Shirt', sleeve_type: 'Short Sleeve', sleeve_length: 'Short Sleeve',
  target_gender: 'unisex', age_range_description: 'adult', department_name: 'unisex-adult', care_instructions: 'Machine Wash',
  number_of_items: '1', item_weight: '150', manufacturer_address: 'Manufacturer address', packer_address: 'Packer address',
  item_dimension_length: '20', item_dimension_width: '15', item_dimension_height: '1', variation_theme: 'SIZE_NAME/COLOR_NAME', size_system: 'as5'
};

test('uses the current Etsy storage keys', () => {
  assert.equal(getEtsyGridStorageKey('digital'), 'workstation_v2_grid_data_etsy_digital');
  assert.equal(getEtsyGridStorageKey('physical'), 'workstation_v2_grid_data_etsy_physical');
});

test('allows Amazon publishing with a SKU template', () => {
  assert.equal(getAmazonPublishValidationError({ ...validAmazonRow, sku: undefined, sku_template: 'SKU-{folder}' }, 1), null);
  assert.match(getAmazonPublishValidationError({ title: 'Title', description: 'Description' }, 2) || '', /SKU Template/);
});

test('validates standalone Amazon offers and variation matrices', () => {
  assert.match(getAmazonPublishValidationError({ ...validAmazonRow, price: '', quantity: '' }, 1) || '', /price and quantity/);
  assert.equal(getAmazonPublishValidationError(validAmazonRow, 1), null);
  assert.match(getAmazonPublishValidationError({
    ...validAmazonRow, sku: undefined, sku_template: 'SKU-{color}-{size}',
    variations: { properties: [{ name: 'Color' }, { name: 'Size' }], combinations: [{ values: { Color: 'White' }, isEnabled: true, price: '1200', quantity: '10' }] }
  }, 2) || '', /both Color and Size/);
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

test('marks accepted Amazon submissions as pending until an ASIN is available', () => {
  assert.deepEqual(getAmazonPushResult({ success: true, pending: true, asin: null }), {
    status: 'Submitted', asin: '', message: 'Amazon accepted the submission and is still processing it.', isError: false
  });
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