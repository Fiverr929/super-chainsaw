import assert from 'node:assert/strict';
import test from 'node:test';
import { conceptDirection, parseDesignIdeas } from '../src/lib/designIdeation.ts';

function response(count = 6) {
  return {
    sourceBrief: { subject: 'Undead cinema', appeal: 'Retro horror nostalgia', audience: 'Horror fans', visualStructure: 'Portrait collage', avoidCopying: ['character likeness'] },
    concepts: Array.from({ length: count }, (_, index) => ({
      name: `Idea ${index + 1}`, buyer: 'Genre fan', hook: 'A fresh club identity', composition: 'Circular badge',
      style: 'Distressed screen print', palette: 'Bone and red', garmentColors: ['Black'], originality: 'New wording and layout',
      generationPrompt: 'Create an original undead cinema club badge.', riskNote: 'Do not use protected characters.',
    })),
  };
}

test('parseDesignIdeas validates and normalizes concept output', () => {
  const parsed = parseDesignIdeas(response());
  assert.equal(parsed.concepts.length, 6);
  assert.equal(parsed.concepts[0].id, 'concept-1');
  assert.deepEqual(parsed.concepts[0].garmentColors, ['Black']);
});

test('parseDesignIdeas rejects responses without enough useful concepts', () => {
  assert.throws(() => parseDesignIdeas(response(2)), /enough usable concepts/i);
});

test('conceptDirection carries strategy and user constraints into generation', () => {
  const concept = parseDesignIdeas(response()).concepts[0];
  const prompt = conceptDirection(concept, 'No text; four ink colors.');
  assert.match(prompt, /Circular badge/);
  assert.match(prompt, /No text; four ink colors/);
  assert.match(prompt, /Do not use protected characters/);
});
