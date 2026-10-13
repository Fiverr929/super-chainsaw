import test from 'node:test';
import assert from 'node:assert/strict';
import { guideAlphaWithMask, isGrayscaleMask, maskOriginalPixels } from '../src/lib/hybridMask.ts';

test('mask removes uncertain shirt pixels but protects strong ink and existing holes', () => {
  const base = new Uint8ClampedArray([
    90, 90, 90, 255,
    240, 240, 240, 255,
    90, 90, 90, 0,
    90, 90, 90, 255,
    140, 140, 140, 255,
  ]);
  const original = new Uint8ClampedArray([
    90, 90, 90, 255,
    240, 240, 240, 255,
    90, 90, 90, 255,
    90, 90, 90, 255,
    140, 140, 140, 255,
  ]);
  const mask = new Uint8ClampedArray([
    0, 0, 0, 255,
    0, 0, 0, 255,
    0, 0, 0, 255,
    255, 255, 255, 255,
    0, 0, 0, 255,
  ]);
  const result = guideAlphaWithMask(base, original, mask, [80, 80, 80]);
  assert.deepEqual([result.pixels[3], result.pixels[7], result.pixels[11], result.pixels[15], result.pixels[19]], [0, 255, 0, 255, 255]);
  assert.equal(result.removed, 1);
});

test('rejects a colored model image in place of a grayscale mask', () => {
  assert.equal(isGrayscaleMask(new Uint8ClampedArray([20, 20, 20, 255, 255, 0, 0, 255])), false);
});

test('direct AI mask uses original colors and does not inherit a pixel cutout', () => {
  const original = new Uint8ClampedArray(100 * 4);
  const mask = new Uint8ClampedArray(100 * 4);
  for (let pixel = 0; pixel < 100; pixel++) {
    const index = pixel * 4;
    original.set([220, 30, 40, 255], index);
    mask.set(pixel < 50 ? [0, 0, 0, 255] : [255, 255, 255, 255], index);
  }
  const result = maskOriginalPixels(original, mask, 10, 10);
  assert.deepEqual(Array.from(result.pixels.slice(0, 4)), [220, 30, 40, 0]);
  assert.deepEqual(Array.from(result.pixels.slice(200, 204)), [220, 30, 40, 255]);
  assert.equal(result.removed, 50);
});

test('AI mask edges become clean while high contrast edge detail stays visible', () => {
  const original = new Uint8ClampedArray(100 * 4);
  const mask = new Uint8ClampedArray(100 * 4);
  for (let pixel = 0; pixel < 100; pixel++) {
    const index = pixel * 4;
    original.set([20, 20, 20, 255], index);
    mask.set([0, 0, 0, 255], index);
  }
  original.set([220, 30, 40, 255], 55 * 4);
  original.set([220, 30, 40, 255], 56 * 4);
  mask.set([255, 255, 255, 255], 55 * 4);
  mask.set([100, 100, 100, 255], 56 * 4);
  const result = maskOriginalPixels(original, mask, 10, 10);
  assert.equal(result.pixels[0 * 4 + 3], 0);
  assert.equal(result.pixels[55 * 4 + 3], 255);
  assert.ok(result.pixels[56 * 4 + 3] > 100);
});

test('AI mask keeps contrasting enclosed interior design instead of punching a hole', () => {
  const width = 10;
  const height = 10;
  const original = new Uint8ClampedArray(width * height * 4);
  const mask = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = (y * width + x) * 4;
    original.set(x === 4 && y === 4 ? [220, 120, 20, 255] : [80, 40, 20, 255], index);
    const keep = x >= 2 && x <= 7 && y >= 2 && y <= 7 && !(x === 4 && y === 4);
    mask.set([keep ? 255 : 0, keep ? 255 : 0, keep ? 255 : 0, 255], index);
  }
  const result = maskOriginalPixels(original, mask, width, height);
  assert.equal(result.pixels[(4 * width + 4) * 4 + 3], 255);
  assert.equal(result.pixels[3], 0);
});

test('AI mask clears enclosed letter holes that match the outer background', () => {
  const width = 10;
  const height = 10;
  const original = new Uint8ClampedArray(width * height * 4);
  const mask = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = (y * width + x) * 4;
    original.set([40, 40, 40, 255], index);
    const ink = x >= 2 && x <= 7 && y >= 2 && y <= 7 && !(x >= 4 && x <= 5 && y >= 4 && y <= 5);
    if (ink) original.set([220, 30, 40, 255], index);
    mask.set([ink ? 255 : 0, ink ? 255 : 0, ink ? 255 : 0, 255], index);
  }
  const result = maskOriginalPixels(original, mask, width, height);
  assert.equal(result.pixels[(4 * width + 4) * 4 + 3], 0);
  assert.equal(result.pixels[(3 * width + 3) * 4 + 3], 255);
});
