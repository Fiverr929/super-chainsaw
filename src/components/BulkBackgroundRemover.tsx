'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ImagePlus, Loader2, UploadCloud, X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { EdgeMode } from '@/lib/mask-test/commands';
import type { PreparedArtwork } from '@/lib/workspaceArtwork';
import { prepareDesignCutout } from '@/lib/designCutout';
import { prepareFlatDesign } from '@/lib/flatDesign';
import { cleanCutoutMargins, cropCutoutToArtwork, reviewCutout } from '@/lib/cutoutQuality';
import { applyDirectMask } from '@/lib/hybridMask';
import { cleanCutoutMask, DEFAULT_MASK_CLEANUP } from '@/lib/mask-test/cleanup';
import MaskRefiner from '@/components/MaskRefiner';
import type { CutoutQuality } from '@/lib/cutoutQuality';
import type { ImagePreset } from './ImagePresetManagerModal';
import { getStoredGeminiApiKey } from '@/lib/clientApiKey';
import { getStoredOpenRouterApiKey } from '@/lib/clientOpenRouterKey';
import { DEFAULT_OPENROUTER_IMAGE_ASPECT_RATIO, DEFAULT_OPENROUTER_IMAGE_MODEL, DEFAULT_OPENROUTER_IMAGE_QUALITY, OPENROUTER_IMAGE_ASPECT_RATIOS, OPENROUTER_IMAGE_MODELS, openRouterQualityForModel, type OpenRouterImageAspectRatio, type OpenRouterImageModel, type OpenRouterImageQuality } from '@/lib/openRouterImage';
import { DEFAULT_EXTRACTION_PROMPT, DEFAULT_IMAGE_MODEL, DEFAULT_IMAGE_QUALITY, IMAGE_MODEL_OPTIONS, imageQualityForModel, type ImageModelId, type ImageQuality } from '@/lib/designExtraction';
import { readyDesigns } from '@/lib/designBatch';
import { deleteSavedExtractedDesign, listSavedExtractedDesigns, saveExtractedDesign, type SavedExtractedDesign } from '@/lib/savedExtractedDesigns';
import type { DesignConcept, DesignIdeaResponse } from '@/lib/designIdeation';

