import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_QUALITY,
  finalGeneratedImage,
  imageQualityForModel,
} from '../src/lib/designExtraction.ts';

test('the extraction default uses a supported higher resolution', () => {
  assert.equal(DEFAULT_IMAGE_MODEL, 'gemini-3.1-flash-image');
  assert.equal(DEFAULT_IMAGE_QUALITY, '2K');
  assert.equal(imageQualityForModel(DEFAULT_IMAGE_MODEL), '2K');
  assert.equal(imageQualityForModel('gemini-3.1-flash-lite-image', '2K'), '1K');
  assert.equal(imageQualityForModel('gemini-3.1-flash-image', '4K'), '4K');
});

test('intermediate thought images cannot replace the final design', () => {
  const parts = [
    { thought: true, inlineData: { mimeType: 'image/png', data: 'intermediate' } },
    { text: 'done' },
    { inlineData: { mimeType: 'image/png', data: 'finished-design' } },
  ];
  assert.deepEqual(finalGeneratedImage(parts), { mimeType: 'image/png', data: 'finished-design' });
  assert.equal(finalGeneratedImage(parts.slice(0, 1)), undefined);
});
