import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import JSZip from 'jszip';
import { galleryItems, type WorkspaceProduct, type MockupPreset, type GallerySlot } from './workspaceProducts.ts';
import { productListingReferences } from './workspaceListingStore.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ASSET = /^\/workspace-products\/([0-9a-f-]{36})\/([0-9a-f]{64}\.(png|jpg|webp))$/;
const VIDEO_ASSET = /^\/workspace-products\/([0-9a-f-]{36})\/([0-9a-f]{64}\.(mp4|webm))$/;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const queues = new Map<string, Promise<unknown>>();

export class ProductStoreError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export function assertProductId(id: string): void {
  if (!UUID.test(id)) throw new ProductStoreError('Invalid product ID.');
}

function productPath(id: string, cwd: string) {
  assertProductId(id);
  return path.join(cwd, '.workspace-data', 'products', `${id}.json`);
}

export async function readProduct(id: string, cwd = process.cwd()): Promise<WorkspaceProduct> {
  try { return JSON.parse(await fs.readFile(productPath(id, cwd), 'utf8')); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new ProductStoreError('Product not found.', 404);
    throw error;
  }
}

export async function listProducts(cwd = process.cwd()): Promise<WorkspaceProduct[]> {
  const dir = path.join(cwd, '.workspace-data', 'products');
  let names: string[];
  try { names = await fs.readdir(dir); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  const products = await Promise.all(names.filter(name => name.endsWith('.json')).map(name => readProduct(name.slice(0, -5), cwd)));
  return products.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function text(value: unknown, name: string, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new ProductStoreError(`Invalid ${name}.`);
  return value.trim();
}

function validatePreset(value: unknown): MockupPreset {
  if (!value || typeof value !== 'object') throw new ProductStoreError('Choose a product template.');
  const p = value as MockupPreset;
  if (!Array.isArray(p.frames) || p.frames.length > 20) throw new ProductStoreError('A template supports up to 20 frames.');
  const seen = new Set<string>();
  return {
    id: text(p.id, 'template ID'), name: text(p.name, 'template name'),
    productType: text(p.productType, 'product type'), color: text(p.color, 'color'),
    ...(p.brand ? { brand: text(p.brand, 'brand') } : {}),
    ...(p.model ? { model: text(p.model, 'model') } : {}),
    frames: p.frames.map(frame => {
      if (!frame || typeof frame !== 'object') throw new ProductStoreError('Invalid frame.');
      const id = text(frame.id, 'frame ID');
      if (seen.has(id)) throw new ProductStoreError('Duplicate frame ID.');
      seen.add(id);
      if (!['Front', 'Back', 'Side', 'Model', 'Detail'].includes(frame.role)) throw new ProductStoreError('Invalid frame role.');
      const placement = frame.placement;
      const limits = { x: [0, 100], y: [0, 100], width: [5, 100], height: [5, 100], opacity: [40, 100], margin: [0, 25], realism: [0, 40], softness: [0, 4] };
      for (const [key, [min, max]] of Object.entries(limits)) {
        const n = placement?.[key as keyof typeof placement];
        if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max) throw new ProductStoreError(`Invalid print placement: ${key}.`);
      }
      if (placement.x + placement.width > 100.001 || placement.y + placement.height > 100.001) throw new ProductStoreError('Print region exceeds the image.');
      if (placement.locked !== undefined && typeof placement.locked !== 'boolean') throw new ProductStoreError('Invalid placement lock.');
      if (placement.artwork) {
        if (placement.artwork.fit !== undefined && !['contain', 'cover'].includes(placement.artwork.fit)) throw new ProductStoreError('Invalid artwork fit.');
        for (const [key, min, max] of [['x', 0, 100], ['y', 0, 100], ['scale', 10, 100]] as const) {
          const n = placement.artwork[key];
          if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max) throw new ProductStoreError(`Invalid artwork placement: ${key}.`);
        }
        if (placement.artwork.rotation !== undefined && (typeof placement.artwork.rotation !== 'number' || !Number.isFinite(placement.artwork.rotation) || placement.artwork.rotation < -180 || placement.artwork.rotation > 180)) throw new ProductStoreError('Invalid artwork rotation.');
      }
      if (typeof frame.applyDesign !== 'boolean') throw new ProductStoreError('Invalid design setting.');
      return { id, name: text(frame.name, 'frame name'), role: frame.role, applyDesign: frame.applyDesign, placement: { ...placement }, imageDataUrl: frame.imageDataUrl || '' };
    }),
  };
}

