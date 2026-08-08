import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

import { resolvePublicAssetPath } from './serverPaths';

type SupabaseStorageConfig = {
  url: string;
  serviceRoleKey: string;
  bucket: string;
  prefix: string;
};

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

type UploadCacheEntry = {
  bucket: string;
  objectPath: string;
  size: number;
  mtimeMs: number;
  publicUrl: string;
  transformVersion?: number;
};

type UploadCache = Record<string, UploadCacheEntry>;

const UPLOAD_CACHE_FILE = path.join(process.cwd(), 'supabase_upload_cache.json');
const AMAZON_IMAGE_TRANSFORM_VERSION = 1;

function getSupabaseStorageConfig(): SupabaseStorageConfig | null {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim();
  const prefix = process.env.SUPABASE_STORAGE_PREFIX?.trim() || 'amazon-listings';

  if (!url || !serviceRoleKey || !bucket) return null;

  return {
    url: url.replace(/\/+$/, ''),
    serviceRoleKey,
    bucket,
    prefix: prefix.replace(/^\/+|\/+$/g, ''),
  };
}

export function isSupabaseStorageConfigured(): boolean {
  return getSupabaseStorageConfig() !== null;
}

function encodeObjectPath(objectPath: string): string {
  return objectPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function sanitizePathSegment(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'asset';
}

function buildStorageObjectPath(fileUrl: string, namespace: string, targetExt: string): string {
  const cleanUrl = fileUrl.replace(/^[/\\]+/, '');
  const parsed = path.posix.parse(cleanUrl.replace(/\\/g, '/'));
  const folderPath = parsed.dir
    .split('/')
    .filter(Boolean)
    .map(sanitizePathSegment)
    .join('/');
  const fileName = sanitizePathSegment(parsed.name) + targetExt;
  const namespacedFolder = sanitizePathSegment(namespace);

  return [getSupabaseStorageConfig()?.prefix, namespacedFolder, folderPath, fileName]
    .filter(Boolean)
    .join('/');
}

function getFileFingerprint(localPath: string): { size: number; mtimeMs: number } {
  const stat = fs.statSync(localPath);
  return {
    size: stat.size,
    mtimeMs: Math.trunc(stat.mtimeMs),
  };
}

function readUploadCache(): UploadCache {
  try {
    if (!fs.existsSync(UPLOAD_CACHE_FILE)) return {};
    return JSON.parse(fs.readFileSync(UPLOAD_CACHE_FILE, 'utf-8')) as UploadCache;
  } catch {
    return {};
  }
}

function writeUploadCache(cache: UploadCache): void {
  try {
    fs.writeFileSync(UPLOAD_CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (error) {
    console.warn('Failed to write Supabase upload cache:', error);
  }
}

function getCacheKey(config: SupabaseStorageConfig, objectPath: string): string {
  return `${config.url}|${config.bucket}|${objectPath}`;
}

async function assertPublicUrlReadable(publicUrl: string, fileUrl: string): Promise<void> {
  const response = await fetch(publicUrl, { method: 'HEAD' });
  if (response.ok) return;

  throw new Error(
    `Supabase uploaded ${fileUrl}, but the public URL is not readable. ` +
    `Make the bucket public or use a public bucket name in SUPABASE_STORAGE_BUCKET. ` +
    `URL: ${publicUrl}`
  );
}

async function buildAmazonReadyImage(localPath: string): Promise<Buffer> {
  return sharp(localPath)
    .rotate()
    .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

export async function uploadPublicAssetToSupabase(fileUrl: string, namespace: string): Promise<string> {
  const config = getSupabaseStorageConfig();
  if (!config) {
    throw new Error('Supabase Storage is not configured. Add SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_STORAGE_BUCKET to .env.local.');
  }

  const localPath = resolvePublicAssetPath(fileUrl);
  if (!localPath || !fs.existsSync(localPath)) {
    throw new Error(`Local image file not found for Supabase upload: ${fileUrl}`);
  }

  const ext = path.extname(localPath).toLowerCase();
  const contentType = MIME_BY_EXT[ext];
  if (!contentType) {
    throw new Error(`Unsupported Amazon image type for Supabase upload: ${fileUrl}`);
  }

  const objectPath = buildStorageObjectPath(fileUrl, namespace, '.jpg');
  const publicUrl = `${config.url}/storage/v1/object/public/${encodeURIComponent(config.bucket)}/${encodeObjectPath(objectPath)}`;
  const fingerprint = getFileFingerprint(localPath);
  const cache = readUploadCache();
  const cacheKey = getCacheKey(config, objectPath);
  const cached = cache[cacheKey];

  if (
    cached &&
    cached.bucket === config.bucket &&
    cached.objectPath === objectPath &&
    cached.size === fingerprint.size &&
    cached.mtimeMs === fingerprint.mtimeMs &&
    cached.publicUrl === publicUrl &&
    cached.transformVersion === AMAZON_IMAGE_TRANSFORM_VERSION
  ) {
    await assertPublicUrlReadable(publicUrl, fileUrl);
    return publicUrl;
  }

  const uploadUrl = `${config.url}/storage/v1/object/${encodeURIComponent(config.bucket)}/${encodeObjectPath(objectPath)}`;
  const fileBytes = await buildAmazonReadyImage(localPath);

  const uploadBody = new Blob([new Uint8Array(fileBytes)], { type: 'image/jpeg' });

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      'Content-Type': 'image/jpeg',
      'Cache-Control': '31536000',
      'x-upsert': 'true',
    },
    body: uploadBody,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Supabase image upload failed for ${fileUrl}: ${details || response.statusText}`);
  }

  await assertPublicUrlReadable(publicUrl, fileUrl);

  cache[cacheKey] = {
    bucket: config.bucket,
    objectPath,
    size: fingerprint.size,
    mtimeMs: fingerprint.mtimeMs,
    publicUrl,
    transformVersion: AMAZON_IMAGE_TRANSFORM_VERSION,
  };
  writeUploadCache(cache);

  return publicUrl;
}
