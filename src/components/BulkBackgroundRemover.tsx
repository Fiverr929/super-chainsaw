'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Loader2, UploadCloud, X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { EdgeMode } from '@/lib/mask-test/commands';
import type { PreparedArtwork } from '@/lib/workspaceArtwork';
import { prepareDesignCutout } from '@/lib/designCutout';
import { prepareFlatDesign } from '@/lib/flatDesign';
import { cleanCutoutMargins, cropCutoutToArtwork, reviewCutout } from '@/lib/cutoutQuality';
import { applyDirectMask } from '@/lib/hybridMask';
import type { CutoutQuality } from '@/lib/cutoutQuality';
import type { ImagePreset } from './ImagePresetManagerModal';
import { getStoredGeminiApiKey } from '@/lib/clientApiKey';
import { DEFAULT_EXTRACTION_PROMPT, DEFAULT_IMAGE_MODEL, DEFAULT_IMAGE_QUALITY, IMAGE_MODEL_OPTIONS, imageQualityForModel, type ImageModelId, type ImageQuality } from '@/lib/designExtraction';
import { readyDesigns } from '@/lib/designBatch';
import { deleteSavedExtractedDesign, listSavedExtractedDesigns, saveExtractedDesign, type SavedExtractedDesign } from '@/lib/savedExtractedDesigns';

type BatchItem = {
  id: string;
  file: File;
  kind?: 'photos' | 'designs';
  selected?: boolean;
  width?: number;
  height?: number;
  generatedWith?: { model: ImageModelId; quality: ImageQuality };
  source?: string;
  sourceAssetUrl?: string;
  extracted?: string;
  flatOutput?: string;
  remixCandidate?: string;
  isRemixed?: boolean;
  details?: string;
  reference?: string;
  analysisWarning?: string;
  output?: string;
  status: 'waiting' | 'working' | 'ready' | 'error';
  error?: string;
  alreadyTransparent?: boolean;
  phase?: string;
  review?: CutoutQuality & { overlay: string | null };
  marginsCleaned?: boolean;
  maskCandidate?: string;
  maskRemoved?: number;
  maskApplied?: boolean;
};

type ReviewBackground = 'checker' | 'white' | 'black';
const reviewBackgrounds: Record<Exclude<ReviewBackground, 'checker'>, string> = {
  white: '#fff', black: '#111',
};

