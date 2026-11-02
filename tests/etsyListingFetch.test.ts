import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { fetchEtsyListing, normalizeEtsyListingUrl } from '../src/lib/etsyListingFetch.ts';
import { listListingAssets, saveListingAssets } from '../src/lib/workspaceAssets.ts';
import { createAgentSession, readAgentSession } from '../src/lib/agent/store.ts';
import { runAgentCommand } from '../src/lib/agent/runtime.ts';
import { AGENT_SYSTEM_PROMPT } from '../src/lib/agent/tools.ts';

const id = '4525717891';
const url = `https://www.etsy.com/listing/${id}/movie-tee`;
const imageUrl = (n: number) => `https://i.etsystatic.com/123/il_fullxfull.${n}.jpg`;
const listing = { listing_id: Number(id), title: 'Movie tee', description: 'A printed cotton tee.', tags: ['movie tee'], materials: ['cotton'], num_favorers: 191, original_creation_timestamp: 1720000000, created_timestamp: 1760000000, last_modified_timestamp: 1760000100, price: { amount: 3399, divisor: 100, currency_code: 'USD' }, images: [{ rank: 2, url_fullxfull: imageUrl(2) }, { rank: 1, url_fullxfull: imageUrl(1) }] };
async function fixture() {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'etsy-fetch-'));
  const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).jpeg().toBuffer();
  return { cwd, bytes, cleanup: () => fs.rm(cwd, { recursive: true, force: true }) };
}

test('normalizes Markdown, escaped tracking parameters and localized Etsy URLs; rejects other hosts', () => {
  assert.deepEqual(normalizeEtsyListingUrl(`[${url}?click_key=abc](${url}?click_key=abc\\&pro=1)`), { id, url: `https://www.etsy.com/listing/${id}` });
  assert.equal(normalizeEtsyListingUrl(`https://www.etsy.com/in-en/listing/${id}/tee`).id, id);
  for (const bad of [`https://etsy.com.evil.test/listing/${id}`, `https://www.etsy.com:444/listing/${id}`, `https://user@www.etsy.com/listing/${id}`, 'http://localhost/test', 'https://www.etsy.com/shop/test']) assert.throws(() => normalizeEtsyListingUrl(bad), /valid HTTPS Etsy/);
});

test('fetches details and ordered gallery images, saves them locally, and reuses the saved asset', async () => {
  const f = await fixture(); const requests: string[] = [];
  try {
    const mock: typeof fetch = async (input, init) => {
      requests.push(String(input)); assert.equal(init?.redirect, 'error');
      if (String(input).includes('api.etsy.com')) {
        assert.equal((init?.headers as Record<string, string>)['x-api-key'], 'test-key:test-secret');
        return Response.json(listing);
      }
      return new Response(new Uint8Array(f.bytes), { headers: { 'content-type': 'image/jpeg' } });
    };
    const first = await fetchEtsyListing(url, { cwd: f.cwd, apiKey: 'test-key', sharedSecret: 'test-secret', fetch: mock });
    assert.equal(first.details?.description, listing.description);
    assert.deepEqual(first.details?.tags, listing.tags);
    assert.deepEqual(first.details?.price, { amount: 3399, divisor: 100, currency: 'USD' });
    assert.equal(first.details?.numFavorers, 191);
    assert.equal(first.details?.originalCreationTimestamp, 1720000000);
    assert.equal(first.details?.createdTimestamp, 1760000000);
    assert.ok(first.details?.fetchedAt);
    assert.deepEqual(first.images.map(image => image.sourceUrl), [imageUrl(1), imageUrl(2)]);
    assert.deepEqual(await fs.readFile(path.join(f.cwd, 'public', first.images[0].url.slice(1))), f.bytes);
    const second = await fetchEtsyListing(url, { cwd: f.cwd, fetch: mock });
    assert.equal(requests.length, 3); assert.equal(second.imports.length, 1);
    const refreshed = await fetchEtsyListing(url, { cwd: f.cwd, apiKey: 'test-key', sharedSecret: 'test-secret', fetch: mock, refresh: true });
    assert.equal(requests.length, 6); assert.equal(refreshed.imports.length, 1);
    assert.equal((await listListingAssets(f.cwd)).length, 1);
    const raw = JSON.stringify(first); assert.ok(!raw.includes('test-secret')); assert.ok(!raw.includes('test-key'));
  } finally { await f.cleanup(); }
});

