import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectCutoutPixels, outsideArtwork } from '../src/lib/cutoutQuality.ts';

function pixels(width: number, height: number) {
  const data = new Uint8ClampedArray(width * height * 4);
  const setAlpha = (x: number, y: number, alpha: number) => { data[(y * width + x) * 4 + 3] = alpha; };
  return { data, setAlpha };
}

test('finds a print body without letting isolated margin dust expand its bounds', () => {
  const { data, setAlpha } = pixels(100, 100);
  for (let y = 20; y <= 79; y++) for (let x = 20; x <= 79; x++) setAlpha(x, y, 255);
  setAlpha(50, 50, 0); // A distressed hole inside the print is not a margin artifact.
  setAlpha(0, 0, 120);
  setAlpha(99, 99, 255);
  const result = inspectCutoutPixels(data, 100, 100);
  assert.deepEqual(result.bounds, { left: 17, top: 17, right: 82, bottom: 82 });
  assert.equal(result.marginPixels, 2);
  assert.equal(result.strongMarginPixels, 1);
  assert.equal(result.canCleanMargins, true);
  assert.equal(outsideArtwork(50, 50, result.bounds!), false);
});

test('does not offer margin cleanup when the artwork touches the image edge', () => {
  const { data, setAlpha } = pixels(100, 100);
  for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) setAlpha(x, y, 255);
  assert.equal(inspectCutoutPixels(data, 100, 100).canCleanMargins, false);
});

test('does not infer an artwork area from only a few isolated pixels', () => {
  const { data, setAlpha } = pixels(100, 100);
  setAlpha(20, 20, 255);
  setAlpha(80, 80, 255);
  assert.equal(inspectCutoutPixels(data, 100, 100).bounds, null);
});
