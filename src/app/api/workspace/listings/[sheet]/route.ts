import { isListingSheet, migrateListingSheet, writeListingSheet, ListingConflictError } from '@/lib/workspaceListingStore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Context = { params: Promise<{ sheet: string }> };

export async function GET(_request: Request, context: Context) {
  const { sheet } = await context.params;
  if (!isListingSheet(sheet)) return Response.json({ error: 'Invalid worksheet.' }, { status: 400 });
  try {
    const snapshot = await migrateListingSheet(sheet);
    return Response.json({ rows: snapshot?.rows ?? null, updatedAt: snapshot?.updatedAt ?? 0, revision: snapshot?.revision ?? '0' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Worksheet load failed:', error);
    return Response.json({ error: 'Could not load saved worksheet.' }, { status: 500 });
  }
}

export async function PUT(request: Request, context: Context) {
  const { sheet } = await context.params;
  if (!isListingSheet(sheet)) return Response.json({ error: 'Invalid worksheet.' }, { status: 400 });
  try {
    const raw = await request.text();
    if (raw.length > 5_000_000) return Response.json({ error: 'Worksheet is too large.' }, { status: 413 });
    const body = JSON.parse(raw) as { rows?: unknown; expectedRevision?: unknown };
    if (typeof body.expectedRevision !== 'string') return Response.json({ error: 'Missing worksheet revision.' }, { status: 400 });
    const revision = await writeListingSheet(sheet, body.rows, process.cwd(), body.expectedRevision);
    return Response.json({ saved: true, revision });
  } catch (error) {
    if (error instanceof ListingConflictError) return Response.json({ error: error.message, revision: error.revision }, { status: 409 });
    console.error('Worksheet save failed:', error);
    return Response.json({ error: 'Could not save worksheet.' }, { status: 400 });
  }
}