test('enriches an existing extension import without duplicating its images', async () => {
  const f = await fixture();
  try {
    const previous = await saveListingAssets({ id, sourceUrl: url, title: listing.title, images: [1, 2].map(position => ({ position, sourceUrl: imageUrl(position), file: new File([new Uint8Array(f.bytes)], 'tee.jpg') })) }, f.cwd);
    const result = await fetchEtsyListing(url, { cwd: f.cwd, apiKey: 'test', sharedSecret: 'secret', fetch: async input => String(input).includes('api.etsy.com') ? Response.json(listing) : new Response(new Uint8Array(f.bytes)) });
    assert.equal(result.imports.length, 1); assert.equal(result.images[0].url, previous.images[0].url); assert.equal(result.details?.description, listing.description);
  } finally { await f.cleanup(); }
});

test('blocked Etsy responses give an actionable error and leave no partial asset', async () => {
  const f = await fixture();
  try {
    await assert.rejects(fetchEtsyListing(url, { cwd: f.cwd, apiKey: 'test', sharedSecret: 'secret', fetch: async () => new Response('blocked', { status: 403 }) }), /HTTP 403.*Download & import/);
    assert.deepEqual(await listListingAssets(f.cwd), []);
    const log = await fs.readFile(path.join(f.cwd, 'latest_error.json'), 'utf8'); assert.ok(!log.includes('secret'));
  } finally { await f.cleanup(); }
});

test('rejects a mismatched listing, arbitrary image URL, redirects, oversized downloads and corrupt images', async () => {
  const f = await fixture();
  try {
    for (const data of [{ ...listing, listing_id: 123 }, { ...listing, images: [{ rank: 1, url_fullxfull: 'http://localhost/private' }] }]) {
      let calls = 0;
      await assert.rejects(fetchEtsyListing(url, { cwd: f.cwd, apiKey: 'test', sharedSecret: 'secret', fetch: async () => { calls++; return Response.json(data); } }), /invalid listing|unsupported listing image/);
      assert.equal(calls, 1);
    }
    for (const response of [new Response(null, { status: 302 }), new Response('x', { headers: { 'content-length': String(30 * 1024 * 1024) } }), new Response('not an image')]) {
      await assert.rejects(fetchEtsyListing(url, { cwd: f.cwd, apiKey: 'test', sharedSecret: 'secret', fetch: async input => String(input).includes('api.etsy.com') ? Response.json(listing) : response.clone() }));
      assert.deepEqual(await listListingAssets(f.cwd), []);
    }
  } finally { await f.cleanup(); }
});

test('agent dispatches Etsy fetch and continues with the saved details in its tool response', async () => {
  const f = await fixture(); const originalFetch = globalThis.fetch;
  const oldKey = process.env.ETSY_API_KEY; const oldSecret = process.env.ETSY_SHARED_SECRET;
  try {
    process.env.ETSY_API_KEY = 'test'; process.env.ETSY_SHARED_SECRET = 'secret';
    globalThis.fetch = async input => String(input).includes('api.etsy.com') ? Response.json(listing) : new Response(new Uint8Array(f.bytes));
    const session = await createAgentSession(f.cwd); let calls = 0;
    const result = await runAgentCommand({ sessionId: session.id, cwd: f.cwd, request: new Request('http://workstation.local/api/agent', { headers: { 'x-gemini-api-key': 'test-model-key' } }), command: { id: '10000000-0000-4000-8000-000000000001', kind: 'message.send', text: `Fetch ${url}` }, provider: { async generate(input) {
      calls++; assert.ok(input.tools.some(tool => tool.name === 'etsy.inspiration.fetch'));
      return calls === 1 ? { parts: [{ functionCall: { name: 'etsy.inspiration.fetch', id: 'fetch-one', args: { url } } }] } : { parts: [{ text: 'Imported the listing and its images.' }] };
    } } });
    assert.equal(calls, 2); assert.equal(result.actions[0].status, 'completed'); assert.equal(result.brief.sourceAssetId, id);
    const saved = await readAgentSession(session.id, f.cwd);
    const response = JSON.parse(saved.messages.find(item => item.toolName === 'etsy.inspiration.fetch')!.text);
    assert.equal(response.details.description, listing.description); assert.equal(response.images.length, 2);
    assert.match(AGENT_SYSTEM_PROMPT, /call etsy.inspiration.fetch/); assert.ok(!AGENT_SYSTEM_PROMPT.includes('cannot fetch or copy'));
  } finally {
    globalThis.fetch = originalFetch;
    if (oldKey === undefined) delete process.env.ETSY_API_KEY; else process.env.ETSY_API_KEY = oldKey;
    if (oldSecret === undefined) delete process.env.ETSY_SHARED_SECRET; else process.env.ETSY_SHARED_SECRET = oldSecret;
    await f.cleanup();
  }
});
