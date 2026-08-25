"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import JSZip from "jszip";
import { Copy, Download, ImageIcon, Loader2, Plus, Save, Settings2, Trash2, UploadCloud, X } from "lucide-react";
import toast from "react-hot-toast";
import { loadMockupPresets, saveMockupPresets } from "@/lib/mockupPresetStorage";

type Placement = {
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  margin: number;
  realism: number;
  softness: number;
};

type RegionDragMode = "move" | "nw" | "ne" | "sw" | "se" | "n" | "s" | "w" | "e";

type RegionDragState = {
  mode: RegionDragMode;
  startX: number;
  startY: number;
  startPlacement: Placement;
};

type MockupFrame = {
  id: string;
  name: string;
  role: "Front" | "Back" | "Side" | "Model" | "Detail";
  imageDataUrl?: string;
  applyDesign: boolean;
  placement: Placement;
};

type MockupPreset = {
  id: string;
  name: string;
  productType: string;
  color: string;
  frames: MockupFrame[];
};

type GeneratedMockup = {
  id: string;
  name: string;
  dataUrl: string;
};

const LEGACY_STORAGE_KEY = "workstation_mockup_presets";

const DEFAULT_PLACEMENT: Placement = {
  x: 35,
  y: 24,
  width: 30,
  height: 34,
  opacity: 96,
  margin: 7,
  realism: 18,
  softness: 1,
};

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function createEmptyPreset(): MockupPreset {
  return {
    id: `mockup-${Date.now()}`,
    name: "Pepper T-Shirt",
    productType: "T-Shirt",
    color: "Pepper",
    frames: [],
  };
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

function loadCanvasImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function fitRect(sourceWidth: number, sourceHeight: number, target: { x: number; y: number; width: number; height: number }) {
  if (sourceWidth <= 0 || sourceHeight <= 0 || target.width <= 0 || target.height <= 0) {
    return { x: target.x, y: target.y, width: 0, height: 0 };
  }
  const scale = Math.min(target.width / sourceWidth, target.height / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    x: target.x + (target.width - width) / 2,
    y: target.y + (target.height - height) / 2,
    width,
    height,
  };
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
  frame: MockupFrame
) {
  const margin = clampNumber(frame.placement.margin, 0, 25) / 100;
  const placement = getPlacementTarget(frame.placement, canvasWidth, canvasHeight);
  const innerPlacement = {
    x: placement.x + placement.width * margin,
    y: placement.y + placement.height * margin,
    width: placement.width * (1 - margin * 2),
    height: placement.height * (1 - margin * 2),
  };
  const designRect = fitRect(designImage.naturalWidth, designImage.naturalHeight, innerPlacement);
  if (designRect.width <= 0 || designRect.height <= 0) return;

  const printCanvas = document.createElement("canvas");
  printCanvas.width = canvasWidth;
  printCanvas.height = canvasHeight;
  const printCtx = printCanvas.getContext("2d");
  if (!printCtx) return;

  const softness = clampNumber(frame.placement.softness, 0, 4);
  if (softness > 0) {
    printCtx.save();
    printCtx.globalAlpha = 0.22;
    printCtx.filter = `blur(${softness}px)`;
    printCtx.drawImage(designImage, designRect.x, designRect.y, designRect.width, designRect.height);
    printCtx.restore();
  }

  printCtx.save();
  printCtx.globalAlpha = clampNumber(frame.placement.opacity, 0, 100) / 100;
  printCtx.drawImage(designImage, designRect.x, designRect.y, designRect.width, designRect.height);
  printCtx.restore();

  ctx.save();
  ctx.drawImage(printCanvas, 0, 0);
  ctx.restore();

  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = canvasWidth;
  textureCanvas.height = canvasHeight;
  const textureCtx = textureCanvas.getContext("2d");
  if (!textureCtx) return;
  textureCtx.drawImage(mockupImage, 0, 0);
  textureCtx.globalCompositeOperation = "destination-in";
  textureCtx.drawImage(printCanvas, 0, 0);

  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = clampNumber(frame.placement.realism, 0, 40) / 100;
  ctx.drawImage(textureCanvas, 0, 0);
  ctx.restore();
}

async function renderMockup(frame: MockupFrame, designDataUrl: string | null): Promise<string> {
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
}: {
  frame: MockupFrame;
  designDataUrl: string | null;
  onPlacementChange: (placement: Placement) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragState, setDragState] = useState<RegionDragState | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function drawPreview() {
      const canvas = canvasRef.current;
      if (!canvas || !frame.imageDataUrl) return;
      const mockupImage = await loadCanvasImage(frame.imageDataUrl);
      const designImage = frame.applyDesign && designDataUrl ? await loadCanvasImage(designDataUrl) : null;
      if (isCancelled) return;

      canvas.width = mockupImage.naturalWidth;
      canvas.height = mockupImage.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(mockupImage, 0, 0);

      const target = getPlacementTarget(frame.placement, canvas.width, canvas.height);

      if (designImage) {
        drawRealisticPrint(ctx, mockupImage, designImage, canvas.width, canvas.height, frame);
      } else if (frame.applyDesign) {
        ctx.save();
        ctx.fillStyle = "rgba(37, 99, 235, 0.16)";
        ctx.fillRect(target.x, target.y, target.width, target.height);
        ctx.restore();
      }

      if (frame.applyDesign) {
        ctx.save();
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
        handlePoints.forEach(([x, y]) => {
          ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
          ctx.strokeRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
        });
        ctx.restore();
      }
    }

    drawPreview().catch((error) => {
      console.error(error);
    });

    return () => {
      isCancelled = true;
    };
  }, [designDataUrl, frame]);

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
      return constrainPlacement({
        ...start,
        x: start.x + dx,
        y: start.y + dy,
      });
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
    if (!frame.applyDesign) return;
    const point = getPointerPercent(event);
    if (!point) return;
    const hitMode = getDragMode(point);
    const mode = hitMode || "move";
    event.currentTarget.setPointerCapture(event.pointerId);
    if (hitMode === null) {
      const placement = constrainPlacement({
        ...frame.placement,
        x: point.x - frame.placement.width / 2,
        y: point.y - frame.placement.height / 2,
      });
      onPlacementChange(placement);
      setDragState({ mode, startX: point.x, startY: point.y, startPlacement: placement });
      return;
    }
    setDragState({ mode, startX: point.x, startY: point.y, startPlacement: frame.placement });
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
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
    <div className="h-full min-h-[520px] bg-zinc-100 border border-zinc-200 flex items-center justify-center overflow-hidden p-4">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        className="max-h-full max-w-full touch-none bg-white shadow-sm cursor-crosshair"
      />
    </div>
  );
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
  initialTab = "details",
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

  const readyFrames = editingPreset.frames.filter(frame => frame.imageDataUrl).length;
  const designFrames = editingPreset.frames.filter(frame => frame.applyDesign).length;
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
            <h2 className="text-base font-bold text-zinc-800">Mockup Presets</h2>
            <p className="text-xs text-zinc-500">Manage presets and map print regions in one full-screen workspace.</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-zinc-200 text-zinc-500">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">
          <div className="w-60 shrink-0 border-r border-zinc-300 bg-zinc-50 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-zinc-300 space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Presets</div>
              <button onClick={() => { const id = onCreatePreset(); setEditingPresetId(id); setActiveTab("mapping"); }} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-blue-600 text-white border border-blue-700 hover:bg-blue-700">
                <Plus size={14} /> New Preset
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
                    <p className="mt-0.5 text-[10px] text-zinc-400 truncate">{preset.frames.filter(frame => frame.imageDataUrl).length}/{preset.frames.length} blanks ready</p>
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
                Preset Details
              </button>
              <button onClick={() => setActiveTab("mapping")} className={`px-4 py-2 border-r border-zinc-300 text-[10px] font-bold uppercase tracking-wider ${activeTab === "mapping" ? "bg-white text-blue-600 border-b-2 border-b-blue-500" : "text-zinc-500 hover:bg-zinc-100"}`}>
                Region Mapping
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
                <input value={editingPreset.productType} onChange={(event) => onUpdateMeta(editingPreset.id, { productType: event.target.value, color: editingPreset.color })} className="mt-1 w-full px-3 py-2 text-sm border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
              </label>

              <div className="grid grid-cols-3 gap-3">
                <div className="border border-zinc-200 bg-zinc-50 p-3">
                  <div className="text-lg font-semibold text-zinc-800">{editingPreset.frames.length}</div>
                  <div className="text-xs text-zinc-500">Frames</div>
                </div>
                <div className="border border-zinc-200 bg-zinc-50 p-3">
                  <div className="text-lg font-semibold text-zinc-800">{readyFrames}</div>
                  <div className="text-xs text-zinc-500">Images Ready</div>
                </div>
                <div className="border border-zinc-200 bg-zinc-50 p-3">
                  <div className="text-lg font-semibold text-zinc-800">{designFrames}</div>
                  <div className="text-xs text-zinc-500">Print Regions</div>
                </div>
              </div>

              <div className="border border-zinc-200">
                <div className="px-3 py-2 border-b border-zinc-200 bg-zinc-50 text-xs font-bold uppercase tracking-wider text-zinc-500">Frames</div>
                {editingPreset.frames.length === 0 ? (
                  <div className="p-5 text-sm text-zinc-500">No frames yet. Create a slot or add mockup images in Region Mapping.</div>
                ) : (
                  <div className="divide-y divide-zinc-200">
                    {editingPreset.frames.map(frame => (
                      <div key={frame.id} className="p-3 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-zinc-800">{frame.name}</div>
                          <div className="text-xs text-zinc-500">{frame.role} / {frame.applyDesign ? "uses design" : "blank export"} / {frame.imageDataUrl ? "image ready" : "missing image"}</div>
                        </div>
                        <div className="text-xs text-zinc-500">{Math.round(frame.placement.width)}% x {Math.round(frame.placement.height)}%</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
                        <div className="border border-blue-100 bg-blue-50 p-3">
                          <div className="text-xs font-semibold text-blue-800">Print Region</div>
                          <p className="mt-1 text-[11px] text-blue-700">Drag the box on the mockup to move it. Drag the small handles to resize it.</p>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <button
                              onClick={() => onUpdateFramePlacement(editingPreset.id, selectedFrame.id, { ...selectedFrame.placement, x: (100 - selectedFrame.placement.width) / 2, y: selectedFrame.placement.y })}
                              className="border border-blue-200 bg-white px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-50"
                            >
                              Center X
                            </button>
                            <button
                              onClick={() => onUpdateFramePlacement(editingPreset.id, selectedFrame.id, { ...selectedFrame.placement, x: selectedFrame.placement.x, y: (100 - selectedFrame.placement.height) / 2 })}
                              className="border border-blue-200 bg-white px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-50"
                            >
                              Center Y
                            </button>
                            <button
                              onClick={() => onUpdateFramePlacement(editingPreset.id, selectedFrame.id, { ...DEFAULT_PLACEMENT })}
                              className="col-span-2 border border-blue-200 bg-white px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-50"
                            >
                              Reset Region
                            </button>
                          </div>
                        </div>

                        {(["x", "y", "width", "height"] as const).map(key => (
                          <label key={key} className="block text-[10px] font-semibold uppercase text-zinc-500">
                            <span className="flex items-center justify-between gap-2">
                              <span>{key === "x" ? "Left" : key === "y" ? "Top" : key}</span>
                              <input
                                type="number"
                                min={key === "width" || key === "height" ? 5 : 0}
                                max={100}
                                value={Math.round(selectedFrame.placement[key])}
                                onChange={(event) => onUpdateFramePlacement(editingPreset.id, selectedFrame.id, { ...selectedFrame.placement, [key]: clampNumber(Number(event.target.value), key === "width" || key === "height" ? 5 : 0, 100) })}
                                className="w-16 border border-zinc-200 px-1.5 py-1 text-right text-xs font-medium text-zinc-700 outline-none focus:border-blue-500"
                              />
                            </span>
                            <input type="range" min={key === "width" || key === "height" ? 5 : 0} max={100} value={selectedFrame.placement[key]} onChange={(event) => onUpdateFramePlacement(editingPreset.id, selectedFrame.id, { ...selectedFrame.placement, [key]: clampNumber(Number(event.target.value), key === "width" || key === "height" ? 5 : 0, 100) })} className="mt-1 w-full" />
                          </label>
                        ))}

                        <div className="pt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Region Size</div>
                        <label className="block text-[10px] font-semibold uppercase text-zinc-500">
                          Margin {selectedFrame.placement.margin}%
                          <input type="range" min={0} max={25} value={selectedFrame.placement.margin} onChange={(event) => onUpdateFramePlacement(editingPreset.id, selectedFrame.id, { ...selectedFrame.placement, margin: clampNumber(Number(event.target.value), 0, 25) })} className="mt-1 w-full" />
                        </label>
                        <div className="pt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Print Look</div>
                        <label className="block text-[10px] font-semibold uppercase text-zinc-500">
                          Opacity {selectedFrame.placement.opacity}%
                          <input type="range" min={40} max={100} value={selectedFrame.placement.opacity} onChange={(event) => onUpdateFramePlacement(editingPreset.id, selectedFrame.id, { ...selectedFrame.placement, opacity: clampNumber(Number(event.target.value), 40, 100) })} className="mt-1 w-full" />
                        </label>
                        <label className="block text-[10px] font-semibold uppercase text-zinc-500">
                          Fabric {selectedFrame.placement.realism}%
                          <input type="range" min={0} max={40} value={selectedFrame.placement.realism} onChange={(event) => onUpdateFramePlacement(editingPreset.id, selectedFrame.id, { ...selectedFrame.placement, realism: clampNumber(Number(event.target.value), 0, 40) })} className="mt-1 w-full" />
                        </label>
                        <label className="block text-[10px] font-semibold uppercase text-zinc-500">
                          Softness {selectedFrame.placement.softness}px
                          <input type="range" min={0} max={4} step={0.5} value={selectedFrame.placement.softness} onChange={(event) => onUpdateFramePlacement(editingPreset.id, selectedFrame.id, { ...selectedFrame.placement, softness: clampNumber(Number(event.target.value), 0, 4) })} className="mt-1 w-full" />
                        </label>
                      </div>
                    )}
                  </div>
                ) : null}
              </aside>
            </div>
            )}

            <div className="shrink-0 p-4 px-6 border-t border-zinc-200 bg-zinc-50 flex justify-between items-center">
              <button onClick={() => onDelete(editingPreset.id)} className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-red-50 text-red-600 text-xs font-bold border border-red-200 transition-colors uppercase tracking-wider">
                <Trash2 size={13} /> Delete Preset
              </button>
              <div className="flex gap-2">
                <button onClick={() => { onSelect(editingPreset.id); onClose(); }} className="px-4 py-2 bg-white hover:bg-zinc-100 text-zinc-700 text-xs font-bold border border-zinc-300 transition-colors uppercase tracking-wider">
                  Use Preset
                </button>
                <button onClick={() => { onSelect(editingPreset.id); if (activeTab === "mapping") onClose(); else setActiveTab("mapping"); }} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold border border-blue-700 transition-colors uppercase tracking-wider">
                  {activeTab === "mapping" ? "Done" : "Map Region"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MockupStudio() {
  const [presets, setPresets] = useState<MockupPreset[]>([]);
  const [activePresetId, setActivePresetId] = useState("");
  const [designDataUrl, setDesignDataUrl] = useState<string | null>(null);
  const [generated, setGenerated] = useState<GeneratedMockup[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [frameUploadTargetId, setFrameUploadTargetId] = useState<string | null>(null);
  const [isPresetSetupOpen, setIsPresetSetupOpen] = useState(false);
  const [isPresetManagerOpen, setIsPresetManagerOpen] = useState(false);
  const [presetManagerInitialTab, setPresetManagerInitialTab] = useState<"details" | "mapping">("details");
  const [selectedFrameId, setSelectedFrameId] = useState("");
  const designInputRef = useRef<HTMLInputElement>(null);
  const frameInputRef = useRef<HTMLInputElement>(null);
  const slotImageInputRef = useRef<HTMLInputElement>(null);
  const hasLoadedPresetsRef = useRef(false);
  const storageErrorShownRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const hydratePresets = async () => {
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
  }, []);

  useEffect(() => {
    if (!hasLoadedPresetsRef.current || presets.length === 0) return;

    const saveTimer = window.setTimeout(() => {
      void saveMockupPresets(presets).then(() => {
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
  }, [presets]);

  const activePreset = useMemo(
    () => presets.find((preset) => preset.id === activePresetId) || presets[0],
    [activePresetId, presets]
  );
  const selectedFrame = useMemo(
    () => activePreset?.frames.find(frame => frame.id === selectedFrameId) || activePreset?.frames[0],
    [activePreset, selectedFrameId]
  );

  useEffect(() => {
    if (!activePreset) return;
    if (!activePreset.frames.some(frame => frame.id === selectedFrameId)) {
      setSelectedFrameId(activePreset.frames[0]?.id || "");
    }
  }, [activePreset, selectedFrameId]);

  const updatePreset = (updates: Partial<MockupPreset>) => {
    if (!activePreset) return;
    setPresets(prev => prev.map(preset => preset.id === activePreset.id ? { ...preset, ...updates } : preset));
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
    updateFrame(frameId, { placement: normalizePlacement(placement) });
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
    const frames = await Promise.all(imageFiles.map(async (file, index) => ({
      id: `frame-${Date.now()}-${index}`,
      name: file.name.replace(/\.[^.]+$/, ""),
      role: preset.frames.length + index === 0 ? "Front" as const : "Back" as const,
      imageDataUrl: await readImageFile(file),
      applyDesign: preset.frames.length + index === 0,
      placement: { ...DEFAULT_PLACEMENT },
    })));
    setPresets(prev => prev.map(item => item.id === presetId ? { ...item, frames: [...item.frames, ...frames] } : item));
    if (presetId === activePresetId) setSelectedFrameId(frames[0]?.id || "");
    setGenerated([]);
    return frames[0]?.id || null;
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

  const handleFrameUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!activePreset) return;
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    const imageFiles = files.filter(file => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      toast.error("Add PNG, JPG, or WEBP mockup images.");
      return;
    }
    const frames = await Promise.all(imageFiles.map(async (file, index) => ({
      id: `frame-${Date.now()}-${index}`,
      name: file.name.replace(/\.[^.]+$/, ""),
      role: activePreset.frames.length + index === 0 ? "Front" as const : "Back" as const,
      imageDataUrl: await readImageFile(file),
      applyDesign: activePreset.frames.length + index === 0,
      placement: { ...DEFAULT_PLACEMENT },
    })));
    updatePreset({ frames: [...activePreset.frames, ...frames] });
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
    if (readyFrames.some(frame => frame.applyDesign) && !designDataUrl) {
      toast.error("Upload a design first.");
      return;
    }

    setIsGenerating(true);
    try {
      const results = await Promise.all(readyFrames.map(async (frame, index) => ({
        id: `${frame.id}-${Date.now()}`,
        name: `${String(index + 1).padStart(2, "0")}-${activePreset.color}-${frame.role}.png`,
        dataUrl: await renderMockup(frame, designDataUrl),
      })));
      setGenerated(results);
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
    generated.forEach(item => {
      zip.file(item.name, item.dataUrl.split(",")[1], { base64: true });
    });
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activePreset?.name || "mockups"}-${Date.now()}.zip`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const addPreset = () => {
    const preset = createEmptyPreset();
    preset.name = `Mockup Preset ${presets.length + 1}`;
    setPresets(prev => [...prev, preset]);
    setActivePresetId(preset.id);
    setGenerated([]);
    return preset.id;
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

  if (isPresetSetupOpen) {
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
        <div className="shrink-0 border-b border-zinc-200 bg-zinc-50 p-4 lg:px-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-800">Preset Setup</h2>
            <p className="text-xs text-zinc-500">Map the design area on the real blank mockup.</p>
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
            <button onClick={() => setIsPresetSetupOpen(false)} className="h-8 px-3 border border-zinc-200 bg-white text-xs font-medium text-zinc-700 hover:bg-zinc-50">
              Done
            </button>
            <button onClick={() => setIsPresetManagerOpen(true)} className="h-8 px-3 border border-zinc-200 bg-white text-xs font-medium text-zinc-700 hover:bg-zinc-50">
              Manage Presets
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-[280px_1fr_300px] bg-zinc-100/50">
          <aside className="min-h-0 overflow-y-auto border-r border-zinc-200 bg-white p-4 space-y-4">
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
              <label className="text-xs font-semibold text-zinc-700 block">
                Product
                <input value={activePreset.productType} onChange={(event) => updatePreset({ productType: event.target.value })} className="mt-1 w-full border border-zinc-200 px-2 py-1.5 text-xs outline-none focus:border-blue-500" />
              </label>
            </div>

            <div className="flex gap-2">
              <button onClick={addPreset} className="flex-1 px-2 py-1.5 border border-zinc-200 bg-white text-xs font-medium text-zinc-700 hover:bg-zinc-50 flex items-center justify-center gap-1">
                <Plus size={12} /> Empty
              </button>
              <button onClick={addTshirtPreset} className="flex-1 px-2 py-1.5 border border-blue-200 bg-blue-50 text-xs font-medium text-blue-700 hover:bg-blue-100 flex items-center justify-center gap-1">
                <Plus size={12} /> T-Shirt
              </button>
            </div>

            <input ref={slotImageInputRef} type="file" accept="image/*" onChange={handleSlotImageUpload} className="hidden" />
            <input ref={frameInputRef} type="file" accept="image/*" multiple onChange={handleFrameUpload} className="hidden" />
            <button onClick={() => frameInputRef.current?.click()} className="w-full border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-700 flex items-center justify-center gap-2">
              <ImageIcon size={14} /> Add Mockup Images
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => addFrameSlot("Front")} className="px-2 py-1.5 border border-zinc-200 bg-white text-xs font-medium text-zinc-700 hover:bg-zinc-50">
                Front Slot
              </button>
              <button onClick={() => addFrameSlot("Back")} className="px-2 py-1.5 border border-zinc-200 bg-white text-xs font-medium text-zinc-700 hover:bg-zinc-50">
                Back Slot
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

          <main className="min-h-0 overflow-hidden p-5">
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

          <aside className="min-h-0 overflow-y-auto border-l border-zinc-200 bg-white p-4">
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
                  <option>Side</option>
                  <option>Model</option>
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
                    <div className="border border-blue-100 bg-blue-50 p-3">
                      <div className="text-xs font-semibold text-blue-800">Print Region</div>
                      <p className="mt-1 text-[11px] text-blue-700">Drag the box on the mockup to move it. Drag the small handles to resize it.</p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => updateFramePlacement(selectedFrame.id, { ...selectedFrame.placement, x: (100 - selectedFrame.placement.width) / 2, y: selectedFrame.placement.y })}
                          className="border border-blue-200 bg-white px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-50"
                        >
                          Center X
                        </button>
                        <button
                          onClick={() => updateFramePlacement(selectedFrame.id, { ...selectedFrame.placement, x: selectedFrame.placement.x, y: (100 - selectedFrame.placement.height) / 2 })}
                          className="border border-blue-200 bg-white px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-50"
                        >
                          Center Y
                        </button>
                        <button
                          onClick={() => updateFramePlacement(selectedFrame.id, { ...DEFAULT_PLACEMENT })}
                          className="col-span-2 border border-blue-200 bg-white px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-50"
                        >
                          Reset Region
                        </button>
                      </div>
                    </div>
                    {(["x", "y", "width", "height"] as const).map(key => (
                      <label key={key} className="block text-[10px] font-semibold uppercase text-zinc-500">
                        <span className="flex items-center justify-between gap-2">
                          <span>{key === "x" ? "Left" : key === "y" ? "Top" : key}</span>
                          <input
                            type="number"
                            min={key === "width" || key === "height" ? 5 : 0}
                            max={100}
                            value={Math.round(selectedFrame.placement[key])}
                            onChange={(event) => updateFramePlacement(selectedFrame.id, { ...selectedFrame.placement, [key]: clampNumber(Number(event.target.value), key === "width" || key === "height" ? 5 : 0, 100) })}
                            className="w-16 border border-zinc-200 px-1.5 py-1 text-right text-xs font-medium text-zinc-700 outline-none focus:border-blue-500"
                          />
                        </span>
                        <input type="range" min={key === "width" || key === "height" ? 5 : 0} max={100} value={selectedFrame.placement[key]} onChange={(event) => updateFramePlacement(selectedFrame.id, { ...selectedFrame.placement, [key]: clampNumber(Number(event.target.value), key === "width" || key === "height" ? 5 : 0, 100) })} className="mt-1 w-full" />
                      </label>
                    ))}
                    <label className="block text-[10px] font-semibold uppercase text-zinc-500">
                      Margin {selectedFrame.placement.margin}%
                      <input type="range" min={0} max={25} value={selectedFrame.placement.margin} onChange={(event) => updateFramePlacement(selectedFrame.id, { ...selectedFrame.placement, margin: clampNumber(Number(event.target.value), 0, 25) })} className="mt-1 w-full" />
                    </label>
                    <label className="block text-[10px] font-semibold uppercase text-zinc-500">
                      Opacity {selectedFrame.placement.opacity}%
                      <input type="range" min={40} max={100} value={selectedFrame.placement.opacity} onChange={(event) => updateFramePlacement(selectedFrame.id, { ...selectedFrame.placement, opacity: clampNumber(Number(event.target.value), 40, 100) })} className="mt-1 w-full" />
                    </label>
                    <label className="block text-[10px] font-semibold uppercase text-zinc-500">
                      Fabric {selectedFrame.placement.realism}%
                      <input type="range" min={0} max={40} value={selectedFrame.placement.realism} onChange={(event) => updateFramePlacement(selectedFrame.id, { ...selectedFrame.placement, realism: clampNumber(Number(event.target.value), 0, 40) })} className="mt-1 w-full" />
                    </label>
                    <label className="block text-[10px] font-semibold uppercase text-zinc-500">
                      Softness {selectedFrame.placement.softness}px
                      <input type="range" min={0} max={4} step={0.5} value={selectedFrame.placement.softness} onChange={(event) => updateFramePlacement(selectedFrame.id, { ...selectedFrame.placement, softness: clampNumber(Number(event.target.value), 0, 4) })} className="mt-1 w-full" />
                    </label>
                  </div>
                )}
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    );
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
      <div className="shrink-0 border-b border-zinc-200 bg-zinc-50 p-4 lg:px-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-800">Mockup</h2>
          <p className="text-xs text-zinc-500">Upload a design, use the selected preset, generate mockups.</p>
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
          <button onClick={() => { setPresetManagerInitialTab("mapping"); setIsPresetManagerOpen(true); }} className="h-8 px-3 border border-zinc-200 bg-white text-xs font-medium text-zinc-700 hover:bg-zinc-50 flex items-center gap-1.5">
            <Settings2 size={13} /> Preset Setup
          </button>
          <button onClick={() => { setPresetManagerInitialTab("details"); setIsPresetManagerOpen(true); }} className="h-8 px-3 border border-zinc-200 bg-white text-xs font-medium text-zinc-700 hover:bg-zinc-50">
            Manage Presets
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-[360px_1fr]">
        <aside className="min-h-0 overflow-y-auto border-r border-zinc-200 p-4 space-y-5">
          <section className="border border-zinc-200 bg-zinc-50 p-3">
            <div className="text-xs font-bold text-zinc-800">{activePreset.name}</div>
            <div className="mt-1 text-[11px] text-zinc-500">{activePreset.productType} / {activePreset.color}</div>
            <div className="mt-2 text-[11px] text-zinc-500">
              {activePreset.frames.filter(frame => frame.imageDataUrl).length}/{activePreset.frames.length} preset images ready
            </div>
          </section>
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Design</h3>
              {designDataUrl && <span className="text-[10px] font-medium text-emerald-600">Loaded</span>}
            </div>
            <input ref={designInputRef} type="file" accept="image/*" onChange={handleDesignUpload} className="hidden" />
            <button onClick={() => designInputRef.current?.click()} className="w-full border border-dashed border-zinc-300 bg-white hover:bg-zinc-50 p-4 text-xs font-medium text-zinc-600 flex flex-col items-center gap-2">
              <UploadCloud size={18} className="text-blue-500" />
              Upload Design
            </button>
            {designDataUrl && (
              <div className="relative aspect-square border border-zinc-200 bg-zinc-50">
                <Image src={designDataUrl} alt="Uploaded design" fill unoptimized sizes="320px" className="object-contain p-3" />
              </div>
            )}
          </section>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white px-4 py-2 text-sm font-semibold flex items-center justify-center gap-2"
          >
            {isGenerating ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {isGenerating ? "Generating..." : "Generate Mockups"}
          </button>

        </aside>

        <main className="min-h-0 overflow-y-auto p-6 bg-zinc-100/50">
          {generated.length === 0 ? (
            <div className="h-full min-h-[420px] border border-dashed border-zinc-300 bg-white flex flex-col items-center justify-center text-center p-8">
              <ImageIcon size={34} className="text-zinc-300 mb-3" />
              <h3 className="text-sm font-semibold text-zinc-800">No generated mockups yet</h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm">Upload a design, add blank mockup images to the preset, then generate. Frames marked as back/no-design export clean.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-800">Generated Mockups</h3>
                  <p className="text-xs text-zinc-500">{generated.length} output image{generated.length === 1 ? "" : "s"}</p>
                </div>
                <button onClick={handleDownloadZip} className="px-3 py-1.5 border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-medium text-zinc-700 flex items-center gap-2">
                  <Download size={14} /> Download ZIP
                </button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {generated.map(item => (
                  <div key={item.id} className="bg-white border border-zinc-200 p-3">
                    <div className="relative aspect-square bg-zinc-50 border border-zinc-100">
                      <Image src={item.dataUrl} alt={item.name} fill unoptimized sizes="45vw" className="object-contain" />
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-xs font-medium text-zinc-700">{item.name}</span>
                      <a href={item.dataUrl} download={item.name} className="shrink-0 text-xs font-medium text-blue-600 hover:text-blue-700">Download</a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
