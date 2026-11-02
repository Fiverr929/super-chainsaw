import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanMaskPixels, DEFAULT_MASK_CLEANUP } from '../src/lib/mask-test/cleanup.ts';

function image(width: number, height: number, alpha: number) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < pixels.length; offset += 4) pixels.set([40, 80, 120, alpha], offset);
  return pixels;
}

test('cleanup removes small disconnected pieces and preserves retained soft alpha', () => {
  const original = image(10, 10, 255);
  const cutout = image(10, 10, 0);
  for (let y = 2; y < 7; y++) for (let x = 2; x < 7; x++) cutout[(y * 10 + x) * 4 + 3] = 180;
  cutout[0 * 4 + 3] = 255;
  const result = cleanMaskPixels(original, cutout, 10, 10, { componentPercent: 20, holePercent: 0 });
  assert.equal(result[3], 0);
  assert.equal(result[(3 * 10 + 3) * 4 + 3], 180);
  assert.equal(cutout[3], 255);
});

test('small holes recover original pixels while exterior stays transparent', () => {
  const original = image(10, 10, 200);
  const cutout = image(10, 10, 0);
  for (let y = 2; y < 8; y++) for (let x = 2; x < 8; x++) cutout[(y * 10 + x) * 4 + 3] = 200;
  const hole = (4 * 10 + 4) * 4;
  cutout.fill(0, hole, hole + 4);
  const result = cleanMaskPixels(original, cutout, 10, 10, { componentPercent: 0, holePercent: 5 });
  assert.deepEqual(result.slice(hole, hole + 4), original.slice(hole, hole + 4));
  assert.equal(result[3], 0);
  assert.equal(cutout[hole + 3], 0);
});

test('zero thresholds preserve every piece and hole', () => {
  const original = image(5, 5, 255);
  const cutout = image(5, 5, 0);
  cutout[3] = 50;
  for (const pixel of [6, 7, 8, 11, 13, 16, 17, 18]) cutout[pixel * 4 + 3] = 255;
  assert.deepEqual(cleanMaskPixels(original, cutout, 5, 5, { componentPercent: 0, holePercent: 0 }), cutout);
  assert.deepEqual(DEFAULT_MASK_CLEANUP, { componentPercent: 0, holePercent: 0 });
  assert.deepEqual(cleanMaskPixels(original, cutout, 5, 5, DEFAULT_MASK_CLEANUP), cutout);
});

test('diagonal artwork stays connected, and large holes stay open', () => {
  const original = image(5, 5, 255);
  const cutout = image(5, 5, 0);
  for (const pixel of [0, 6, 12, 18, 24]) cutout[pixel * 4 + 3] = 255;
  assert.deepEqual(cleanMaskPixels(original, cutout, 5, 5, { componentPercent: 100, holePercent: 0 }), cutout);
  const ring = image(5, 5, 255);
  for (let y = 1; y < 4; y++) for (let x = 1; x < 4; x++) ring[(y * 5 + x) * 4 + 3] = 0;
  assert.deepEqual(cleanMaskPixels(original, ring, 5, 5, { componentPercent: 0, holePercent: 5 }), ring);
});

test('empty masks remain empty and invalid settings are rejected', () => {
  const empty = image(2, 2, 0);
  assert.deepEqual(cleanMaskPixels(image(2, 2, 255), empty, 2, 2, DEFAULT_MASK_CLEANUP), empty);
  assert.throws(() => cleanMaskPixels(empty, empty, 2, 2, { componentPercent: NaN, holePercent: 5 }));
  assert.throws(() => cleanMaskPixels(empty, empty, 3, 2, DEFAULT_MASK_CLEANUP));
});
