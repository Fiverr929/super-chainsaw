import test from 'node:test';
import assert from 'node:assert/strict';
import { solidDesignAlpha } from '../src/lib/solidDesignCutout.ts';

const gray: [number, number, number] = [79, 77, 79];

test('flat shirt-color pixels and small noise become transparent', () => {
  assert.equal(solidDesignAlpha(gray, gray, 'soft'), 0);
  assert.equal(solidDesignAlpha([83, 80, 81], gray, 'soft'), 0);
});

test('dark colored ink, light lettering, and faded neutral ink survive', () => {
  assert.equal(solidDesignAlpha([54, 85, 59], gray, 'soft'), 255);
  assert.equal(solidDesignAlpha([220, 220, 220], gray, 'soft'), 255);
  assert.equal(solidDesignAlpha([115, 113, 115], gray, 'soft'), 255);
});

test('near-background edges remain partially transparent', () => {
  const alpha = solidDesignAlpha([93, 91, 93], gray, 'soft');
  assert.ok(alpha > 0 && alpha < 255);
  assert.ok(solidDesignAlpha([93, 91, 93], gray, 'strict') > alpha);
});
