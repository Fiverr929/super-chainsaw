import { loadImage } from './mask-test/canvasAlpha.ts';

type Rgb = [number, number, number];

export function colorDistance(pixel: Rgb, background: Rgb) {
  const rgb = Math.hypot(...pixel.map((value, channel) => value - background[channel]));
  const chroma = Math.max(
    Math.abs((pixel[0] - pixel[1]) - (background[0] - background[1])),
    Math.abs((pixel[1] - pixel[2]) - (background[1] - background[2])),
    Math.abs((pixel[2] - pixel[0]) - (background[2] - background[0])),
  );
  return Math.max(rgb, chroma * 4);
}

/** A semantic mask can clear uncertain shirt pixels, but never erase clearly contrasting ink. */
export function guideAlphaWithMask(base: Uint8ClampedArray, original: Uint8ClampedArray, mask: Uint8ClampedArray, background: Rgb) {
  if (base.length !== original.length || mask.length !== base.length) throw new Error('Mask and design dimensions differ.');
  const output = new Uint8ClampedArray(base);
  let removed = 0;
  for (let i = 0; i < base.length; i += 4) {
    const certainty = (mask[i] + mask[i + 1] + mask[i + 2]) / 3;
    if (certainty >= 128 || base[i + 3] === 0) continue;
    const distance = colorDistance([original[i], original[i + 1], original[i + 2]], background);
    if (distance > 60) continue;
    const guided = Math.round(base[i + 3] * Math.max(0, certainty / 128));
    if (guided < base[i + 3]) removed++;
    output[i + 3] = guided;
  }
  return { pixels: output, removed };
}

export function isGrayscaleMask(mask: Uint8ClampedArray) {
  let colored = 0;
  for (let i = 0; i < mask.length; i += 4) {
    if (Math.max(mask[i], mask[i + 1], mask[i + 2]) - Math.min(mask[i], mask[i + 1], mask[i + 2]) > 18) colored++;
  }
  return colored / (mask.length / 4) <= 0.08;
}

async function pixels(source: string, width?: number, height?: number) {
  const image = await loadImage(source);
  const canvas = document.createElement('canvas');
  canvas.width = width || image.naturalWidth;
  canvas.height = height || image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas is unavailable.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return { canvas, context, data: context.getImageData(0, 0, canvas.width, canvas.height) };
}

export async function applyHybridMask(original: string, cutout: string, mask: string) {
  const base = await pixels(cutout);
  const [source, guide] = await Promise.all([
    pixels(original, base.canvas.width, base.canvas.height),
    pixels(mask, base.canvas.width, base.canvas.height),
  ]);
  if (!isGrayscaleMask(guide.data.data)) throw new Error('The image model returned artwork instead of a grayscale mask. The original cutout is unchanged.');
  const background: Rgb = [source.data.data[0], source.data.data[1], source.data.data[2]];
  const result = guideAlphaWithMask(base.data.data, source.data.data, guide.data.data, background);
  base.context.putImageData(new ImageData(result.pixels, base.canvas.width, base.canvas.height), 0, 0);
  return { output: base.canvas.toDataURL('image/png'), removed: result.removed };
}

/** Apply a model-produced alpha mask directly to the uncut design pixels. */
export function maskOriginalPixels(original: Uint8ClampedArray, mask: Uint8ClampedArray, width: number, height: number) {
  if (width <= 0 || height <= 0 || original.length !== width * height * 4 || original.length !== mask.length) throw new Error('Mask and design dimensions differ.');
  if (!isGrayscaleMask(mask)) throw new Error('The image model returned artwork instead of a grayscale mask.');
  const output = new Uint8ClampedArray(original);
  let removed = 0;
  let kept = 0;
  const background: Rgb = [original[0], original[1], original[2]];
  const values = new Uint8Array(width * height);
  for (let pixel = 0; pixel < values.length; pixel++) {
    const i = pixel * 4;
    values[pixel] = Math.round((mask[i] + mask[i + 1] + mask[i + 2]) / 3);
  }
  // Exterior background is always removable. Enclosed mask regions are kept
  // only when their color contrasts with the sampled background; this protects
  // interior artwork while allowing shirt-colored holes inside letters to clear.
  const exterior = new Uint8Array(values.length);
  const queue = new Uint32Array(values.length);
  let head = 0;
  let tail = 0;
  const addExterior = (pixel: number) => {
    if (exterior[pixel] || values[pixel] >= 128) return;
    exterior[pixel] = 1;
    queue[tail++] = pixel;
  };
  for (let x = 0; x < width; x++) { addExterior(x); addExterior((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { addExterior(y * width); addExterior(y * width + width - 1); }
  while (head < tail) {
    const pixel = queue[head++];
    const x = pixel % width;
    if (x > 0) addExterior(pixel - 1);
    if (x + 1 < width) addExterior(pixel + 1);
    if (pixel >= width) addExterior(pixel - width);
    if (pixel + width < values.length) addExterior(pixel + width);
  }
  for (let pixel = 0; pixel < values.length; pixel++) {
    const i = pixel * 4;
    const distance = colorDistance([original[i], original[i + 1], original[i + 2]], background);
    const enclosedArtwork = !exterior[pixel] && values[pixel] < 128 && distance > 60;
    const certainty = enclosedArtwork ? 255 : values[pixel];
    // Sharpen broad gray model edges while keeping a narrow antialiased transition.
    let alpha = certainty <= 80 ? 0 : certainty >= 176 ? 255 : Math.round((certainty - 80) * 255 / 96);
    if (alpha < 255 && certainty >= 24) {
      if (distance > 48) {
        const x = pixel % width;
        const y = Math.floor(pixel / width);
        let nearInk = false;
        for (let dy = -1; dy <= 1 && !nearInk; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height && values[ny * width + nx] >= 176) { nearInk = true; break; }
        }
        if (nearInk) alpha = Math.max(alpha, Math.min(255, Math.round((distance - 48) * 3)));
      }
    }
    output[i + 3] = Math.round(original[i + 3] * alpha / 255);
    if (output[i + 3] < 16) removed++;
    if (output[i + 3] > 239) kept++;
  }
  const count = output.length / 4;
  if (removed < count * 0.01 || kept < count * 0.01) throw new Error('The AI mask did not clearly separate artwork from background. Try again.');
  return { pixels: output, removed };
}

export async function applyDirectMask(original: string, mask: string) {
  const source = await pixels(original);
  const maskImage = await loadImage(mask);
  const sourceRatio = source.canvas.width / source.canvas.height;
  const maskRatio = maskImage.naturalWidth / maskImage.naturalHeight;
  if (Math.abs(sourceRatio - maskRatio) / sourceRatio > 0.02) throw new Error('The AI mask has different proportions from the design. Try again.');
  const guide = await pixels(mask, source.canvas.width, source.canvas.height);
  const result = maskOriginalPixels(source.data.data, guide.data.data, source.canvas.width, source.canvas.height);
  source.context.putImageData(new ImageData(result.pixels, source.canvas.width, source.canvas.height), 0, 0);
  return { output: source.canvas.toDataURL('image/png'), removed: result.removed };
}
