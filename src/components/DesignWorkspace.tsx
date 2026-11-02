"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { getStoredOpenRouterApiKey } from '@/lib/clientOpenRouterKey';
import {
  DEFAULT_OPENROUTER_IMAGE_ASPECT_RATIO,
  DEFAULT_OPENROUTER_IMAGE_MODEL,
  DEFAULT_OPENROUTER_IMAGE_QUALITY,
  OPENROUTER_IMAGE_ASPECT_RATIOS,
  OPENROUTER_IMAGE_MODELS,
  openRouterQualityForModel,
  type OpenRouterImageAspectRatio,
  type OpenRouterImageModel,
  type OpenRouterImageQuality,
} from '@/lib/openRouterImage';
import type { PreparedArtwork } from '@/lib/workspaceArtwork';

type Task = 'garment' | 'graphic';
type Operation = 'extract' | 'remove';
type DesignItem = {
  id: string;
  file: File;
  preview: string;
  sourceAssetUrl?: string;
  task: Task | null;
  extracted: string | null;
  result: string | null;
  working: boolean;
  error: string | null;
};

const MAX_IMAGES = 20;
const MAX_BYTES = 25 * 1024 * 1024;
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
    reader.onerror = () => reject(new Error(`Could not open ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function nextOperation(item: DesignItem): Operation | null {
  if (!item.task || item.result) return null;
  if (item.task === 'garment' && !item.extracted) return 'extract';
  return 'remove';
}

function status(item: DesignItem): string {
  if (item.working) return 'Working…';
  if (item.error && item.result) return 'Previous PNG available';
  if (item.error) return 'Needs attention';
  if (item.result) return 'Transparent PNG ready';
  if (item.extracted) return 'Extracted · remove background';
  if (item.task === 'garment') return 'Ready to extract';
  if (item.task === 'graphic') return 'Ready to remove background';
  return 'Choose image type';
}

export default function DesignWorkspace({ incomingAsset, onOpenAssets, onContinue }: {
  incomingAsset?: { url: string; name: string; requestId?: string } | null;
  onOpenAssets: () => void;
  onContinue: (artworks: PreparedArtwork[]) => void;
}) {
  const addInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const importedRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  const [items, setItems] = useState<DesignItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [showExtracted, setShowExtracted] = useState(false);
  const [model, setModel] = useState<OpenRouterImageModel>(DEFAULT_OPENROUTER_IMAGE_MODEL);
  const [quality, setQuality] = useState<OpenRouterImageQuality>(DEFAULT_OPENROUTER_IMAGE_QUALITY);
  const [aspectRatio, setAspectRatio] = useState<OpenRouterImageAspectRatio>(DEFAULT_OPENROUTER_IMAGE_ASPECT_RATIO);

  useEffect(() => {
    try {
      const savedModel = localStorage.getItem('workstation_gpt_cutout_model');
      if (OPENROUTER_IMAGE_MODELS.some(option => option.id === savedModel)) {
        const selected = savedModel as OpenRouterImageModel;
        setModel(selected);
        setQuality(openRouterQualityForModel(selected, localStorage.getItem('workstation_gpt_cutout_quality') || ''));
      }
      const savedRatio = localStorage.getItem('workstation_gpt_cutout_aspect_ratio');
      if (OPENROUTER_IMAGE_ASPECT_RATIOS.some(value => value === savedRatio)) setAspectRatio(savedRatio as OpenRouterImageAspectRatio);
    } catch { /* Keep the defaults if browser storage is unavailable. */ }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem('workstation_gpt_cutout_model', model);
        localStorage.setItem('workstation_gpt_cutout_quality', quality);
        localStorage.setItem('workstation_gpt_cutout_aspect_ratio', aspectRatio);
      } catch { /* Settings still work in this session. */ }
    }, 500);
    return () => clearTimeout(timer);
  }, [model, quality, aspectRatio]);

  const active = items.find(item => item.id === activeId) || items[0] || null;
  const ready = items.filter(item => !!item.result);
  const operation = active ? nextOperation(active) : null;
  const eligible = operation ? items.filter(item => nextOperation(item) === operation) : [];
  const displayed = active?.result && !showExtracted ? active.result : active?.extracted || null;

  const update = (id: string, changes: Partial<DesignItem>) => {
    setItems(current => current.map(item => item.id === id ? { ...item, ...changes } : item));
  };

  const addFiles = useCallback(async (files: File[], sourceAssetUrl?: string) => {
    if (!files.length) return;
    const valid = files.filter(file => ['image/png', 'image/jpeg', 'image/webp'].includes(file.type) && file.size <= MAX_BYTES);
    if (valid.length !== files.length) toast.error('Use PNG, JPG, or WebP images smaller than 25 MB.');
    if (!valid.length) return;
    if (items.length + valid.length > MAX_IMAGES) return toast.error(`Use up to ${MAX_IMAGES} images per batch.`);
    try {
      const commonTask = items.length && items.every(item => item.task === items[0].task) ? items[0].task : null;
      const previews = await Promise.all(valid.map(readFile));
      const added = valid.map((file, index): DesignItem => ({
        id: crypto.randomUUID(), file, preview: previews[index], sourceAssetUrl,
        task: commonTask, extracted: null, result: null, working: false, error: null,
      }));
      setItems(current => [...current, ...added]);
      setActiveId(added[0].id);
      setShowExtracted(false);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not open the images.'); }
  }, [items]);

  const replaceActive = async (file: File) => {
    if (!active || busyRef.current) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > MAX_BYTES) {
      toast.error('Use a PNG, JPG, or WebP image smaller than 25 MB.');
      return;
    }
    try {
      const preview = await readFile(file);
      update(active.id, { file, preview, sourceAssetUrl: undefined, extracted: null, result: null, error: null });
      setShowExtracted(false);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not replace the image.'); }
  };

  useEffect(() => {
    if (!incomingAsset) return;
    const requestId = incomingAsset.requestId || incomingAsset.url;
    if (importedRef.current === requestId) return;
    importedRef.current = requestId;
    void fetch(incomingAsset.url).then(async response => {
      if (!response.ok) throw new Error('Could not open the selected asset.');
      const blob = await response.blob();
      const type = blob.type.split(';')[0];
      const extension = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
      await addFiles([new File([blob], `${incomingAsset.name}.${extension}`, { type })], incomingAsset.url);
    }).catch(error => { importedRef.current = null; toast.error(error instanceof Error ? error.message : 'Could not open the selected asset.'); });
  }, [incomingAsset, addFiles]);

  const chooseTask = (task: Task) => {
    if (!active || busyRef.current) return;
    setItems(current => current.map(item => item.id === active.id || item.task === null
      ? { ...item, task, extracted: item.id === active.id ? null : item.extracted, result: item.id === active.id ? null : item.result, error: null }
      : item));
    setShowExtracted(false);
  };

  const requestImage = async (item: DesignItem, stage: Operation): Promise<string> => {
    const form = new FormData();
    if (stage === 'remove' && item.extracted) {
      const blob = await (await fetch(item.extracted)).blob();
      form.append('image', new File([blob], 'extracted-design.png', { type: 'image/png' }));
    } else {
      form.append('image', item.file);
    }
    form.append('model', model);
    form.append('quality', quality);
    form.append('aspectRatio', aspectRatio);
    if (stage === 'extract') form.append('intent', 'extract');
    const key = getStoredOpenRouterApiKey();
    const response = await fetch(stage === 'extract' ? '/api/image/openrouter-photo-to-design' : '/api/image/openrouter-cutout', {
      method: 'POST',
      headers: key ? { 'x-openrouter-api-key': key } : undefined,
      body: form,
      signal: AbortSignal.timeout(210000),
    });
    const data = await response.json().catch(() => null) as { image?: string; error?: string } | null;
    if (!response.ok || !data?.image) throw new Error(data?.error || 'GPT Image could not prepare this design.');
    return data.image;
  };

  const process = async (targets: DesignItem[], stage: Operation) => {
    if (busyRef.current || !targets.length) return;
    busyRef.current = true;
    setBusy(true);
    if (stage === 'remove') setShowExtracted(false);
    let failures = 0;
    try {
      for (let index = 0; index < targets.length; index++) {
        const item = targets[index];
        setProgress(`${stage === 'extract' ? 'Extracting' : 'Removing backgrounds'} · ${index + 1} of ${targets.length}`);
        update(item.id, { working: true, error: null });
        try {
          const image = await requestImage(item, stage);
          update(item.id, stage === 'extract'
            ? { extracted: image, result: null, working: false, error: null }
            : { result: image, working: false, error: null });
        } catch (error) {
          failures++;
          update(item.id, { working: false, error: error instanceof Error ? error.message : 'Could not prepare this design.' });
        }
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
      setProgress(null);
    }
    if (failures) toast.error(`${failures} image${failures === 1 ? '' : 's'} need attention. Select one to see the error.`);
  };

  const continueToMockups = (chosen: DesignItem[]) => {
    if (busyRef.current) return;
    const artworks: PreparedArtwork[] = chosen.filter(item => item.result).map(item => ({
      name: item.file.name.replace(/\.[^.]+$/, ''), design: item.result!, source: item.preview,
      sourceAssetUrl: item.sourceAssetUrl, background: 'transparent',
    }));
    if (artworks.length) onContinue(artworks);
  };

  const downloadActive = async () => {
    if (!active?.result) return;
    const blob = await (await fetch(active.result)).blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${active.file.name.replace(/\.[^.]+$/, '')}-transparent.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  return <div className="flex h-full min-h-0 flex-col bg-white">
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4 lg:px-7">
      <div><h2 className="text-base font-semibold text-zinc-900">Design</h2><p className="mt-1 text-xs text-zinc-500">Extract a print if needed, remove its background, then continue to Mockups.</p></div>
      {items.length > 0 && <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => addInputRef.current?.click()} className="rounded border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-700 disabled:opacity-40">Add images</button><button type="button" onClick={onOpenAssets} className="rounded border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-700">Open Assets</button></div>}
    </header>
    <input ref={addInputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={event => { void addFiles(Array.from(event.target.files || [])); event.target.value = ''; }} />
    <input ref={replaceInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={event => { const file = event.target.files?.[0]; if (file) void replaceActive(file); event.target.value = ''; }} />
    <div className="min-h-0 flex-1 overflow-y-auto bg-zinc-50 p-4 lg:p-6">
      {!items.length ? <div className="mx-auto max-w-3xl rounded-lg border border-zinc-200 bg-white p-8 text-center sm:p-12" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); void addFiles(Array.from(event.dataTransfer.files)); }}><h3 className="text-base font-semibold text-zinc-900">Add images to prepare designs</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-600">Use a garment photo to extract its print, or use a graphic that needs its background removed.</p><div className="mt-6 flex flex-wrap justify-center gap-2"><button type="button" onClick={() => addInputRef.current?.click()} className="rounded bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700">Choose images</button><button type="button" onClick={onOpenAssets} className="rounded border border-zinc-300 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50">Choose from Assets</button></div><p className="mt-5 text-xs text-zinc-500">PNG, JPG, or WebP · up to 20 similar images · 25 MB each</p></div> : <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="rounded-lg border border-zinc-200 bg-white p-3 md:self-start" aria-label="Images in this batch"><div className="flex items-center justify-between border-b border-zinc-100 pb-3"><h3 className="text-xs font-semibold text-zinc-800">Images · {items.length}</h3><span className="text-[11px] text-zinc-500">{ready.length} ready</span></div><div className="mt-2 grid max-h-36 gap-1 overflow-y-auto sm:grid-cols-2 md:max-h-[65vh] md:grid-cols-1">{items.map(item => <div key={item.id} className={`flex items-center gap-2 rounded border p-2 ${active?.id === item.id ? 'border-blue-500 bg-blue-50' : 'border-transparent hover:bg-zinc-50'}`}><button type="button" aria-pressed={active?.id === item.id} aria-label={`View ${item.file.name}`} onClick={() => { setActiveId(item.id); setShowExtracted(false); }} className="flex min-w-0 flex-1 items-center gap-2 text-left"><span className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-zinc-100"><Image src={item.result || item.extracted || item.preview} alt="" fill unoptimized sizes="48px" className="object-contain" /></span><span className="min-w-0"><span className="block truncate text-xs font-medium text-zinc-800" title={item.file.name}>{item.file.name}</span><span className={`block text-[11px] ${item.error ? 'text-red-700' : 'text-zinc-500'}`}>{status(item)}</span></span></button><button type="button" disabled={busy} aria-label={`Remove ${item.file.name}`} onClick={() => { setItems(current => current.filter(entry => entry.id !== item.id)); setShowExtracted(false); }} className="shrink-0 px-1 text-[11px] text-zinc-400 hover:text-red-700 disabled:opacity-40">×</button></div>)}</div></aside>
        {active && <section className="min-w-0 space-y-4"><div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-3"><div className="min-w-0"><h3 className="truncate text-sm font-semibold text-zinc-900" title={active.file.name}>{active.file.name}</h3><p className="mt-0.5 text-xs text-zinc-500">{status(active)}</p></div><button type="button" disabled={busy} onClick={() => replaceInputRef.current?.click()} className="rounded border border-zinc-300 px-3 py-2 text-xs text-zinc-700 disabled:opacity-40">Replace image</button></div>
          <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-lg border border-zinc-200 bg-white p-3"><div className="mb-2 text-xs font-medium text-zinc-700">Source</div><div className="relative h-[clamp(220px,42vh,460px)] overflow-hidden rounded bg-zinc-100"><Image src={active.preview} alt="Source image" fill unoptimized sizes="(min-width: 1024px) 500px, 90vw" className="object-contain" /></div></div><div className="rounded-lg border border-zinc-200 bg-white p-3"><div className="mb-2 flex items-center justify-between gap-2 text-xs font-medium text-zinc-700"><span>{active.result ? showExtracted ? 'Extracted design' : 'Transparent result' : active.extracted ? 'Extracted design' : 'Outcome'}</span>{active.result && active.extracted && <button type="button" onClick={() => setShowExtracted(value => !value)} className="text-[11px] font-medium text-blue-700">{showExtracted ? 'Show transparent' : 'View extraction'}</button>}</div><div className="relative h-[clamp(220px,42vh,460px)] overflow-hidden rounded" style={displayed && active.result && !showExtracted ? checkerboard : { backgroundColor: '#f4f4f5' }}>{displayed ? <Image src={displayed} alt={active.result && !showExtracted ? 'Transparent result' : 'Extracted design'} fill unoptimized sizes="(min-width: 1024px) 500px, 90vw" className="object-contain" /> : <div className="flex h-full items-center justify-center p-6 text-center text-xs text-zinc-500">The result will appear here.</div>}</div></div></div>
          {active.result && <div className="flex justify-end gap-4 text-xs"><button type="button" disabled={busy} onClick={() => void downloadActive()} className="font-medium text-blue-700 disabled:opacity-40">Download PNG</button><button type="button" disabled={busy} onClick={() => void process([active], 'remove')} className="text-zinc-600 disabled:opacity-40">Retry background removal</button></div>}
          {!active.task ? <div className="rounded-lg border border-zinc-200 bg-white p-4"><p className="text-xs font-semibold text-zinc-800">What kind of image is this?</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => chooseTask('garment')} className="rounded border border-zinc-200 p-3 text-left text-xs hover:border-blue-500 hover:bg-blue-50"><span className="block font-semibold text-zinc-900">Garment photo</span><span className="mt-1 block text-zinc-600">Extract print → Remove background</span></button><button type="button" onClick={() => chooseTask('graphic')} className="rounded border border-zinc-200 p-3 text-left text-xs hover:border-blue-500 hover:bg-blue-50"><span className="block font-semibold text-zinc-900">Existing graphic</span><span className="mt-1 block text-zinc-600">Remove background</span></button></div><p className="mt-2 text-[11px] text-zinc-500">This choice also applies to images in the batch that have no type yet.</p></div> : <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 text-xs"><span className="text-zinc-700">{active.task === 'garment' ? 'Garment photo · Extract → Remove background' : 'Existing graphic · Remove background'}</span><button type="button" disabled={busy} onClick={() => update(active.id, { task: null, extracted: null, result: null, error: null })} className="font-medium text-blue-700 disabled:opacity-40">Change</button></div>}
          {active.error && <p role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">{active.error}</p>}
          <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white/95 p-3 shadow-sm backdrop-blur"><p className="text-xs text-zinc-600">{progress || (active.result ? 'Review the result, then use it in Mockups.' : active.extracted ? 'Review the extraction, then remove its background.' : active.task ? 'Ready to process.' : 'Choose the image type to begin.')}</p><div className="flex flex-wrap items-center gap-2">{active.extracted && !active.result && <button type="button" disabled={busy} onClick={() => update(active.id, { extracted: null, result: null, error: null })} className="rounded border border-zinc-300 px-3 py-2 text-xs text-zinc-700 disabled:opacity-40">Redo extraction</button>}{operation && <><button type="button" disabled={busy} onClick={() => void process([active], operation)} className="rounded bg-blue-600 px-4 py-2 text-xs font-medium text-white disabled:opacity-40">{operation === 'extract' ? 'Extract design' : 'Remove background'}</button>{eligible.length > 1 && <button type="button" disabled={busy} onClick={() => void process(eligible, operation)} className="rounded border border-blue-300 px-3 py-2 text-xs font-medium text-blue-700 disabled:opacity-40">{operation === 'extract' ? 'Extract' : 'Remove backgrounds'} · all {eligible.length}</button>}</>}{active.result && <><button type="button" disabled={busy} onClick={() => continueToMockups([active])} className="rounded bg-blue-600 px-4 py-2 text-xs font-medium text-white disabled:opacity-40">Use in Mockups</button>{ready.length > 1 && <button type="button" disabled={busy} onClick={() => continueToMockups(ready)} className="rounded border border-blue-300 px-3 py-2 text-xs font-medium text-blue-700 disabled:opacity-40">Use all {ready.length} ready</button>}</>}</div></div>
          <details className="rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-700"><summary className="cursor-pointer font-medium">GPT Image settings</summary><div className="mt-3 flex flex-wrap gap-3"><label>Model<select aria-label="GPT Image model" disabled={busy} value={model} onChange={event => { const selected = event.target.value as OpenRouterImageModel; setModel(selected); setQuality(openRouterQualityForModel(selected, quality)); }} className="mt-1 block border border-zinc-300 bg-white p-2">{OPENROUTER_IMAGE_MODELS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label><label>Quality<select aria-label="GPT Image quality" disabled={busy} value={quality} onChange={event => setQuality(event.target.value as OpenRouterImageQuality)} className="mt-1 block border border-zinc-300 bg-white p-2">{OPENROUTER_IMAGE_MODELS.find(option => option.id === model)?.qualities.map(value => <option key={value} value={value}>{value}</option>)}</select></label><label>Aspect ratio<select aria-label="GPT Image aspect ratio" disabled={busy} value={aspectRatio} onChange={event => setAspectRatio(event.target.value as OpenRouterImageAspectRatio)} className="mt-1 block border border-zinc-300 bg-white p-2">{OPENROUTER_IMAGE_ASPECT_RATIOS.map(value => <option key={value} value={value}>{value === 'auto' ? 'Auto' : value}</option>)}</select></label></div></details>
        </section>}
      </div>}
    </div>
  </div>;
}
