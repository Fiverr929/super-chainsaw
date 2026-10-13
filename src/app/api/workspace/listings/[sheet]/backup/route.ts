import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { isListingSheet } from '@/lib/workspaceListingStore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ sheet: string }> }) {
  const { sheet } = await context.params;
  if (!isListingSheet(sheet)) return Response.json({ error: 'Invalid worksheet.' }, { status: 400 });
  try {
    const raw = await request.text();
    if (raw.length > 5_000_000) return Response.json({ error: 'Browser worksheet is too large to back up.' }, { status: 413 });
    const rows: unknown = JSON.parse(raw);
    if (!Array.isArray(rows)) return Response.json({ error: 'Invalid browser worksheet.' }, { status: 400 });
    const dir = path.join(process.cwd(), '.workspace-data', 'listings', 'browser-backups');
    await fs.mkdir(dir, { recursive: true });
    const name = `${sheet}-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}.json`;
    await fs.writeFile(path.join(dir, name), raw, { flag: 'wx' });
    return Response.json({ backedUp: true, name });
  } catch (error) {
    console.error('Browser worksheet backup failed:', error);
    return Response.json({ error: 'Could not back up browser worksheet.' }, { status: 500 });
  }
}
