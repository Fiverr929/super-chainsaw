import test from 'node:test';
import assert from 'node:assert/strict';
import { workflowItems, readyDesigns, selectedDesigns, type DesignBatchState } from '../src/lib/designBatch.ts';

type Item = DesignBatchState & { id: string };

test('switching workflows isolates both processing and mockup selection', () => {
  const photo: Item = { id: 'shirt', kind: 'photos', status: 'ready', output: 'solid-gray-png', selected: true };
  const cutout: Item = { id: 'logo', kind: 'designs', status: 'ready', output: 'transparent-png', selected: true };
  const batch = [photo, cutout];
  assert.deepEqual(workflowItems(batch, 'designs'), [cutout]);
  assert.deepEqual(selectedDesigns(batch, 'photos'), [photo]);
  assert.deepEqual(selectedDesigns(batch, 'designs'), [cutout]);
  assert.deepEqual(workflowItems(batch, 'photos'), [photo]);
  assert.equal(photo.output, 'solid-gray-png');
});

test('unreviewed, failed, waiting and running results cannot enter the handoff', () => {
  const batch: Item[] = [
    { id: 'approved', kind: 'photos', status: 'ready', output: 'good', selected: true },
    { id: 'unreviewed', kind: 'photos', status: 'ready', output: 'needs-review' },
    { id: 'retry-failed', kind: 'photos', status: 'error', output: 'previous-result', selected: true },
    { id: 'regenerating', kind: 'photos', status: 'working', output: 'previous-result', selected: true },
    { id: 'queued', kind: 'photos', status: 'waiting', selected: true },
    { id: 'empty', kind: 'photos', status: 'ready', selected: true },
  ];
  assert.deepEqual(readyDesigns(batch).map(item => item.id), ['approved', 'unreviewed']);
  assert.deepEqual(selectedDesigns(batch, 'photos').map(item => item.id), ['approved']);
});

test('removing one result does not move selection or include a different image', () => {
  const batch: Item[] = [
    { id: 'selected', kind: 'photos', status: 'ready', output: 'one', selected: true },
    { id: 'other', kind: 'photos', status: 'ready', output: 'two', selected: false },
  ];
  assert.deepEqual(selectedDesigns(batch.filter(item => item.id !== 'selected'), 'photos'), []);
});

test('legacy transparent results are not mislabeled as solid photo extractions', () => {
  const batch: Item[] = [
    { id: 'old-cutout', status: 'ready', output: 'alpha', alreadyTransparent: true, selected: true },
    { id: 'old-solid', status: 'ready', output: 'opaque', alreadyTransparent: false, selected: true },
    { id: 'explicit-photo', kind: 'photos', status: 'ready', output: 'opaque', alreadyTransparent: true },
  ];
  assert.deepEqual(workflowItems(batch, 'photos').map(item => item.id), ['old-solid', 'explicit-photo']);
  assert.deepEqual(selectedDesigns(batch, 'photos').map(item => item.id), ['old-solid']);
});
