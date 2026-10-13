import { listListingRecords } from '@/lib/workspaceListingStore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    return Response.json({ listings: await listListingRecords() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Listing record load failed:', error);
    return Response.json({ error: 'Could not load listing records.' }, { status: 500 });
  }
}
