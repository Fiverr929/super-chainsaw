import { imageSize } from 'image-size';
import { decode } from 'fast-png';
import fs from './workspaceFs.ts';
import { workspaceStorageContext } from './workspaceFs.ts';

interface Images {
  input(bytes: ReadableStream): { transform(options: Record<string, unknown>): ReturnType<Images['input']>; output(options: Record<string, unknown>): Promise<{ response(): Response }> };
}

/** Worker image adapter: Images performs transforms; PNG decoding verifies alpha. */
export default function sharp(input: Uint8Array | string, options?: { limitInputPixels?: number }) {
  let resize: Record<string, unknown> | undefined;
  let crop: { left: number; top: number; width: number; height: number } | undefined;
  let format: string | undefined;
  let quality = 85;
  let background: string | undefined;
  let channel: number | undefined;
  let raw = false;
  async function bytes() { return typeof input === 'string' ? await fs.readFile(input) : Buffer.from(input); }
  async function metadata() {
    const source = await bytes();
    const info = imageSize(source);
    if (!info.width || !info.height || info.width * info.height > (options?.limitInputPixels ?? 40_000_000)) throw new Error('Invalid image or image exceeds 40 megapixels.');
    let hasAlpha = false;
    if (info.type === 'png') {
      hasAlpha = source[25] === 4 || source[25] === 6;
      for (let offset = 8; offset + 12 <= source.length;) {
        const size = source.readUInt32BE(offset);
        if (source.toString('ascii',offset + 4,offset + 8) === 'tRNS') hasAlpha = true;
        if (size > source.length - offset - 12) throw new Error('Invalid PNG chunk.');
        offset += size + 12;
      }
    }
    if (info.type === 'webp') hasAlpha = source.length > 21 && source.toString('ascii', 12, 16) === 'VP8X' && Boolean(source[20] & 16) || source.toString('ascii',12,16) === 'VP8L';
    return { width: info.width, height: info.height, format: info.type === 'jpg' ? 'jpeg' : info.type, hasAlpha };
  }
  const pipeline = {
    metadata,
    resize(width?: number | Record<string, unknown>, height?: number, settings?: Record<string, unknown>) {
      resize = typeof width === 'object' ? { ...width } : { width, height, ...settings }; return pipeline;
    },
    extract(value: typeof crop) { crop = value; return pipeline; },
    rotate() { return pipeline; },
    flatten(value: { background: string }) { background = value.background; return pipeline; },
    jpeg(settings?: { quality?: number; mozjpeg?: boolean }) { format = 'jpeg'; quality = settings?.quality ?? 85; return pipeline; },
    png() { format = 'png'; return pipeline; },
    extractChannel(value: number) { channel = value; return pipeline; },
    raw() { raw = true; return pipeline; },
    async toBuffer(): Promise<Buffer> {
      let source = await bytes();
      const info = await metadata();
      if (raw && channel !== undefined && info.format === 'png' && info.width * info.height <= 2_000_000 && !resize && !crop) {
        const decoded = decode(source);
        if (channel !== 3 || decoded.channels !== 4 || decoded.depth !== 8) throw new Error('An 8-bit RGBA PNG is required for alpha validation.');
        return Buffer.from(Uint8Array.from({ length: info.width * info.height }, (_, i) => decoded.data[i * 4 + 3]));
      }
      if (!format && !resize && !crop && !background && !raw) return source;
      const images = workspaceStorageContext()?.images as Images | undefined;
      if (!images) throw new Error('The hosted image transformation binding is unavailable.');
      if (source.length > 20 * 1024 * 1024) throw new Error('Hosted image transformations support images up to 20 MB.');
      let image = images.input(new Blob([new Uint8Array(source)]).stream());
      // Alpha quality checks need a representative sample, not a full decoded
      // multi-megapixel RGBA image in the 128 MB Worker isolate.
      if (raw) image = image.transform({width:1200,height:1200,fit:'scale-down'});
      if (crop) image = image.transform({ trim: { left: crop.left, top: crop.top, right: info.width - crop.left - crop.width, bottom: info.height - crop.top - crop.height } });
      if (resize) image = image.transform({ width: resize.width, height: resize.height, fit: resize.withoutEnlargement ? 'scale-down' : resize.fit === 'inside' ? 'contain' : resize.fit ?? 'scale-down' });
      if (background) image = image.transform({ background });
      source = Buffer.from(await (await image.output({ format: `image/${raw ? 'png' : format ?? info.format}`, quality })).response().arrayBuffer());
      if (raw && channel === 3) {
        const decoded = decode(source);
        if (decoded.depth !== 8) throw new Error('Unsupported PNG bit depth.');
        return Buffer.from(Uint8Array.from({ length: decoded.width * decoded.height }, (_, i) => decoded.channels === 4 ? decoded.data[i * 4 + 3] : 255));
      }
      return source;
    },
  };
  return pipeline;
}
