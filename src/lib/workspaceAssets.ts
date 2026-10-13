import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { isEtsyListingImageUrl } from './etsyListingImage.ts';
import { listProducts } from './workspaceProductStore.ts';

export type ListingAsset = { position: number; url: string; sourceUrl: string };
export type ListingAssetFolder = { id: string; source: 'etsy'; sourceUrl: string; title: string; importedAt: string; images: ListingAsset[]; imports: { id: string; importedAt: string; images: ListingAsset[] }[] };
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

export class AssetStoreError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export async function deleteListingAssetFolder(id: string, cwd = process.cwd()): Promise<void> {
  if (!/^\d{8,15}$/.test(id)) throw new AssetStoreError('Invalid Etsy listing ID.');
  const metadataFile = path.join(cwd, '.workspace-data', 'assets', 'etsy', `${id}.json`);
  const mediaDirectory = path.join(cwd, 'public', 'workspace-assets', 'etsy', id);
  try { await fs.access(metadataFile); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new AssetStoreError('Asset folder not found.', 404);
    throw error;
  }
  const linked = (await listProducts(cwd)).filter(product => product.origin?.sourceAssetUrl?.startsWith(`/workspace-assets/etsy/${id}/`));
  if (linked.length) throw new AssetStoreError(`Used by ${linked.length} saved product${linked.length === 1 ? '' : 's'}. Remove those products before deleting this asset folder.`, 409);
  const pendingFile = `${metadataFile}.${randomUUID()}.deleting`;
  await fs.rename(metadataFile, pendingFile);
  try {
    await fs.rm(mediaDirectory, { recursive: true, force: true });
    await fs.unlink(pendingFile);
  } catch (error) {
    await fs.rename(pendingFile, metadataFile).catch(() => undefined);
    throw error;
  }
}

export async function listListingAssets(cwd = process.cwd()): Promise<ListingAssetFolder[]> {
  const dir = path.join(cwd, '.workspace-data', 'assets', 'etsy');
  let files: string[];
  try { files = await fs.readdir(dir); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const folders = await Promise.all(files.filter(name => /^\d+\.json$/.test(name)).map(async name => {
    const record = JSON.parse(await fs.readFile(path.join(dir, name), 'utf8')) as ListingAssetFolder;
    return record;
  }));
  return folders.sort((a, b) => b.importedAt.localeCompare(a.importedAt));
}

export async function saveListingAssets(input: { id: string; sourceUrl: string; title: string; images: { position: number; sourceUrl: string; file: File }[] }, cwd = process.cwd()): Promise<ListingAssetFolder> {
  if (!/^\d{8,15}$/.test(input.id)) throw new Error('Invalid Etsy listing ID.');
  const source = new URL(input.sourceUrl);
  const listingPath = new RegExp(`^/(?:[a-z]{2}(?:-[a-z]{2})?/)?listing/${input.id}(?:/|$)`, 'i');
  if (source.protocol !== 'https:' || !['www.etsy.com', 'etsy.com'].includes(source.hostname) || !listingPath.test(source.pathname)) throw new Error('Invalid Etsy listing URL.');
  if (!Array.isArray(input.images) || input.images.length < 1 || input.images.length > 10) throw new Error('Select 1 to 10 listing images.');
  const unique = new Set<number>();
  for (const item of input.images) {
    if (!Number.isInteger(item.position) || item.position < 1 || item.position > 10 || unique.has(item.position)) throw new Error('Invalid image order.');
    unique.add(item.position);
    if (!isEtsyListingImageUrl(item.sourceUrl)) throw new Error('Only Etsy listing images can be imported.');
    if (item.file.size < 1 || item.file.size > MAX_IMAGE_BYTES) throw new Error('An image is empty or larger than 25 MB.');
  }
  const metadataDirectory = path.join(cwd, '.workspace-data', 'assets', 'etsy');
  const metadataFile = path.join(metadataDirectory, `${input.id}.json`);
  let previous: ListingAssetFolder | null = null;
  try { previous = JSON.parse(await fs.readFile(metadataFile, 'utf8')) as ListingAssetFolder; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const selection = input.images.map(item => `${item.position}:${item.sourceUrl}`).sort();
  if (previous && JSON.stringify(previous.images.map(item => `${item.position}:${item.sourceUrl}`).sort()) === JSON.stringify(selection)) return previous;

  const importId = randomUUID();
  const importedAt = new Date().toISOString();
  const directory = path.join(cwd, 'public', 'workspace-assets', 'etsy', input.id, importId);
  const temporary = `${metadataFile}.${importId}.tmp`;
  const images: ListingAsset[] = [];
  try {
    await fs.mkdir(directory, { recursive: true });
    await fs.mkdir(metadataDirectory, { recursive: true });
    for (const item of input.images) {
      const bytes = Buffer.from(await item.file.arrayBuffer());
      const info = await sharp(bytes).metadata();
      if (!['jpeg', 'png', 'webp'].includes(info.format || '')) throw new Error('Use a JPEG, PNG, or WebP image.');
      const extension = info.format === 'jpeg' ? 'jpg' : info.format;
      const name = `${String(item.position).padStart(2, '0')}.${extension}`;
      await fs.writeFile(path.join(directory, name), bytes);
      images.push({ position: item.position, sourceUrl: item.sourceUrl, url: `/workspace-assets/etsy/${input.id}/${importId}/${name}` });
    }
    images.sort((a, b) => a.position - b.position);
    const imports = [...(previous?.imports || (previous ? [{ id: 'legacy', importedAt: previous.importedAt, images: previous.images }] : [])), { id: importId, importedAt, images }];
    const folder: ListingAssetFolder = { id: input.id, source: 'etsy', sourceUrl: source.toString(), title: input.title.trim().slice(0, 200) || `Etsy listing ${input.id}`, importedAt, images, imports };
    await fs.writeFile(temporary, JSON.stringify(folder, null, 2));
    await fs.rename(temporary, metadataFile);
    return folder;
  } catch (error) {
    await Promise.allSettled([fs.rm(directory, { recursive: true, force: true }), fs.rm(temporary, { force: true })]);
    throw error;
  }
}