const checkerboard = {
  backgroundColor: '#fff',
  backgroundImage: 'linear-gradient(45deg, #e4e4e7 25%, transparent 25%), linear-gradient(-45deg, #e4e4e7 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e4e4e7 75%), linear-gradient(-45deg, transparent 75%, #e4e4e7 75%)',
  backgroundSize: '20px 20px',
  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0',
};

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function downloadPng(output: string, name: string) {
  const encoded = output.split(',')[1];
  const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function extractGraphic(file: File, preset: ImagePreset, model: ImageModelId, quality: ImageQuality, details?: string, reference?: string): Promise<{ image: string; details?: string; reference?: string; analysisWarning?: string }> {
  const form = new FormData();
  form.append('image', reference ? new File([await (await fetch(reference)).blob()], 'print-reference.png', { type: 'image/png' }) : file);
  form.append('model', model);
  form.append('resolution', quality);
  form.append('aspectRatio', preset.aspectRatio);
  form.append('thinkingLevel', preset.thinkingLevel);
  form.append('prompt', preset.id === 'default-graphic-extractor' ? DEFAULT_EXTRACTION_PROMPT : preset.prompt.trim() || DEFAULT_EXTRACTION_PROMPT);
  if (details?.trim()) form.append('details', details.trim());
  const key = getStoredGeminiApiKey();
  const response = await fetch('/api/image/extract', {
    method: 'POST',
    headers: key ? { 'x-gemini-api-key': key } : undefined,
    body: form,
    signal: AbortSignal.timeout(360000),
  });
  const data = await response.json().catch(() => { throw new Error('The extraction service returned an unreadable response. Please retry.'); });
  if (!response.ok || !data.image) throw new Error(data.error || 'Could not extract the graphic.');
  return { image: data.image, details: data.details, reference: data.reference || reference, analysisWarning: data.analysisWarning };
}

export default function BulkBackgroundRemover({ onContinue, onOpenPresets, preset, incomingAsset }: { onContinue: (artworks: PreparedArtwork[]) => void; onOpenPresets: () => void; preset: ImagePreset; incomingAsset?: { url: string; name: string; requestId?: string } | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const importedAssetRef = useRef<string | null>(null);
  const designInputRef = useRef<HTMLInputElement>(null);
  const flatImportRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false);
  const latestOutputRef = useRef(new Map<string, string>());
  const [items, setItems] = useState<BatchItem[]>([]);
  const [savedDesigns, setSavedDesigns] = useState<SavedExtractedDesign[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [edgeMode, setEdgeMode] = useState<EdgeMode>('soft');
  const [includeInside, setIncludeInside] = useState(true);
  const [imageModel, setImageModel] = useState<ImageModelId>(DEFAULT_IMAGE_MODEL);
  const [quality, setQuality] = useState<ImageQuality>(DEFAULT_IMAGE_QUALITY);
  const [remixDirection, setRemixDirection] = useState('');
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewBackground, setReviewBackground] = useState<ReviewBackground>('checker');
  const [reviewActualSize, setReviewActualSize] = useState(false);
  const [showArtifacts, setShowArtifacts] = useState(true);
  const modelOption = IMAGE_MODEL_OPTIONS.find(option => option.id === imageModel) || IMAGE_MODEL_OPTIONS[0];

  useEffect(() => {
    void listSavedExtractedDesigns().then(setSavedDesigns).catch(() => toast.error('Could not load saved extracted designs.'));
  }, []);

  useEffect(() => {
    try {
      const savedModel = localStorage.getItem('workstation_extraction_model');
      const option = IMAGE_MODEL_OPTIONS.find(item => item.id === savedModel);
      if (option) {
        setImageModel(option.id);
        const savedQuality = localStorage.getItem('workstation_extraction_quality');
        setQuality(imageQualityForModel(option.id, savedQuality));
      }
    } catch {
      // Storage may be unavailable; extraction still works with default settings.
    } finally { setSettingsLoaded(true); }
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    try {
      localStorage.setItem('workstation_extraction_model', imageModel);
      localStorage.setItem('workstation_extraction_quality', quality);
    } catch { /* Model selection still works when browser storage is unavailable. */ }
  }, [imageModel, quality, settingsLoaded]);
  const visibleItems = items;
  const active = visibleItems.find(item => item.id === activeId) || visibleItems[0];
  const ready = readyDesigns(visibleItems);
  const selected = ready.filter(item => item.selected);

  const update = (id: string, changes: Partial<BatchItem>) => {
    setItems(current => current.map(item => item.id === id ? { ...item, ...changes } : item));
  };

  const processItem = async (item: BatchItem, kind: 'photos' | 'designs', regenerate = false) => {
    update(item.id, { status: 'working', selected: false, output: undefined, review: undefined, error: undefined, phase: kind === 'photos' ? 'Extracting design…' : 'Preparing design…' });
    try {
      const source = item.source || await readFile(item.file);
      update(item.id, { source });
      const generated = kind === 'photos'
        ? !regenerate && item.extracted
          ? { image: item.extracted, details: item.details, reference: item.reference, analysisWarning: item.analysisWarning }
          : await extractGraphic(item.file, preset, imageModel, quality, item.details, item.reference)
        : { image: source };
      const extracted = generated.image;
      update(item.id, { extracted, details: generated.details, reference: generated.reference, analysisWarning: generated.analysisWarning, phase: kind === 'photos' ? 'Preparing extracted design…' : 'Preparing design…' });
      if (kind === 'photos') {
        const flatOutput = await prepareFlatDesign(extracted);
        update(item.id, { source, extracted, flatOutput, remixCandidate: undefined, isRemixed: false, output: undefined, review: undefined, details: generated.details, reference: generated.reference, analysisWarning: generated.analysisWarning, marginsCleaned: false, maskCandidate: undefined, maskRemoved: undefined, maskApplied: false, status: 'ready', selected: false, generatedWith: { model: imageModel, quality }, alreadyTransparent: false, phase: undefined });
        try {
          await saveExtractedDesign({ id: item.id, file: item.file, extracted, details: generated.details, savedAt: Date.now() });
          setSavedDesigns(await listSavedExtractedDesigns());
        } catch { toast.error('The extraction is ready, but it could not be saved in this browser.'); }
      } else {
        update(item.id, { source, extracted: undefined, flatOutput: source, output: undefined, review: undefined, marginsCleaned: false, maskCandidate: undefined, maskRemoved: undefined, maskApplied: false, status: 'ready', selected: false, phase: undefined });
      }
    } catch (error) {
      update(item.id, { status: 'error', phase: undefined, error: error instanceof Error ? error.message : 'Design extraction failed.' });
    }
  };

  const processBatch = async (batch: BatchItem[], kind: 'photos' | 'designs', regenerate = false) => {
    if (processingRef.current) return;
    const matching = batch.filter(item => (item.kind || 'photos') === kind);
    if (!matching.length) return;
    processingRef.current = true;
    setBusy(true);
    try {
      for (const item of matching) await processItem(item, kind, regenerate);
    } finally {
      processingRef.current = false;
      setBusy(false);
    }
  };

  const addFiles = (files: File[], kind: 'photos' | 'designs' = 'photos', sourceAssetUrl?: string) => {
    if (processingRef.current) return;
    const images = files.filter(file => ['image/png', 'image/jpeg', 'image/webp'].includes(file.type));
    if (images.length !== files.length) toast.error('Only PNG, JPG, and WebP images are supported.');
    if (!images.length) return;
    if (items.length + images.length > 20) { toast.error('Use up to 20 images per batch.'); return; }
    const added = images.map(file => ({ id: crypto.randomUUID(), file, kind, selected: false, status: 'waiting' as const, sourceAssetUrl }));
    setItems(current => [...current, ...added]);
    setActiveId(added[0].id);
    void processBatch(added, kind);
  };

  useEffect(() => {
    if (!incomingAsset) return;
    const requestId = incomingAsset.requestId || incomingAsset.url;
    if (importedAssetRef.current === requestId) return;
    importedAssetRef.current = requestId;
    void fetch(incomingAsset.url).then(async response => {
      if (!response.ok) throw new Error('Could not open asset image.');
      const blob = await response.blob();
      const extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
      addFiles([new File([blob], `${incomingAsset.name}.${extension}`, { type: blob.type })], 'photos', incomingAsset.url);
    }).catch(error => { importedAssetRef.current = null; toast.error(error instanceof Error ? error.message : 'Could not open asset image.'); });
  // An asset is imported once when the user selects it from Assets.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingAsset]);

  const regenerateActive = () => {
    if (busy || !active || active.kind !== 'photos') return;
    void processBatch([{ ...active, reference: undefined }], 'photos', true);
  };

  const rebuildCutout = async () => {
    if (!(active?.flatOutput || active?.source) || processingRef.current) return;
    processingRef.current = true;
    setBusy(true);
    update(active.id, { status: 'working', selected: false, phase: 'Removing background…', error: undefined });
    try {
      const { output, alreadyTransparent } = await prepareDesignCutout(active.flatOutput || active.source!, edgeMode, includeInside);
      const review = await reviewCutout(output);
      latestOutputRef.current.set(active.id, output);
      update(active.id, { output, review, marginsCleaned: false, maskCandidate: undefined, maskRemoved: undefined, maskApplied: false, status: 'ready', selected: false, alreadyTransparent, phase: undefined });
    } catch (error) {
      update(active.id, { status: 'error', phase: undefined, error: error instanceof Error ? error.message : 'Could not rebuild the cutout.' });
    } finally {
      processingRef.current = false;
      setBusy(false);
    }
  };

  const importSavedExtraction = async (file: File) => {
    if (!active || active.kind !== 'photos' || processingRef.current) return;
    processingRef.current = true;
    setBusy(true);
    update(active.id, { status: 'working', phase: 'Preparing saved extraction…', error: undefined });
    try {
      const extracted = await readFile(file);
      const flatOutput = await prepareFlatDesign(extracted);
      update(active.id, { extracted, flatOutput, remixCandidate: undefined, isRemixed: false, output: undefined, review: undefined, marginsCleaned: false, maskCandidate: undefined, maskRemoved: undefined, maskApplied: false, status: 'ready', selected: false, phase: undefined });
      try {
        await saveExtractedDesign({ id: active.id, file: active.file, extracted, details: active.details, savedAt: Date.now() });
        setSavedDesigns(await listSavedExtractedDesigns());
      } catch { toast.error('The extraction is ready, but it could not be saved in this browser.'); }
    } catch (error) {
      update(active.id, { status: 'error', phase: undefined, error: error instanceof Error ? error.message : 'Could not use the saved extraction.' });
    } finally {
      processingRef.current = false;
      setBusy(false);
    }
  };

  const fitActiveExtraction = async () => {
    if (!active?.extracted || processingRef.current) return;
    processingRef.current = true;
    setBusy(true);
    update(active.id, { phase: 'Fitting artwork to canvas…' });
    try {
      const flatOutput = await prepareFlatDesign(active.extracted);
      update(active.id, { flatOutput, isRemixed: false, output: undefined, review: undefined, selected: false, status: 'ready', phase: undefined });
    } catch (error) {
      update(active.id, { phase: undefined });
      toast.error(error instanceof Error ? error.message : 'Could not fit the artwork.');
    } finally {
      processingRef.current = false;
      setBusy(false);
    }
  };

  const reopenSavedDesign = async (saved: SavedExtractedDesign) => {
    const existing = items.find(item => item.id === saved.id);
    if (existing) { setActiveId(existing.id); return; }
    if (busy || items.length >= 20) { toast.error('Remove an image from this batch before opening another saved design.'); return; }
    setBusy(true);
    try {
      const [flatOutput, source] = await Promise.all([prepareFlatDesign(saved.extracted), readFile(saved.file)]);
      setItems(current => [...current, { id: saved.id, file: saved.file, kind: 'photos', source, extracted: saved.extracted, flatOutput, details: saved.details, status: 'ready', selected: false }]);
      setActiveId(saved.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not reopen the saved design.');
    } finally { setBusy(false); }
  };

  const removeSavedDesign = async (id: string) => {
    try {
      await deleteSavedExtractedDesign(id);
      setSavedDesigns(current => current.filter(design => design.id !== id));
    } catch { toast.error('Could not delete the saved design.'); }
  };

  const createNewDesign = async () => {
    if (!active?.extracted || processingRef.current) return;
    processingRef.current = true;
    setBusy(true);
    update(active.id, { phase: 'Creating a new design…', remixCandidate: undefined });
    try {
      const form = new FormData();
      const referenceBlob = await (await fetch(active.extracted)).blob();
      form.append('image', new File([referenceBlob], 'extracted-design', { type: referenceBlob.type || 'image/png' }));
      form.append('model', imageModel);
      form.append('resolution', quality);
      form.append('direction', remixDirection);
      const key = getStoredGeminiApiKey();
      const response = await fetch('/api/image/remix', { method: 'POST', headers: key ? { 'x-gemini-api-key': key } : undefined, body: form, signal: AbortSignal.timeout(150000) });
      const data = await response.json();
      if (!response.ok || !data.image) throw new Error(data.error || 'Could not create a new design.');
      const remixCandidate = await prepareFlatDesign(data.image);
      update(active.id, { remixCandidate, phase: undefined });
    } catch (error) {
      update(active.id, { phase: undefined });
      toast.error(error instanceof Error ? error.message : 'Could not create a new design.');
    } finally {
      processingRef.current = false;
      setBusy(false);
    }
  };

  const useNewDesign = () => {
    if (!active?.remixCandidate || busy) return;
    update(active.id, { flatOutput: active.remixCandidate, remixCandidate: undefined, isRemixed: true, output: undefined, review: undefined, maskCandidate: undefined, maskRemoved: undefined, selected: false, status: 'ready' });
  };

  const changeModel = (value: ImageModelId) => {
    const selected = IMAGE_MODEL_OPTIONS.find(option => option.id === value);
    if (!selected) return;
    setImageModel(value);
    if (!selected.qualities.some(item => item === quality)) setQuality('1K');
  };

  const continueToMockups = () => {
    if (processingRef.current) return;
    const artworks = selected.map(item => ({
      name: item.file.name.replace(/\.[^.]+$/, ''),
      design: item.output!,
      source: item.source,
      sourceAssetUrl: item.sourceAssetUrl,
      background: 'transparent' as const,
    }));
    if (artworks.length) onContinue(artworks);
  };

  const downloadActive = async () => {
    if (busy || !active?.output) return;
    const output = latestOutputRef.current.get(active.id) || active.output;
    if (active.marginsCleaned && (await reviewCutout(output)).marginPixels > 0) {
      toast.error('The saved image still has margin pixels. Reprocess and try again.');
      return;
    }
    downloadPng(output, `${active.file.name.replace(/\.[^.]+$/, '')}-${active.marginsCleaned ? 'cleaned-cutout' : active.maskApplied ? 'mask-guided-cutout' : 'cutout'}.png`);
  };

  const cleanActiveMargins = async () => {
    if (!active?.output || !active.review?.bounds || !active.review.canCleanMargins || !active.review.marginPixels || processingRef.current) return;
    processingRef.current = true;
    setBusy(true);
    update(active.id, { phase: 'Cleaning empty margins…' });
    try {
      const output = await cleanCutoutMargins(active.output, active.review.bounds);
      const review = await reviewCutout(output);
      latestOutputRef.current.set(active.id, output);
      update(active.id, { output, review, marginsCleaned: true, maskCandidate: undefined, maskRemoved: undefined, selected: false, phase: undefined });
      toast.success('Empty margins cleaned. Review the updated PNG before using it.');
    } catch (error) {
      update(active.id, { phase: undefined });
      toast.error(error instanceof Error ? error.message : 'Could not clean the margins.');
    } finally {
      processingRef.current = false;
      setBusy(false);
    }
  };

  const tryAiMask = async () => {
    const maskSource = active?.flatOutput || active?.source;
    if (!maskSource || processingRef.current) return;
    processingRef.current = true;
    setBusy(true);
    update(active.id, { phase: 'Generating artwork mask…', maskCandidate: undefined });
    try {
      const form = new FormData();
      form.append('image', active.flatOutput
        ? new File([await (await fetch(active.flatOutput)).blob()], 'extracted-design.png', { type: 'image/png' })
        : active.file);
      const key = getStoredGeminiApiKey();
      const response = await fetch('/api/image/mask', { method: 'POST', headers: key ? { 'x-gemini-api-key': key } : undefined, body: form, signal: AbortSignal.timeout(150000) });
      const data = await response.json();
      if (!response.ok || !data.mask) throw new Error(data.error || 'Could not generate the artwork mask.');
      const candidate = await applyDirectMask(maskSource, data.mask);
      update(active.id, { maskCandidate: candidate.output, maskRemoved: candidate.removed, phase: undefined });
      toast.success('AI mask preview is ready. Review it before applying.');
    } catch (error) {
      update(active.id, { phase: undefined });
      toast.error(error instanceof Error ? error.message : 'AI mask removal failed.');
    } finally {
      processingRef.current = false;
      setBusy(false);
    }
  };

  const acceptMaskCleanup = async () => {
    if (!active?.maskCandidate) return;
    const output = await cropCutoutToArtwork(active.maskCandidate);
    const review = await reviewCutout(output);
    latestOutputRef.current.set(active.id, output);
    update(active.id, { output, review, maskCandidate: undefined, maskRemoved: undefined, maskApplied: true, marginsCleaned: true, selected: false, status: 'ready' });
  };

  return <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-zinc-50 p-4 lg:p-6">
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <section className="space-y-4 border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="text-sm font-semibold text-zinc-900">Extract your design</h3><p className="mt-1 text-xs text-zinc-500">Upload a product photo, review the extracted design, then remove its background.</p></div>
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={event => { addFiles(Array.from(event.target.files || [])); event.target.value = ''; }} />
          <input ref={designInputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={event => { addFiles(Array.from(event.target.files || []), 'designs'); event.target.value = ''; }} />
          <input ref={flatImportRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={event => { const file = event.target.files?.[0]; if (file) void importSavedExtraction(file); event.target.value = ''; }} />
          {visibleItems.length > 0 && <button type="button" disabled={busy || !settingsLoaded} onClick={() => inputRef.current?.click()} className="flex items-center gap-2 bg-blue-600 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"><UploadCloud size={14} /> Add product photos</button>}
        </div>
        <button type="button" disabled={busy} onClick={() => designInputRef.current?.click()} className="text-left text-xs font-medium text-blue-700 disabled:opacity-50">Already have a design image? Add it here</button>
        <details className="text-xs text-zinc-600"><summary className="cursor-pointer font-medium">Extraction settings</summary><div className="mt-3 flex flex-wrap items-center gap-3"><button type="button" onClick={onOpenPresets} className="border border-zinc-300 px-2 py-1.5 font-medium">Preset: {preset.name}</button><label className="flex items-center gap-2">Model <select aria-label="Image model" value={imageModel} disabled={busy || !settingsLoaded} onChange={event => changeModel(event.target.value as ImageModelId)} className="border border-zinc-300 bg-white p-1.5">{IMAGE_MODEL_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label><label className="flex items-center gap-2">Quality <select aria-label="Output quality" value={quality} disabled={busy || !settingsLoaded} onChange={event => setQuality(event.target.value as ImageQuality)} className="border border-zinc-300 bg-white p-1.5">{modelOption.qualities.map(option => <option key={option} value={option}>{option}</option>)}</select></label></div></details>
      </section>

      {savedDesigns.length > 0 && <section className="rounded-lg border border-zinc-200 bg-white p-4" aria-label="Saved extracted designs"><div className="mb-3"><h3 className="text-sm font-semibold text-zinc-900">Saved extracted designs</h3><p className="mt-1 text-xs text-zinc-500">Stored in this browser. Open one to continue after a refresh.</p></div><div className="flex gap-3 overflow-x-auto pb-1">{savedDesigns.map(saved => <div key={saved.id} className="w-36 shrink-0 rounded-md border border-zinc-200 p-2"><button type="button" disabled={busy} onClick={() => void reopenSavedDesign(saved)} className="w-full text-left disabled:opacity-50"><span className="relative block aspect-square bg-zinc-50"><Image src={saved.extracted} alt="" fill unoptimized sizes="144px" className="object-contain" /></span><span className="mt-2 block truncate text-xs font-medium text-zinc-800" title={saved.file.name}>{saved.file.name}</span><span className="block text-[11px] text-blue-700">Open design</span></button><button type="button" disabled={busy} onClick={() => void removeSavedDesign(saved.id)} className="mt-2 text-[11px] text-red-700 disabled:opacity-50" aria-label={`Delete saved ${saved.file.name}`}>Delete saved copy</button></div>)}</div></section>}

      {visibleItems.length === 0 ? <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); addFiles(Array.from(event.dataTransfer.files)); }} className="flex min-h-64 w-full flex-col items-center justify-center gap-2 border-2 border-dashed border-zinc-300 bg-white p-8 text-sm text-zinc-600 hover:border-blue-400"><UploadCloud size={28} /><span className="font-medium">Drop product photos here</span><span className="text-xs">PNG, JPG or WebP · up to 20 images</span></button> : <>
        <section className="flex flex-wrap items-center gap-3 text-xs">
          <h3 className="mr-auto text-sm font-semibold text-zinc-900">Your designs</h3>
          <span role="status" className="text-zinc-600">{busy ? 'Processing · ' : ''}{ready.length} of {visibleItems.length} cutouts ready</span>
          <details className="relative"><summary className="cursor-pointer border border-zinc-300 bg-white px-3 py-2 font-medium">Background removal settings</summary><div className="absolute right-0 z-10 mt-1 w-64 space-y-3 border border-zinc-200 bg-white p-3 shadow-lg"><label className="flex items-center justify-between gap-2">Edge cleanup <select aria-label="Edge cleanup" value={edgeMode} disabled={busy} onChange={event => setEdgeMode(event.target.value as EdgeMode)} className="border border-zinc-300 bg-white p-1.5"><option value="strict">Strict</option><option value="soft">Soft</option><option value="max">Maximum</option></select></label><label className="flex items-center gap-2"><input type="checkbox" checked={includeInside} disabled={busy} onChange={event => setIncludeInside(event.target.checked)} /> Clear enclosed areas</label></div></details>
        </section>

        <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_250px]">
          <div className="min-w-0 space-y-4 border border-zinc-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="min-w-0 break-words text-xs font-medium text-zinc-700">{active?.file.name}</p>{active?.output && <button type="button" disabled={busy} onClick={downloadActive} className="shrink-0 border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 disabled:opacity-50">Download PNG</button>}</div>
            <div className="grid gap-3 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <div className="min-w-0 rounded-lg border border-zinc-200 bg-zinc-50 p-3"><p className="mb-2 text-xs font-medium text-zinc-600">Original {active?.kind === 'photos' ? 'product photo' : 'design'}</p><div className="relative aspect-square overflow-hidden rounded-md bg-zinc-100">{active?.source && <Image src={active.source} alt="Original upload" fill unoptimized sizes="(min-width: 1280px) 400px, 45vw" className="object-contain" />}</div></div>
              <div className="min-w-0 rounded-lg border border-blue-100 bg-white p-3 shadow-sm"><p className="mb-2 text-xs font-semibold text-zinc-800">{active?.output ? 'Background removed' : active?.isRemixed ? 'New design' : active?.kind === 'photos' ? 'Extracted design' : 'Design image'}</p><div className="relative aspect-square overflow-hidden rounded-md" style={active?.output ? checkerboard : { backgroundColor: '#f4f4f5' }}>{(active?.output || active?.flatOutput) && <Image key={active.output || active.flatOutput} src={(active.output || active.flatOutput)!} alt={active.output ? 'Design with background removed' : 'Design ready for background removal'} fill unoptimized sizes="(min-width: 1280px) 520px, 60vw" className="object-contain" onLoad={event => { const image = event.currentTarget; if (active.width !== image.naturalWidth || active.height !== image.naturalHeight) update(active.id, { width: image.naturalWidth, height: image.naturalHeight }); }} />}{active?.status === 'working' && <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/85 p-4 text-center text-xs text-zinc-700"><Loader2 className="animate-spin text-blue-600" />{active.phase}</div>}</div>{active?.output && active.width && <p className="mt-2 text-xs text-zinc-500">{active.width} × {active.height} px · transparent PNG</p>}</div>
            </div>
            {active?.kind === 'photos' && active.extracted && <section className="space-y-3 rounded-lg border border-indigo-200 bg-indigo-50/60 p-4" aria-label="Create a new design">
              <div><h4 className="text-sm font-semibold text-indigo-950">Create a new design</h4><p className="mt-1 text-xs leading-5 text-indigo-800">Use the extracted artwork as inspiration for a new composition about the same subject. Your original extraction stays available.</p></div>
              <label className="block text-xs font-medium text-indigo-950" htmlFor="remix-direction">Creative direction <span className="font-normal text-indigo-700">(optional)</span></label>
              <textarea id="remix-direction" value={remixDirection} onChange={event => setRemixDirection(event.target.value)} rows={2} maxLength={1000} placeholder="Example: dramatic poster layout, different pose, ornamental border, bold lettering" className="w-full resize-y rounded-md border border-indigo-200 bg-white p-2 text-xs text-zinc-800" />
              <button type="button" disabled={busy} onClick={() => void createNewDesign()} className="rounded-md bg-indigo-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Generate new design</button>
              {active.remixCandidate && <div className="space-y-3 border-t border-indigo-200 pt-3"><p className="text-xs font-semibold text-indigo-950">New design preview</p><div className="mx-auto relative aspect-square max-w-md overflow-hidden rounded-md bg-white"><Image src={active.remixCandidate} alt="New design inspired by the extracted artwork" fill unoptimized sizes="450px" className="object-contain" /></div><div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={useNewDesign} className="rounded-md bg-indigo-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Use this new design</button><button type="button" disabled={busy} onClick={() => update(active.id, { remixCandidate: undefined })} className="rounded-md border border-indigo-300 bg-white px-4 py-2 text-xs font-medium text-indigo-800">Discard</button></div></div>}
              {active.isRemixed && <button type="button" disabled={busy} onClick={() => void fitActiveExtraction()} className="text-xs font-medium text-indigo-700 disabled:opacity-50">Restore original extracted design</button>}
            </section>}
            {active?.status === 'ready' && active.flatOutput && !active.output && <div className="flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-4"><button type="button" disabled={busy} onClick={() => void tryAiMask()} className="bg-violet-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Remove with AI mask →</button><button type="button" disabled={busy} onClick={() => void rebuildCutout()} className="border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 disabled:opacity-50">Use pixel removal</button><span className="text-xs text-zinc-500">AI mask uses the original design image and makes a model request.</span></div>}
            {active?.maskCandidate && <div className="space-y-2 rounded-lg border border-violet-200 bg-violet-50 p-3 text-xs"><p className="font-medium text-violet-900">AI mask preview · {active.maskRemoved?.toLocaleString()} background pixels cleared</p><div className="grid gap-2 sm:grid-cols-2"><div><p className="mb-1">Original design</p><div className="relative aspect-square bg-white"><Image src={(active.flatOutput || active.source)!} alt="Original design before background removal" fill unoptimized sizes="400px" className="object-contain" /></div></div><div><p className="mb-1">AI mask result</p><div className="relative aspect-square" style={checkerboard}><Image src={active.maskCandidate} alt="AI mask background removal preview" fill unoptimized sizes="400px" className="object-contain" /></div></div></div><div className="flex gap-2"><button type="button" disabled={busy} onClick={() => void acceptMaskCleanup()} className="border border-violet-500 bg-violet-700 px-3 py-2 font-medium text-white">Use AI mask result</button><button type="button" disabled={busy} onClick={() => update(active.id, { maskCandidate: undefined, maskRemoved: undefined })} className="border border-zinc-300 bg-white px-3 py-2 font-medium">Discard preview</button></div></div>}
            {active?.kind === 'photos' && active.flatOutput && <div className="flex flex-wrap items-center gap-4">{!active.isRemixed && <button type="button" disabled={busy} onClick={() => void fitActiveExtraction()} className="text-xs font-medium text-blue-700 disabled:opacity-50">Fit artwork to canvas</button>}<button type="button" onClick={() => downloadPng(active.flatOutput!, `${active.file.name.replace(/\.[^.]+$/, '')}-${active.isRemixed ? 'new-design' : 'extracted-design'}.png`)} className="text-xs text-blue-700">Download {active.isRemixed ? 'new' : 'extracted'} design</button></div>}
            {active?.status === 'ready' && active.review && <div className="space-y-2 border-t border-zinc-100 pt-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => { setReviewOpen(true); setReviewActualSize(false); }} className="border border-zinc-300 bg-white px-3 py-2 font-medium text-zinc-800">Inspect at full size</button>
                {active.review.marginPixels > 0 && active.review.canCleanMargins && <button type="button" disabled={busy} onClick={() => void cleanActiveMargins()} className="border border-blue-300 bg-blue-50 px-3 py-2 font-medium text-blue-700 disabled:opacity-50">Clean stray pixels</button>}
              </div>
              {active.flatOutput && <details><summary className="cursor-pointer font-medium text-zinc-600">Try another background removal method</summary><div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" disabled={busy} onClick={() => void tryAiMask()} className="border border-violet-300 bg-violet-50 px-3 py-2 font-medium text-violet-800 disabled:opacity-50">Generate AI mask from original</button><button type="button" disabled={busy} onClick={() => void rebuildCutout()} className="border border-zinc-300 bg-white px-3 py-2 font-medium text-zinc-800 disabled:opacity-50">Use pixel removal</button></div></details>}
              {active.review.marginPixels > 0 && <p className="text-amber-800">
                {active.review.bounds
                  ? `${active.review.marginPixels.toLocaleString()} stray pixels detected outside the artwork.`
                  : 'Artwork bounds are unclear; inspect the PNG before using it.'}
              </p>}
              {active.review.bounds && !active.review.canCleanMargins && active.review.marginPixels > 0 && <p className="text-zinc-600">The artwork reaches an image edge, so automatic margin cleanup is disabled.</p>}
            </div>}
            {active?.status === 'ready' && active.output && <label className="flex items-center gap-2 border-t border-zinc-100 pt-3 text-xs font-medium text-zinc-700"><input aria-label={`Use ${active.file.name} for mockups`} type="checkbox" checked={!!active.selected} disabled={busy} onChange={event => update(active.id, { selected: event.target.checked })} /> Use this result for mockups</label>}
            {active?.kind === 'photos' && active && <details className="border-t border-zinc-100 pt-3"><summary className="cursor-pointer text-xs font-medium text-zinc-700">Refine extraction</summary><div className="mt-3 space-y-3"><p className="text-xs leading-5 text-zinc-500">Regenerate to remove copied seller watermarks. Edit the description if needed; this makes a new model request.</p><label htmlFor="print-details" className="block text-xs font-medium text-zinc-700">Artwork description</label><textarea id="print-details" value={active.details || ''} onChange={event => update(active.id, { details: event.target.value })} disabled={busy} rows={5} placeholder="Describe the print you want to extract." className="w-full resize-y border border-zinc-300 bg-white p-2 text-xs leading-5 text-zinc-800 disabled:opacity-60" /><button type="button" disabled={busy || !active.source} onClick={regenerateActive} className="border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 disabled:opacity-50">Regenerate artwork</button></div></details>}
            {active?.analysisWarning && <p className="text-xs text-amber-700">{active.analysisWarning}</p>}
            {active?.kind === 'photos' && active?.status === 'error' && <button type="button" disabled={busy} onClick={() => flatImportRef.current?.click()} className="border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-700 disabled:opacity-50">Use a saved solid extraction for this photo</button>}
            {active?.status === 'error' && active.flatOutput && <button type="button" disabled={busy} onClick={() => void rebuildCutout()} className="border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 disabled:opacity-50">Retry background removal from extracted design</button>}
            {active?.error && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-xs text-red-700"><span>{active.error}</span><button type="button" disabled={busy} onClick={() => active.flatOutput ? void rebuildCutout() : void processBatch([active], active.kind || 'photos', true)} className="border border-red-300 bg-white px-3 py-2 font-medium disabled:opacity-50">Retry this image</button></div>}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs"><span className="font-medium text-zinc-700">Images · {visibleItems.length}</span><button type="button" disabled={busy || !ready.length} onClick={() => { const selectAll = selected.length !== ready.length; setItems(current => current.map(item => item.status === 'ready' && item.output ? { ...item, selected: selectAll } : item)); }} className="text-blue-700 disabled:opacity-50">{selected.length === ready.length && ready.length ? 'Deselect all' : 'Select all ready'}</button></div>
            <div className="grid max-h-[500px] gap-2 overflow-y-auto sm:grid-cols-2 xl:grid-cols-1">
              {visibleItems.map(item => <div key={item.id} className={`flex min-w-0 items-center gap-2 border p-2 ${active?.id === item.id ? 'border-blue-500 bg-blue-50' : 'border-zinc-200 bg-white'}`}><button type="button" aria-label={`Review ${item.file.name}`} aria-pressed={active?.id === item.id} onClick={() => setActiveId(item.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left"><span className="relative h-14 w-14 shrink-0" style={checkerboard}>{(item.output || item.flatOutput || item.source) && <Image src={(item.output || item.flatOutput || item.source)!} alt="" fill unoptimized sizes="56px" className="object-contain" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium" title={item.file.name}>{item.file.name}</span><span className="text-[11px] text-zinc-500">{item.status === 'ready' ? item.output ? item.selected ? 'Selected for mockups' : 'Cutout ready' : 'Remove background next' : item.status === 'error' ? 'Needs attention' : item.status === 'working' ? item.phase : 'Waiting'}</span></span></button><button type="button" disabled={busy} aria-label={`Remove ${item.file.name} from batch`} onClick={() => setItems(current => current.filter(entry => entry.id !== item.id))} className="shrink-0 p-1 text-zinc-500 hover:text-red-700 disabled:opacity-50"><X size={14} /></button></div>)}
            </div>
          </div>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-3 border border-zinc-200 bg-white p-4"><div><h3 className="text-sm font-semibold text-zinc-900">Ready for mockups?</h3><p className="mt-1 text-xs text-zinc-500">{selected.length ? `${selected.length} design${selected.length === 1 ? '' : 's'} selected` : 'Select the designs you want to use.'}</p></div><button type="button" disabled={busy || selected.length === 0} onClick={continueToMockups} className="bg-blue-600 px-4 py-2 text-xs font-medium text-white disabled:opacity-50">Continue to Mockups →</button></section>
        <p className="text-xs text-zinc-500">Download PNGs before closing this page; the batch is kept only for this session.</p>
      </>}
    </div>
    {reviewOpen && active?.output && active.review && <div role="dialog" aria-modal="true" aria-label={`Inspect ${active.file.name} mask`} className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 p-3 text-xs">
        <strong className="mr-auto max-w-64 truncate text-sm">Inspect mask · {active.file.name}</strong>
        <span>Background</span>
        {(['checker', 'white', 'black'] as const).map(background => <button key={background} type="button" aria-pressed={reviewBackground === background} onClick={() => setReviewBackground(background)} className={`border px-2 py-1.5 capitalize ${reviewBackground === background ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-zinc-300'}`}>{background === 'checker' ? 'Checkerboard' : background}</button>)}
        <label className="flex items-center gap-2"><input type="checkbox" checked={showArtifacts} onChange={event => setShowArtifacts(event.target.checked)} disabled={!active.review.overlay} /> Highlight margin pixels</label>
        <button type="button" onClick={() => setReviewActualSize(current => !current)} className="border border-zinc-300 px-3 py-1.5">{reviewActualSize ? 'Fit image' : '100% size'}</button>
        <button type="button" onClick={() => setReviewOpen(false)} aria-label="Close mask inspection" className="border border-zinc-300 p-1.5"><X size={16} /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4" style={reviewBackground === 'checker' ? checkerboard : { backgroundColor: reviewBackgrounds[reviewBackground] }}>
        <div className="relative mx-auto" style={{ width: reviewActualSize ? `${active.review.width}px` : '100%', height: reviewActualSize ? `${active.review.height}px` : 'calc(100vh - 150px)' }}>
          <Image src={active.output} alt="Transparent design at review size" fill unoptimized sizes={reviewActualSize ? `${active.review.width}px` : '900px'} className="object-contain" />
          {showArtifacts && active.review.overlay && <Image src={active.review.overlay} alt="" fill unoptimized sizes={reviewActualSize ? `${active.review.width}px` : '900px'} className="pointer-events-none object-contain" />}
        </div>
      </div>
      <div className="border-t border-zinc-200 p-3 text-xs text-zinc-600">Red markers show pixels outside the main print area. The original PNG is unchanged until you choose Clean empty margins.</div>
    </div>}
  </div>;
}
