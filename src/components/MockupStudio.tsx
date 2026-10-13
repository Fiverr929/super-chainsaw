"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import JSZip from "jszip";
import { Copy, Download, ImageIcon, Loader2, Plus, Save, Settings2, Trash2, UploadCloud, X } from "lucide-react";
import toast from "react-hot-toast";
import { loadMockupPresets, saveMockupPresets } from "@/lib/mockupPresetStorage";
import { artworkForFrame, productInputSignature, type Placement, type MockupFrame, type MockupPreset, type GeneratedMockup, type WorkspaceProduct, type ProductSnapshot } from "@/lib/workspaceProducts";
import { ARTWORK_PRESETS, presetArtwork, type ArtworkPresetId, resizeArtwork, type ArtworkResizeHandle, artworkRect, dragArtwork, fitArtwork, normalizeArtwork, visiblePixelBounds, type ArtworkPlacement, type FitPosition, type Rect } from '@/lib/artworkPlacement';
import { CC1717_COLORS, VINTAGE_COLORS, type VintageColor } from '@/lib/vintageMockups';

type RegionDragMode = "move" | "nw" | "ne" | "sw" | "se" | "n" | "s" | "w" | "e";

type RegionDragState = {
  mode: RegionDragMode;
  startX: number;
  startY: number;
  startPlacement: Placement;
};

const LEGACY_STORAGE_KEY = "workstation_mockup_presets";

const DEFAULT_PLACEMENT: Placement = {
  x: 35,
  y: 24,
  width: 30,
  height: 34,
  opacity: 96,
  margin: 0,
  realism: 18,
  softness: 1,
};

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function createTshirtPreset(): MockupPreset {
  const id = `mockup-${Date.now()}`;
  return {
    id,
    name: "Pepper T-Shirt",
    productType: "T-Shirt",
    color: "Pepper",
    frames: [
      {
        id: `${id}-front`,
        name: "Front",
        role: "Front",
        applyDesign: true,
        placement: { ...DEFAULT_PLACEMENT },
      },
      {
        id: `${id}-back`,
        name: "Back",
        role: "Back",
        applyDesign: false,
        placement: { ...DEFAULT_PLACEMENT },
      },
    ],
  };
}

function isValidPreset(value: unknown): value is MockupPreset {
  if (!value || typeof value !== "object") return false;
  const preset = value as Partial<MockupPreset>;
  return typeof preset.id === "string" &&
    typeof preset.name === "string" &&
    typeof preset.productType === "string" &&
    typeof preset.color === "string" &&
    Array.isArray(preset.frames);
}

function normalizePlacement(value: unknown): Placement {
  const placement = value && typeof value === "object" ? value as Partial<Placement> : {};
  const width = clampNumber(Number(placement.width ?? DEFAULT_PLACEMENT.width), 5, 100);
  const height = clampNumber(Number(placement.height ?? DEFAULT_PLACEMENT.height), 5, 100);
  return {
    x: clampNumber(Number(placement.x ?? DEFAULT_PLACEMENT.x), 0, 100 - width),
    y: clampNumber(Number(placement.y ?? DEFAULT_PLACEMENT.y), 0, 100 - height),
    width,
    height,
    opacity: clampNumber(Number(placement.opacity ?? DEFAULT_PLACEMENT.opacity), 40, 100),
    margin: clampNumber(Number(placement.margin ?? DEFAULT_PLACEMENT.margin), 0, 25),
    realism: clampNumber(Number(placement.realism ?? DEFAULT_PLACEMENT.realism), 0, 40),
    softness: clampNumber(Number(placement.softness ?? DEFAULT_PLACEMENT.softness), 0, 4),
    ...(placement.locked !== undefined ? { locked: Boolean(placement.locked) } : {}),
    ...(placement.artwork ? { artwork: normalizeArtwork(placement.artwork) } : {}),
  };
}

function normalizePreset(preset: MockupPreset): MockupPreset {
  return {
    ...preset,
    frames: preset.frames
      .filter(frame => frame && typeof frame === "object" && typeof frame.id === "string")
      .map(frame => ({
        ...frame,
        name: typeof frame.name === "string" ? frame.name : "Mockup",
        role: ["Front", "Back", "Side", "Model", "Detail"].includes(frame.role) ? frame.role : "Detail",
        imageDataUrl: typeof frame.imageDataUrl === "string" ? frame.imageDataUrl : "",
        applyDesign: Boolean(frame.applyDesign),
        placement: normalizePlacement(frame.placement),
      })),
  };
}

