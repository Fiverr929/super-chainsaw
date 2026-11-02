import assert from 'node:assert/strict';
import test from 'node:test';
import { parseResearchCase, parseResearchResult } from '../src/lib/designResearch.ts';

test('research case keeps dated observations and only Etsy source URLs', () => {
  const research = parseResearchCase({ keyword: 'concert tee', observations: [
    { url: 'https://www.etsy.com/listing/123', title: 'Retro music tee', observedAt: '2026-10-22', listedDate: '21 Oct 2026', favorites: '191', seenOnSoldPage: true, soldPageUrl: 'https://www.etsy.com/shop/Example/sold', visualNotes: 'arched text' },
    { url: 'https://example.com/fake', title: 'Other tee' },
  ] });
  assert.equal(research.observations[0].id, 'source-1');
  assert.equal(research.observations[0].observedAt, '2026-10-22');
  assert.equal(research.observations[0].soldPageUrl, 'https://www.etsy.com/shop/Example/sold');
  assert.equal(research.observations[1].url, '');
});

test('a URL without recorded evidence cannot produce an opportunity', () => {
  assert.throws(() => parseResearchCase({ keyword: 'concert tee', observations: [{ url: 'https://www.etsy.com/listing/123' }] }), /URL alone/i);
});

test('model opportunities must cite submitted source IDs', () => {
  const sourceAnalysis = { subject: 'The Beatles', visibleArtwork: 'Four portrait panels below a band wordmark', composition: 'A centered collage on the shirt', palette: 'Blue and magenta', buyerAppeal: 'Nostalgia', uncertainDetails: 'Small text is unreadable' };
  const opportunity = { name: 'Beatles club badge', sourceConnection: 'The Beatles and the four portrait panels', specificChange: 'Move to a circular badge', buyerReason: 'Fans may like a simpler format', evidenceIds: ['source-1', 'source-999'], uncertainty: 'No sales volume known', designDirection: 'Original Beatles fan badge with four abstract color panels.' };
  const result = parseResearchResult({ sourceAnalysis, opportunities: [opportunity, opportunity, opportunity] }, ['source-1']);
  assert.equal(result.sourceAnalysis.subject, 'The Beatles');
  assert.deepEqual(result.opportunities[0].evidenceIds, ['source-1']);
  assert.deepEqual(parseResearchResult({ sourceAnalysis, opportunities: [{ ...opportunity, evidenceIds: ['source-999'] }, opportunity, opportunity] }, ['source-1']).opportunities[0].evidenceIds, ['source-1']);
  assert.throws(() => parseResearchResult({ sourceAnalysis, opportunities: [{ ...opportunity, evidenceIds: ['source-999'] }, opportunity, opportunity] }, ['source-1', 'source-2']), /usable opportunities/i);
  assert.throws(() => parseResearchResult({ opportunities: [opportunity, opportunity, opportunity] }, ['source-1']), /describe the source artwork/i);
});
