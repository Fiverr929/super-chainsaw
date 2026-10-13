import { loadImage, type MaskResult } from "./canvasAlpha";
import type { BgCommand, ColorCommand, EdgeMode } from "./commands";

type Rgb = [number, number, number];

/** Enclosed areas smaller than this share of the image are left alone, so eye highlights and teeth survive `inside`. */
const INSIDE_MIN_AREA_RATIO = 0.0004;

function readImage(original: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = original.naturalWidth;
  canvas.height = original.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable");
  ctx.drawImage(original, 0, 0);
  return { canvas, ctx, imageData: ctx.getImageData(0, 0, canvas.width, canvas.height) };
}

/**
 * Takes the background colour back out of half-transparent edge pixels, which
 * otherwise carry it as a halo onto any new background.
 */
function decontaminate(data: Uint8ClampedArray, alphaMap: Uint8ClampedArray, target: Rgb) {
  for (let index = 0; index < alphaMap.length; index += 1) {
    const alpha = alphaMap[index];
    if (alpha <= 0 || alpha >= 255) continue;
    const i = index * 4;
    const a = Math.max(0.08, alpha / 255);
    data[i] = Math.max(0, Math.min(255, Math.round((data[i] - target[0] * (1 - a)) / a)));
    data[i + 1] = Math.max(0, Math.min(255, Math.round((data[i + 1] - target[1] * (1 - a)) / a)));
    data[i + 2] = Math.max(0, Math.min(255, Math.round((data[i + 2] - target[2] * (1 - a)) / a)));
  }
}

/** Marks every pixel within `radius` of a marked pixel, as two passes over rows then columns. */
function dilate(marked: Uint8Array, width: number, height: number, radius: number) {
  const rows = new Uint8Array(marked.length);
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      const from = Math.max(0, x - radius);
      const to = Math.min(width - 1, x + radius);
      for (let nx = from; nx <= to; nx += 1) {
        if (marked[row + nx]) {
          rows[row + x] = 1;
          break;
        }
      }
    }
  }

  const near = new Uint8Array(marked.length);
  for (let y = 0; y < height; y += 1) {
    const from = Math.max(0, y - radius);
    const to = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x += 1) {
      for (let ny = from; ny <= to; ny += 1) {
        if (rows[ny * width + x]) {
          near[y * width + x] = 1;
          break;
        }
      }
    }
  }
  return near;
}

function finish(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  imageData: ImageData,
  alphaMap: Uint8ClampedArray,
  invert: boolean,
) {
  const { width, height } = canvas;
  const data = imageData.data;
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = width;
  maskCanvas.height = height;
  const maskCtx = maskCanvas.getContext("2d");
  if (!maskCtx) throw new Error("Mask canvas is unavailable");
  const maskData = maskCtx.createImageData(width, height);

  for (let index = 0; index < alphaMap.length; index += 1) {
    const i = index * 4;
    const finalAlpha = invert ? 255 - alphaMap[index] : alphaMap[index];
    data[i + 3] = finalAlpha;
    maskData.data[i] = finalAlpha;
    maskData.data[i + 1] = finalAlpha;
    maskData.data[i + 2] = finalAlpha;
    maskData.data[i + 3] = 255;
  }

  maskCtx.putImageData(maskData, 0, 0);
  ctx.putImageData(imageData, 0, 0);
  return { rawMaskUrl: maskCanvas.toDataURL("image/png"), outputUrl: canvas.toDataURL("image/png"), width, height };
}

function edgeTolerance(base: number, edgeMode: EdgeMode, steps: { strict: number; soft: number; max: number }, floor: number) {
  if (edgeMode === "strict") return Math.max(floor, base - steps.strict);
  if (edgeMode === "max") return base + steps.max;
  if (edgeMode === "soft") return base + steps.soft;
  return base;
}

