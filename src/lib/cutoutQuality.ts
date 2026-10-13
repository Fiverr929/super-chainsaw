import { loadImage } from './mask-test/canvasAlpha.ts';

export type ArtworkBounds = { left: number; top: number; right: number; bottom: number };

export type CutoutQuality = {
  width: number;
  height: number;
  bounds: ArtworkBounds | null;
  marginPixels: number;
  strongMarginPixels: number;
  canCleanMargins: boolean;
};

const STRONG_ALPHA = 192;
const VISIBLE_ALPHA = 16;

export function outsideArtwork(x: number, y: number, bounds: ArtworkBounds) {
  return x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom;
}

/** Find the body of the print from substantial opaque rows and columns, not isolated dots. */
export function inspectCutoutPixels(data: Uint8ClampedArray, width: number, height: number): CutoutQuality {
  if (width <= 0 || height <= 0 || data.length !== width * height * 4) {
    throw new Error('Invalid cutout pixels.');
  }
  const rows = new Uint32Array(height);
  const columns = new Uint32Array(width);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] >= STRONG_ALPHA) {
        rows[y]++;
        columns[x]++;
      }
    }
  }

  const minimumRun = Math.max(5, Math.round(Math.min(width, height) * 0.0012));
  const firstColumn = columns.findIndex(count => count >= minimumRun);
  const firstRow = rows.findIndex(count => count >= minimumRun);
  if (firstColumn < 0 || firstRow < 0) {
    return { width, height, bounds: null, marginPixels: 0, strongMarginPixels: 0, canCleanMargins: false };
  }
  let lastColumn = width - 1;
  let lastRow = height - 1;
  while (columns[lastColumn] < minimumRun) lastColumn--;
  while (rows[lastRow] < minimumRun) lastRow--;
  const padding = Math.max(3, Math.ceil(Math.min(width, height) * 0.006));
  const bounds = {
    left: Math.max(0, firstColumn - padding),
    top: Math.max(0, firstRow - padding),
    right: Math.min(width - 1, lastColumn + padding),
    bottom: Math.min(height - 1, lastRow + padding),
  };
  // When the print itself reaches the image edge, a margin cannot be inferred safely.
  const canCleanMargins = bounds.left > 0 && bounds.top > 0 && bounds.right < width - 1 && bounds.bottom < height - 1;
  let marginPixels = 0;
  let strongMarginPixels = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!outsideArtwork(x, y, bounds)) continue;
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha >= VISIBLE_ALPHA) marginPixels++;
      if (alpha >= STRONG_ALPHA) strongMarginPixels++;
    }
  }
  return { width, height, bounds, marginPixels, strongMarginPixels, canCleanMargins };
}

async function readCanvas(source: string) {
  const image = await loadImage(source);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas is unavailable.');
  context.drawImage(image, 0, 0);
  return { canvas, context, imageData: context.getImageData(0, 0, canvas.width, canvas.height) };
}

export async function reviewCutout(source: string) {
  const { canvas, context, imageData } = await readCanvas(source);
  const report = inspectCutoutPixels(imageData.data, canvas.width, canvas.height);
  if (!report.bounds || !report.marginPixels) return { ...report, overlay: null as string | null };
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#ff0040';
  const markerStep = Math.max(1, Math.ceil(report.marginPixels / 5000));
  let marked = 0;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      if (!outsideArtwork(x, y, report.bounds) || imageData.data[i + 3] < VISIBLE_ALPHA) continue;
      if (marked++ % markerStep === 0) context.fillRect(x - 5, y - 5, 10, 10);
    }
  }
  return { ...report, overlay: canvas.toDataURL('image/png') };
}

/** Only pixels beyond the reviewed print bounds are erased. Interior distress is untouched. */
export async function cleanCutoutMargins(source: string, bounds: ArtworkBounds) {
  const { canvas, context, imageData } = await readCanvas(source);
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (outsideArtwork(x, y, bounds)) imageData.data[(y * canvas.width + x) * 4 + 3] = 0;
    }
  }
  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

/** Crop transparent canvas padding so mockup sizing follows the visible artwork. */
export async function cropCutoutToArtwork(source: string) {
  const { canvas, imageData } = await readCanvas(source);
  const report = inspectCutoutPixels(imageData.data, canvas.width, canvas.height);
  if (!report.bounds) return source;
  const { left, top, right, bottom } = report.bounds;
  const width = right - left + 1;
  const height = bottom - top + 1;
  if (width >= canvas.width * 0.96 && height >= canvas.height * 0.96) return source;
  const cropped = document.createElement('canvas');
  cropped.width = width;
  cropped.height = height;
  const context = cropped.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable.');
  context.drawImage(canvas, left, top, width, height, 0, 0, width, height);
  return cropped.toDataURL('image/png');
}
