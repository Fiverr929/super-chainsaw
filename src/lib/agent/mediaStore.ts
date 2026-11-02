import fs from '../workspaceFs.ts';
import path from 'node:path';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AGENT_MEDIA = /^\/api\/agent\/media\/([0-9a-f-]{36})$/i;
const WORKSPACE_PRODUCT = /^\/workspace-products\/([0-9a-f-]{36})\/([0-9a-f]{64}\.(?:png|jpg|webp))$/i;
const ETSY_ASSET = /^\/workspace-assets\/etsy\/\d{8,15}\/([0-9a-f-]{36})\/\d{2}\.(?:png|jpg|webp)$/i;
export class AgentMediaError extends Error { public status: number; constructor(message: string, status = 400) { super(message); this.status = status; } }
function directory(cwd: string) { return path.join(cwd, '.workspace-data', 'agent', 'media'); }
function safeId(value: string) { if (!UUID.test(value)) throw new AgentMediaError('Invalid artwork ID.'); return value; }

export async function saveAgentImage(bytes: Buffer, mimeType: string, cwd = process.cwd()) {
  if (bytes.length < 1 || bytes.length > 25 * 1024 * 1024) throw new AgentMediaError('Choose an image under 25 MB.', 413);
  let info;
  try { info = await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata(); }
  catch { throw new AgentMediaError('The selected artwork is not a valid image.'); }
  const extension = info.format === 'jpeg' ? 'jpg' : info.format;
  if (!['png','jpg','webp'].includes(extension || '') || (mimeType && mimeType !== `image/${info.format}` && !(info.format === 'jpeg' && mimeType === 'image/jpeg'))) throw new AgentMediaError('Use a PNG, JPEG or WebP image.');
  const id = randomUUID(); const file = path.join(directory(cwd), `${id}.${extension}`); await fs.mkdir(directory(cwd), { recursive: true });
  await fs.writeFile(file, bytes, { flag: 'wx' });
  return { id, url: `/api/agent/media/${id}`, mimeType: `image/${info.format}`, bytes: bytes.length, width: info.width, height: info.height };
}

async function readAgentFile(id: string, cwd: string) {
  safeId(id);
  const files = await fs.readdir(directory(cwd)).catch(error => { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; });
  const name = files.find(value => value.startsWith(`${id}.`));
  if (!name || !new RegExp(`^${id}\\.(?:png|jpg|webp)$`).test(name)) throw new AgentMediaError('Saved artwork was removed.', 404);
  return { bytes: await fs.readFile(path.join(directory(cwd), name)), name };
}

async function readUrl(url: string, cwd: string) {
  const media = AGENT_MEDIA.exec(url);
  if (media) return readAgentFile(media[1], cwd);
  const product = WORKSPACE_PRODUCT.exec(url);
  if (product) return { bytes: await fs.readFile(path.join(cwd, 'public', 'workspace-products', product[1], product[2])), name: product[2] };
  const asset = ETSY_ASSET.exec(url);
  if (asset) {
    const match = /^\/workspace-assets\/etsy\/(\d{8,15})\/([0-9a-f-]{36})\/(\d{2}\.(?:png|jpg|webp))$/i.exec(url);
    if (!match) throw new AgentMediaError('Invalid imported artwork path.');
    return { bytes: await fs.readFile(path.join(cwd, 'public', 'workspace-assets', 'etsy', match[1], match[2], match[3])), name: match[3] };
  }
  throw new AgentMediaError('Select artwork saved inside the workstation.', 403);
}

export async function readAgentMediaDataUrl(url: string, cwd = process.cwd()) {
  const { bytes } = await readUrl(url, cwd);
  if (bytes.length > 25 * 1024 * 1024) throw new AgentMediaError('Saved artwork exceeds 25 MB.', 413);
  const info = await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata();
  if (!['png','jpeg','webp'].includes(info.format || '')) throw new AgentMediaError('Saved artwork has an unsupported image format.');
  const mime = info.format === 'jpeg' ? 'image/jpeg' : `image/${info.format}`;
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

export async function getAgentImage(id: string, cwd = process.cwd()) {
  const { bytes, name } = await readAgentFile(id, cwd);
  const mime = name.endsWith('.png') ? 'image/png' : name.endsWith('.jpg') ? 'image/jpeg' : 'image/webp';
  return { bytes, mime };
}

export async function readAgentImagePreview(url: string, cwd = process.cwd()) {
  const { bytes } = await readUrl(url, cwd);
  const preview = await sharp(bytes, { limitInputPixels: 40_000_000 }).resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
  return preview.toString('base64');
}
