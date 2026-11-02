"use client";
import { artworkRect, normalizeArtwork, visiblePixelBounds, type Rect } from "@/lib/artworkPlacement";
import type { Placement, MockupFrame } from "@/lib/workspaceProducts";

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

const decodedImages = new Map<string, Promise<HTMLImageElement>>();
const visibleSourceRects = new WeakMap<HTMLImageElement, Rect>();
export function loadCanvasImage(src: string): Promise<HTMLImageElement> {
  const cached = decodedImages.get(src);
  if (cached) return cached;
  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => { decodedImages.delete(src); reject(new Error('Could not load mockup image.')); };
    image.src = src;
  });
  decodedImages.set(src, pending);
  // A multi-view recipe plus its artwork should stay decoded while editing.
  if (decodedImages.size > 8) decodedImages.delete(decodedImages.keys().next().value!);
  return pending;
}

export function visibleSourceRect(image: HTMLImageElement): Rect {
  const cached = visibleSourceRects.get(image);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return { x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight };
  context.drawImage(image, 0, 0);
  const source = visiblePixelBounds(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
  visibleSourceRects.set(image, source);
  return source;
}

export function getPlacementTarget(placement: Placement, canvasWidth: number, canvasHeight: number) {
  return {
    x: (placement.x / 100) * canvasWidth,
    y: (placement.y / 100) * canvasHeight,
    width: (placement.width / 100) * canvasWidth,
    height: (placement.height / 100) * canvasHeight,
  };
}

export function drawRealisticPrint(
  ctx: CanvasRenderingContext2D,
  mockupImage: HTMLImageElement,
  designImage: HTMLImageElement,
  canvasWidth: number,
  canvasHeight: number,
  frame: MockupFrame,
  reusableCanvases?: { print: HTMLCanvasElement; texture: HTMLCanvasElement }
) {
  const margin = clampNumber(frame.placement.margin, 0, 25) / 100;
  const placement = getPlacementTarget(frame.placement, canvasWidth, canvasHeight);
  const innerPlacement = {
    x: placement.x + placement.width * margin,
    y: placement.y + placement.height * margin,
    width: placement.width * (1 - margin * 2),
    height: placement.height * (1 - margin * 2),
  };
  const sourceRect = visibleSourceRect(designImage);
  const designRect = artworkRect(sourceRect.width, sourceRect.height, innerPlacement, frame.placement.artwork);
  const rotation = normalizeArtwork(frame.placement.artwork).rotation || 0;
  if (designRect.width <= 0 || designRect.height <= 0) return;

  const printCanvas = reusableCanvases?.print || document.createElement("canvas");
  if (printCanvas.width !== canvasWidth) printCanvas.width = canvasWidth;
  if (printCanvas.height !== canvasHeight) printCanvas.height = canvasHeight;
  const printCtx = printCanvas.getContext("2d");
  if (!printCtx) return;
  printCtx.clearRect(0, 0, canvasWidth, canvasHeight);
  printCtx.save();

  printCtx.beginPath();
  printCtx.rect(innerPlacement.x, innerPlacement.y, innerPlacement.width, innerPlacement.height);
  printCtx.clip();

  const softness = clampNumber(frame.placement.softness, 0, 4) * canvasWidth / mockupImage.naturalWidth;
  if (softness > 0) {
    printCtx.save();
    printCtx.globalAlpha = 0.22;
    printCtx.filter = `blur(${softness}px)`;
    printCtx.translate(designRect.x + designRect.width / 2, designRect.y + designRect.height / 2);
    printCtx.rotate(rotation * Math.PI / 180);
    printCtx.drawImage(designImage, sourceRect.x, sourceRect.y, sourceRect.width, sourceRect.height, -designRect.width / 2, -designRect.height / 2, designRect.width, designRect.height);
    printCtx.restore();
  }

  printCtx.save();
  printCtx.globalAlpha = clampNumber(frame.placement.opacity, 0, 100) / 100;
  printCtx.translate(designRect.x + designRect.width / 2, designRect.y + designRect.height / 2);
  printCtx.rotate(rotation * Math.PI / 180);
  printCtx.drawImage(designImage, sourceRect.x, sourceRect.y, sourceRect.width, sourceRect.height, -designRect.width / 2, -designRect.height / 2, designRect.width, designRect.height);
  printCtx.restore();
  printCtx.restore();

  ctx.save();
  ctx.drawImage(printCanvas, 0, 0);
  ctx.restore();

  const textureCanvas = reusableCanvases?.texture || document.createElement("canvas");
  if (textureCanvas.width !== canvasWidth) textureCanvas.width = canvasWidth;
  if (textureCanvas.height !== canvasHeight) textureCanvas.height = canvasHeight;
  const textureCtx = textureCanvas.getContext("2d");
  if (!textureCtx) return;
  textureCtx.globalCompositeOperation = "source-over";
  textureCtx.clearRect(0, 0, canvasWidth, canvasHeight);
  textureCtx.drawImage(mockupImage, 0, 0, canvasWidth, canvasHeight);
  textureCtx.globalCompositeOperation = "destination-in";
  textureCtx.drawImage(printCanvas, 0, 0);

  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = clampNumber(frame.placement.realism, 0, 40) / 100;
  ctx.drawImage(textureCanvas, 0, 0);
  ctx.restore();
}

export async function renderMockup(frame: MockupFrame, designDataUrl: string | null): Promise<string> {
  if (!frame.imageDataUrl) throw new Error(`${frame.name} needs a blank mockup image.`);
  const [mockupImage, designImage] = await Promise.all([
    loadCanvasImage(frame.imageDataUrl),
    frame.applyDesign && designDataUrl ? loadCanvasImage(designDataUrl) : Promise.resolve(null),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = mockupImage.naturalWidth;
  canvas.height = mockupImage.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");

  ctx.drawImage(mockupImage, 0, 0);

  if (designImage) {
    drawRealisticPrint(ctx, mockupImage, designImage, canvas.width, canvas.height, frame);
  }

  return canvas.toDataURL("image/png");
}