function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const decodedImages = new Map<string, Promise<HTMLImageElement>>();
const visibleSourceRects = new WeakMap<HTMLImageElement, Rect>();
function loadCanvasImage(src: string): Promise<HTMLImageElement> {
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

function visibleSourceRect(image: HTMLImageElement): Rect {
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

function getPlacementTarget(placement: Placement, canvasWidth: number, canvasHeight: number) {
  return {
    x: (placement.x / 100) * canvasWidth,
    y: (placement.y / 100) * canvasHeight,
    width: (placement.width / 100) * canvasWidth,
    height: (placement.height / 100) * canvasHeight,
  };
}

function constrainPlacement(placement: Placement): Placement {
  return normalizePlacement(placement);
}

function drawRealisticPrint(
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

function MockupPlacementPreview({
  frame,
  designDataUrl,
  onPlacementChange,
  compact = false,
  previewOnly = false,
}: {
  frame: MockupFrame;
  designDataUrl: string | null;
  onPlacementChange: (placement: Placement) => void;
  compact?: boolean;
  previewOnly?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const printBuffers = useRef<{ print: HTMLCanvasElement; texture: HTMLCanvasElement } | null>(null);
  const [dragState, setDragState] = useState<RegionDragState | null>(null);
  const [showGuides, setShowGuides] = useState(true);
  const [mode, setMode] = useState<'artwork' | 'region'>(designDataUrl ? 'artwork' : 'region');
  const artworkBounds = useRef<{ rect: Rect; inner: Rect } | null>(null);
  const artworkDrag = useRef<{ x: number; y: number; start: ArtworkPlacement; placement: Placement; slackX: number; slackY: number; rect: Rect; inner: Rect; handle?: ArtworkResizeHandle } | null>(null);
  useEffect(() => { setMode(designDataUrl ? 'artwork' : 'region'); }, [designDataUrl]);
  useEffect(() => { setShowGuides(!previewOnly); }, [previewOnly]);

  useEffect(() => {
    let isCancelled = false;

    async function drawPreview() {
      const canvas = canvasRef.current;
      if (!canvas || !frame.imageDataUrl) return;
      const mockupImage = await loadCanvasImage(frame.imageDataUrl);
      const designImage = frame.applyDesign && designDataUrl ? await loadCanvasImage(designDataUrl) : null;
      if (isCancelled) return;

      const previewScale = Math.min(1, 1000 / Math.max(mockupImage.naturalWidth, mockupImage.naturalHeight));
      const width = Math.max(1, Math.round(mockupImage.naturalWidth * previewScale));
      const height = Math.max(1, Math.round(mockupImage.naturalHeight * previewScale));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(mockupImage, 0, 0, canvas.width, canvas.height);

      const target = getPlacementTarget(frame.placement, canvas.width, canvas.height);

      if (designImage) {
        printBuffers.current ??= { print: document.createElement('canvas'), texture: document.createElement('canvas') };
        drawRealisticPrint(ctx, mockupImage, designImage, canvas.width, canvas.height, frame, printBuffers.current);
        const margin = frame.placement.margin / 100;
        const inner = { x: target.x + target.width * margin, y: target.y + target.height * margin, width: target.width * (1 - margin * 2), height: target.height * (1 - margin * 2) };
        const sourceRect = visibleSourceRect(designImage);
        const rect = artworkRect(sourceRect.width, sourceRect.height, inner, frame.placement.artwork);
        artworkBounds.current = { rect, inner };
      } else {
        artworkBounds.current = null;
      }
      if (!designImage && frame.applyDesign) {
        ctx.save();
        ctx.fillStyle = "rgba(37, 99, 235, 0.16)";
        ctx.fillRect(target.x, target.y, target.width, target.height);
        ctx.restore();
      }

      if (frame.applyDesign && showGuides) {
        ctx.save();
        if (dragState && mode === 'region') {
          const centerX = frame.placement.x + frame.placement.width / 2;
          const centerY = frame.placement.y + frame.placement.height / 2;
          ctx.strokeStyle = '#f97316';
          ctx.lineWidth = Math.max(2, canvas.width * 0.0025);
          ctx.setLineDash([Math.max(8, canvas.width * 0.01), Math.max(6, canvas.width * 0.007)]);
          if (Math.abs(centerX - 50) <= 1) {
            ctx.beginPath(); ctx.moveTo(canvas.width / 2, 0); ctx.lineTo(canvas.width / 2, canvas.height); ctx.stroke();
          }
          if (Math.abs(centerY - 50) <= 1) {
            ctx.beginPath(); ctx.moveTo(0, canvas.height / 2); ctx.lineTo(canvas.width, canvas.height / 2); ctx.stroke();
          }
          ctx.setLineDash([]);
        }
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = Math.max(3, canvas.width * 0.004);
        ctx.setLineDash([Math.max(12, canvas.width * 0.015), Math.max(8, canvas.width * 0.01)]);
        ctx.strokeRect(target.x, target.y, target.width, target.height);
        ctx.setLineDash([]);
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#2563eb";
        const handleSize = Math.max(14, canvas.width * 0.018);
        const handlePoints = [
          [target.x, target.y],
          [target.x + target.width / 2, target.y],
          [target.x + target.width, target.y],
          [target.x, target.y + target.height / 2],
          [target.x + target.width, target.y + target.height / 2],
          [target.x, target.y + target.height],
          [target.x + target.width / 2, target.y + target.height],
          [target.x + target.width, target.y + target.height],
        ];
        if (!frame.placement.locked && (mode === 'region' || !designImage)) handlePoints.forEach(([x, y]) => {
          ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
          ctx.strokeRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
        });
        ctx.restore();
        if (mode === 'artwork' && artworkBounds.current) {
          const { rect } = artworkBounds.current;
          ctx.save(); ctx.strokeStyle = '#16a34a'; ctx.lineWidth = Math.max(2, canvas.width * 0.003);
          ctx.translate(rect.x + rect.width / 2, rect.y + rect.height / 2);
          ctx.rotate((normalizeArtwork(frame.placement.artwork).rotation || 0) * Math.PI / 180);
          ctx.strokeRect(-rect.width / 2, -rect.height / 2, rect.width, rect.height);
          ctx.restore();
          if (!frame.placement.locked) {
            ctx.save();
            const size = Math.max(14, canvas.width * 0.018);
            ctx.fillStyle = '#ffffff';
            for (const [x, y] of [[rect.x, rect.y], [rect.x + rect.width / 2, rect.y], [rect.x + rect.width, rect.y], [rect.x + rect.width, rect.y + rect.height / 2], [rect.x + rect.width, rect.y + rect.height], [rect.x + rect.width / 2, rect.y + rect.height], [rect.x, rect.y + rect.height], [rect.x, rect.y + rect.height / 2]]) {
              ctx.fillRect(x - size / 2, y - size / 2, size, size);
              ctx.strokeRect(x - size / 2, y - size / 2, size, size);
            }
            ctx.restore();
          }
        }
      }
    }

    const animationFrame = requestAnimationFrame(() => { void drawPreview().catch((error) => {
      console.error(error);
    }); });

    return () => {
      isCancelled = true;
      cancelAnimationFrame(animationFrame);
    };
  }, [designDataUrl, dragState, frame, mode, showGuides]);

  const getPointerPercent = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: clampNumber(((event.clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clampNumber(((event.clientY - rect.top) / rect.height) * 100, 0, 100),
    };
  };

  const getDragMode = (point: { x: number; y: number }): RegionDragMode | null => {
    const { x, y, width, height } = frame.placement;
    const right = x + width;
    const bottom = y + height;
    const hit = 3;
    const nearLeft = Math.abs(point.x - x) <= hit;
    const nearRight = Math.abs(point.x - right) <= hit;
    const nearTop = Math.abs(point.y - y) <= hit;
    const nearBottom = Math.abs(point.y - bottom) <= hit;
    const insideX = point.x >= x && point.x <= right;
    const insideY = point.y >= y && point.y <= bottom;

    if (nearLeft && nearTop) return "nw";
    if (nearRight && nearTop) return "ne";
    if (nearLeft && nearBottom) return "sw";
    if (nearRight && nearBottom) return "se";
    if (nearTop && insideX) return "n";
    if (nearBottom && insideX) return "s";
    if (nearLeft && insideY) return "w";
    if (nearRight && insideY) return "e";
    if (insideX && insideY) return "move";
    return null;
  };

  const resizePlacement = (state: RegionDragState, point: { x: number; y: number }): Placement => {
    const dx = point.x - state.startX;
    const dy = point.y - state.startY;
    const start = state.startPlacement;
    const minSize = 5;
    let left = start.x;
    let top = start.y;
    let right = start.x + start.width;
    let bottom = start.y + start.height;

    if (state.mode === "move") {
      const moved = constrainPlacement({
        ...start,
        x: start.x + dx,
        y: start.y + dy,
      });
      if (Math.abs(moved.x + moved.width / 2 - 50) <= 1.5) moved.x = (100 - moved.width) / 2;
      if (Math.abs(moved.y + moved.height / 2 - 50) <= 1.5) moved.y = (100 - moved.height) / 2;
      return moved;
    }

    if (state.mode.includes("w")) left = clampNumber(left + dx, 0, right - minSize);
    if (state.mode.includes("e")) right = clampNumber(right + dx, left + minSize, 100);
    if (state.mode.includes("n")) top = clampNumber(top + dy, 0, bottom - minSize);
    if (state.mode.includes("s")) bottom = clampNumber(bottom + dy, top + minSize, 100);

    return constrainPlacement({
      ...start,
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    });
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (previewOnly) return;
    if (!frame.applyDesign || frame.placement.locked) return;
    const point = getPointerPercent(event);
    if (!point) return;
    if (mode === 'artwork' && designDataUrl && artworkBounds.current) {
      const canvas = canvasRef.current!;
      const { rect, inner } = artworkBounds.current;
      const px = point.x / 100 * canvas.width;
      const py = point.y / 100 * canvas.height;
      const hit = 10 * canvas.width / canvas.getBoundingClientRect().width;
      const handles: [ArtworkResizeHandle, number, number][] = [
        ['nw', rect.x, rect.y], ['ne', rect.x + rect.width, rect.y], ['sw', rect.x, rect.y + rect.height], ['se', rect.x + rect.width, rect.y + rect.height],
        ['n', rect.x + rect.width / 2, rect.y], ['s', rect.x + rect.width / 2, rect.y + rect.height], ['w', rect.x, rect.y + rect.height / 2], ['e', rect.x + rect.width, rect.y + rect.height / 2],
      ];
      const handle = handles.find(([, x, y]) => Math.abs(px - x) <= hit && Math.abs(py - y) <= hit)?.[0];
      if (!handle && (px < rect.x || px > rect.x + rect.width || py < rect.y || py > rect.y + rect.height)) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      artworkDrag.current = { x: px, y: py, start: normalizeArtwork(frame.placement.artwork), placement: frame.placement, slackX: inner.width - rect.width, slackY: inner.height - rect.height, rect, inner, handle };
      return;
    }
    const hitMode = getDragMode(point);
    const regionMode = hitMode || "move";
    event.currentTarget.setPointerCapture(event.pointerId);
    if (hitMode === null) {
      const placement = constrainPlacement({
        ...frame.placement,
        x: point.x - frame.placement.width / 2,
        y: point.y - frame.placement.height / 2,
      });
      onPlacementChange(placement);
      setDragState({ mode: regionMode, startX: point.x, startY: point.y, startPlacement: placement });
      return;
    }
    setDragState({ mode: regionMode, startX: point.x, startY: point.y, startPlacement: frame.placement });
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (previewOnly) return;
    if (frame.placement.locked) return;
    if (artworkDrag.current) {
      const point = getPointerPercent(event);
      if (!point || !canvasRef.current) return;
      const drag = artworkDrag.current;
      const dx = point.x / 100 * canvasRef.current.width - drag.x;
      const dy = point.y / 100 * canvasRef.current.height - drag.y;
      onPlacementChange({ ...drag.placement, artwork: drag.handle ? resizeArtwork(drag.start, drag.rect, drag.inner, drag.handle, dx, dy) : dragArtwork(drag.start, dx, dy, drag.slackX, drag.slackY) });
      return;
    }
    if (!frame.applyDesign || !dragState) return;
    const point = getPointerPercent(event);
    if (!point) return;
    onPlacementChange(resizePlacement(dragState, point));
  };

  const stopDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragState(null);
    artworkDrag.current = null;
  };

  if (!frame.imageDataUrl) {
    return (
      <div className="h-full min-h-[520px] border border-dashed border-zinc-300 bg-white flex flex-col items-center justify-center text-center p-8">
        <ImageIcon size={34} className="text-zinc-300 mb-3" />
        <h3 className="text-sm font-semibold text-zinc-800">Upload a blank mockup</h3>
        <p className="text-xs text-zinc-500 mt-1 max-w-sm">Once the blank image is loaded, this area becomes the mapping preview.</p>
      </div>
    );
  }

  return (
    <div className={compact ? 'flex flex-col border border-zinc-200 bg-zinc-100' : 'h-full min-h-[520px] flex flex-col bg-zinc-100 border border-zinc-200'}>
      {frame.applyDesign && !previewOnly && <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-white px-3 py-2 text-xs">
        <span className="text-zinc-500">{frame.placement.locked ? 'Placement locked' : mode === 'artwork' ? 'Drag artwork; drag its white edge handles to resize' : 'Drag the blue print area or its handles; orange guides show center alignment'}</span>
        <div className="flex gap-2">
          {designDataUrl && <button disabled={frame.placement.locked} onClick={() => setMode(mode === 'artwork' ? 'region' : 'artwork')} className="px-2 py-1 text-blue-600 hover:bg-blue-50 disabled:opacity-50">{mode === 'artwork' ? 'Adjust print area' : 'Done'}</button>}
          <button type="button" aria-pressed={showGuides} onClick={() => setShowGuides(value => !value)} className="px-2 py-1 text-blue-600 hover:bg-blue-50">{showGuides ? 'Hide guides' : 'Show guides'}</button>
          <button aria-pressed={!!frame.placement.locked} onClick={() => onPlacementChange({ ...frame.placement, locked: !frame.placement.locked })} className="border border-zinc-200 px-2 py-1 text-zinc-700">{frame.placement.locked ? 'Unlock placement' : 'Lock placement'}</button>
        </div>
      </div>}
      <div className={`flex items-center justify-center overflow-hidden p-4 ${compact ? 'h-[min(65vh,640px)]' : 'flex-1 min-h-0'}`}>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        aria-label={mode === 'artwork' ? 'Drag artwork inside the print region' : 'Move or resize print region'}
        className={`max-h-full max-w-full touch-none bg-white shadow-sm ${previewOnly ? 'cursor-default' : frame.placement.locked ? 'cursor-not-allowed' : mode === 'artwork' ? 'cursor-move' : 'cursor-crosshair'}`}
      />
      </div>
    </div>
  );
}

function ArtworkPlacementControls({ placement, onChange }: { placement: Placement; onChange: (placement: Placement) => void }) {
  const artwork = normalizeArtwork(placement.artwork);
  const changeArtwork = (changes: Partial<ArtworkPlacement>) => onChange({ ...placement, artwork: normalizeArtwork({ ...artwork, ...changes }) });
  const slider = (key: 'x' | 'y') => <label key={key} className="block text-xs text-zinc-600"><span>{key === 'x' ? 'Horizontal position' : 'Vertical position'} · {Math.round(artwork[key])}%</span><input aria-label={`Artwork ${key === 'x' ? 'horizontal' : 'vertical'} position`} type="range" min={0} max={100} value={artwork[key]} onChange={e => changeArtwork({ [key]: Number(e.target.value) })} className="w-full accent-blue-600" /></label>;
  return <fieldset disabled={!!placement.locked} className="space-y-4 disabled:opacity-50">
    <div className="grid gap-2">{(Object.keys(ARTWORK_PRESETS) as ArtworkPresetId[]).map(id => <button key={id} aria-pressed={JSON.stringify(artwork) === JSON.stringify(presetArtwork(id))} onClick={() => onChange({ ...placement, margin: 0, artwork: presetArtwork(id) })} className="border border-zinc-200 bg-white px-3 py-2 text-left text-xs text-zinc-700 hover:bg-blue-50 aria-pressed:border-blue-600 aria-pressed:bg-blue-50">{ARTWORK_PRESETS[id].label}</button>)}</div>
    <p className="text-[11px] text-zinc-500">Pocket is wearer-left (photo-right). White handles resize without stretching.</p>
    <div className="grid grid-cols-2 gap-2">{(['contain', 'cover'] as const).map(fit => <button key={fit} onClick={() => onChange({ ...placement, margin: 0, artwork: { x: 50, y: 50, scale: 100, ...(fit === 'cover' ? { fit } : {}) } })} className="border border-zinc-200 px-2 py-2 text-xs hover:bg-blue-50">{fit === 'contain' ? 'Fit whole design' : 'Fill region (crop)'}</button>)}</div>
    <p className="text-[11px] text-zinc-500">Fit keeps all artwork visible. Fill reaches every border and crops overflow.</p>
    <label className="block space-y-2 text-xs text-zinc-600"><span className="flex items-center justify-between">Size (%)<input aria-label="Artwork size percent" type="number" min={10} max={100} value={Math.round(artwork.scale)} onChange={e => changeArtwork({ scale: Number(e.target.value) })} className="w-16 border border-zinc-200 p-1 text-right" /></span><input aria-label="Artwork scale" type="range" min={10} max={100} value={artwork.scale} onChange={e => changeArtwork({ scale: Number(e.target.value) })} className="w-full accent-blue-600" /></label>
    <label className="block space-y-2 text-xs text-zinc-600"><span className="flex items-center justify-between">Rotation (°)<input aria-label="Artwork rotation degrees" type="number" min={-180} max={180} value={Math.round(artwork.rotation || 0)} onChange={e => changeArtwork({ rotation: Number(e.target.value) })} className="w-16 border border-zinc-200 p-1 text-right" /></span><input aria-label="Artwork rotation" type="range" min={-180} max={180} step={1} value={artwork.rotation || 0} onChange={e => changeArtwork({ rotation: Number(e.target.value) })} className="w-full accent-blue-600" /><button type="button" onClick={() => changeArtwork({ rotation: 0 })} className="text-blue-600 hover:underline">Reset rotation</button></label>
    <div className="space-y-2"><p className="text-xs font-medium text-zinc-600">Align to region</p><div className="grid grid-cols-3 gap-1">{(['top', 'left', 'center', 'right', 'bottom'] as FitPosition[]).map(position => <button key={position} onClick={() => { const fitted = fitArtwork(position); changeArtwork(position === 'top' || position === 'bottom' ? { y: fitted.y } : position === 'left' || position === 'right' ? { x: fitted.x } : { x: 50, y: 50 }); }} className="border border-zinc-200 px-2 py-2 text-xs capitalize hover:bg-blue-50">Align {position}</button>)}</div></div>
    <label className="block space-y-2 text-xs text-zinc-600"><span className="flex items-center justify-between">Edge gap (%)<input aria-label="Edge gap percent" type="number" min={0} max={25} value={placement.margin} onChange={e => onChange({ ...placement, margin: clampNumber(Number(e.target.value), 0, 25) })} className="w-16 border border-zinc-200 p-1 text-right" /></span><input aria-label="Edge gap" type="range" min={0} max={25} value={placement.margin} onChange={e => onChange({ ...placement, margin: Number(e.target.value) })} className="w-full accent-blue-600" /></label>
    <details className="text-xs text-zinc-500"><summary className="cursor-pointer py-1">Fine-tune position</summary><div className="mt-3 space-y-4">{slider('x')}{slider('y')}</div></details>
    {placement.locked && <p className="text-xs text-zinc-500">Unlock placement above the preview to edit.</p>}
  </fieldset>;
}

function PrintAreaControls({ placement, onChange }: { placement: Placement; onChange: (placement: Placement) => void }) {
  const update = (changes: Partial<Placement>) => onChange({ ...placement, ...changes });
  return <section className="space-y-3">
    <div className="flex items-center justify-between gap-2"><h3 className="text-xs font-semibold text-zinc-800">Print area</h3><button type="button" onClick={() => update({ x: (100 - placement.width) / 2 })} className="text-xs text-blue-600 hover:underline">Center</button></div>
    <p className="text-xs text-zinc-500">Drag the blue box to move it; drag its handles to resize.</p>
    <details className="text-xs text-zinc-600"><summary className="cursor-pointer py-1">Precise area and print look</summary><div className="mt-3 space-y-3">
      {(['x', 'y', 'width', 'height'] as const).map(key => <label key={key} className="flex items-center justify-between gap-2 capitalize"><span>{key === 'x' ? 'Left' : key === 'y' ? 'Top' : key}</span><input aria-label={`Print area ${key}`} type="number" min={key === 'width' || key === 'height' ? 5 : 0} max={100} value={Math.round(placement[key])} onChange={e => update({ [key]: clampNumber(Number(e.target.value), key === 'width' || key === 'height' ? 5 : 0, 100) })} className="w-16 border border-zinc-200 p-1 text-right" /></label>)}
      {(['opacity', 'realism', 'softness'] as const).map(key => <label key={key} className="block capitalize">{key}: {placement[key]}{key === 'softness' ? 'px' : '%'}<input aria-label={`Print ${key}`} type="range" min={0} max={key === 'opacity' ? 100 : key === 'realism' ? 40 : 4} step={key === 'softness' ? 0.5 : 1} value={placement[key]} onChange={e => update({ [key]: Number(e.target.value) })} className="mt-1 w-full" /></label>)}
    </div></details>
  </section>;
}

function MockupPresetManagerModal({
  presets,
  activePresetId,
  designDataUrl,
  onClose,
  onSelect,
  onCreatePreset,
  onDuplicate,
  onDelete,
  onRename,
  onUpdateMeta,
  onUpdateFrame,
  onUpdateFramePlacement,
  onDeleteFrame,
  onAddFrameSlot,
  onAddFrameImages,
  onUploadFrameImage,
  initialTab = "mapping",
}: {
  presets: MockupPreset[];
  activePresetId: string;
  designDataUrl: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onCreatePreset: () => string;
  onDuplicate: (id: string) => string | null;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onUpdateMeta: (id: string, updates: Pick<MockupPreset, "productType" | "color">) => void;
  onUpdateFrame: (presetId: string, frameId: string, updates: Partial<MockupFrame>) => void;
  onUpdateFramePlacement: (presetId: string, frameId: string, placement: Placement) => void;
  onDeleteFrame: (presetId: string, frameId: string) => void;
  onAddFrameSlot: (presetId: string, role: MockupFrame["role"]) => string | null;
  onAddFrameImages: (presetId: string, files: File[]) => Promise<string | null>;
  onUploadFrameImage: (presetId: string, frameId: string, file: File) => Promise<void>;
  initialTab?: "details" | "mapping";
}) {
  const [editingPresetId, setEditingPresetId] = useState(activePresetId);
  const [activeTab, setActiveTab] = useState<"details" | "mapping">(initialTab);
  const [selectedFrameId, setSelectedFrameId] = useState("");
  const frameInputRef = useRef<HTMLInputElement>(null);
  const slotImageInputRef = useRef<HTMLInputElement>(null);
  const [frameUploadTargetId, setFrameUploadTargetId] = useState<string | null>(null);
  const editingPreset = presets.find(preset => preset.id === editingPresetId) || presets[0];
  const selectedFrame = editingPreset?.frames.find(frame => frame.id === selectedFrameId) || editingPreset?.frames[0];

  useEffect(() => {
    if (!presets.some(preset => preset.id === editingPresetId)) {
      setEditingPresetId(presets[0]?.id || "");
    }
  }, [editingPresetId, presets]);

  useEffect(() => {
    if (!editingPreset) return;
    if (!editingPreset.frames.some(frame => frame.id === selectedFrameId)) {
      setSelectedFrameId(editingPreset.frames[0]?.id || "");
    }
  }, [editingPreset, selectedFrameId]);

  if (!editingPreset) return null;

  const nextSlotRole: MockupFrame["role"] = editingPreset.frames.some(frame => frame.role === "Front") ? "Back" : "Front";
  const handleImportImages = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    const firstFrameId = await onAddFrameImages(editingPreset.id, files);
    if (firstFrameId) setSelectedFrameId(firstFrameId);
    if (frameInputRef.current) frameInputRef.current.value = "";
  };

  const handleSlotImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !frameUploadTargetId) return;
    await onUploadFrameImage(editingPreset.id, frameUploadTargetId, file);
    setFrameUploadTargetId(null);
    if (slotImageInputRef.current) slotImageInputRef.current.value = "";
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-zinc-900/55" onClick={onClose}>
      <div className="bg-white w-full h-full flex flex-col overflow-hidden shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-zinc-300 bg-zinc-50">
          <div>
            <h2 className="text-base font-bold text-zinc-800">Manage templates</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-zinc-200 text-zinc-500">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">
          <div className="w-60 shrink-0 border-r border-zinc-300 bg-zinc-50 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-zinc-300 space-y-2">
              <div className="text-xs font-semibold text-zinc-700">Templates</div>
              <button onClick={() => { const id = onCreatePreset(); setEditingPresetId(id); setActiveTab("mapping"); }} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-blue-600 text-white border border-blue-700 hover:bg-blue-700">
                <Plus size={14} /> New template
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {presets.map(preset => (
                <div
                  key={preset.id}
                  className={`group flex items-center justify-between p-3 border-b border-zinc-200 cursor-pointer ${editingPreset.id === preset.id ? "bg-blue-50 border-l-2 border-l-blue-500" : "bg-white hover:bg-zinc-50"}`}
                  onClick={() => setEditingPresetId(preset.id)}
                >
                  <div className="min-w-0">
                    <h4 className={`text-sm font-medium truncate ${editingPreset.id === preset.id ? "text-blue-700" : "text-zinc-800"}`}>{preset.name}</h4>
                    <p className="text-xs text-zinc-500 truncate">{preset.productType} / {preset.color}</p>
                  </div>
                  <div className={`flex items-center gap-1 pl-2 ${editingPreset.id === preset.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}>
                    <button onClick={(event) => { event.stopPropagation(); const nextId = onDuplicate(preset.id); if (nextId) setEditingPresetId(nextId); }} className="p-1 text-zinc-400 hover:text-blue-500 hover:bg-zinc-200" title="Duplicate Preset">
                      <Copy size={14} />
                    </button>
                    <button onClick={(event) => { event.stopPropagation(); onDelete(preset.id); }} className="p-1 text-zinc-400 hover:text-red-500 hover:bg-zinc-200" title="Delete Preset">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 min-w-0 bg-white flex flex-col min-h-0">
            <div className="flex border-b border-zinc-300 bg-zinc-50 shrink-0 select-none overflow-x-auto">
              <button onClick={() => setActiveTab("details")} className={`px-4 py-2 border-r border-zinc-300 text-[10px] font-bold uppercase tracking-wider ${activeTab === "details" ? "bg-white text-blue-600 border-b-2 border-b-blue-500" : "text-zinc-500 hover:bg-zinc-100"}`}>
                Template info
              </button>
              <button onClick={() => setActiveTab("mapping")} className={`px-4 py-2 border-r border-zinc-300 text-[10px] font-bold uppercase tracking-wider ${activeTab === "mapping" ? "bg-white text-blue-600 border-b-2 border-b-blue-500" : "text-zinc-500 hover:bg-zinc-100"}`}>
                Print area & design
              </button>
            </div>

            {activeTab === "details" ? (
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <label className="block text-xs font-medium text-zinc-700">
                  Preset Name
                  <input value={editingPreset.name} onChange={(event) => onRename(editingPreset.id, event.target.value)} className="mt-1 w-full px-3 py-2 text-sm border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                </label>
                <label className="block text-xs font-medium text-zinc-700">
                  Color
                  <input value={editingPreset.color} onChange={(event) => onUpdateMeta(editingPreset.id, { productType: editingPreset.productType, color: event.target.value })} className="mt-1 w-full px-3 py-2 text-sm border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                </label>
              </div>
              <label className="block text-xs font-medium text-zinc-700">
                Product Type
                <input value="Flat T-shirt" readOnly className="mt-1 w-full px-3 py-2 text-sm border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
              </label>

            </div>
            ) : (
            <div className="flex-1 min-h-0 grid grid-cols-[210px_1fr_260px] bg-zinc-100/50">
              <aside className="min-h-0 overflow-y-auto border-r border-zinc-200 bg-white p-3 space-y-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Frames</div>
                <input ref={frameInputRef} type="file" accept="image/*" multiple onChange={handleImportImages} className="hidden" />
                <input ref={slotImageInputRef} type="file" accept="image/*" onChange={handleSlotImageUpload} className="hidden" />
                <button onClick={() => frameInputRef.current?.click()} className="w-full border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-700 flex items-center justify-center gap-2">
                  <ImageIcon size={14} /> Import Blanks
                </button>
                <button onClick={() => { const id = onAddFrameSlot(editingPreset.id, nextSlotRole); if (id) setSelectedFrameId(id); }} className="w-full border border-zinc-200 bg-white hover:bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700 flex items-center justify-center gap-2">
                  <Plus size={14} /> Add Slot
                </button>
                <div className="space-y-2">
                  {editingPreset.frames.length === 0 ? (
                    <div className="border border-dashed border-zinc-300 bg-zinc-50 p-4 text-center text-xs text-zinc-500">
                      Add a slot or import blank mockups.
                    </div>
                  ) : editingPreset.frames.map(frame => (
                    <div
                      key={frame.id}
                      onClick={() => setSelectedFrameId(frame.id)}
                      className={`w-full border p-2 text-left flex items-center gap-2 ${selectedFrame?.id === frame.id ? "border-blue-500 bg-blue-50" : "border-zinc-200 bg-white hover:bg-zinc-50"}`}
                    >
                      <div className="relative w-11 h-11 bg-zinc-50 border border-zinc-100 shrink-0">
                        {frame.imageDataUrl ? (
                          <Image src={frame.imageDataUrl} alt={frame.name} fill unoptimized sizes="44px" className="object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-300">
                            <ImageIcon size={16} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold text-zinc-800">{frame.name}</div>
                        <div className="mt-1 text-[11px] text-zinc-500">{frame.role}{frame.applyDesign ? " / design" : " / blank"}</div>
                        {selectedFrame?.id === frame.id && (
                          <div className="mt-2 grid grid-cols-2 gap-1">
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                setFrameUploadTargetId(frame.id);
                                slotImageInputRef.current?.click();
                              }}
                              className="border border-zinc-200 bg-white hover:bg-zinc-100 px-1.5 py-1 text-[10px] font-medium text-zinc-700"
                            >
                              {frame.imageDataUrl ? "Replace" : "Upload"}
                            </button>
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                const nextFrame = editingPreset.frames.find(item => item.id !== frame.id);
                                onDeleteFrame(editingPreset.id, frame.id);
                                setSelectedFrameId(nextFrame?.id || "");
                              }}
                              className="border border-red-200 bg-white hover:bg-red-50 px-1.5 py-1 text-[10px] font-medium text-red-600"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </aside>

              <main className="min-h-0 overflow-hidden p-5">
                {selectedFrame ? (
                  <MockupPlacementPreview
                    frame={selectedFrame}
                    designDataUrl={designDataUrl}
                    onPlacementChange={(placement) => onUpdateFramePlacement(editingPreset.id, selectedFrame.id, placement)}
                  />
                ) : (
                  <div className="h-full min-h-[520px] border border-dashed border-zinc-300 bg-white flex flex-col items-center justify-center text-center p-8">
                    <ImageIcon size={34} className="text-zinc-300 mb-3" />
                    <h3 className="text-sm font-semibold text-zinc-800">Add a blank mockup image</h3>
                    <p className="text-xs text-zinc-500 mt-1 max-w-sm">Start with a front shirt image, then map where the design should sit.</p>
                    <button onClick={() => { const id = onAddFrameSlot(editingPreset.id, "Front"); if (id) setSelectedFrameId(id); }} className="mt-4 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white">
                      Add Front Slot
                    </button>
                  </div>
                )}
              </main>

              <aside className="min-h-0 overflow-y-auto border-l border-zinc-200 bg-white p-4">
                {selectedFrame ? (
                  <div className="space-y-4">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Mapping</div>
                      <div className="mt-1 text-sm font-semibold text-zinc-800">{selectedFrame.name}</div>
                    </div>

                    <label className="flex items-center gap-2 text-xs font-medium text-zinc-700">
                      <input type="checkbox" checked={selectedFrame.applyDesign} onChange={(event) => onUpdateFrame(editingPreset.id, selectedFrame.id, { applyDesign: event.target.checked })} />
                      Place design on this image
                    </label>

                    {selectedFrame.applyDesign && (
                      <div className="space-y-4">
                        <PrintAreaControls placement={selectedFrame.placement} onChange={placement => onUpdateFramePlacement(editingPreset.id, selectedFrame.id, placement)} />
                        <div className="border-t border-zinc-200 pt-4"><h3 className="mb-3 text-xs font-semibold text-zinc-800">Design placement</h3><ArtworkPlacementControls placement={selectedFrame.placement} onChange={placement => onUpdateFramePlacement(editingPreset.id, selectedFrame.id, placement)} /></div>
                      </div>
                    )}
                  </div>
                ) : null}
              </aside>
            </div>
            )}

            <div className="shrink-0 p-4 px-6 border-t border-zinc-200 bg-zinc-50 flex justify-between items-center">
              <span className="text-xs text-zinc-500">Changes save automatically</span>
              <div className="flex gap-2">
                <button onClick={() => { onSelect(editingPreset.id); onClose(); }} className="px-4 py-2 bg-white hover:bg-zinc-100 text-zinc-700 text-xs font-bold border border-zinc-300 transition-colors uppercase tracking-wider">
                  Use template
                </button>
                <button onClick={() => { onSelect(editingPreset.id); if (activeTab === "mapping") onClose(); else setActiveTab("mapping"); }} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold border border-blue-700 transition-colors uppercase tracking-wider">
                  {activeTab === "mapping" ? "Done" : "Edit print area"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MockupStudio({ product, onSave, onBack, templateOnly = false, onContinue, initialArtwork }: {
  templateOnly?: boolean;
  onContinue?: () => void;
  initialArtwork?: string;
  product?: WorkspaceProduct;
  onSave?: (snapshot: ProductSnapshot) => Promise<void>;
  onBack?: () => void;
} = {}) {
  const [presets, setPresets] = useState<MockupPreset[]>([]);
  const [activePresetId, setActivePresetId] = useState("");
  const [designDataUrl, setDesignDataUrl] = useState<string | null>(product?.artworks?.front || product?.designDataUrl || initialArtwork || null);
  const [backDesignDataUrl, setBackDesignDataUrl] = useState<string | null>(product?.artworks?.back ?? null);
  const [generated, setGenerated] = useState<GeneratedMockup[]>(product?.generated ?? []);
  const [saveStatus, setSaveStatus] = useState("Saved");
  const renderedInputRef = useRef(product ? productInputSignature({ ...product, designDataUrl: product.artworks?.front || product.designDataUrl }) : "");
  const pendingSnapshotRef = useRef<ProductSnapshot | null>(null);
  const onSaveRef = useRef(onSave);
  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);
  const savedSnapshotRef = useRef("");
  const saveSequenceRef = useRef(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [changingColor, setChangingColor] = useState(false);
  const [frameUploadTargetId, setFrameUploadTargetId] = useState<string | null>(null);
  const [isPresetManagerOpen, setIsPresetManagerOpen] = useState(false);
  const [presetManagerInitialTab, setPresetManagerInitialTab] = useState<"details" | "mapping">("details");
  const [selectedFrameId, setSelectedFrameId] = useState("");
  const [previewOnly, setPreviewOnly] = useState(false);
  const designInputRef = useRef<HTMLInputElement>(null);
  const backDesignInputRef = useRef<HTMLInputElement>(null);
  const frameInputRef = useRef<HTMLInputElement>(null);
  const slotImageInputRef = useRef<HTMLInputElement>(null);
  const hasLoadedPresetsRef = useRef(false);
  const storageErrorShownRef = useRef(false);
  const pendingPresetsRef = useRef<MockupPreset[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    const hydratePresets = async () => {
      if (product) {
        hasLoadedPresetsRef.current = true;
        setPresets([normalizePreset(product.preset)]);
        setActivePresetId(product.preset.id);
        return;
      }
      let storedPresets: unknown;

      try {
        storedPresets = await loadMockupPresets();
      } catch (error) {
        console.warn("Failed to load mockup presets from IndexedDB:", error);
      }

      if (storedPresets === undefined) {
        try {
          const legacyValue = localStorage.getItem(LEGACY_STORAGE_KEY);
          if (legacyValue) {
            storedPresets = JSON.parse(legacyValue);
            await saveMockupPresets(storedPresets);
            localStorage.removeItem(LEGACY_STORAGE_KEY);
          }
        } catch (error) {
          console.warn("Failed to migrate legacy mockup presets:", error);
        }
      }

      if (cancelled) return;

      const validPresets = Array.isArray(storedPresets)
        ? storedPresets.filter(isValidPreset).map(normalizePreset)
        : [];
      const nextPresets = validPresets.length > 0 ? validPresets : [createTshirtPreset()];

      hasLoadedPresetsRef.current = true;
      setPresets(nextPresets);
      setActivePresetId(nextPresets[0].id);
    };

    void hydratePresets();
    return () => {
      cancelled = true;
    };
  }, [product]);

  useEffect(() => {
    if (product || !hasLoadedPresetsRef.current || presets.length === 0) return;
    pendingPresetsRef.current = presets;

    const saveTimer = window.setTimeout(() => {
      void saveMockupPresets(presets).then(() => {
        if (pendingPresetsRef.current === presets) pendingPresetsRef.current = null;
        storageErrorShownRef.current = false;
      }).catch((error) => {
        console.warn("Failed to save mockup presets:", error);
        if (!storageErrorShownRef.current) {
          storageErrorShownRef.current = true;
          toast.error("Could not save mockup presets in browser storage.");
        }
      });
    }, 500);

    return () => {
      window.clearTimeout(saveTimer);
    };
  }, [presets, product]);

  useEffect(() => () => {
    if (pendingPresetsRef.current) void saveMockupPresets(pendingPresetsRef.current).catch(() => toast.error('Could not save template changes.'));
  }, []);

  const activePreset = useMemo(
    () => presets.find((preset) => preset.id === activePresetId) || presets[0],
    [activePresetId, presets]
  );
  const selectedFrame = useMemo(
    () => activePreset?.frames.find(frame => frame.id === selectedFrameId) || activePreset?.frames[0],
    [activePreset, selectedFrameId]
  );

  const saveCurrent = async () => {
    const snapshot = pendingSnapshotRef.current;
    if (!snapshot || !onSaveRef.current) return;
    const signature = JSON.stringify(snapshot);
    if (signature === savedSnapshotRef.current) return;
    const sequence = ++saveSequenceRef.current;
    setSaveStatus("Saving…");
    try {
      await onSaveRef.current(snapshot);
      savedSnapshotRef.current = signature;
      if (sequence === saveSequenceRef.current) setSaveStatus("Saved");
    } catch (error) {
      if (sequence === saveSequenceRef.current) setSaveStatus(error instanceof Error ? error.message : "Save failed. Retry saving.");
      throw error;
    }
  };

  useEffect(() => {
    if (!product || !activePreset || !hasLoadedPresetsRef.current) return;
    const artworks = product.artworks || backDesignDataUrl ? { ...(designDataUrl ? { front: designDataUrl } : {}), ...(backDesignDataUrl ? { back: backDesignDataUrl } : {}) } : undefined;
    const signature = productInputSignature({ designDataUrl, artworks, preset: activePreset });
    const currentGenerated = signature === renderedInputRef.current ? generated : [];
    if (currentGenerated !== generated && generated.length) setGenerated([]);
    const snapshot = { designDataUrl, artworks, preset: activePreset, generated: currentGenerated };
    pendingSnapshotRef.current = snapshot;
    const serialized = JSON.stringify(snapshot);
    if (!savedSnapshotRef.current) {
      savedSnapshotRef.current = JSON.stringify({ designDataUrl: product.designDataUrl, artworks: product.artworks, preset: normalizePreset(product.preset), generated: product.generated });
    }
    if (serialized === savedSnapshotRef.current) return;
    setSaveStatus("Unsaved changes");
    const timer = window.setTimeout(() => { void saveCurrent().catch(() => undefined); }, 500);
    return () => window.clearTimeout(timer);
    // saveCurrent reads the latest snapshot and callback from refs.
  }, [activePreset, backDesignDataUrl, designDataUrl, generated, product]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (pendingSnapshotRef.current && JSON.stringify(pendingSnapshotRef.current) !== savedSnapshotRef.current) {
        event.preventDefault();
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      const snapshot = pendingSnapshotRef.current;
      if (snapshot && JSON.stringify(snapshot) !== savedSnapshotRef.current) {
        // Route unmount saves through the same revision queue as autosave and explicit save.
        // A second direct callback here can finish last and overwrite freshly rendered images.
        void saveCurrent().catch(error => toast.error(error instanceof Error ? error.message : 'Product save failed.'));
      }
    };
  }, []);

  useEffect(() => {
    if (!activePreset) return;
    if (!activePreset.frames.some(frame => frame.id === selectedFrameId)) {
      setSelectedFrameId(activePreset.frames[0]?.id || "");
    }
  }, [activePreset, selectedFrameId]);

  const updatePreset = (updates: Partial<MockupPreset>) => {
    if (!activePreset) return;
    setPresets(prev => prev.map(preset => preset.id === activePreset.id ? { ...preset, ...updates } : preset));
    setGenerated([]);
  };

  const updatePresetById = (id: string, updates: Partial<MockupPreset>) => {
    setPresets(prev => prev.map(preset => preset.id === id ? { ...preset, ...updates } : preset));
  };

  const updateFrame = (frameId: string, updates: Partial<MockupFrame>) => {
    if (!activePreset) return;
    updatePreset({
      frames: activePreset.frames.map(frame => frame.id === frameId ? { ...frame, ...updates } : frame),
    });
  };

  const updateFramePlacement = (frameId: string, placement: Placement) => {
    const current = activePreset?.frames.find(frame => frame.id === frameId)?.placement;
    if (current?.locked && placement.locked !== false) return;
    updateFrame(frameId, { placement: normalizePlacement(placement) });
  };

  const changeVintageColor = async (color: VintageColor) => {
    if (!activePreset || changingColor || activePreset.color === color) return;
    setChangingColor(true);
    try {
      const frames = await Promise.all(activePreset.frames.map(async frame => {
        if (!frame.imageDataUrl) return frame;
        const view = frame.role === 'Back' ? 'back' : 'front';
        const response = await fetch(`/mockups/vintage-${view}-2k/${color.toLowerCase()}.jpg`);
        if (!response.ok) throw new Error(`Could not load the ${view} shirt in ${color}.`);
        const imageDataUrl = await readImageFile(new File([await response.blob()], `${color}-${view}.jpg`, { type: 'image/jpeg' }));
        return { ...frame, imageDataUrl };
      }));
      updatePreset({
        name: activePreset.id.startsWith('cc1717-') ? `Comfort Colors 1717 · ${color}` : `Vintage Front 2K · ${color}`,
        color,
        frames,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not change shirt color.');
    } finally {
      setChangingColor(false);
    }
  };

  const updateFrameByPresetId = (presetId: string, frameId: string, updates: Partial<MockupFrame>) => {
    setPresets(prev => prev.map(preset => {
      if (preset.id !== presetId) return preset;
      return {
        ...preset,
        frames: preset.frames.map(frame => frame.id === frameId ? { ...frame, ...updates } : frame),
      };
    }));
    setGenerated([]);
  };

  const updateFramePlacementByPresetId = (presetId: string, frameId: string, placement: Placement) => {
    const current = presets.find(preset => preset.id === presetId)?.frames.find(frame => frame.id === frameId)?.placement;
    if (current?.locked && placement.locked !== false) return;
    updateFrameByPresetId(presetId, frameId, { placement: normalizePlacement(placement) });
  };

  const deleteFrameByPresetId = (presetId: string, frameId: string) => {
    setPresets(prev => prev.map(preset => preset.id === presetId ? {
      ...preset,
      frames: preset.frames.filter(frame => frame.id !== frameId),
    } : preset));
    setGenerated([]);
  };

  const addFrameSlotToPreset = (presetId: string, role: MockupFrame["role"]) => {
    const id = `frame-${Date.now()}-${role.toLowerCase()}`;
    const frame: MockupFrame = {
      id,
      name: role,
      role,
      imageDataUrl: "",
      applyDesign: role === "Front",
      placement: { ...DEFAULT_PLACEMENT },
    };
    setPresets(prev => prev.map(preset => preset.id === presetId ? { ...preset, frames: [...preset.frames, frame] } : preset));
    if (presetId === activePresetId) setSelectedFrameId(id);
    setGenerated([]);
    return id;
  };

  const addFrameImagesToPreset = async (presetId: string, files: File[]) => {
    const preset = presets.find(item => item.id === presetId);
    if (!preset) return null;
    const imageFiles = files.filter(file => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      toast.error("Add PNG, JPG, or WEBP mockup images.");
      return null;
    }
    const emptySlots = preset.frames.filter(frame => !frame.imageDataUrl);
    if (preset.frames.filter(frame => frame.imageDataUrl).length + imageFiles.length > 10) {
      toast.error('Use up to 10 photos per T-shirt template.');
      return null;
    }
    const uploaded = await Promise.all(imageFiles.map(async (file, index) => ({
      ...(emptySlots[index] || {
        id: crypto.randomUUID(), name: file.name.replace(/\.[^.]+$/, ''),
        role: 'Front' as const, applyDesign: true, placement: { ...DEFAULT_PLACEMENT },
      }),
      imageDataUrl: await readImageFile(file),
    })));
    const replacements = new Map(uploaded.map(frame => [frame.id, frame]));
    const frames = [...preset.frames.map(frame => replacements.get(frame.id) || frame), ...uploaded.filter(frame => !preset.frames.some(existing => existing.id === frame.id))];
    setPresets(prev => prev.map(item => item.id === presetId ? { ...item, frames } : item));
    if (presetId === activePresetId) setSelectedFrameId(uploaded[0]?.id || '');
    setGenerated([]);
    return uploaded[0]?.id || null;
  };

  const uploadFrameImageToPreset = async (presetId: string, frameId: string, file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Upload a PNG, JPG, or WEBP blank mockup.");
      return;
    }
    updateFrameByPresetId(presetId, frameId, { imageDataUrl: await readImageFile(file) });
  };

  const addFrameSlot = (role: MockupFrame["role"]) => {
    if (!activePreset) return;
    const id = `frame-${Date.now()}-${role.toLowerCase()}`;
    const frame: MockupFrame = {
      id,
      name: role,
      role,
      imageDataUrl: "",
      applyDesign: role === "Front",
      placement: { ...DEFAULT_PLACEMENT },
    };
    updatePreset({ frames: [...activePreset.frames, frame] });
    setSelectedFrameId(id);
    setGenerated([]);
  };

  const handleDesignUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Upload a PNG, JPG, or WEBP design.");
      return;
    }
    setDesignDataUrl(await readImageFile(file));
    setGenerated([]);
    if (designInputRef.current) designInputRef.current.value = "";
  };

  const handleBackDesignUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Upload a PNG, JPG, or WEBP back design.'); return; }
    setBackDesignDataUrl(await readImageFile(file));
    if (activePreset) updatePreset({ frames: activePreset.frames.map(frame => frame.role === 'Back' ? { ...frame, applyDesign: true } : frame) });
    setGenerated([]);
    if (backDesignInputRef.current) backDesignInputRef.current.value = '';
  };

  const handleFrameUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!activePreset) return;
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    try { await addFrameImagesToPreset(activePreset.id, files); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not add photos.'); }
    if (frameInputRef.current) frameInputRef.current.value = "";
  };

  const handleSlotImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!frameUploadTargetId) return;
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Upload a PNG, JPG, or WEBP blank mockup.");
      return;
    }
    updateFrame(frameUploadTargetId, { imageDataUrl: await readImageFile(file) });
    setGenerated([]);
    setFrameUploadTargetId(null);
    if (slotImageInputRef.current) slotImageInputRef.current.value = "";
  };

  const handleGenerate = async () => {
    if (!activePreset) return;
    const readyFrames = activePreset.frames.filter(frame => frame.imageDataUrl);
    if (readyFrames.length === 0) {
      toast.error("Add blank mockup images to the preset first.");
      return;
    }
    const artworks = product?.artworks || backDesignDataUrl ? { ...(designDataUrl ? { front: designDataUrl } : {}), ...(backDesignDataUrl ? { back: backDesignDataUrl } : {}) } : undefined;
    if (readyFrames.some(frame => frame.applyDesign && !artworkForFrame({ designDataUrl, artworks }, frame.role))) {
      toast.error("Upload artwork for each printed view first.");
      return;
    }

    setIsGenerating(true);
    const inputSignature = productInputSignature({ designDataUrl, artworks, preset: activePreset });
    try {
      const results = await Promise.all(readyFrames.map(async (frame, index) => ({
        id: frame.id,
        name: `${String(index + 1).padStart(2, "0")}-${activePreset.color}-${frame.role}.png`,
        dataUrl: await renderMockup(frame, artworkForFrame({ designDataUrl, artworks }, frame.role)),
      })));
      if (product && pendingSnapshotRef.current && productInputSignature(pendingSnapshotRef.current) !== inputSignature) {
        throw new Error('The design changed during rendering. Generate again to use the latest placement.');
      }
      renderedInputRef.current = inputSignature;
      setGenerated(results);
      if (onSaveRef.current) {
        pendingSnapshotRef.current = { designDataUrl, artworks, preset: activePreset, generated: results };
        await saveCurrent();
      }
      toast.success("Mockups generated.");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to generate mockups.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadZip = async () => {
    if (generated.length === 0) return;
    const zip = new JSZip();
    for (const item of generated) {
      const response = await fetch(item.dataUrl);
      if (!response.ok) { toast.error(`Could not download ${item.name}.`); return; }
      zip.file(item.name, await response.blob());
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activePreset?.name || "mockups"}-${Date.now()}.zip`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const duplicatePreset = (id: string) => {
    const source = presets.find(preset => preset.id === id);
    if (!source) return null;
    const duplicate: MockupPreset = JSON.parse(JSON.stringify(source));
    duplicate.id = `mockup-${Date.now()}`;
    duplicate.name = `${source.name} (Copy)`;
    duplicate.frames = duplicate.frames.map((frame, index) => ({
      ...frame,
      id: `${duplicate.id}-frame-${index}`,
    }));
    setPresets(prev => [duplicate, ...prev]);
    setActivePresetId(duplicate.id);
    setSelectedFrameId(duplicate.frames[0]?.id || "");
    setGenerated([]);
    toast.success("Preset duplicated.");
    return duplicate.id;
  };

  const deletePreset = (id: string) => {
    if (presets.length <= 1) {
      toast.error("You must keep at least one preset.");
      return;
    }
    const nextPresets = presets.filter(preset => preset.id !== id);
    setPresets(nextPresets);
    if (activePresetId === id) {
      setActivePresetId(nextPresets[0].id);
      setSelectedFrameId(nextPresets[0].frames[0]?.id || "");
      setGenerated([]);
    }
    toast.success("Preset deleted.");
  };

  const addTshirtPreset = () => {
    const preset = createTshirtPreset();
    preset.name = `T-Shirt Preset ${presets.length + 1}`;
    setPresets(prev => [...prev, preset]);
    setActivePresetId(preset.id);
    setSelectedFrameId(preset.frames[0]?.id || "");
    setGenerated([]);
    return preset.id;
  };

  if (!activePreset) {
    return null;
  }

  if (templateOnly) {
    return (
      <div className="w-full h-full flex-1 min-h-0 bg-white flex flex-col">
        {isPresetManagerOpen && (
          <MockupPresetManagerModal
            presets={presets}
            activePresetId={activePreset.id}
            designDataUrl={designDataUrl}
            onClose={() => setIsPresetManagerOpen(false)}
            onSelect={(id) => { setActivePresetId(id); setGenerated([]); }}
            onCreatePreset={addTshirtPreset}
            onDuplicate={duplicatePreset}
            onDelete={deletePreset}
            onRename={(id, name) => updatePresetById(id, { name })}
            onUpdateMeta={(id, updates) => updatePresetById(id, updates)}
            onUpdateFrame={updateFrameByPresetId}
            onUpdateFramePlacement={updateFramePlacementByPresetId}
            onDeleteFrame={deleteFrameByPresetId}
            onAddFrameSlot={addFrameSlotToPreset}
            onAddFrameImages={addFrameImagesToPreset}
            onUploadFrameImage={uploadFrameImageToPreset}
            initialTab="mapping"
          />
        )}
        <div className="shrink-0 border-b border-zinc-200 bg-zinc-50 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-zinc-800">2. Mockup</h2>
            <p className="text-xs text-zinc-500">Build a User mockup here, then return to the Mockup library to use it.{initialArtwork ? ' Your extracted design is loaded for preview.' : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={activePreset.id}
              onChange={(event) => { setActivePresetId(event.target.value); setGenerated([]); }}
              className="h-8 border border-zinc-200 bg-white px-2 text-xs text-zinc-700 outline-none"
            >
              {presets.map(preset => (
                <option key={preset.id} value={preset.id}>{preset.name}</option>
              ))}
            </select>
            <button disabled={!activePreset.frames.some(frame => frame.imageDataUrl && frame.applyDesign)} onClick={async () => {
              try {
                await saveMockupPresets(presets);
                localStorage.setItem('workspace_default_template', activePreset.id);
                onContinue?.();
              } catch { toast.error('Could not save template. Please retry.'); }
            }} className="h-8 px-3 bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 disabled:opacity-50">
              Use User mockup →
            </button>
            <button onClick={() => onContinue?.()} className="h-8 border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50">Choose App mockup →</button>
            <button onClick={() => setIsPresetManagerOpen(true)} className="h-8 px-3 border border-zinc-200 bg-white text-xs font-medium text-zinc-700 hover:bg-zinc-50">
              Manage templates
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 overflow-y-auto lg:grid-cols-[220px_minmax(0,1fr)_250px] bg-zinc-100/50">
          <aside className="min-h-0 overflow-y-auto border-r border-zinc-200 bg-white p-3 space-y-3">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-semibold text-zinc-700">
                  Name
                  <input value={activePreset.name} onChange={(event) => updatePreset({ name: event.target.value })} className="mt-1 w-full border border-zinc-200 px-2 py-1.5 text-xs outline-none focus:border-blue-500" />
                </label>
                <label className="text-xs font-semibold text-zinc-700">
                  Color
                  <input value={activePreset.color} onChange={(event) => updatePreset({ color: event.target.value })} className="mt-1 w-full border border-zinc-200 px-2 py-1.5 text-xs outline-none focus:border-blue-500" />
                </label>
              </div>
            </div>

            <button onClick={addTshirtPreset} className="w-full px-3 py-2 border border-blue-200 bg-blue-50 text-xs font-medium text-blue-700 hover:bg-blue-100 flex items-center justify-center gap-1">
              <Plus size={12} /> New template
            </button>

            <input ref={slotImageInputRef} type="file" accept="image/*" onChange={handleSlotImageUpload} className="hidden" />
            <input ref={frameInputRef} type="file" accept="image/*" multiple onChange={handleFrameUpload} className="hidden" />
            <button onClick={() => frameInputRef.current?.click()} className="w-full border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-700 flex items-center justify-center gap-2">
              <ImageIcon size={14} /> Add flat T-shirt photos
            </button>
            <div className="grid grid-cols-2 gap-2">
                <button onClick={() => addFrameSlot("Front")} className="px-2 py-1.5 border border-zinc-200 bg-white text-xs font-medium text-zinc-700 hover:bg-zinc-50">
                  Add front
              </button>
              <button onClick={() => addFrameSlot("Back")} className="px-2 py-1.5 border border-zinc-200 bg-white text-xs font-medium text-zinc-700 hover:bg-zinc-50">
                  Add back
              </button>
            </div>

            <div className="space-y-2">
              {activePreset.frames.map((frame) => (
                <button
                  key={frame.id}
                  onClick={() => setSelectedFrameId(frame.id)}
                  className={`w-full border p-2 text-left flex items-center gap-3 ${selectedFrame?.id === frame.id ? "border-blue-500 bg-blue-50" : "border-zinc-200 bg-white hover:bg-zinc-50"}`}
                >
                  <div className="relative w-14 h-14 bg-zinc-50 border border-zinc-100 shrink-0">
                    {frame.imageDataUrl ? (
                      <Image src={frame.imageDataUrl} alt={frame.name} fill unoptimized sizes="56px" className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-300">
                        <ImageIcon size={16} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-zinc-800">{frame.name}</div>
                    <div className="mt-1 text-[11px] text-zinc-500">{frame.role}{frame.applyDesign ? " / design" : " / blank"}</div>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <main className="min-h-0 overflow-hidden p-3">
            {selectedFrame ? (
              <MockupPlacementPreview
                frame={selectedFrame}
                designDataUrl={designDataUrl}
                onPlacementChange={(placement) => updateFramePlacement(selectedFrame.id, placement)}
              />
            ) : (
              <div className="h-full min-h-[520px] border border-dashed border-zinc-300 bg-white flex flex-col items-center justify-center text-center p-8">
                <ImageIcon size={34} className="text-zinc-300 mb-3" />
                <h3 className="text-sm font-semibold text-zinc-800">Add a blank mockup image</h3>
                <p className="text-xs text-zinc-500 mt-1 max-w-sm">Start with a front shirt image, then map where the design should sit.</p>
                <button onClick={() => addFrameSlot("Front")} className="mt-4 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white">
                  Add Front Slot
                </button>
              </div>
            )}
          </main>

          <aside className="min-h-0 overflow-y-auto border-l border-zinc-200 bg-white p-3">
            {selectedFrame ? (
              <div className="space-y-4">
                <div className="flex items-start gap-2">
                  <input value={selectedFrame.name} onChange={(event) => updateFrame(selectedFrame.id, { name: event.target.value })} className="min-w-0 flex-1 border border-zinc-200 px-2 py-1.5 text-xs font-medium outline-none focus:border-blue-500" />
                  <button onClick={() => updatePreset({ frames: activePreset.frames.filter(item => item.id !== selectedFrame.id) })} className="w-8 h-8 flex items-center justify-center border border-zinc-200 text-zinc-400 hover:text-red-600 hover:bg-red-50">
                    <Trash2 size={14} />
                  </button>
                </div>

                <select value={selectedFrame.role} onChange={(event) => updateFrame(selectedFrame.id, { role: event.target.value as MockupFrame["role"] })} className="w-full border border-zinc-200 px-2 py-1.5 text-xs outline-none">
                  <option>Front</option>
                  <option>Back</option>
                  <option>Detail</option>
                </select>

                <button
                  onClick={() => {
                    setFrameUploadTargetId(selectedFrame.id);
                    slotImageInputRef.current?.click();
                  }}
                  className="w-full border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-700"
                >
                  {selectedFrame.imageDataUrl ? "Replace Blank Image" : "Upload Blank Image"}
                </button>

                <label className="flex items-center gap-2 text-xs font-medium text-zinc-700">
                  <input type="checkbox" checked={selectedFrame.applyDesign} onChange={(event) => updateFrame(selectedFrame.id, { applyDesign: event.target.checked })} />
                  Place design on this image
                </label>

                {selectedFrame.applyDesign && (
                  <div className="space-y-4">
                    <PrintAreaControls placement={selectedFrame.placement} onChange={placement => updateFramePlacement(selectedFrame.id, placement)} />
                    <div className="border-t border-zinc-200 pt-4"><h3 className="mb-3 text-xs font-semibold text-zinc-800">Design placement</h3><ArtworkPlacementControls placement={selectedFrame.placement} onChange={placement => updateFramePlacement(selectedFrame.id, placement)} /></div>
                  </div>
                )}
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    );
  }


  if (product) {
    const currentArtwork = selectedFrame ? artworkForFrame({ designDataUrl, artworks: { ...(designDataUrl ? { front: designDataUrl } : {}), ...(backDesignDataUrl ? { back: backDesignDataUrl } : {}) } }, selectedFrame.role) : null;
    const colorOptions = activePreset.id.startsWith('cc1717-') ? CC1717_COLORS : activePreset.id.startsWith('vintage-front-2k-') ? VINTAGE_COLORS : [];
    return <div className="flex h-full min-h-0 flex-col bg-[#f7f7f4]">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-white px-3 py-2">
        <div className="flex min-w-0 items-center gap-3"><button disabled={isGenerating} onClick={() => { void saveCurrent().then(() => onBack?.()).catch(() => undefined); }} className="border border-zinc-200 px-3 py-2 text-xs hover:bg-zinc-50">← Listing draft</button>{designDataUrl && <span className="relative h-10 w-10 shrink-0 border border-zinc-200 bg-zinc-50"><Image src={designDataUrl} alt="Current product design" fill unoptimized sizes="40px" className="object-contain" /></span>}<div><h2 className="truncate text-sm font-semibold text-zinc-800">{product.name}</h2><p className="text-xs text-zinc-500">Editing this draft’s artwork · {activePreset.name}</p></div></div>
        <div className="flex items-center gap-2"><span role="status" className="mr-2 text-xs text-zinc-500">{saveStatus}</span><div className="flex border border-zinc-200 bg-zinc-50"><button aria-pressed={!previewOnly} onClick={() => setPreviewOnly(false)} className="px-4 py-2 text-xs aria-pressed:bg-zinc-800 aria-pressed:text-white">Edit</button><button aria-pressed={previewOnly} onClick={() => setPreviewOnly(true)} className="px-4 py-2 text-xs aria-pressed:bg-zinc-800 aria-pressed:text-white">Preview</button></div><button onClick={handleGenerate} disabled={isGenerating || !designDataUrl || !activePreset.frames.some(frame => frame.imageDataUrl)} className="inline-flex items-center gap-2 bg-blue-600 px-4 py-2 text-xs font-medium text-white disabled:opacity-50">{isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{isGenerating ? 'Rendering…' : 'Save mockups'}</button></div>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_270px] xl:grid-cols-[180px_minmax(0,1fr)_270px]">
        <aside className="hidden space-y-4 border-b border-zinc-200 bg-white p-3 xl:block xl:overflow-y-auto xl:border-b-0 xl:border-r">
          <div><h3 className="text-sm font-semibold text-zinc-800">Product</h3><p className="mt-2 text-xs text-zinc-600">{activePreset.brand || activePreset.productType} {activePreset.model || ''}</p><p className="mt-1 text-xs text-zinc-500">{activePreset.color} · {activePreset.frames.length} views</p></div>
          <div className="border-t border-zinc-200 pt-4"><h3 className="text-xs font-semibold text-zinc-800">Shirt source</h3><p className="mt-2 text-xs leading-5 text-zinc-500">Color, fabric texture, highlights, and shadows come from the GIMP XCF master. Select a color to swap the shirt base.</p><button onClick={() => { setPresetManagerInitialTab('mapping'); setIsPresetManagerOpen(true); }} className="mt-3 inline-flex items-center gap-2 border border-zinc-200 px-3 py-2 text-xs text-zinc-700"><Settings2 size={14} /> Advanced recipe settings</button></div>
          <div className="border-t border-zinc-200 pt-4"><h3 className="text-xs font-semibold text-zinc-800">Output</h3><p className="mt-2 text-xs leading-5 text-zinc-500">The saved front and back images are rendered from this recipe. Change the artwork or shirt, then save mockups to update the listing draft.</p>{generated.length > 0 && <a href={`/api/workspace/products/${product.id}/download`} download className="mt-3 inline-flex items-center gap-2 border border-zinc-200 px-3 py-2 text-xs"><Download size={14} /> Download listing media</a>}</div>
        </aside>
        <main className="flex min-w-0 flex-col gap-2 p-3 lg:overflow-y-auto">
          <div className="flex items-center justify-between gap-3"><p className="text-xs font-medium text-zinc-700">{selectedFrame?.role || 'Shirt'} side · {activePreset.color}</p><span className="text-xs text-zinc-500">{previewOnly ? 'Listing preview' : 'Drag the artwork or its handles to position and size it'}</span></div>
          {selectedFrame?.imageDataUrl ? <MockupPlacementPreview key={selectedFrame.id} compact frame={selectedFrame} designDataUrl={currentArtwork} onPlacementChange={placement => updateFramePlacement(selectedFrame.id, placement)} previewOnly={previewOnly} /> : <div className="flex min-h-96 items-center justify-center border border-dashed border-zinc-300 bg-white text-sm text-zinc-500">This view needs a shirt image in the recipe.</div>}
          <div className="flex justify-center gap-2" aria-label="Mockup views">{activePreset.frames.map(frame => <button key={frame.id} aria-pressed={selectedFrame?.id === frame.id} onClick={() => setSelectedFrameId(frame.id)} className="rounded-full border border-zinc-300 bg-white px-5 py-2 text-xs text-zinc-700 aria-pressed:border-zinc-800 aria-pressed:bg-zinc-800 aria-pressed:text-white">{frame.role} side</button>)}</div>
          {generated.length > 0 && <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-3"><span className="mr-2 text-xs text-zinc-500">Saved listing images</span>{generated.map(item => <a key={item.id} href={item.dataUrl} target="_blank" rel="noreferrer" className="border border-zinc-200 bg-white px-3 py-2 text-xs text-blue-600">{item.name}</a>)}</div>}
        </main>
        <aside className="space-y-4 border-t border-zinc-200 bg-white p-3 lg:overflow-y-auto lg:border-l lg:border-t-0">
          <section><h3 className="text-sm font-semibold text-zinc-800">Variants and layers</h3><p className="mt-1 text-xs text-zinc-500">Preview the shirt color and edit the artwork for each side.</p></section>
          {colorOptions.length > 0 && <section className="border-t border-zinc-200 pt-4"><h4 className="text-xs font-semibold text-zinc-800">Shirt colors</h4><div className="mt-3 flex flex-wrap gap-2">{colorOptions.map(color => <button key={color} type="button" disabled={changingColor || isGenerating} aria-pressed={activePreset.color === color} onClick={() => { void changeVintageColor(color); }} className="rounded-full border border-zinc-300 px-3 py-2 text-xs text-zinc-700 aria-pressed:border-blue-600 aria-pressed:bg-blue-50 aria-pressed:text-blue-700">{color}</button>)}</div><p className="mt-2 text-[11px] text-zinc-500">These change the mockup preview. Production sizes and variants are chosen when preparing fulfillment.</p></section>}
          <section className="border-t border-zinc-200 pt-4"><h4 className="text-xs font-semibold text-zinc-800">Artwork layer · {selectedFrame?.role}</h4><p className="mt-1 text-[11px] text-zinc-500">Upload the graphic itself, preferably a transparent PNG. Do not upload a photo of a shirt as artwork.</p><input ref={designInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleDesignUpload} className="hidden" /><input ref={backDesignInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleBackDesignUpload} className="hidden" /><button onClick={() => (selectedFrame?.role === 'Back' ? backDesignInputRef : designInputRef).current?.click()} className="mt-3 flex w-full items-center gap-3 border border-zinc-200 p-3 text-left text-xs text-zinc-700 hover:bg-zinc-50">{currentArtwork ? <span className="relative h-12 w-12 shrink-0 bg-zinc-50"><Image src={currentArtwork} alt={`${selectedFrame?.role} artwork layer`} fill unoptimized sizes="48px" className="object-contain" /></span> : <UploadCloud size={18} className="text-blue-600" />}<span>{currentArtwork ? `Replace ${selectedFrame?.role.toLowerCase()} artwork` : `Add ${selectedFrame?.role.toLowerCase()} artwork`}</span></button></section>
          {selectedFrame?.applyDesign && currentArtwork && <section className="border-t border-zinc-200 pt-4"><h4 className="mb-3 text-xs font-semibold text-zinc-800">Position and size</h4><ArtworkPlacementControls placement={selectedFrame.placement} onChange={placement => updateFramePlacement(selectedFrame.id, placement)} /></section>}
          {selectedFrame?.applyDesign && <details className="border-t border-zinc-200 pt-4 text-xs"><summary className="cursor-pointer font-semibold text-zinc-800">Print look and area</summary><div className="mt-3 space-y-4"><PrintAreaControls placement={selectedFrame.placement} onChange={placement => updateFramePlacement(selectedFrame.id, placement)} /></div></details>}
        </aside>
      </div>
      {isPresetManagerOpen && <MockupPresetManagerModal presets={presets} activePresetId={activePreset.id} designDataUrl={designDataUrl} onClose={() => setIsPresetManagerOpen(false)} onSelect={id => { setActivePresetId(id); setGenerated([]); }} onCreatePreset={addTshirtPreset} onDuplicate={duplicatePreset} onDelete={deletePreset} onRename={(id, name) => updatePresetById(id, { name })} onUpdateMeta={(id, updates) => updatePresetById(id, updates)} onUpdateFrame={updateFrameByPresetId} onUpdateFramePlacement={updateFramePlacementByPresetId} onDeleteFrame={deleteFrameByPresetId} onAddFrameSlot={addFrameSlotToPreset} onAddFrameImages={addFrameImagesToPreset} onUploadFrameImage={uploadFrameImageToPreset} initialTab={presetManagerInitialTab} />}
    </div>;
  }



  return (
    <div className="w-full h-full flex-1 min-h-0 bg-white flex flex-col">
      {isPresetManagerOpen && (
        <MockupPresetManagerModal
          presets={presets}
          activePresetId={activePreset.id}
          designDataUrl={designDataUrl}
          onClose={() => setIsPresetManagerOpen(false)}
          onSelect={(id) => { setActivePresetId(id); setGenerated([]); }}
          onCreatePreset={addTshirtPreset}
          onDuplicate={duplicatePreset}
          onDelete={deletePreset}
          onRename={(id, name) => updatePresetById(id, { name })}
          onUpdateMeta={(id, updates) => updatePresetById(id, updates)}
          onUpdateFrame={updateFrameByPresetId}
          onUpdateFramePlacement={updateFramePlacementByPresetId}
          onDeleteFrame={deleteFrameByPresetId}
          onAddFrameSlot={addFrameSlotToPreset}
          onAddFrameImages={addFrameImagesToPreset}
          onUploadFrameImage={uploadFrameImageToPreset}
          initialTab={presetManagerInitialTab}
        />
      )}
      <header className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold text-zinc-800">Mockup studio</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Product template" value={activePreset.id} onChange={event => { setActivePresetId(event.target.value); setGenerated([]); }} className="max-w-48 border border-zinc-200 bg-white px-2 py-2 text-xs">{presets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select>
          <button onClick={() => { setPresetManagerInitialTab('mapping'); setIsPresetManagerOpen(true); }} className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-500 hover:bg-zinc-50"><Settings2 size={14} /> Edit template</button>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[270px_minmax(0,1fr)]">
        <aside className="space-y-6 border-r border-zinc-200 p-4 md:overflow-y-auto">
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-zinc-800">1. Production artwork</h3>
            <input ref={designInputRef} type="file" accept="image/*" onChange={handleDesignUpload} className="hidden" />
            <button onClick={() => designInputRef.current?.click()} className="flex w-full items-center gap-3 border border-zinc-200 px-3 py-3 text-xs text-zinc-600 hover:bg-zinc-50">
              {designDataUrl ? <span className="relative h-10 w-10 shrink-0 bg-zinc-50"><Image src={designDataUrl} alt="Uploaded design" fill unoptimized sizes="40px" className="object-contain" /></span> : <UploadCloud size={18} className="text-blue-600" />}
              {designDataUrl ? 'Replace front design' : 'Upload front design'}
            </button>
            {activePreset.frames.some(frame => frame.role === 'Back') && <><input ref={backDesignInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleBackDesignUpload} className="hidden" /><button onClick={() => backDesignInputRef.current?.click()} className="flex w-full items-center gap-3 border border-zinc-200 px-3 py-3 text-xs text-zinc-600 hover:bg-zinc-50">{backDesignDataUrl ? <span className="relative h-10 w-10 shrink-0 bg-zinc-50"><Image src={backDesignDataUrl} alt="Back design" fill unoptimized sizes="40px" className="object-contain" /></span> : <UploadCloud size={18} className="text-blue-600" />}{backDesignDataUrl ? 'Replace back design' : 'Add back design'}</button></>}
          </section>
          {selectedFrame?.applyDesign && <>
            {(activePreset.id.startsWith('vintage-front-2k-') || activePreset.id.startsWith('cc1717-')) && <section className="space-y-3 border-t border-zinc-200 pt-4"><h3 className="text-xs font-semibold text-zinc-800">2. Shirt color</h3><div className="grid grid-cols-2 gap-2">{(activePreset.id.startsWith('cc1717-') ? CC1717_COLORS : VINTAGE_COLORS).map(color => <button key={color} type="button" disabled={changingColor || isGenerating} aria-pressed={activePreset.color === color} onClick={() => { void changeVintageColor(color); }} className="border border-zinc-200 px-3 py-2 text-left text-xs text-zinc-700 hover:bg-blue-50 disabled:opacity-50 aria-pressed:border-blue-600 aria-pressed:bg-blue-50">{color}</button>)}</div></section>}
            <section className="space-y-3 border-t border-zinc-200 pt-4"><h3 className="text-xs font-semibold text-zinc-800">Design position & size · {selectedFrame.role}</h3><ArtworkPlacementControls placement={selectedFrame.placement} onChange={placement => updateFramePlacement(selectedFrame.id, placement)} /></section>
            <section className="space-y-3 border-t border-zinc-200 pt-4"><h3 className="text-xs font-semibold text-zinc-800">Print look</h3>{(['opacity', 'realism', 'softness'] as const).map(key => <label key={key} className="block space-y-1 text-xs text-zinc-600"><span className="flex justify-between"><span className="capitalize">{key}</span><span>{selectedFrame.placement[key]}{key === 'softness' ? 'px' : '%'}</span></span><input aria-label={`Print ${key}`} className="w-full accent-blue-600" type="range" min={key === 'opacity' ? 40 : 0} max={key === 'opacity' ? 100 : key === 'realism' ? 40 : 4} step={key === 'softness' ? 0.5 : 1} value={selectedFrame.placement[key]} onChange={event => updateFramePlacement(selectedFrame.id, { ...selectedFrame.placement, [key]: Number(event.target.value) })} /></label>)}</section>
            <details className="border-t border-zinc-200 pt-4 text-xs text-zinc-600"><summary className="cursor-pointer font-semibold text-zinc-800">Print area</summary><div className="mt-3"><PrintAreaControls placement={selectedFrame.placement} onChange={placement => updateFramePlacement(selectedFrame.id, placement)} /></div></details>
          </>}
          <section className="space-y-2">
            <button onClick={handleGenerate} disabled={isGenerating || !designDataUrl || !activePreset.frames.some(frame => frame.imageDataUrl)} className="flex w-full items-center justify-center gap-2 bg-blue-600 px-3 py-3 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50">
              {isGenerating ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {isGenerating ? 'Creating…' : 'Create mockups'}
            </button>
            <p className="text-xs text-zinc-500">Full-resolution export · all configured views</p>
          </section>
        </aside>
        <main className="min-w-0 space-y-4 bg-zinc-50 p-4 md:overflow-y-auto">
          {activePreset.frames.length > 0 && <div className="flex flex-wrap gap-2" aria-label="Mockup views">{activePreset.frames.map(frame => <button key={frame.id} aria-pressed={selectedFrame?.id === frame.id} onClick={() => setSelectedFrameId(frame.id)} className="border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600 aria-pressed:border-blue-600 aria-pressed:text-blue-600">{frame.name}</button>)}</div>}
          {selectedFrame?.imageDataUrl ? <MockupPlacementPreview compact frame={selectedFrame} designDataUrl={artworkForFrame({ designDataUrl, artworks: backDesignDataUrl ? { ...(designDataUrl ? { front: designDataUrl } : {}), back: backDesignDataUrl } : undefined }, selectedFrame.role)} onPlacementChange={placement => updateFramePlacement(selectedFrame.id, placement)} /> : <div className="flex min-h-80 flex-col items-center justify-center gap-3 border border-dashed border-zinc-300 bg-white p-6 text-center"><ImageIcon size={28} className="text-zinc-400" /><p className="text-sm text-zinc-600">Add a blank product photo to get started.</p><button onClick={() => { setPresetManagerInitialTab('mapping'); setIsPresetManagerOpen(true); }} className="border border-zinc-200 px-3 py-2 text-xs">Set up template</button></div>}
          {generated.length > 0 && <details className="border-t border-zinc-200 pt-3"><summary className="cursor-pointer text-sm font-medium text-zinc-700">{generated.length} saved mockups</summary><div className="mt-3 space-y-3"><button onClick={() => { void handleDownloadZip().catch(() => toast.error('Download failed. Try again.')); }} className="flex items-center gap-2 border border-zinc-200 bg-white px-3 py-2 text-xs"><Download size={14} /> Download all</button><div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{generated.map(item => <a key={item.id} href={item.dataUrl} download={item.name} className="block border border-zinc-200 bg-white p-2"><span className="relative block aspect-square"><Image src={item.dataUrl} alt={item.name} fill unoptimized sizes="200px" className="object-contain" /></span><span className="mt-2 block truncate text-xs text-blue-600">{item.name}</span></a>)}</div></div></details>}
        </main>
      </div>
    </div>
  );
}
