import test from 'node:test';
import assert from 'node:assert/strict';
import { canSubmitAgentMessage, isAgentActive, summarizeToolResult } from '../src/lib/agent/ui.ts';

test('Enter submission follows the same running-state guard as the Send button', () => {
  assert.equal(canSubmitAgentMessage('another instruction', false, 'running'), false);
  assert.equal(canSubmitAgentMessage('another instruction', false, 'waiting-for-browser'), false);
  assert.equal(canSubmitAgentMessage('another instruction', false, 'waiting-for-user'), true);
  assert.equal(canSubmitAgentMessage('  ', false, 'idle'), false);
  assert.equal(canSubmitAgentMessage('ready', true, 'idle'), false);
  assert.equal(isAgentActive('completed'), false);
});

test('large tool responses receive compact summaries without losing exact saved details', () => {
  const raw = JSON.stringify({ productCount: 13, products: [{ id: 'one' }], inspirationAssets: [{ id: 'two', details: { description: 'Long listing copy' } }], listings: [] });
  assert.equal(summarizeToolResult('workspace.inspect', raw), '13 saved products · 1 imported reference · 0 local listings');
  assert.equal(summarizeToolResult('etsy.inspiration.fetch', JSON.stringify({ title: 'Reference tee', images: [{ position: 1 }, { position: 2 }] })), 'Reference tee · 2 saved images');
  assert.equal(summarizeToolResult('presets.list', JSON.stringify({ mockupPresets: [1], listingPresets: [1, 2] })), '1 mockup presets · 2 listing presets');
});
