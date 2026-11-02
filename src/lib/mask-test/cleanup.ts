import { loadImage } from './canvasAlpha.ts';

export type MaskCleanupOptions = { componentPercent: number; holePercent: number };
// Keep the complete composition by default. Cleanup is lossy by design, so users
// should opt into removing specks or filling holes for a particular image.
export const DEFAULT_MASK_CLEANUP: MaskCleanupOptions = { componentPercent: 0, holePercent: 0 };

/** PhotoCraft-style component cleanup: 8-connected artwork, 4-connected holes.
 * Retained pixels keep their soft alpha; filled holes recover original pixels.
 */
export function cleanMaskPixels(original: Uint8ClampedArray, cutout: Uint8ClampedArray, width: number, height: number, options: MaskCleanupOptions) {
  const count = width * height;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || original.length !== count * 4 || cutout.length !== original.length) throw new Error('Invalid mask dimensions.');
  if (![options.componentPercent, options.holePercent].every(value => Number.isFinite(value) && value >= 0 && value <= 100)) throw new Error('Cleanup percentages must be between 0 and 100.');
  const output = new Uint8ClampedArray(cutout);
  const labels = new Uint32Array(count);
  const queue = new Uint32Array(count);
  const sizes = [0];
  let largest = 0;
  for (let start = 0; start < count; start++) {
    if (labels[start] || cutout[start * 4 + 3] === 0) continue;
    const label = sizes.length;
    let tail = 1;
    queue[0] = start;
    labels[start] = label;
    for (let head = 0; head < tail; head++) {
      const pixel = queue[head];
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const next = ny * width + nx;
        if (labels[next] || cutout[next * 4 + 3] === 0) continue;
        labels[next] = label;
        queue[tail++] = next;
      }
    }
    sizes.push(tail);
    largest = Math.max(largest, tail);
  }
  if (!largest) return output;
  const minimum = Math.ceil(largest * options.componentPercent / 100);
  let keptArea = 0;
  for (let pixel = 0; pixel < count; pixel++) {
    if (labels[pixel] && sizes[labels[pixel]] >= minimum) keptArea++;
    else { labels[pixel] = 0; output[pixel * 4 + 3] = 0; }
  }
  const maximumHole = Math.floor(keptArea * options.holePercent / 100);
  if (!maximumHole) return output;
  const visited = new Uint8Array(count);
  for (let start = 0; start < count; start++) {
    if (labels[start] || visited[start]) continue;
    let tail = 1;
    let touchesBorder = false;
    queue[0] = start;
    visited[start] = 1;
    for (let head = 0; head < tail; head++) {
      const pixel = queue[head];
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesBorder = true;
      const add = (next: number) => {
        if (labels[next] || visited[next]) return;
        visited[next] = 1;
        queue[tail++] = next;
      };
      if (x > 0) add(pixel - 1);
      if (x + 1 < width) add(pixel + 1);
      if (y > 0) add(pixel - width);
      if (y + 1 < height) add(pixel + width);
    }
    if (!touchesBorder && tail <= maximumHole) {
      for (let index = 0; index < tail; index++) {
        const offset = queue[index] * 4;
        output.set(original.subarray(offset, offset + 4), offset);
      }
    }
  }
  return output;
}

export async function cleanCutoutMask(originalUrl: string, cutoutUrl: string, options: MaskCleanupOptions) {
  const [original, cutout] = await Promise.all([loadImage(originalUrl), loadImage(cutoutUrl)]);
  const width = cutout.naturalWidth;
  const height = cutout.naturalHeight;
  if (original.naturalWidth !== width || original.naturalHeight !== height) throw new Error('Mask and original dimensions differ.');
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas is unavailable.');
  context.drawImage(original, 0, 0);
  const sourcePixels = context.getImageData(0, 0, width, height).data;
  context.clearRect(0, 0, width, height);
  context.drawImage(cutout, 0, 0);
  const result = context.getImageData(0, 0, width, height);
  result.data.set(cleanMaskPixels(sourcePixels, result.data, width, height, options));
  context.putImageData(result, 0, 0);
  return canvas.toDataURL('image/png');
}