export async function removeEdgeBackground(originalUrl: string, invert: boolean, command: BgCommand, label: string): Promise<MaskResult> {
  const original = await loadImage(originalUrl);
  const { canvas, ctx, imageData } = readImage(original);
  const data = imageData.data;
  const width = canvas.width;
  const height = canvas.height;
  const total = width * height;
  const removed = new Uint8Array(total);
  const alphaMap = new Uint8ClampedArray(total);
  const queue = new Int32Array(total);
  const target = command.mode === "auto" ? sampleBorderColor(data, width, height) : command.color!;
  const tolerance = edgeTolerance(command.mode === "auto" ? 34 : 42, command.edgeMode, { strict: 16, soft: 10, max: 24 }, 20);
  const targetAvg = (target[0] + target[1] + target[2]) / 3;

  function colorDistance(index: number) {
    const i = index * 4;
    const dr = data[i] - target[0];
    const dg = data[i + 1] - target[1];
    const db = data[i + 2] - target[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  // Fills outward from the queue entries in [head, tail) over background-like pixels not yet claimed.
  function fill(claimed: Uint8Array, head: number, tail: number) {
    function push(index: number) {
      if (claimed[index] || colorDistance(index) > tolerance) return;
      claimed[index] = 1;
      queue[tail] = index;
      tail += 1;
    }
    for (let q = head; q < tail; q += 1) {
      const index = queue[q];
      const x = index % width;
      if (x > 0) push(index - 1);
      if (x < width - 1) push(index + 1);
      if (index >= width) push(index - width);
      if (index < total - width) push(index + width);
    }
    return tail;
  }

  let tail = 0;
  function seed(index: number) {
    if (removed[index] || colorDistance(index) > tolerance) return;
    removed[index] = 1;
    queue[tail] = index;
    tail += 1;
  }
  for (let x = 0; x < width; x += 1) {
    seed(x);
    seed((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    seed(y * width);
    seed(y * width + width - 1);
  }
  fill(removed, 0, tail);

  if (command.inside) {
    // Background the edge fill could not reach: each enclosed area is collected, and removed when it is large enough.
    const seen = new Uint8Array(removed);
    const minArea = Math.max(64, Math.round(total * INSIDE_MIN_AREA_RATIO));
    for (let start = 0; start < total; start += 1) {
      if (seen[start] || colorDistance(start) > tolerance) continue;
      seen[start] = 1;
      queue[0] = start;
      const size = fill(seen, 0, 1);
      if (size < minArea) continue;
      for (let q = 0; q < size; q += 1) removed[queue[q]] = 1;
    }
  }

  alphaMap.fill(255);
  const nearRemoved = dilate(removed, width, height, 2);
  const fringeReachBase = command.edgeMode === "strict" ? 32 : command.edgeMode === "max" ? 170 : command.edgeMode === "soft" ? 132 : 108;
  const neutralReachBase = command.edgeMode === "strict" ? 20 : command.edgeMode === "max" ? 108 : command.edgeMode === "soft" ? 72 : 50;

  for (let index = 0; index < total; index += 1) {
    if (removed[index]) {
      alphaMap[index] = 0;
      continue;
    }
    if (!nearRemoved[index]) continue;

    const i = index * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const avg = (r + g + b) / 3;
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    const distance = colorDistance(index);
    const likelyLightFringe = targetAvg > 220 && avg > 176 && spread < 62;
    const likelyDarkFringe = targetAvg < 36 && avg < 86 && spread < 62;
    const fringeReach = tolerance + (likelyLightFringe || likelyDarkFringe ? fringeReachBase : neutralReachBase);

    if (distance <= tolerance + 10) {
      alphaMap[index] = 0;
    } else if (distance <= fringeReach) {
      const t = (distance - tolerance - 10) / Math.max(1, fringeReach - tolerance - 10);
      alphaMap[index] = Math.max(24, Math.min(220, Math.round(t * 255)));
    }
  }

  if (!invert) decontaminate(data, alphaMap, target);

  return {
    ...finish(canvas, ctx, imageData, alphaMap, invert),
    source: "local-bg",
    sourceLabel: command.mode === "auto" ? label.replace(/\bauto\b/, `auto ${hexName(target)}`) : label,
    notes: [],
  };
}

export async function removeGlobalColor(originalUrl: string, invert: boolean, command: ColorCommand, label: string): Promise<MaskResult> {
  const original = await loadImage(originalUrl);
  const { canvas, ctx, imageData } = readImage(original);
  const data = imageData.data;
  const width = canvas.width;
  const height = canvas.height;
  const target = command.mode === "auto" ? sampleBorderColor(data, width, height) : command.color!;
  const tolerance = edgeTolerance(command.mode === "auto" ? 36 : 44, command.edgeMode, { strict: 18, soft: 18, max: 42 }, 18);
  const feather = command.edgeMode === "strict" ? 18 : command.edgeMode === "max" ? 120 : command.edgeMode === "soft" ? 82 : 46;
  const targetAvg = (target[0] + target[1] + target[2]) / 3;
  const alphaMap = new Uint8ClampedArray(width * height);

  for (let index = 0; index < width * height; index += 1) {
    const i = index * 4;
    const dr = data[i] - target[0];
    const dg = data[i + 1] - target[1];
    const db = data[i + 2] - target[2];
    const distance = Math.sqrt(dr * dr + dg * dg + db * db);
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
    const spread = Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]);
    const maxLightCleanup = command.edgeMode === "max" && targetAvg > 220 && avg > 156 && spread < 72;
    const maxDarkCleanup = command.edgeMode === "max" && targetAvg < 35 && avg < 100 && spread < 72;
    let alpha = 255;

    if (maxLightCleanup || maxDarkCleanup || distance <= tolerance) {
      alpha = 0;
    } else if (distance <= tolerance + feather) {
      const t = (distance - tolerance) / feather;
      alpha = Math.max(24, Math.min(255, Math.round(t * 255)));
    }

    alphaMap[index] = alpha;
  }

  if (!invert) {
    // The fringe test reads the pixel as it was, and the colour is corrected with the alpha from before thinning.
    const measured = command.edgeMode === "max" ? alphaMap.slice() : alphaMap;
    if (command.edgeMode === "max") thinFringe(alphaMap, data, width, height, target);
    decontaminate(data, measured, target);
  }

  return {
    ...finish(canvas, ctx, imageData, alphaMap, invert),
    source: "color",
    sourceLabel: command.mode === "auto" ? label.replace(/\bauto\b/, `auto ${hexName(target)}`) : label,
    notes: [],
  };
}

/** `max` only: half-transparent pixels beside cleared ones that still read as the background are made nearly clear. */
function thinFringe(alphaMap: Uint8ClampedArray, data: Uint8ClampedArray, width: number, height: number, target: Rgb) {
  const targetAvg = (target[0] + target[1] + target[2]) / 3;
  const clear = new Uint8Array(alphaMap.length);
  for (let index = 0; index < alphaMap.length; index += 1) {
    if (alphaMap[index] <= 12) clear[index] = 1;
  }
  const nearClear = dilate(clear, width, height, 2);

  for (let index = 0; index < alphaMap.length; index += 1) {
    const alpha = alphaMap[index];
    if (alpha <= 0 || alpha >= 255 || !nearClear[index]) continue;

    const i = index * 4;
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
    const spread = Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]);
    const lightFringe = targetAvg > 220 && avg > 118 && spread < 96;
    const darkFringe = targetAvg < 35 && avg < 138 && spread < 96;
    if (lightFringe || darkFringe) alphaMap[index] = Math.min(alpha, 48);
  }
}

function hexName(color: Rgb) {
  return `#${color.map((value) => value.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function sampleBorderColor(data: Uint8ClampedArray, width: number, height: number): Rgb {
  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();

  function addPixel(x: number, y: number) {
    const i = (y * width + x) * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = `${Math.round(r / 16)},${Math.round(g / 16)},${Math.round(b / 16)}`;
    const bucket = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };
    bucket.count += 1;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    buckets.set(key, bucket);
  }

  for (let x = 0; x < width; x += 1) {
    addPixel(x, 0);
    addPixel(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    addPixel(0, y);
    addPixel(width - 1, y);
  }

  let best = { count: 0, r: 255, g: 255, b: 255 };
  buckets.forEach((bucket) => {
    if (bucket.count > best.count) best = bucket;
  });

  return [
    Math.round(best.r / Math.max(1, best.count)),
    Math.round(best.g / Math.max(1, best.count)),
    Math.round(best.b / Math.max(1, best.count)),
  ];
}
