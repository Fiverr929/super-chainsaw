import { randomUUID } from 'node:crypto';
import { ListingConflictError, readListingSheetSnapshot, writeListingSheet, type ListingSheet } from './workspaceListingStore.ts';
import { mergeProductIntoListing, type ListingPresetValues, type WorkspaceProduct } from './workspaceProducts.ts';
import { exportProductFolder, readProduct } from './workspaceProductStore.ts';

export class ListingOperationError extends Error { public status: number; constructor(message: string, status = 400) { super(message); this.status = status; } }
const SHEET: ListingSheet = 'etsy-physical';

export async function preparePhysicalEtsyDraft(productId: string, listingPreset: ListingPresetValues, expectedSheetRevision: string, cwd = process.cwd()) {
  if (!listingPreset || typeof listingPreset.id !== 'string' || typeof listingPreset.name !== 'string') throw new ListingOperationError('Select a valid Etsy listing preset.');
  let product: WorkspaceProduct;
  try { product = await readProduct(productId, cwd); }
  catch (error) { throw new ListingOperationError(error instanceof Error ? error.message : 'Product not found.', 404); }
  if (product.renderState !== 'ready') throw new ListingOperationError('Render and save the product mockups before preparing its listing.', 422);
  if (!product.designDataUrl || product.generated.length === 0) throw new ListingOperationError('The product is missing saved artwork or mockups.', 422);
  if (!expectedSheetRevision || expectedSheetRevision.length > 100) throw new ListingOperationError('Reload the worksheet before preparing the listing.', 409);
  await exportProductFolder(product.id, 'etsy', cwd);
  const current = await readListingSheetSnapshot(SHEET, cwd);
  if ((current?.revision ?? '0') !== expectedSheetRevision) throw new ListingConflictError(current?.revision ?? '0');
  const rows = mergeProductIntoListing(current?.rows ?? [], product, listingPreset) as Record<string, unknown>[];
  const index = rows.findIndex(row => row.workspace_product_id === product.id);
  if (index < 0) throw new ListingOperationError('The prepared listing row could not be found.', 500);
  const existingId = rows[index].local_listing_id;
  const localListingId = typeof existingId === 'string' && /^[0-9a-f-]{36}$/i.test(existingId) ? existingId : randomUUID();
  const row: Record<string, unknown> = { ...rows[index], local_listing_id: localListingId, status: rows[index].status || 'Draft' };
  rows[index] = row;
  try {
    const revision = await writeListingSheet(SHEET, rows, cwd, expectedSheetRevision);
    return { productId, productRevision: product.revision, sheet: SHEET, sheetRevision: revision, listingId: localListingId, rowIndex: index, row };
  } catch (error) {
    if (error instanceof ListingConflictError) throw error;
    throw new ListingOperationError(error instanceof Error ? error.message : 'Could not save Etsy worksheet.', 500);
  }
}

export async function updatePhysicalEtsyDraft(listingId: string, expectedSheetRevision: string, changes: Record<string, unknown>, cwd = process.cwd()) {
  if (!listingId || listingId.length > 100) throw new ListingOperationError('Invalid listing ID.');
  const allowed = new Set(['title', 'description', 'tags', 'alt_text', 'primary_color', 'secondary_color', 'materials', 'sleeve_length', 'neckline', 'clothing_style', 'occasion', 'celebration', 'subject', 'graphic']);
  const entries = Object.entries(changes);
  if (!entries.length || entries.some(([key, value]) => !allowed.has(key) || typeof value !== 'string')) throw new ListingOperationError('The listing revision contains unsupported fields.');
  const snapshot = await readListingSheetSnapshot(SHEET, cwd);
  if (!snapshot) throw new ListingOperationError('The Etsy physical worksheet is empty.', 404);
  if (snapshot.revision !== expectedSheetRevision) throw new ListingConflictError(snapshot.revision);
  const rowIndex = snapshot.rows.findIndex(row => row.local_listing_id === listingId);
  if (rowIndex < 0) throw new ListingOperationError('Listing draft not found.', 404);
  const row = { ...snapshot.rows[rowIndex], ...changes };
  if (typeof row.title === 'string' && row.title.length > 140) throw new ListingOperationError('Etsy titles must be 140 characters or fewer.');
  snapshot.rows[rowIndex] = row;
  const revision = await writeListingSheet(SHEET, snapshot.rows, cwd, expectedSheetRevision);
  return { listingId, sheet: SHEET, sheetRevision: revision, rowIndex, row };
}

export function validatePhysicalEtsyDraft(row: Record<string, unknown>) {
  const errors: string[] = []; const warnings: string[] = [];
  if (typeof row.title !== 'string' || !row.title.trim()) errors.push('Add a listing title.');
  else {
    if (row.title.length > 140) errors.push('Title exceeds Etsy’s 140-character limit.');
    const acronyms = [...row.title.matchAll(/\b[A-Z]{2,}\b/g)];
    if (acronyms.length > 3) errors.push('Title contains more than three fully capitalized terms.');
  }
  if (typeof row.description !== 'string' || !row.description.trim()) errors.push('Add a listing description.');
  if (typeof row.tags !== 'string' || !row.tags.trim()) warnings.push('Add relevant Etsy tags.');
  else {
    const tags = row.tags.split(',').map(tag => tag.trim()).filter(Boolean);
    if (tags.length > 13) errors.push('Etsy supports at most 13 tags.');
    if (tags.some(tag => tag.length > 20)) errors.push('Each Etsy tag must be 20 characters or fewer.');
  }
  if (typeof row.images !== 'string' || !row.images.trim()) errors.push('Add at least one listing image.');
  else if (row.images.split(',').filter(Boolean).length > 10) errors.push('Etsy supports at most 10 listing images.');
  for (const key of ['price', 'quantity', 'shipping_profile', 'readiness_state_id']) if (row[key] === undefined || row[key] === '') warnings.push(`Confirm ${key.replaceAll('_', ' ')} before publishing.`);
  return { valid: errors.length === 0, errors, warnings };
}

