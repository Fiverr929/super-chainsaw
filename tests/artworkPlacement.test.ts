import test from 'node:test';
import assert from 'node:assert/strict';
import { resizeArtwork, presetArtwork, artworkRect, fitArtwork, dragArtwork, normalizeArtwork, visiblePixelBounds } from '../src/lib/artworkPlacement.ts';

const region = { x: 30, y: 40, width: 200, height: 300 };
test('fit top, center and bottom preserve aspect ratio and align inside print region', () => {
  assert.deepEqual(artworkRect(400, 200, region, fitArtwork('top')), { x: 30, y: 40, width: 200, height: 100 });
  assert.deepEqual(artworkRect(400, 200, region, fitArtwork('center')), { x: 30, y: 140, width: 200, height: 100 });
  assert.deepEqual(artworkRect(400, 200, region, fitArtwork('bottom')), { x: 30, y: 240, width: 200, height: 100 });
  assert.deepEqual(artworkRect(100, 300, region, fitArtwork('right')), { x: 130, y: 40, width: 100, height: 300 });
  assert.deepEqual(artworkRect(100, 300, region, fitArtwork('left')), { x: 30, y: 40, width: 100, height: 300 });
});

test('visible pixel bounds ignore transparent canvas padding', () => {
  const pixels = new Uint8ClampedArray(10 * 8 * 4);
  for (let y = 2; y <= 6; y++) for (let x = 3; x <= 7; x++) pixels[(y * 10 + x) * 4 + 3] = 255;
  assert.deepEqual(visiblePixelBounds(pixels, 10, 8), { x: 3, y: 2, width: 5, height: 5 });
});

test('scale and drag use free space without changing print region or distorting artwork', () => {
  assert.deepEqual(artworkRect(400, 200, region, { x: 100, y: 0, scale: 50 }), { x: 130, y: 40, width: 100, height: 50 });
  assert.deepEqual(dragArtwork({ x: 50, y: 50, scale: 50 }, 50, -100, 100, 200), { x: 100, y: 0, scale: 50 });
  assert.deepEqual(dragArtwork({ x: 50, y: 50, scale: 100 }, 100, -100, 0, 0), { x: 50, y: 50, scale: 100 });
  assert.deepEqual(normalizeArtwork(), { x: 50, y: 50, scale: 100 });
  assert.deepEqual(normalizeArtwork({ x: -50, y: 140, scale: 1000 }), { x: 0, y: 100, scale: 100 });
  assert.deepEqual(normalizeArtwork({ x: 50, y: 50, scale: 100, rotation: 45 }), { x: 50, y: 50, scale: 100, rotation: 45 });
  assert.deepEqual(normalizeArtwork({ rotation: 999 }), { x: 50, y: 50, scale: 100, rotation: 180 });
});


test('top-center uses full size while pocket stays small and wearer-left', () => {
  const region = { x: 280, y: 230, width: 440, height: 500 };
  const top = artworkRect(1969, 2662, region, presetArtwork('top-center'));
  const pocket = artworkRect(1969, 2662, region, presetArtwork('pocket'));
  assert.equal(presetArtwork('top-center').scale, 100);
  assert.equal(top.y, region.y);
  assert.ok(Math.abs(top.x + top.width / 2 - (region.x + region.width / 2)) < 0.001);
  assert.ok(pocket.x + pocket.width / 2 > region.x + region.width / 2);
  assert.ok(pocket.width < top.width);
  for (const rect of [top, pocket]) {
    assert.ok(rect.x >= region.x && rect.y >= region.y);
    assert.ok(rect.x + rect.width <= region.x + region.width);
    assert.ok(rect.y + rect.height <= region.y + region.height);
    assert.ok(Math.abs(rect.width / rect.height - 1969 / 2662) < 0.001);
  }
  const changed = presetArtwork('pocket');
  changed.scale = 99;
  assert.equal(presetArtwork('pocket').scale, 35);
});


test('fill covers every edge while fit contains the whole design without distortion', () => {
  const region = { x: 10, y: 20, width: 300, height: 200 };
  const contain = artworkRect(100, 200, region, { x: 50, y: 50, scale: 100 });
  const cover = artworkRect(100, 200, region, { x: 50, y: 50, scale: 100, fit: 'cover' });
  assert.equal(contain.height, 200);
  assert.equal(cover.width, 300);
  assert.ok(cover.y <= region.y && cover.y + cover.height >= region.y + region.height);
  assert.equal(cover.width / cover.height, 0.5);
  const moved = dragArtwork({ x: 50, y: 50, scale: 100, fit: 'cover' }, 0, 20, 0, -400);
  assert.equal(moved.y, 45);
  assert.equal(moved.fit, 'cover');
});

test('edge and corner resize preserve aspect ratio and the opposite anchor', () => {
  const region = { x: 0, y: 0, width: 400, height: 400 };
  const start = { x: 50, y: 50, scale: 50 };
  const rect = artworkRect(100, 100, region, start);
  const resized = resizeArtwork(start, rect, region, 'se', 40, 40);
  const result = artworkRect(100, 100, region, resized);
  assert.equal(resized.scale, 60);
  assert.equal(result.x, rect.x);
  assert.equal(result.y, rect.y);
  assert.equal(result.width, result.height);
  const edge = artworkRect(100, 100, region, resizeArtwork(start, rect, region, 'w', -40, 0));
  assert.equal(edge.x + edge.width, rect.x + rect.width);
  assert.equal(edge.y + edge.height / 2, rect.y + rect.height / 2);
  assert.equal(resizeArtwork(start, rect, region, 'se', 10000, 10000).scale, 100);
});

