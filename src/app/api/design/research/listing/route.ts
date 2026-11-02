import { NextResponse } from 'next/server';
import { fetchEtsyListing, normalizeEtsyListingUrl } from '@/lib/etsyListingFetch';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const url = typeof body?.url === 'string' ? body.url : '';
    normalizeEtsyListingUrl(url);
    const folder = await fetchEtsyListing(url, { refresh: true });
    return NextResponse.json({ listing: {
      id: folder.id, url: folder.sourceUrl, title: folder.title,
      details: folder.details, images: folder.images,
    } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not import this Etsy listing.';
    return NextResponse.json({ error: message }, { status: /valid HTTPS Etsy listing URL/.test(message) ? 400 : 502 });
  }
}
