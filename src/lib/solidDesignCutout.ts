import { loadImage } from './mask-test/canvasAlpha.ts';
import type { EdgeMode } from './mask-test/commands';

type Rgb = [number, number, number];

function borderColor(data: Uint8ClampedArray, width: number, height: number): Rgb | null {
  const samples: Rgb[] = [];
  const stepX = Math.max(1, Math.floor(width / 300));
  const stepY = Math.max(1, Math.floor(height / 300));
  const add = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    samples.push([data[i], data[i + 1], data[i + 2]]);
  };
  for (let x = 0; x < width; x += stepX) { add(x, 0); add(x, height - 1); }
  for (let y = 0; y < height; y += stepY) { add(0, y); add(width - 1, y); }
  if (!samples.length) return null;
  const color = ([0, 1, 2] as const).map(channel => {
    const values = samples.map(sample => sample[channel]).sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  }) as Rgb;
  const matching = samples.filter(sample => Math.max(...sample.map((value, channel) => Math.abs(value - color[channel]))) <= 6).length;
  return matching / samples.length >= 0.98 ? color : null;
}

/** Chroma separates dark colored ink from a neutral shirt-color canvas. */
export function solidDesignAlpha(pixel: Rgb, background: Rgb, mode: EdgeMode): number {
  const [r, g, b] = pixel;
  const [br, bg, bb] = background;
  const rgb = Math.hypot(r - br, g - bg, b - bb);
  const chroma = Math.max(
    Math.abs((r - g) - (br - bg)),
    Math.abs((g - b) - (bg - bb)),
    Math.abs((b - r) - (bb - br)),
  );
  const distance = Math.max(rgb, chroma * 4);
  const [clear, solid] = mode === 'strict' ? [9, 32] : mode === 'max' ? [18, 55] : [12, 42];
  if (distance <= clear) return 0;
  if (distance >= solid) return 255;
  return Math.round((distance - clear) * 255 / (solid - clear));
}

/** Use only on images with a uniform opaque border; no connectivity or minimum-area filter. */
export async function removeSolidDesignBackground(source: string, mode: EdgeMode): Promise<string | null> {
  const image = await loadImage(source);
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas is unavailable.');
  context.drawImage(image, 0, 0);
  const imageData = context.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  const background = borderColor(pixels, width, height);
  if (!background) return null;
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = solidDesignAlpha([pixels[i], pixels[i + 1], pixels[i + 2]], background, mode);
    pixels[i + 3] = alpha;
    if (alpha === 0 || alpha === 255) continue;
    const fraction = Math.max(alpha / 255, 0.08);
    for (let channel = 0; channel < 3; channel++) {
      pixels[i + channel] = Math.max(0, Math.min(255, Math.round((pixels[i + channel] - background[channel] * (1 - fraction)) / fraction)));
    }
  }
  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}