type BatchItem = {
  id: string;
  file: File;
  kind?: 'photos' | 'designs';
  gptPhoto?: boolean;
  gptOriginal?: boolean;
  originalDirection?: string;
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
  gptCandidate?: string;
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

async function recreatePhotoWithGpt(file: File, model: OpenRouterImageModel, quality: OpenRouterImageQuality, aspectRatio: OpenRouterImageAspectRatio, intent: 'faithful' | 'original', creativeDirection = ''): Promise<string> {
  const form = new FormData();
  form.append('image', file);
  form.append('model', model);
  form.append('quality', quality);
  form.append('aspectRatio', aspectRatio);
  form.append('intent', intent);
  if (intent === 'original' && creativeDirection.trim()) form.append('creativeDirection', creativeDirection.trim());
  const key = getStoredOpenRouterApiKey();
  const response = await fetch('/api/image/openrouter-photo-to-design', {
    method: 'POST',
    headers: key ? { 'x-openrouter-api-key': key } : undefined,
    body: form,
    signal: AbortSignal.timeout(210000),
  });
  const data = await response.json().catch(() => { throw new Error('The GPT Image service returned an unreadable response.'); });
  if (!response.ok || !data.image) throw new Error(data.error || 'Could not recreate the transparent design with GPT Image.');
  return data.image;
}

export default function BulkBackgroundRemover({ onContinue, onOpenPresets, preset, incomingAsset, researchDirection }: { onContinue: (artworks: PreparedArtwork[]) => void; onOpenPresets: () => void; preset: ImagePreset; incomingAsset?: { url: string; name: string; requestId?: string } | null; researchDirection?: { id: string; prompt: string; imageUrl: string } | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const gptPhotoInputRef = useRef<HTMLInputElement>(null);
  const gptOriginalInputRef = useRef<HTMLInputElement>(null);
  const importedAssetRef = useRef<string | null>(null);
  const designInputRef = useRef<HTMLInputElement>(null);
  const flatImportRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false);
  const latestOutputRef = useRef(new Map<string, string>());
  const [items, setItems] = useState<BatchItem[]>([]);
  const [savedDesigns, setSavedDesigns] = useState<SavedExtractedDesign[]>([]);
  const [removalMethod, setRemovalMethod] = useState<'ai' | 'local' | 'gpt'>('local');
  const [gptModel, setGptModel] = useState<OpenRouterImageModel>(DEFAULT_OPENROUTER_IMAGE_MODEL);
  const [gptQuality, setGptQuality] = useState<OpenRouterImageQuality>(DEFAULT_OPENROUTER_IMAGE_QUALITY);
  const [gptAspectRatio, setGptAspectRatio] = useState<OpenRouterImageAspectRatio>(DEFAULT_OPENROUTER_IMAGE_ASPECT_RATIO);
  const [tool, setTool] = useState<'prepare' | 'ideas'>('prepare');
  const [showOriginal, setShowOriginal] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [edgeMode, setEdgeMode] = useState<EdgeMode>('soft');
  const [includeInside, setIncludeInside] = useState(true);
  const [maskCleanupEnabled, setMaskCleanupEnabled] = useState(true);
  const [maskCleanupOptions, setMaskCleanupOptions] = useState(DEFAULT_MASK_CLEANUP);
  const [imageModel, setImageModel] = useState<ImageModelId>(DEFAULT_IMAGE_MODEL);
  const [quality, setQuality] = useState<ImageQuality>(DEFAULT_IMAGE_QUALITY);
  const [remixDirection, setRemixDirection] = useState('');
  const [originalDirection, setOriginalDirection] = useState('');
  useEffect(() => {
    if (!researchDirection) return;
    setOriginalDirection(researchDirection.prompt);
    setItems(current => current.map(item => item.gptOriginal ? { ...item, originalDirection: researchDirection.prompt } : item));
  }, [researchDirection]);
  const [designIdeas, setDesignIdeas] = useState<DesignIdeaResponse | null>(null);
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewBackground, setReviewBackground] = useState<ReviewBackground>('checker');
  const [reviewActualSize, setReviewActualSize] = useState(false);
  const [showArtifacts, setShowArtifacts] = useState(true);
  const modelOption = IMAGE_MODEL_OPTIONS.find(option => option.id === imageModel) || IMAGE_MODEL_OPTIONS[0];
  const gptModelOption = OPENROUTER_IMAGE_MODELS.find(option => option.id === gptModel)!;

  useEffect(() => {
    void listSavedExtractedDesigns().then(setSavedDesigns).catch(() => toast.error('Could not load saved extracted designs.'));
  }, []);

  useEffect(() => {
    setDesignIdeas(null);
    setSelectedConceptId(null);
    setRemixDirection('');
  }, [activeId]);

  useEffect(() => {
    try {
      const cleanup = JSON.parse(localStorage.getItem('workstation_mask_cleanup') || 'null');
      if (cleanup && typeof cleanup.enabled === 'boolean') setMaskCleanupEnabled(cleanup.enabled);
      if (cleanup && [cleanup.componentPercent, cleanup.holePercent].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100)) {
        const isPreviousDefault = cleanup.componentPercent === 20 && cleanup.holePercent === 5;
        setMaskCleanupOptions(isPreviousDefault ? DEFAULT_MASK_CLEANUP : { componentPercent: cleanup.componentPercent, holePercent: cleanup.holePercent });
      }
    } catch { /* Use default cleanup settings when storage is unavailable or invalid. */ }
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    const timer = setTimeout(() => {
      try { localStorage.setItem('workstation_mask_cleanup', JSON.stringify({ enabled: maskCleanupEnabled, ...maskCleanupOptions })); }
      catch { /* Cleanup still works when storage is unavailable. */ }
    }, 500);
    return () => clearTimeout(timer);
  }, [maskCleanupEnabled, maskCleanupOptions, settingsLoaded]);

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

  useEffect(() => {
    try {
      const model = localStorage.getItem('workstation_gpt_cutout_model');
      if (OPENROUTER_IMAGE_MODELS.some(option => option.id === model)) {
        const selected = model as OpenRouterImageModel;
        setGptModel(selected);
        setGptQuality(openRouterQualityForModel(selected, localStorage.getItem('workstation_gpt_cutout_quality') || ''));
      }
      const ratio = localStorage.getItem('workstation_gpt_cutout_aspect_ratio');
      if (OPENROUTER_IMAGE_ASPECT_RATIOS.some(value => value === ratio)) setGptAspectRatio(ratio as OpenRouterImageAspectRatio);
    } catch { /* Use defaults when browser storage is unavailable. */ }
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem('workstation_gpt_cutout_model', gptModel);
        localStorage.setItem('workstation_gpt_cutout_quality', gptQuality);
        localStorage.setItem('workstation_gpt_cutout_aspect_ratio', gptAspectRatio);
      } catch { /* Settings still work for this session. */ }
    }, 500);
    return () => clearTimeout(timer);
  }, [gptModel, gptQuality, gptAspectRatio, settingsLoaded]);
  const visibleItems = items;
  const active = visibleItems.find(item => item.id === activeId) || visibleItems[0];
  const ready = readyDesigns(visibleItems).filter(item => !item.gptCandidate);
  const selected = ready.filter(item => item.selected);
  const selectedConcept = designIdeas?.concepts.find(concept => concept.id === selectedConceptId) || null;

  const update = (id: string, changes: Partial<BatchItem>) => {
    setItems(current => current.map(item => item.id === id ? { ...item, ...changes } : item));
  };

  const processItem = async (item: BatchItem, kind: 'photos' | 'designs', regenerate = false) => {
    update(item.id, { status: 'working', selected: false, ...(!item.gptPhoto ? { output: undefined, review: undefined } : {}), gptCandidate: undefined, error: undefined, phase: item.gptOriginal ? 'Creating inspired design with GPT Image…' : item.gptPhoto ? 'Recreating transparent design with GPT Image…' : kind === 'photos' ? 'Extracting design…' : 'Preparing design…' });
    try {
      const source = item.source || await readFile(item.file);
      update(item.id, { source });
      if (item.gptPhoto) {
        const gptCandidate = await recreatePhotoWithGpt(item.file, gptModel, gptQuality, gptAspectRatio, item.gptOriginal ? 'original' : 'faithful', item.originalDirection);
        update(item.id, { source, gptCandidate, extracted: undefined, flatOutput: undefined, status: 'ready', selected: false, phase: undefined });
        toast.success(item.gptOriginal ? 'Inspired design preview is ready. Review it before using it.' : 'Transparent design preview is ready. Compare it with the product photo before using it.');
        return;
      }
      const generated = kind === 'photos'
        ? !regenerate && item.extracted
          ? { image: item.extracted, details: item.details, reference: item.reference, analysisWarning: item.analysisWarning }
          : await extractGraphic(item.file, preset, imageModel, quality, item.details, item.reference)
        : { image: source };
      const extracted = generated.image;
      update(item.id, { extracted, details: generated.details, reference: generated.reference, analysisWarning: generated.analysisWarning, phase: kind === 'photos' ? 'Preparing extracted design…' : 'Preparing design…' });
      if (kind === 'photos') {
        const flatOutput = await prepareFlatDesign(extracted);
        update(item.id, { source, extracted, flatOutput, remixCandidate: undefined, isRemixed: false, output: undefined, review: undefined, details: generated.details, reference: generated.reference, analysisWarning: generated.analysisWarning, marginsCleaned: false, maskCandidate: undefined, gptCandidate: undefined, maskRemoved: undefined, maskApplied: false, status: 'ready', selected: false, generatedWith: { model: imageModel, quality }, alreadyTransparent: false, phase: undefined });
        try {
          await saveExtractedDesign({ id: item.id, file: item.file, extracted, details: generated.details, savedAt: Date.now() });
          setSavedDesigns(await listSavedExtractedDesigns());
        } catch { toast.error('The extraction is ready, but it could not be saved in this browser.'); }
      } else {
        update(item.id, { source, extracted: undefined, flatOutput: source, output: undefined, review: undefined, marginsCleaned: false, maskCandidate: undefined, gptCandidate: undefined, maskRemoved: undefined, maskApplied: false, status: 'ready', selected: false, phase: undefined });
      }
    } catch (error) {
      update(item.id, { status: item.gptPhoto && item.output ? 'ready' : 'error', phase: undefined, error: error instanceof Error ? error.message : 'Design extraction failed.' });
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

  const addFiles = (files: File[], kind: 'photos' | 'designs' = 'photos', sourceAssetUrl?: string, gptPhoto = false, gptOriginal = false, directionOverride?: string) => {
    if (processingRef.current) return;
    const images = files.filter(file => ['image/png', 'image/jpeg', 'image/webp'].includes(file.type));
    if (images.length !== files.length) toast.error('Only PNG, JPG, and WebP images are supported.');
    if (!images.length) return;
    if (items.length + images.length > 20) { toast.error('Use up to 20 images per batch.'); return; }
    const added = images.map(file => ({ id: crypto.randomUUID(), file, kind, gptPhoto, gptOriginal, originalDirection: gptOriginal ? (directionOverride ?? originalDirection).trim() : undefined, selected: false, status: 'waiting' as const, sourceAssetUrl }));
    setItems(current => [...current, ...added]);
    setTool('prepare');
    setActiveId(added[0].id);
    void processBatch(added, kind);
  };

  useEffect(() => {
    if (!researchDirection?.imageUrl) return;
    if (processingRef.current) { toast.error('Wait for the current image request, then choose the research direction again.'); return; }
    const { imageUrl, prompt } = researchDirection;
    if (!/^\/workspace-assets\/etsy\/\d{8,15}\//.test(imageUrl)) { toast.error('The selected source image is unavailable.'); return; }
    void fetch(imageUrl).then(async response => {
      if (!response.ok) throw new Error('Could not open the imported listing image.');
      const blob = await response.blob();
      const extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
      addFiles([new File([blob], `research-source.${extension}`, { type: blob.type })], 'photos', imageUrl, true, true, prompt);
    }).catch(error => toast.error(error instanceof Error ? error.message : 'Could not open the imported listing image.'));
  // A new research selection initiates one GPT Image request using the selected asset.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [researchDirection]);

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
      const source = active.flatOutput || active.source!;
      const cutout = await prepareDesignCutout(source, edgeMode, includeInside);
      const alreadyTransparent = cutout.alreadyTransparent;
      const output = maskCleanupEnabled && !alreadyTransparent
        ? await cleanCutoutMask(source, cutout.output, maskCleanupOptions)
        : cutout.output;
      const review = await reviewCutout(output);
      latestOutputRef.current.set(active.id, output);
      update(active.id, { output, review, marginsCleaned: false, maskCandidate: undefined, gptCandidate: undefined, maskRemoved: undefined, maskApplied: false, status: 'ready', selected: false, alreadyTransparent, phase: undefined });
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
      update(active.id, { extracted, flatOutput, remixCandidate: undefined, isRemixed: false, output: undefined, review: undefined, marginsCleaned: false, maskCandidate: undefined, gptCandidate: undefined, maskRemoved: undefined, maskApplied: false, status: 'ready', selected: false, phase: undefined });
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
      update(active.id, { flatOutput, isRemixed: false, output: undefined, review: undefined, gptCandidate: undefined, selected: false, status: 'ready', phase: undefined });
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

  const developIdeas = async () => {
    if (!active?.extracted || processingRef.current) return;
    processingRef.current = true;
    setBusy(true);
    update(active.id, { phase: 'Developing original product ideas…' });
    try {
      const referenceBlob = await (await fetch(active.extracted)).blob();
      const form = new FormData();
      form.append('image', new File([referenceBlob], 'extracted-design', { type: referenceBlob.type || 'image/png' }));
      const key = getStoredGeminiApiKey();
      const response = await fetch('/api/design/ideas', { method: 'POST', headers: key ? { 'x-gemini-api-key': key } : undefined, body: form, signal: AbortSignal.timeout(150000) });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.concepts)) throw new Error(data.error || 'Could not develop design ideas.');
      setDesignIdeas(data as DesignIdeaResponse);
      setSelectedConceptId(data.concepts[0]?.id || null);
      update(active.id, { phase: undefined });
    } catch (error) {
      update(active.id, { phase: undefined });
      toast.error(error instanceof Error ? error.message : 'Could not develop design ideas.');
    } finally {
      processingRef.current = false;
      setBusy(false);
    }
  };

  const createNewDesign = async (concept?: DesignConcept | null) => {
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
      if (concept) form.append('concept', JSON.stringify(concept));
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
    update(active.id, { flatOutput: active.remixCandidate, remixCandidate: undefined, isRemixed: true, output: undefined, review: undefined, maskCandidate: undefined, gptCandidate: undefined, maskRemoved: undefined, selected: false, status: 'ready' });
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
    update(active.id, { phase: 'Generating artwork mask…', maskCandidate: undefined, gptCandidate: undefined });
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
      const output = maskCleanupEnabled ? await cleanCutoutMask(maskSource, candidate.output, maskCleanupOptions) : candidate.output;
      update(active.id, { maskCandidate: output, maskRemoved: maskCleanupEnabled ? undefined : candidate.removed, phase: undefined });
      toast.success('AI mask preview is ready. Review it before applying.');
    } catch (error) {
      update(active.id, { phase: undefined });
      toast.error(error instanceof Error ? error.message : 'AI mask removal failed.');
    } finally {
      processingRef.current = false;
      setBusy(false);
    }
  };

  const tryGptCutout = async () => {
    if (!active?.flatOutput || processingRef.current) return;
    processingRef.current = true;
    setBusy(true);
    update(active.id, { status: 'working', phase: 'Removing background with GPT Image…', error: undefined, gptCandidate: undefined, maskCandidate: undefined });
    try {
      const form = new FormData();
      const source = await (await fetch(active.flatOutput)).blob();
      form.append('image', new File([source], 'extracted-design.png', { type: 'image/png' }));
      form.append('model', gptModel);
      form.append('quality', gptQuality);
      form.append('aspectRatio', gptAspectRatio);
      const key = getStoredOpenRouterApiKey();
      const response = await fetch('/api/image/openrouter-cutout', {
        method: 'POST',
        headers: key ? { 'x-openrouter-api-key': key } : undefined,
        body: form,
        signal: AbortSignal.timeout(210000),
      });
      const data = await response.json().catch(() => { throw new Error('The GPT Image service returned an unreadable response.'); });
      if (!response.ok || !data.image) throw new Error(data.error || 'Could not remove the background with GPT Image.');
      update(active.id, { gptCandidate: data.image, status: 'ready', phase: undefined });
      toast.success('GPT Image preview is ready. Review it before using it.');
    } catch (error) {
      update(active.id, { status: 'ready', phase: undefined });
      toast.error(error instanceof Error ? error.message : 'GPT Image background removal failed.');
    } finally {
      processingRef.current = false;
      setBusy(false);
    }
  };

  const acceptGptCutout = async () => {
    if (!active?.gptCandidate || processingRef.current) return;
    processingRef.current = true;
    setBusy(true);
    try {
      const output = active.gptCandidate;
      const review = await reviewCutout(output);
      latestOutputRef.current.set(active.id, output);
      update(active.id, { output, review, gptCandidate: undefined, maskCandidate: undefined, maskRemoved: undefined, maskApplied: false, marginsCleaned: false, selected: false, status: 'ready' });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not use the GPT Image cutout.');
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
    update(active.id, { output, review, maskCandidate: undefined, gptCandidate: undefined, maskRemoved: undefined, maskApplied: true, marginsCleaned: true, selected: false, status: 'ready' });
  };

  const settingsPanel = <details className="relative text-xs text-zinc-600">
    <summary className="cursor-pointer rounded-md px-3 py-2 font-medium hover:bg-zinc-100">Settings</summary>
    <div className="absolute right-0 z-20 mt-2 max-h-[65vh] w-[min(320px,calc(100vw-100px))] space-y-5 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-4 shadow-lg">
      <section><h4 className="font-semibold text-zinc-900">Extraction</h4><div className="mt-3 space-y-3"><button type="button" onClick={onOpenPresets} className="border border-zinc-300 px-2 py-1.5 font-medium">Preset: {preset.name}</button><label className="flex items-center gap-2">Model <select aria-label="Image model" value={imageModel} disabled={busy || !settingsLoaded} onChange={event => changeModel(event.target.value as ImageModelId)} className="border border-zinc-300 bg-white p-1.5">{IMAGE_MODEL_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label><label className="flex items-center gap-2">Quality <select aria-label="Output quality" value={quality} disabled={busy || !settingsLoaded} onChange={event => setQuality(event.target.value as ImageQuality)} className="border border-zinc-300 bg-white p-1.5">{modelOption.qualities.map(option => <option key={option} value={option}>{option}</option>)}</select></label></div></section>
      <section className="border-t border-zinc-200 pt-4"><h4 className="font-semibold text-zinc-900">GPT Image · OpenRouter</h4><p className="mt-1 text-zinc-500">Used for cutouts and one-step photo to design.</p><div className="mt-3 space-y-3">
        <label className="flex items-center justify-between gap-2">Model <select aria-label="GPT Image model" value={gptModel} disabled={busy} onChange={event => { const model = event.target.value as OpenRouterImageModel; setGptModel(model); setGptQuality(openRouterQualityForModel(model, gptQuality)); }} className="max-w-44 border border-zinc-300 bg-white p-1.5">{OPENROUTER_IMAGE_MODELS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
        <label className="flex items-center justify-between gap-2">Quality <select aria-label="GPT Image quality" value={gptQuality} disabled={busy} onChange={event => setGptQuality(event.target.value as OpenRouterImageQuality)} className="border border-zinc-300 bg-white p-1.5">{gptModelOption.qualities.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="flex items-center justify-between gap-2">Aspect ratio <select aria-label="GPT Image aspect ratio" value={gptAspectRatio} disabled={busy} onChange={event => setGptAspectRatio(event.target.value as OpenRouterImageAspectRatio)} className="border border-zinc-300 bg-white p-1.5">{OPENROUTER_IMAGE_ASPECT_RATIOS.map(value => <option key={value} value={value}>{value === 'auto' ? 'Auto' : value}</option>)}</select></label>
        <label className="block space-y-1"><span>Inspired design direction (optional)</span><textarea aria-label="Inspired design direction" value={originalDirection} disabled={busy} maxLength={600} rows={3} onChange={event => setOriginalDirection(event.target.value)} placeholder="Theme, symbols, palette, or wording to include" className="w-full resize-y border border-zinc-300 bg-white p-2" /></label>
      </div></section>
      <section className="border-t border-zinc-200 pt-4"><h4 className="font-semibold text-zinc-900">Background removal</h4><div className="mt-3 space-y-3"><label className="flex items-center justify-between gap-2">Edge cleanup <select aria-label="Edge cleanup" value={edgeMode} disabled={busy} onChange={event => setEdgeMode(event.target.value as EdgeMode)} className="border border-zinc-300 bg-white p-1.5"><option value="strict">Strict</option><option value="soft">Soft</option><option value="max">Maximum</option></select></label><label className="flex items-center gap-2"><input type="checkbox" checked={includeInside} disabled={busy} onChange={event => setIncludeInside(event.target.checked)} /> Clear enclosed areas</label>
            <div className="space-y-2 border-t border-zinc-200 pt-3">
              <label className="flex items-center justify-between gap-2"><span className="font-medium">Mask cleanup</span><input role="switch" aria-label="Mask cleanup" type="checkbox" checked={maskCleanupEnabled} disabled={busy || !settingsLoaded} onChange={event => setMaskCleanupEnabled(event.target.checked)} /></label>
              <p className="text-zinc-500">Optional cleanup can remove small pieces or fill holes. Defaults preserve all artwork. Applies the next time you remove the background.</p>
              {maskCleanupEnabled && <>
                <label className="flex items-center justify-between gap-2">Minimum piece size (%)<input aria-label="Minimum piece size percent" type="number" min="0" max="100" step="1" value={maskCleanupOptions.componentPercent} disabled={busy} onChange={event => { const value = event.target.valueAsNumber; if (Number.isFinite(value)) setMaskCleanupOptions(current => ({ ...current, componentPercent: Math.max(0, Math.min(100, value)) })); }} className="w-16 border border-zinc-300 p-1" /></label>
                <label className="flex items-center justify-between gap-2">Maximum hole size (%)<input aria-label="Maximum hole size percent" type="number" min="0" max="100" step="1" value={maskCleanupOptions.holePercent} disabled={busy} onChange={event => { const value = event.target.valueAsNumber; if (Number.isFinite(value)) setMaskCleanupOptions(current => ({ ...current, holePercent: Math.max(0, Math.min(100, value)) })); }} className="w-16 border border-zinc-300 p-1" /></label>
                <p className="text-zinc-500">Piece size is relative to the largest piece; hole size is relative to the kept artwork. Use 0 to preserve all pieces or holes.</p>
              </>}
            </div>
          </div></section>
    </div>
  </details>;

  const savedLibrary = (
    <section className="border border-zinc-200 bg-white p-4" aria-label="Saved extracted designs"><div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-sm font-semibold text-zinc-900">Saved designs</h3><p className="mt-1 text-xs text-zinc-500">Stored in this browser. Open one to continue editing.</p></div><input type="search" aria-label="Search saved designs" placeholder="Search saved designs…" value={librarySearch} onChange={event => setLibrarySearch(event.target.value)} className="w-full border border-zinc-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none sm:w-56" /></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{savedDesigns.filter(saved => saved.file.name.toLowerCase().includes(librarySearch.toLowerCase())).map(saved => <div key={saved.id} className="flex min-w-0 items-center gap-3 border border-zinc-200 p-2"><button type="button" disabled={busy} onClick={() => { setLibraryOpen(false); setTool('prepare'); void reopenSavedDesign(saved); }} className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:opacity-50"><span className="relative block h-16 w-16 shrink-0 bg-zinc-50"><Image src={saved.extracted} alt="" fill unoptimized sizes="64px" className="object-contain" /></span><span className="min-w-0"><span className="block truncate text-xs font-medium text-zinc-800" title={saved.file.name}>{saved.file.name}</span><span className="block text-[11px] text-blue-700">Open design →</span></span></button><button type="button" disabled={busy} onClick={() => void removeSavedDesign(saved.id)} className="shrink-0 px-1 text-[11px] text-red-700 disabled:opacity-50" aria-label={`Delete saved ${saved.file.name}`}>Delete</button></div>)}</div></section>
  );

  return <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-zinc-50 p-4 lg:p-6">
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <section className={visibleItems.length ? 'flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-3' : 'flex justify-end'}>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={event => { addFiles(Array.from(event.target.files || [])); event.target.value = ''; }} />
        <input ref={gptPhotoInputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={event => { addFiles(Array.from(event.target.files || []), 'photos', undefined, true); event.target.value = ''; }} />
        <input ref={gptOriginalInputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={event => { addFiles(Array.from(event.target.files || []), 'photos', undefined, true, true); event.target.value = ''; }} />
          <input ref={designInputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={event => { addFiles(Array.from(event.target.files || []), 'designs'); event.target.value = ''; }} />
          <input ref={flatImportRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={event => { const file = event.target.files?.[0]; if (file) void importSavedExtraction(file); event.target.value = ''; }} />
        <div className="flex flex-wrap items-center justify-between gap-3">

          <div className={visibleItems.length ? 'flex flex-wrap gap-2' : 'hidden'}>
            <details className="relative text-xs"><summary className="cursor-pointer border border-zinc-300 bg-white px-3 py-2 font-medium text-zinc-700 hover:bg-zinc-50">Add images</summary><div className="absolute left-0 z-20 mt-2 w-64 border border-zinc-200 bg-white p-1 shadow-lg"><button type="button" disabled={busy || !settingsLoaded} onClick={() => inputRef.current?.click()} className="w-full px-3 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">Extract from a product photo</button><button type="button" disabled={busy || !settingsLoaded} onClick={() => gptPhotoInputRef.current?.click()} className="w-full px-3 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">GPT: photo to transparent design</button><button type="button" disabled={busy || !settingsLoaded} onClick={() => gptOriginalInputRef.current?.click()} className="w-full px-3 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">GPT: inspired design from photo</button><button type="button" disabled={busy} onClick={() => designInputRef.current?.click()} className="w-full px-3 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">Remove an image background</button></div></details>
            {visibleItems.length > 0 && savedDesigns.length > 0 && <button type="button" aria-expanded={libraryOpen} onClick={() => setLibraryOpen(current => !current)} className="rounded-md border border-zinc-300 px-3 py-2 text-xs text-zinc-700">Saved designs ({savedDesigns.length})</button>}
          </div>
        </div>
        {settingsPanel}
      </section>



      {visibleItems.length > 0 && savedDesigns.length > 0 && libraryOpen && savedLibrary}

      {visibleItems.length === 0 ? <><section className="grid gap-4 md:grid-cols-2" aria-label="Start a design">
        <button type="button" disabled={busy || !settingsLoaded} onClick={() => inputRef.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); addFiles(Array.from(event.dataTransfer.files)); }} className="group flex min-h-44 flex-col items-start justify-center rounded-xl border border-zinc-200 bg-white p-6 text-left hover:border-blue-400 hover:bg-blue-50/30 disabled:opacity-50"><UploadCloud size={26} className="mb-4 text-blue-600" /><span className="text-sm font-semibold text-zinc-900">Extract artwork</span><span className="mt-2 text-xs leading-5 text-zinc-500">Isolate the printed artwork from a product photo.<br />Adding photos starts AI extraction.</span><span className="mt-4 text-xs font-medium text-blue-700">Choose photos →</span></button>
        <button type="button" disabled={busy || !settingsLoaded} onClick={() => gptPhotoInputRef.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); addFiles(Array.from(event.dataTransfer.files), 'photos', undefined, true); }} className="flex min-h-44 flex-col items-start justify-center rounded-xl border border-blue-200 bg-blue-50/40 p-6 text-left hover:border-blue-500 disabled:opacity-50"><ImagePlus size={26} className="mb-4 text-blue-600" /><span className="text-sm font-semibold text-zinc-900">GPT photo to design</span><span className="mt-2 text-xs leading-5 text-zinc-600">Recreate the print from a product photo as a transparent PNG in one OpenRouter request. Review the result before using it.</span><span className="mt-4 text-xs font-medium text-blue-700">Choose photos →</span></button>
        <section className="flex min-h-44 flex-col items-start justify-center rounded-xl border border-indigo-200 bg-indigo-50/40 p-6"><ImagePlus size={26} className="mb-4 text-indigo-600" /><h3 className="text-sm font-semibold text-zinc-900">GPT inspired design</h3><p className="mt-2 text-xs leading-5 text-zinc-600">Create a fresh transparent print using ideas from a product photo.</p><label className="mt-3 w-full text-xs text-zinc-700">Creative direction (optional)<textarea value={originalDirection} onChange={event => setOriginalDirection(event.target.value)} disabled={busy} maxLength={600} rows={2} placeholder="Theme, symbols, palette, or wording" className="mt-1 w-full resize-y border border-indigo-200 bg-white p-2 text-xs" /></label><button type="button" disabled={busy || !settingsLoaded} onClick={() => gptOriginalInputRef.current?.click()} className="mt-3 text-xs font-medium text-indigo-700 disabled:opacity-50">Choose reference photos →</button></section>
        <button type="button" disabled={busy} onClick={() => designInputRef.current?.click()} className="flex min-h-44 flex-col items-start justify-center rounded-xl border border-zinc-200 bg-white p-6 text-left hover:border-zinc-400 disabled:opacity-50"><ImagePlus size={26} className="mb-4 text-zinc-500" /><span className="text-sm font-semibold text-zinc-900">Remove background</span><span className="mt-2 text-xs leading-5 text-zinc-500">Start with an image and export a transparent PNG.</span><span className="mt-4 text-xs font-medium text-blue-700">Open image →</span></button>
        <p className="text-xs text-zinc-500 md:col-span-2">PNG, JPG or WebP · up to 20 images per batch</p>
      </section>
      {savedDesigns.length > 0 && savedLibrary}
      </> : <>
        <section className="flex flex-wrap items-center gap-3 text-xs">
          <h3 className="mr-auto text-sm font-semibold text-zinc-900">Current batch</h3>
          <span role="status" className="text-zinc-600">{busy ? 'Processing · ' : ''}{ready.length} of {visibleItems.length} cutouts ready</span>

        </section>

        <section className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_210px]">
          <div className="min-w-0 space-y-4 rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="min-w-0 break-words text-xs font-medium text-zinc-700">{active?.file.name}</p></div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-3 text-xs">
                <span className="font-semibold text-zinc-800">{active?.gptOriginal ? 'GPT inspired design' : active?.output ? 'Background removed' : active?.gptPhoto ? 'GPT photo to design' : active?.flatOutput ? 'Remove background' : 'Extract artwork'}</span>
                {active?.kind === 'photos' && active.extracted && <details className="relative"><summary className="cursor-pointer text-zinc-500">Creative tools</summary><div className="absolute left-0 z-10 mt-2 w-44 rounded-md border border-zinc-200 bg-white p-1 shadow-lg"><button type="button" aria-pressed={tool === 'ideas'} onClick={() => setTool(tool === 'ideas' ? 'prepare' : 'ideas')} className="w-full rounded px-3 py-2 text-left text-xs hover:bg-zinc-50">{tool === 'ideas' ? 'Back to background removal' : 'Create a variation'}</button></div></details>}
              </div>
              <div className="flex items-center gap-2">{active?.output && active.review && <button type="button" onClick={() => { setReviewOpen(true); setReviewActualSize(false); }} className="inline-flex h-9 items-center border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50">Inspect PNG</button>}
              <button type="button" aria-pressed={showOriginal} onClick={() => setShowOriginal(current => !current)} className="text-xs font-medium text-zinc-600">{showOriginal ? 'Hide original' : 'Compare original'}</button></div>
            </div>

            <div className={`grid gap-3 ${showOriginal ? 'md:grid-cols-2' : ''}`}>
              {showOriginal && <div className="min-w-0 rounded-lg border border-zinc-200 bg-zinc-50 p-3"><p className="mb-2 text-xs font-medium text-zinc-600">Original {active?.kind === 'photos' ? 'product photo' : 'design'}</p><div className="relative h-[clamp(180px,38vh,420px)] overflow-hidden rounded-md bg-zinc-100">{active?.source && <Image src={active.source} alt="Original upload" fill unoptimized sizes="(min-width: 1280px) 400px, 45vw" className="object-contain" />}</div></div>}
              <div className="min-w-0 rounded-lg border border-blue-100 bg-white p-3 shadow-sm"><div className="relative h-[clamp(180px,38vh,420px)] overflow-hidden rounded-md" style={active?.output || active?.gptCandidate ? checkerboard : { backgroundColor: '#f4f4f5' }}>{(active?.gptCandidate || active?.output || active?.flatOutput) && <Image key={active.gptCandidate || active.output || active.flatOutput} src={(active.gptCandidate || active.output || active.flatOutput)!} alt={active.gptCandidate ? 'GPT transparent design preview' : active.output ? 'Design with background removed' : 'Design ready for background removal'} fill unoptimized sizes="(min-width: 1280px) 520px, 60vw" className="object-contain" onLoad={event => { const image = event.currentTarget; if (active.width !== image.naturalWidth || active.height !== image.naturalHeight) update(active.id, { width: image.naturalWidth, height: image.naturalHeight }); }} />}{active?.status === 'working' && <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/85 p-4 text-center text-xs text-zinc-700"><Loader2 className="animate-spin text-blue-600" />{active.phase}</div>}</div>{active?.output && active.width && <p className="mt-2 text-xs text-zinc-500">{active.width} × {active.height} px · transparent PNG</p>}</div>
            </div>
            {tool === 'ideas' && active?.kind === 'photos' && active.extracted && <section className="space-y-4 rounded-lg border border-blue-200 bg-blue-50/60 p-4" aria-label="Create a new design">
              <div><h4 className="text-sm font-semibold text-blue-950">Explore a new design</h4><p className="mt-1 text-xs leading-5 text-blue-800">First develop distinct commercial directions, then generate from the one you choose. The source is treated as inspiration for a distinct design.</p></div>
              {!designIdeas && <button type="button" disabled={busy} onClick={() => void developIdeas()} className="rounded-md bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">Develop 6 product ideas</button>}
              {designIdeas && <>
                <div className="rounded-md border border-blue-100 bg-white/70 p-3 text-xs text-blue-950"><span className="font-semibold">Source opportunity:</span> {designIdeas.sourceBrief.appeal || designIdeas.sourceBrief.subject} <span className="text-blue-700">· {designIdeas.sourceBrief.audience}</span></div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{designIdeas.concepts.map(concept => {
                  const chosen = concept.id === selectedConceptId;
                  return <button key={concept.id} type="button" aria-pressed={chosen} onClick={() => setSelectedConceptId(concept.id)} className={`space-y-2 rounded-lg border p-3 text-left text-xs transition ${chosen ? 'border-blue-600 bg-white ring-2 ring-blue-200' : 'border-blue-200 bg-white/70 hover:border-blue-400'}`}>
                    <span className="block font-semibold text-blue-950">{concept.name}</span>
                    <span className="block text-zinc-700">{concept.hook}</span>
                    <span className="block text-zinc-500"><span className="font-medium">Buyer:</span> {concept.buyer}</span>
                    <span className="block text-zinc-500"><span className="font-medium">Look:</span> {concept.composition} · {concept.style}</span>
                    {concept.garmentColors.length > 0 && <span className="block text-zinc-500"><span className="font-medium">Best on:</span> {concept.garmentColors.join(', ')}</span>}
                  </button>;
                })}</div>
                <button type="button" disabled={busy} onClick={() => void developIdeas()} className="text-xs font-medium text-blue-700 disabled:opacity-50">Regenerate ideas</button>
              </>}
              <label className="block text-xs font-medium text-blue-950" htmlFor="remix-direction">Additional direction <span className="font-normal text-blue-700">(optional)</span></label>
              <textarea id="remix-direction" value={remixDirection} onChange={event => setRemixDirection(event.target.value)} rows={2} maxLength={1000} placeholder="Example: no text, limited to four ink colors, suitable for a black shirt" className="w-full resize-y rounded-md border border-blue-200 bg-white p-2 text-xs text-zinc-800" />
              <button type="button" disabled={busy || (designIdeas !== null && !selectedConcept)} onClick={() => void createNewDesign(selectedConcept)} className="rounded-md bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">{selectedConcept ? `Generate “${selectedConcept.name}”` : 'Quick generate without ideas'}</button>
              {active.remixCandidate && <div className="space-y-3 border-t border-blue-200 pt-3"><p className="text-xs font-semibold text-blue-950">New design preview</p><div className="mx-auto relative aspect-square max-w-md overflow-hidden rounded-md bg-white"><Image src={active.remixCandidate} alt="New design inspired by the extracted artwork" fill unoptimized sizes="450px" className="object-contain" /></div><div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={useNewDesign} className="rounded-md bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">Use this new design</button><button type="button" disabled={busy} onClick={() => update(active.id, { remixCandidate: undefined })} className="rounded-md border border-blue-300 bg-white px-4 py-2 text-xs font-medium text-blue-800">Discard</button></div></div>}
              {active.isRemixed && <button type="button" disabled={busy} onClick={() => void fitActiveExtraction()} className="text-xs font-medium text-blue-700 disabled:opacity-50">Restore original extracted design</button>}
            </section>}
            <div hidden={tool !== 'prepare'} className="space-y-4">

            {active?.maskCandidate && <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs"><p className="font-medium text-blue-900">AI mask preview{active.maskRemoved !== undefined ? ` · ${active.maskRemoved.toLocaleString()} background pixels cleared` : ''}</p><div className="grid gap-2 sm:grid-cols-2"><div><p className="mb-1">Original design</p><div className="relative aspect-square bg-white"><Image src={(active.flatOutput || active.source)!} alt="Original design before background removal" fill unoptimized sizes="400px" className="object-contain" /></div></div><div className="min-w-0"><p className="mb-1">Paint corrections on the result</p><MaskRefiner original={(active.flatOutput || active.source)!} value={active.maskCandidate} onChange={value => update(active.id, { maskCandidate: value, maskRemoved: undefined })} /></div></div><div className="flex gap-2"><button type="button" disabled={busy} onClick={() => void acceptMaskCleanup()} className="border border-blue-500 bg-blue-600 px-3 py-2 font-medium text-white hover:bg-blue-700">Use AI mask result</button><button type="button" disabled={busy} onClick={() => update(active.id, { maskCandidate: undefined, maskRemoved: undefined })} className="border border-zinc-300 bg-white px-3 py-2 font-medium">Discard preview</button></div></div>}
            {active?.gptCandidate && <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs"><p className="font-medium text-blue-900">{active.gptOriginal ? 'GPT inspired design preview' : active.gptPhoto ? 'GPT photo to design preview' : 'GPT Image cutout preview'}</p><div className="grid gap-2 sm:grid-cols-2"><div><p className="mb-1">{active.gptPhoto ? 'Reference product photo' : 'Extracted design'}</p><div className="relative aspect-square bg-white"><Image src={(active.flatOutput || active.source)!} alt={active.gptPhoto ? 'Reference product photo' : 'Extracted design before GPT Image removal'} fill unoptimized sizes="400px" className="object-contain" /></div></div><div><p className="mb-1">Transparent result</p><div className="relative aspect-square" style={checkerboard}><Image src={active.gptCandidate} alt="GPT Image transparent design candidate" fill unoptimized sizes="400px" className="object-contain" /></div></div></div><p className="text-zinc-600">{active.gptOriginal ? 'Review the theme, layout, wording, and print edges before using this design.' : 'Check lettering, composition, fine details, and edges before using this generated result.'}</p><div className="flex gap-2"><button type="button" disabled={busy} onClick={() => void acceptGptCutout()} className="border border-blue-500 bg-blue-600 px-3 py-2 font-medium text-white hover:bg-blue-700">Use GPT Image result</button><button type="button" disabled={busy} onClick={() => update(active.id, { gptCandidate: undefined })} className="border border-zinc-300 bg-white px-3 py-2 font-medium">Discard preview</button>{active.gptPhoto && <button type="button" disabled={busy} onClick={() => void processBatch([active], 'photos', true)} className="border border-blue-300 bg-white px-3 py-2 font-medium text-blue-800">Regenerate</button>}</div></div>}
            <details className="border-t border-zinc-100 pt-3 text-xs"><summary className="cursor-pointer font-medium text-zinc-600">Adjust artwork</summary><div className="mt-3 space-y-4">
            {active?.kind === 'photos' && active.flatOutput && <div className="flex flex-wrap items-center gap-4">{!active.isRemixed && <button type="button" disabled={busy} onClick={() => void fitActiveExtraction()} className="text-xs font-medium text-blue-700 disabled:opacity-50">Fit artwork to canvas</button>}<button type="button" onClick={() => downloadPng(active.flatOutput!, `${active.file.name.replace(/\.[^.]+$/, '')}-${active.isRemixed ? 'new-design' : 'extracted-design'}.png`)} className="text-xs text-blue-700">Download {active.isRemixed ? 'new' : 'extracted'} design</button></div>}
            {active?.status === 'ready' && active.review && <div className="space-y-2 border-t border-zinc-100 pt-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">

                {active.review.marginPixels > 0 && active.review.canCleanMargins && <button type="button" disabled={busy} onClick={() => void cleanActiveMargins()} className="border border-blue-300 bg-blue-50 px-3 py-2 font-medium text-blue-700 disabled:opacity-50">Clean stray pixels</button>}
              </div>
              {active.flatOutput && <details><summary className="cursor-pointer font-medium text-zinc-600">Try another background removal method</summary><div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" disabled={busy} onClick={() => void rebuildCutout()} className="border border-zinc-300 bg-white px-3 py-2 font-medium text-zinc-800 disabled:opacity-50">Use pixel removal</button><button type="button" disabled={busy} onClick={() => void tryGptCutout()} className="border border-blue-300 bg-blue-50 px-3 py-2 font-medium text-blue-800 disabled:opacity-50">Use GPT Image</button><button type="button" disabled={busy} onClick={() => void tryAiMask()} className="border border-blue-300 bg-blue-50 px-3 py-2 font-medium text-blue-800 disabled:opacity-50">Generate Google AI mask</button></div></details>}
              {active.review.marginPixels > 0 && <p className="text-amber-800">
                {active.review.bounds
                  ? `${active.review.marginPixels.toLocaleString()} stray pixels detected outside the artwork.`
                  : 'Artwork bounds are unclear; inspect the PNG before using it.'}
              </p>}
              {active.review.bounds && !active.review.canCleanMargins && active.review.marginPixels > 0 && <p className="text-zinc-600">The artwork reaches an image edge, so automatic margin cleanup is disabled.</p>}
            </div>}

            {active?.kind === 'photos' && !active.gptPhoto && <details className="border-t border-zinc-100 pt-3"><summary className="cursor-pointer text-xs font-medium text-zinc-700">Refine extraction</summary><div className="mt-3 space-y-3"><p className="text-xs leading-5 text-zinc-500">Regenerate to remove copied seller watermarks. Edit the description if needed; this makes a new model request.</p><label htmlFor="print-details" className="block text-xs font-medium text-zinc-700">Artwork description</label><textarea id="print-details" value={active.details || ''} onChange={event => update(active.id, { details: event.target.value })} disabled={busy} rows={5} placeholder="Describe the print you want to extract." className="w-full resize-y border border-zinc-300 bg-white p-2 text-xs leading-5 text-zinc-800 disabled:opacity-60" /><button type="button" disabled={busy || !active.source} onClick={regenerateActive} className="border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 disabled:opacity-50">Regenerate artwork</button></div></details>}
            {active?.gptOriginal && <label className="block space-y-1 border-t border-zinc-100 pt-3 text-xs text-zinc-700"><span className="font-medium">Direction for the next inspired design</span><textarea value={active.originalDirection || ''} onChange={event => update(active.id, { originalDirection: event.target.value })} disabled={busy} rows={2} maxLength={600} placeholder="Theme, symbols, palette, or wording" className="w-full resize-y border border-zinc-300 bg-white p-2" /></label>}
            {active?.gptPhoto && active.output && <button type="button" disabled={busy} onClick={() => void processBatch([active], 'photos', true)} className="border border-blue-300 bg-white px-3 py-2 text-xs font-medium text-blue-800 disabled:opacity-50">Regenerate from product photo</button>}
            </div></details>
            </div>
            {active?.analysisWarning && <p className="text-xs text-amber-700">{active.analysisWarning}</p>}
            {active?.kind === 'photos' && !active.gptPhoto && active.status === 'error' && <button type="button" disabled={busy} onClick={() => flatImportRef.current?.click()} className="border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-700 disabled:opacity-50">Use a saved solid extraction for this photo</button>}
            {active?.gptPhoto && active.status === 'ready' && !active.gptCandidate && !active.output && <button type="button" disabled={busy} onClick={() => void processBatch([active], 'photos', true)} className="border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800 disabled:opacity-50">Regenerate transparent design</button>}
            {active?.status === 'error' && active.flatOutput && <button type="button" disabled={busy} onClick={() => void rebuildCutout()} className="border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 disabled:opacity-50">Retry background removal from extracted design</button>}
            {active?.error && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-xs text-red-700"><span>{active.error}</span><button type="button" disabled={busy} onClick={() => active.flatOutput ? void rebuildCutout() : void processBatch([active], active.kind || 'photos', true)} className="border border-red-300 bg-white px-3 py-2 font-medium disabled:opacity-50">Retry this image</button></div>}
          </div>
          <div className="space-y-2 rounded-xl border border-zinc-200 bg-white p-3 lg:sticky lg:top-0">
            <div className="flex items-center justify-between text-xs"><span className="font-medium text-zinc-700">Images · {visibleItems.length}</span><button type="button" disabled={busy || !ready.length} onClick={() => { const selectAll = selected.length !== ready.length; setItems(current => current.map(item => item.status === 'ready' && item.output ? { ...item, selected: selectAll } : item)); }} className="text-blue-700 disabled:opacity-50">{selected.length === ready.length && ready.length ? 'Deselect all' : 'Select all ready'}</button></div>
            <div className="grid max-h-[500px] gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-1">
              {visibleItems.map(item => <div key={item.id} className={`flex min-w-0 items-center gap-2 border p-2 ${active?.id === item.id ? 'border-blue-500 bg-blue-50' : 'border-zinc-200 bg-white'}`}><button type="button" aria-label={`Review ${item.file.name}`} aria-pressed={active?.id === item.id} onClick={() => { setActiveId(item.id); setTool('prepare'); }} className="flex min-w-0 flex-1 items-center gap-2 text-left"><span className="relative h-14 w-14 shrink-0" style={checkerboard}>{(item.gptCandidate || item.output || item.flatOutput || item.source) && <Image src={(item.gptCandidate || item.output || item.flatOutput || item.source)!} alt="" fill unoptimized sizes="56px" className="object-contain" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium" title={item.file.name}>{item.file.name}</span><span className="text-[11px] text-zinc-500">{item.status === 'ready' ? item.gptCandidate ? 'Review GPT preview' : item.output ? item.selected ? 'Selected for mockups' : 'Cutout ready' : item.gptPhoto ? 'Regenerate design' : 'Remove background next' : item.status === 'error' ? 'Needs attention' : item.status === 'working' ? item.phase : 'Waiting'}</span></span></button><button type="button" disabled={busy} aria-label={`Remove ${item.file.name} from batch`} onClick={() => { setTool('prepare'); setItems(current => current.filter(entry => entry.id !== item.id)); }} className="shrink-0 p-1 text-zinc-500 hover:text-red-700 disabled:opacity-50"><X size={14} /></button></div>)}
            </div>
          </div>
        </section>

        <section aria-label="Export artwork" className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white/95 p-3 shadow-sm backdrop-blur">
          <div><p className="text-xs font-semibold text-zinc-800">{busy ? 'Processing image…' : active?.maskCandidate || active?.gptCandidate ? 'Review the preview below' : active?.output ? 'Your PNG is ready' : active?.gptPhoto ? 'Regenerate the transparent design' : 'Ready to remove background'}</p><p className="mt-1 text-[11px] text-zinc-500">{active?.maskCandidate || active?.gptCandidate ? 'Accept or discard the preview to continue.' : active?.output ? 'Download before closing this session.' : active?.gptPhoto ? 'GPT Image recreation makes an OpenRouter request.' : removalMethod === 'local' ? 'Pixel removal runs on your device.' : removalMethod === 'gpt' ? 'GPT Image removal makes an OpenRouter request.' : 'Google AI removal makes a model request.'}</p></div>
          <div className="flex items-center gap-3">
            {ready.length > 0 && <details className="relative text-xs"><summary className="cursor-pointer rounded-md border border-zinc-200 px-3 py-2 text-zinc-600">Use in Mockups</summary><div className="absolute bottom-full right-0 mb-2 w-64 space-y-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-lg">
              {active?.status === 'ready' && active.output && !active.gptCandidate && <label className="flex items-center gap-2 text-xs text-zinc-700"><input aria-label={`Use ${active.file.name} for mockups`} type="checkbox" checked={!!active.selected} disabled={busy} onChange={event => update(active.id, { selected: event.target.checked })} />Use this result</label>}
              <p className="text-zinc-500">{selected.length} selected for mockups</p><button type="button" disabled={busy || selected.length === 0} onClick={continueToMockups} className="rounded-md border border-zinc-300 px-3 py-2 font-medium text-zinc-800 disabled:opacity-40">Continue to Mockups →</button>
            </div></details>}
            {!active?.output && active?.flatOutput && <select aria-label="Background removal method" value={removalMethod} disabled={busy} onChange={event => setRemovalMethod(event.target.value as 'ai' | 'local' | 'gpt')} className="h-9 max-w-44 border border-zinc-300 bg-white px-2 text-xs text-zinc-700 disabled:opacity-50"><option value="local">Pixel removal · local</option><option value="gpt">GPT Image · OpenRouter</option><option value="ai">AI mask · Google</option></select>}
            <button type="button" disabled={busy || active?.status !== 'ready' || (!active.output && !active.flatOutput) || !!active.maskCandidate || !!active.gptCandidate} onClick={() => { setTool('prepare'); if (active?.output) downloadActive(); else if (removalMethod === 'gpt') void tryGptCutout(); else if (removalMethod === 'ai') void tryAiMask(); else void rebuildCutout(); }} className="inline-flex h-9 items-center justify-center gap-2 bg-blue-600 px-4 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">{busy ? <><Loader2 size={14} className="animate-spin" /> Processing…</> : active?.maskCandidate || active?.gptCandidate ? 'Review preview' : active?.output ? 'Download PNG' : removalMethod === 'gpt' ? 'Remove background with GPT Image' : removalMethod === 'ai' ? 'Remove background with Google AI' : 'Remove background'}</button>
          </div>
        </section>
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
          <MaskRefiner original={(active.flatOutput || active.source)!} value={active.output} onChange={value => { latestOutputRef.current.set(active.id, value); void reviewCutout(value).then(review => update(active.id, { output: value, review })); }} />
          {showArtifacts && active.review.overlay && <Image src={active.review.overlay} alt="" fill unoptimized sizes={reviewActualSize ? `${active.review.width}px` : '900px'} className="pointer-events-none object-contain" />}
        </div>
      </div>
      <div className="border-t border-zinc-200 p-3 text-xs text-zinc-600">Red markers show pixels outside the main print area. The original PNG is unchanged until you choose Clean empty margins.</div>
    </div>}
  </div>;
}
