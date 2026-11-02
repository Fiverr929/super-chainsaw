import fs from './workspaceFs.ts';
import path from 'node:path';
import { isEtsyListingImageUrl } from './etsyListingImage.ts';
import { listListingAssets, saveListingAssets, type ListingDetails } from './workspaceAssets.ts';

export function normalizeEtsyListingUrl(input: string) {
  // Chat messages may contain a Markdown link, escaped ampersands or tracking parameters.
  const candidate = input.replace(/\\&/g, '&').match(/https:\/\/[^\s<>"\]\)]+/i)?.[0];
  if (!candidate) throw new Error('Enter a valid HTTPS Etsy listing URL.');
  const url = new URL(candidate);
  const match = url.pathname.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?listing\/(\d{8,15})(?:\/|$)/i);
  if (!['etsy.com', 'www.etsy.com'].includes(url.hostname) || url.port || url.username || url.password || !match) throw new Error('Enter a valid HTTPS Etsy listing URL.');
  return { id: match[1], url: `https://www.etsy.com/listing/${match[1]}` };
}

async function readBounded(response: Response, maxBytes: number) {
  if (!response.ok) throw new Error(`Etsy returned HTTP ${response.status}.`);
  if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('Etsy response exceeds the download size limit.');
  if (!response.body) throw new Error('Etsy returned an empty response.');
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error('Etsy response exceeds the download size limit.');
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally { await reader.cancel().catch(() => undefined); }
}

const strings = (value: unknown, count: number, length: number) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, count).map(item => item.slice(0, length)) : [];

export async function fetchEtsyListing(input: string, options: { cwd?: string; fetch?: typeof fetch; apiKey?: string; sharedSecret?: string; refresh?: boolean } = {}) {
  const source = normalizeEtsyListingUrl(input);
  const cwd = options.cwd ?? process.cwd();
  const existing = (await listListingAssets(cwd)).find(item => item.id === source.id);
  if (!options.refresh && existing?.details && existing.images.length) return existing;
  try {
    const apiKey = options.apiKey ?? process.env.ETSY_API_KEY;
    const secret = options.sharedSecret ?? process.env.ETSY_SHARED_SECRET;
    if (!apiKey || !secret) throw new Error('Etsy API credentials are missing in the workstation configuration.');
    const request = options.fetch ?? fetch;
    const signal = AbortSignal.timeout(60000);
    const response = await request(`https://api.etsy.com/v3/application/listings/${source.id}?includes=Images`, {
      headers: { 'x-api-key': `${apiKey}:${secret}` }, redirect: 'error', signal,
    });
    const listing = JSON.parse((await readBounded(response, 2 * 1024 * 1024)).toString('utf8'));
    if (String(listing.listing_id) !== source.id || typeof listing.title !== 'string') throw new Error('Etsy returned an invalid listing.');
    const price = listing.price;
    const details: ListingDetails = {
      description: typeof listing.description === 'string' ? listing.description.slice(0, 20000) : '',
      tags: strings(listing.tags, 13, 100), materials: strings(listing.materials, 20, 100),
      fetchedAt: new Date().toISOString(),
      ...(Number.isFinite(listing.num_favorers) ? { numFavorers: listing.num_favorers } : {}),
      ...(Number.isFinite(listing.original_creation_timestamp) ? { originalCreationTimestamp: listing.original_creation_timestamp } : {}),
      ...(Number.isFinite(listing.created_timestamp) ? { createdTimestamp: listing.created_timestamp } : {}),
      ...(Number.isFinite(listing.last_modified_timestamp) ? { lastModifiedTimestamp: listing.last_modified_timestamp } : {}),
      ...(typeof listing.state === 'string' ? { state: listing.state.slice(0, 30) } : {}),
      ...(typeof listing.taxonomy_id === 'number' ? { taxonomyId: listing.taxonomy_id } : {}),
      ...(price && Number.isFinite(price.amount) && Number.isFinite(price.divisor) && price.divisor > 0 && typeof price.currency_code === 'string' ? { price: { amount: price.amount, divisor: price.divisor, currency: price.currency_code.slice(0, 10) } } : {}),
    };
    const gallery: Array<{ rank: number; url_fullxfull: string }> = Array.isArray(listing.images) ? listing.images : [];
    const urls = [...new Set(gallery.filter(item => item && typeof item.url_fullxfull === 'string').sort((a, b) => a.rank - b.rank).map(item => item.url_fullxfull))].slice(0, 10);
    if (!urls.length) throw new Error('Etsy returned no listing images.');
    // Only fetch the Etsy image CDN, never an arbitrary URL supplied by the model or API.
    for (const url of urls) {
      const image = new URL(url);
      if (!isEtsyListingImageUrl(url) || image.hostname !== 'i.etsystatic.com' || image.port || image.username || image.password) throw new Error('Etsy returned an unsupported listing image URL.');
    }
    const images = [];
    for (const [index, url] of urls.entries()) {
      const image = await request(url, { redirect: 'error', signal });
      const bytes = await readBounded(image, 25 * 1024 * 1024);
      images.push({ position: index + 1, sourceUrl: url, file: new File([new Uint8Array(bytes)], `image-${index + 1}`, { type: image.headers.get('content-type') || 'application/octet-stream' }) });
    }
    return await saveListingAssets({ id: source.id, sourceUrl: source.url, title: listing.title, details, images }, cwd);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown fetch failure.';
    await fs.writeFile(path.join(cwd, 'latest_error.json'), JSON.stringify({ route: 'etsy.inspiration.fetch', listingId: source.id, timestamp: new Date().toISOString(), error: detail }, null, 2)).catch(() => undefined);
    throw new Error(`Could not fetch Etsy listing ${source.id}: ${detail} Open the listing with the Flat Earth extension and choose Download & import as a fallback.`);
  }
}
