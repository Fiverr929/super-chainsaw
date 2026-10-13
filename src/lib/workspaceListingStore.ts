import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export type ListingSheet = 'etsy-digital' | 'etsy-physical' | 'amazon';
const SHEETS: ListingSheet[] = ['etsy-digital', 'etsy-physical', 'amazon'];
const queues = new Map<string, Promise<unknown>>();

export class ListingConflictError extends Error {
  revision: string;
  constructor(revision: string) {
    super('This worksheet changed in another window. Review the other version before saving.');
    this.revision = revision;
  }
}

export function isListingSheet(value: string): value is ListingSheet {
  return SHEETS.includes(value as ListingSheet);
}

function sheetPath(sheet: ListingSheet, cwd: string) {
  return path.join(cwd, '.workspace-data', 'listings', `${sheet}.json`);
}

export async function readListingSheetSnapshot(sheet: ListingSheet, cwd = process.cwd()): Promise<{ rows: Record<string, unknown>[]; updatedAt: number; revision: string } | null> {
  try {
    const file = sheetPath(sheet, cwd);
    const parsed: unknown = JSON.parse(await fs.readFile(file, 'utf8'));
    const legacy = Array.isArray(parsed);
    const rows: unknown = legacy ? parsed : (parsed as { rows?: unknown })?.rows;
    if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) {
      throw new Error(`Saved ${sheet} worksheet is invalid.`);
    }
    const updatedAt = (await fs.stat(file)).mtimeMs;
    const revision = legacy ? `legacy-${updatedAt}` : (parsed as { revision?: unknown }).revision;
    if (typeof revision !== 'string') throw new Error(`Saved ${sheet} worksheet has no revision.`);
    return { rows: rows as Record<string, unknown>[], updatedAt, revision };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export async function readListingSheet(sheet: ListingSheet, cwd = process.cwd()): Promise<Record<string, unknown>[] | null> {
  return (await readListingSheetSnapshot(sheet, cwd))?.rows ?? null;
}

function isActiveListing(row: Record<string, unknown>): boolean {
  return ['folder', 'title', 'context', 'status', 'listing_id', 'sku', 'asin', 'workspace_product_id']
    .some(key => Boolean(row[key]));
}

export async function migrateListingSheet(sheet: ListingSheet, cwd = process.cwd()) {
  const snapshot = await readListingSheetSnapshot(sheet, cwd);
  if (!snapshot) return null;
  const rows = snapshot.rows.map(row => isActiveListing(row) && !row.local_listing_id
    ? { ...row, local_listing_id: randomUUID() } : row);
  if (rows.every((row, index) => row === snapshot.rows[index])) return snapshot;
  const backup = `${sheetPath(sheet, cwd)}.pre-migration.json`;
  try { await fs.writeFile(backup, await fs.readFile(sheetPath(sheet, cwd)), { flag: 'wx' }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
  try { await writeListingSheet(sheet, rows, cwd, snapshot.revision); }
  catch (error) { if (!(error instanceof ListingConflictError)) throw error; }
  return readListingSheetSnapshot(sheet, cwd);
}

export type ListingRecord = {
  id: string;
  sheet: ListingSheet;
  channel: 'etsy' | 'amazon';
  productId: string | null;
  productRevision: number | null;
  folder: string | null;
  status: string;
  remoteListingId: string | null;
  sku: string | null;
  asin: string | null;
};

export async function listListingRecords(cwd = process.cwd()): Promise<ListingRecord[]> {
  const records: ListingRecord[] = [];
  for (const sheet of SHEETS) {
    const snapshot = await migrateListingSheet(sheet, cwd);
    if (!snapshot) continue;
    for (const [index, row] of snapshot.rows.entries()) {
      if (!isActiveListing(row)) continue;
      const value = (key: string) => typeof row[key] === 'string' && row[key] ? row[key] as string : null;
      records.push({
        id: value('local_listing_id') || `legacy:${sheet}:${index}`,
        sheet, channel: sheet === 'amazon' ? 'amazon' : 'etsy',
        productId: value('workspace_product_id'),
        productRevision: typeof row.workspace_product_revision === 'number' ? row.workspace_product_revision : null,
        folder: value('folder'), status: value('status') || 'Draft',
        remoteListingId: value('listing_id'), sku: value('sku'), asin: value('asin'),
      });
    }
  }
  return records;
}

export async function writeListingSheet(sheet: ListingSheet, rows: unknown, cwd = process.cwd(), expectedRevision?: string): Promise<string> {
  if (!Array.isArray(rows) || rows.length > 10000 || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) {
    throw new Error('Invalid worksheet rows.');
  }
  const file = sheetPath(sheet, cwd);
  const lock = `${cwd}:${sheet}`;
  const previous = queues.get(lock) || Promise.resolve();
  const task = previous.catch(() => undefined).then(async () => {
    const current = await readListingSheetSnapshot(sheet, cwd);
    if (expectedRevision !== undefined && expectedRevision !== (current?.revision ?? '0')) {
      throw new ListingConflictError(current?.revision ?? '0');
    }
    await fs.mkdir(path.dirname(file), { recursive: true });
    const revision = randomUUID();
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporary, JSON.stringify({ revision, rows }), 'utf8');
      await fs.rename(temporary, file);
    } finally {
      await fs.rm(temporary, { force: true });
    }
    return revision;
  });
  queues.set(lock, task);
  try { return await task; }
  finally { if (queues.get(lock) === task) queues.delete(lock); }
}

export async function productListingReferences(productId: string, cwd = process.cwd()): Promise<ListingSheet[]> {
  const found: ListingSheet[] = [];
  for (const sheet of SHEETS) {
    const rows = await readListingSheet(sheet, cwd);
    if (rows?.some(row => row.workspace_product_id === productId)) found.push(sheet);
  }
  return found;
}
