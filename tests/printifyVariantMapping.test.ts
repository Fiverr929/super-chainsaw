import test from 'node:test';
import assert from 'node:assert/strict';
import { mapPrintifyVariants } from '../src/lib/printifyVariantMapping.ts';

const variants = [
  { id: 1, title: 'Black / M', options: { color: 'Black', size: 'M' } },
  { id: 2, title: 'Black / XL', options: { color: 'Black', size: 'XL' } },
  { id: 3, title: 'Heather Black / M', options: { color: 'Heather Black', size: 'M' } },
];

test('Printify mapping uses exact color/size pairs and ignores disabled combinations', () => {
  assert.deepEqual(mapPrintifyVariants(variants, [
    { id: 'medium', isEnabled: true, values: { Color: ' black ', Size: 'm' } },
    { id: 'large', isEnabled: false, values: { Color: 'Black', Size: 'XL' } },
  ]), [{ combinationId: 'medium', variantId: 1 }]);
  assert.deepEqual(mapPrintifyVariants(variants, [
    { id: 'medium', isEnabled: true, values: { Size: 'M' } },
  ], 'Black'), [{ combinationId: 'medium', variantId: 1 }]);
});

test('Printify rejects missing, fuzzy, and ambiguous variants instead of substituting', () => {
  assert.throws(() => mapPrintifyVariants(variants, []), /enabled/);
  assert.throws(() => mapPrintifyVariants(variants, [{ id: 'x', isEnabled: true, values: { Color: 'Black', Size: 'L' } }]), /No unique/);
  assert.throws(() => mapPrintifyVariants(variants, [{ id: 'x', isEnabled: true, values: { Color: 'Heather', Size: 'M' } }]), /No unique/);
  assert.throws(() => mapPrintifyVariants(variants, [{ id: 'x', isEnabled: true, values: { Size: 'M' } }]), /explicit/);
  assert.throws(() => mapPrintifyVariants([...variants, { ...variants[0], id: 4 }], [{ id: 'x', isEnabled: true, values: { Color: 'Black', Size: 'M' } }]), /No unique/);
});