export async function deleteProduct(id: string, revision: number, cwd = process.cwd()): Promise<void> {
  assertProductId(id);
  const lockKey = `${cwd}:${id}`;
  const previous = queues.get(lockKey) || Promise.resolve();
  const task = previous.catch(() => undefined).then(async () => {
    const current = await readProduct(id, cwd);
    if (current.revision !== revision) throw new ProductStoreError('This draft changed. Reopen it before deleting.', 409);
    const listings = await productListingReferences(id, cwd);
    if (listings.length) throw new ProductStoreError(`This product is used by ${listings.join(', ')} listings. Remove those worksheet listings before deleting its assets.`, 409);
    await fs.unlink(productPath(id, cwd));
    await fs.rm(path.join(cwd, 'public', 'workspace-products', id), { recursive: true, force: true });
    await fs.rm(path.join(cwd, 'public', 'listings-physical', `product-${id}`), { recursive: true, force: true });
    await fs.rm(path.join(cwd, 'public', 'listings-amazon', `product-${id}`), { recursive: true, force: true });
  });
  queues.set(lockKey, task);
  try { await task; }
  finally { if (queues.get(lockKey) === task) queues.delete(lockKey); }
}

async function persistVideo(value: unknown, id: string, cwd: string): Promise<string> {
  if (typeof value !== 'string') throw new ProductStoreError('Invalid video.');
  const existing = VIDEO_ASSET.exec(value);
  let bytes: Buffer;
  let extension: 'mp4' | 'webm';
  if (existing) {
    assertProductId(existing[1]);
    bytes = await fs.readFile(path.join(cwd, 'public', 'workspace-products', existing[1], existing[2]));
    extension = existing[3] as 'mp4' | 'webm';
  } else {
    const comma = value.indexOf(',');
    const header = comma >= 0 && comma < 40 ? value.slice(0, comma) : '';
    if (header !== 'data:video/mp4;base64' && header !== 'data:video/webm;base64') throw new ProductStoreError('Use an MP4 or WebM video.');
    const payload = value.slice(comma + 1).replace(/[\r\n]/g, '');
    if (!payload || payload.length > MAX_VIDEO_BYTES * 1.4 || /[^A-Za-z0-9+/=]/.test(payload)) throw new ProductStoreError('Invalid or oversized video.');
    bytes = Buffer.from(payload, 'base64');
    if (bytes.length > MAX_VIDEO_BYTES || bytes.toString('base64') !== payload) throw new ProductStoreError('Invalid or oversized video.');
    extension = header.includes('mp4') ? 'mp4' : 'webm';
    if (extension === 'mp4' ? bytes.toString('ascii', 4, 8) !== 'ftyp' : bytes.subarray(0, 4).toString('hex') !== '1a45dfa3') throw new ProductStoreError('Video file does not match its format.');
  }
  const name = `${createHash('sha256').update(bytes).digest('hex')}.${extension}`;
  const dir = path.join(cwd, 'public', 'workspace-products', id);
  await fs.mkdir(dir, { recursive: true });
  try { await fs.writeFile(path.join(dir, name), bytes, { flag: 'wx' }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
  return `/workspace-products/${id}/${name}`;
}

async function persistGallerySlots(slots: GallerySlot[] | undefined, preset: MockupPreset, id: string, cwd: string): Promise<GallerySlot[] | undefined> {
  if (slots === undefined) return undefined;
  if (!Array.isArray(slots) || slots.length > 20) throw new ProductStoreError('A gallery supports up to 20 slots.');
  const seen = new Set<string>();
  const result: GallerySlot[] = [];
  for (const slot of slots) {
    if (!slot || typeof slot !== 'object') throw new ProductStoreError('Invalid gallery slot.');
    const slotId = text(slot.id, 'gallery slot ID');
    if (seen.has(slotId)) throw new ProductStoreError('Duplicate gallery slot ID.');
    seen.add(slotId);
    const label = text(slot.label, 'gallery slot label');
    if (slot.kind === 'mockup') {
      const frameId = text(slot.frameId, 'gallery frame ID');
      if (!preset.frames.some(frame => frame.id === frameId)) throw new ProductStoreError('Gallery references a missing mockup view.');
      result.push({ id: slotId, kind: 'mockup', label, frameId });
    } else if (slot.kind === 'image' || slot.kind === 'video') {
      if (!slot.assetUrl) throw new ProductStoreError('Upload the static gallery asset first.');
      const assetUrl = slot.kind === 'image' ? await persistImage(slot.assetUrl, id, cwd) : await persistVideo(slot.assetUrl, id, cwd);
      result.push({ id: slotId, kind: slot.kind, label, assetUrl });
    } else throw new ProductStoreError('Invalid gallery media type.');
  }
  return result;
}

async function persistImage(value: unknown, id: string, cwd: string): Promise<string> {
  if (typeof value !== 'string') throw new ProductStoreError('Invalid image.');
  const existing = ASSET.exec(value);
  let bytes: Buffer;
  let extension: string;
  if (existing) {
    assertProductId(existing[1]);
    try { bytes = await fs.readFile(path.join(cwd, 'public', 'workspace-products', existing[1], existing[2])); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new ProductStoreError('A saved source image is missing. Re-upload the artwork or replace the blank photo in Product Creator.', 422);
      throw error;
    }
    extension = existing[3];
  } else {
    // Only match the short header. Repeating a capture across megabytes of
    // base64 can overflow V8's regexp stack, even for a valid 4 MB PNG.
    const comma = value.indexOf(',');
    const header = comma >= 0 && comma < 40 ? value.slice(0, comma) : '';
    if (!/^data:image\/(png|jpeg|webp);base64$/.test(header)) throw new ProductStoreError('Use a PNG, JPEG or WebP image.');
    const payload = value.slice(comma + 1);
    if (payload.length > MAX_IMAGE_BYTES * 1.4) throw new ProductStoreError('Each image must be under 25 MB.');
    const encoded = payload.replace(/[\r\n]/g, '');
    if (!encoded || /[^A-Za-z0-9+/=]/.test(encoded)) throw new ProductStoreError('Invalid image encoding. Upload the original image again.');
    bytes = Buffer.from(encoded, 'base64');
    if (bytes.length > MAX_IMAGE_BYTES) throw new ProductStoreError('Each image must be under 25 MB.');
    if (bytes.toString('base64') !== encoded) throw new ProductStoreError('Invalid image encoding. Upload the original image again.');
    let meta;
    try { meta = await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata(); }
    catch { throw new ProductStoreError('Image cannot be decoded or exceeds 40 megapixels.'); }
    if (!meta.format || !['png', 'jpeg', 'webp'].includes(meta.format)) throw new ProductStoreError('Unsupported image format.');
    extension = meta.format === 'jpeg' ? 'jpg' : meta.format;
  }
  const name = `${createHash('sha256').update(bytes).digest('hex')}.${extension}`;
  const dir = path.join(cwd, 'public', 'workspace-products', id);
  await fs.mkdir(dir, { recursive: true });
  // Immutable names keep saved listing images stable while products are edited.
  try { await fs.writeFile(path.join(dir, name), bytes, { flag: 'wx' }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
  return `/workspace-products/${id}/${name}`;
}

export async function saveProduct(input: unknown, cwd = process.cwd()): Promise<WorkspaceProduct> {
  if (!input || typeof input !== 'object') throw new ProductStoreError('Invalid product.');
  const value = input as WorkspaceProduct;
  assertProductId(value.id);
  const lockKey = `${cwd}:${value.id}`;
  const previous = queues.get(lockKey) || Promise.resolve();
  const task = previous.catch(() => undefined).then(async () => {
    let old: WorkspaceProduct | undefined;
    try { old = await readProduct(value.id, cwd); }
    catch (error) { if (!(error instanceof ProductStoreError) || error.status !== 404) throw error; }
    if (value.revision !== (old?.revision ?? 0)) throw new ProductStoreError('This product changed in another window. Reopen it before saving.', 409);
    const preset = validatePreset(value.preset);
    if (!Array.isArray(value.generated) || value.generated.length > 20) throw new ProductStoreError('Too many mockups.');
    if (!['draft', 'queued', 'rendering', 'ready', 'error'].includes(value.renderState)) throw new ProductStoreError('Invalid render state.');
    const name = text(value.name, 'product name');
    const frontInput = value.artworks?.front || value.designDataUrl;
    const designDataUrl = frontInput ? await persistImage(frontInput, value.id, cwd) : null;
    const artworks = value.artworks ? {
      ...(designDataUrl ? { front: designDataUrl } : {}),
      ...(value.artworks.back ? { back: await persistImage(value.artworks.back, value.id, cwd) } : {}),
    } : undefined;
    for (const frame of preset.frames) {
      if (frame.imageDataUrl) frame.imageDataUrl = await persistImage(frame.imageDataUrl, value.id, cwd);
    }
    const generated = [];
    for (const image of value.generated) {
      generated.push({ id: text(image.id, 'image ID'), name: text(image.name, 'image name'), dataUrl: await persistImage(image.dataUrl, value.id, cwd) });
    }
    const gallerySlots = await persistGallerySlots(value.gallerySlots, preset, value.id, cwd);
    const origin = value.origin ? {
      designName: text(value.origin.designName, 'source design name'),
      designKind: value.origin.designKind,
      mockupSource: value.origin.mockupSource,
      mockupPresetId: text(value.origin.mockupPresetId, 'source mockup ID'),
      ...(value.origin.sourceAssetUrl ? { sourceAssetUrl: value.origin.sourceAssetUrl } : {}),
    } : undefined;
    if (origin && (!['design-stage', 'upload'].includes(origin.designKind) || !['app', 'user'].includes(origin.mockupSource))) throw new ProductStoreError('Invalid product source.');
    if (origin?.sourceAssetUrl && !/^\/workspace-assets\/etsy\/\d{8,15}\/[0-9a-f-]{36}\/\d{2}\.(?:jpg|png|webp)$/.test(origin.sourceAssetUrl)) throw new ProductStoreError('Invalid source asset link.');
    if (value.renderState === 'ready' && (!designDataUrl || generated.length === 0)) throw new ProductStoreError('A ready product needs artwork and mockups.');
    const now = new Date().toISOString();
    const result: WorkspaceProduct = {
      id: value.id, revision: (old?.revision ?? 0) + 1, name,
      createdAt: old?.createdAt ?? now, updatedAt: now,
      designDataUrl, ...(artworks ? { artworks } : {}), preset, generated,
      ...(gallerySlots ? { gallerySlots } : {}), renderState: value.renderState,
      ...(origin ? { origin } : {}),
      ...(value.sourceImage ? { sourceImage: await persistImage(value.sourceImage, value.id, cwd) } : {}),
      ...(value.error ? { error: text(value.error, 'error message', 1000) } : {}),
    };
    const file = productPath(value.id, cwd);
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.${randomUUID()}.tmp`;
    try { await fs.writeFile(temporary, JSON.stringify(result), 'utf8'); await fs.rename(temporary, file); }
    finally { await fs.rm(temporary, { force: true }); }
    return result;
  });
  queues.set(lockKey, task);
  try { return await task; }
  finally { if (queues.get(lockKey) === task) queues.delete(lockKey); }
}


/** Export only persisted product-owned images, never arbitrary filesystem paths. */
export async function productArchive(id: string, cwd = process.cwd()) {
  const product = await readProduct(id, cwd);
  if (!galleryItems(product).length) throw new ProductStoreError('Add listing media before downloading.', 422);
  const zip = new JSZip();
  for (const [index, item] of galleryItems(product).entries()) {
    const match = (item.kind === 'video' ? VIDEO_ASSET : ASSET).exec(item.url);
    if (!match || match[1] !== id) throw new ProductStoreError('Invalid saved product media.', 422);
    const bytes = await fs.readFile(path.join(cwd, 'public', 'workspace-products', id, match[2]));
    const safeLabel = item.label.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80) || 'media';
    const label = /\.(png|jpg|webp|mp4|webm)$/i.test(safeLabel) ? safeLabel : `${safeLabel}.${match[3]}`;
    zip.file(`${String(index + 1).padStart(2, '0')}-${label}`, bytes);
  }
  return { name: product.name, bytes: await zip.generateAsync({ type: 'uint8array' }) };
}

/** Write a worksheet-importable snapshot without moving the product's source media. */
export async function exportProductFolder(id: string, channel: 'etsy' | 'amazon', cwd = process.cwd()) {
  const product = await readProduct(id, cwd);
  if (product.renderState !== 'ready') throw new ProductStoreError('Generate and save mockups before preparing a listing.', 422);
  const media = galleryItems(product);
  const images = media.filter(item => item.kind !== 'video');
  if (!images.length || images.length > 10) throw new ProductStoreError('A listing needs between 1 and 10 images.', 422);
  const root = path.join(cwd, 'public', channel === 'etsy' ? 'listings-physical' : 'listings-amazon');
  const folder = `product-${id}`;
  const target = path.join(root, folder);
  const stage = path.join(root, `.${folder}-${randomUUID()}.tmp`);
  const backup = path.join(root, `.${folder}-${randomUUID()}.bak`);
  await fs.mkdir(root, { recursive: true });
  await fs.mkdir(stage);
  let backedUp = false;
  try {
    try { await fs.cp(target, stage, { recursive: true }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    const exportedMedia: string[] = [];
    for (const [index, item] of media.entries()) {
      const match = (item.kind === 'video' ? VIDEO_ASSET : ASSET).exec(item.url);
      if (!match || match[1] !== id) throw new ProductStoreError('A saved listing image is missing or belongs to another product.', 422);
      const name = `${String(index + 1).padStart(2, '0')}-${match[2]}`;
      await fs.copyFile(path.join(cwd, 'public', 'workspace-products', id, match[2]), path.join(stage, name));
      exportedMedia.push(name);
    }
    const artwork = product.artworks?.front || product.designDataUrl;
    const artworkMatch = artwork && ASSET.exec(artwork);
    const exportedDigital: string[] = [];
    if (artworkMatch?.[1] === id) {
      const digital = path.join(stage, 'digital');
      await fs.mkdir(digital, { recursive: true });
      const name = `design-${artworkMatch[2]}`;
      await fs.copyFile(path.join(cwd, 'public', 'workspace-products', id, artworkMatch[2]), path.join(digital, name));
      exportedDigital.push(name);
    }
    await fs.writeFile(path.join(stage, 'manifest.json'), JSON.stringify({
      schemaVersion: 1, productId: id, productRevision: product.revision, channel,
      name: product.name, exportedAt: new Date().toISOString(), media: exportedMedia, digitalFiles: exportedDigital,
    }, null, 2));
    try { await fs.rename(target, backup); backedUp = true; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    try { await fs.rename(stage, target); }
    catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (!['EPERM', 'EACCES', 'EBUSY'].includes(code || '')) {
        if (backedUp) await fs.rename(backup, target);
        throw error;
      }
      // Windows may refuse a directory rename while Next.js watches public/.
      // Keep old content until new immutable media is copied and switch the
      // manifest last, so readers see either the old or complete new snapshot.
      await fs.mkdir(target, { recursive: true });
      for (const name of await fs.readdir(stage)) {
        if (name === 'manifest.json') continue;
        await fs.cp(path.join(stage, name), path.join(target, name), { recursive: true, force: true });
      }
      const manifest = await fs.readFile(path.join(stage, 'manifest.json'));
      const manifestTemp = path.join(target, `.manifest-${randomUUID()}.tmp`);
      try {
        await fs.writeFile(manifestTemp, manifest);
        await fs.rename(manifestTemp, path.join(target, 'manifest.json'));
      } catch (manifestError) {
        await fs.rm(manifestTemp, { force: true });
        const manifestCode = (manifestError as NodeJS.ErrnoException).code;
        if (!['EPERM', 'EACCES', 'EBUSY'].includes(manifestCode || '')) throw manifestError;
        await fs.writeFile(path.join(target, 'manifest.json'), manifest);
      }
      await fs.rm(stage, { recursive: true, force: true });
      backedUp = false;
    }
    if (backedUp) await fs.rm(backup, { recursive: true, force: true });
    return { folder, channel, productId: id, revision: product.revision };
  } finally {
    await fs.rm(stage, { recursive: true, force: true });
  }
}
