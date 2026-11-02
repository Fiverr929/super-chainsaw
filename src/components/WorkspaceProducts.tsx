"use client";
import { browserStorage } from '../lib/browserStorage.ts';


import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Package, UploadCloud, ArrowLeft, RefreshCw, Copy, Trash2, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import MockupStudio from './MockupStudio';
import { renderWorkspaceProduct } from '@/lib/workspaceProductBrowserOperations';
import { ARTWORK_PRESETS, presetArtwork, type ArtworkPresetId } from '@/lib/artworkPlacement';
import { loadMockupPresets, saveMockupPresets } from '@/lib/mockupPresetStorage';
import { artworkForFrame, createWorkspaceProduct, galleryItems, type GallerySlot, type ListingPresetValues, type MockupPreset, type ProductSnapshot, type WorkspaceProduct, type ProductChannel } from '@/lib/workspaceProducts';
import { CC1717_COLORS, CC1717_PRESETS, isVintageMockupAsset, VINTAGE_FRONT_PRESETS } from '@/lib/vintageMockups';
import type { PreparedArtwork } from '@/lib/workspaceArtwork';
import ProductSourceReference from './ProductSourceReference';
import ProductChannelListings from './ProductChannelListings';
import type { ListingRecord } from '@/lib/workspaceListingStore';

const button = 'inline-flex items-center justify-center gap-2 border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50';
const primary = 'inline-flex items-center justify-center gap-2 bg-blue-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50';
async function readFile(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error(`${file.name}: choose PNG, JPEG or WebP.`);
  if (file.size > 25 * 1024 * 1024) throw new Error(`${file.name}: maximum image size is 25 MB.`);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

async function readStaticMedia(file: File): Promise<string> {
  if (file.type.startsWith('image/')) return readFile(file);
  if (!['video/mp4', 'video/webm'].includes(file.type) || file.size > 50 * 1024 * 1024) throw new Error('Choose an MP4 or WebM video under 50 MB.');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

async function persistProduct(product: WorkspaceProduct): Promise<WorkspaceProduct> {
  const response = await fetch('/api/workspace/products', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(product),
  });
  const body = await response.text();
  let result: { error?: string; product?: WorkspaceProduct };
  try { result = JSON.parse(body); }
  catch { throw new Error(`Product server returned an invalid response (${response.status}). Your uploaded image is kept; retry saving once the workspace is ready.`); }
  if (!response.ok) throw new Error(result.error || 'Product could not be saved.');
  if (!result.product) throw new Error('Product server did not confirm the save. Your uploaded image is kept; retry saving.');
  return result.product;
}

function freshProduct(name: string, design: string | null, preset: MockupPreset, sourceImage?: string, backDesign?: string | null, designName = name, designKind: 'design-stage' | 'upload' = 'upload', sourceAssetUrl?: string): WorkspaceProduct {
  return createWorkspaceProduct({name,designDataUrl:design,preset,sourceImage,backArtwork:backDesign,designName,designKind,sourceAssetUrl});
}

function ProductCard({ product, selected, busy, channelSummary, onSelect, onOpen }: {
  product: WorkspaceProduct;
  selected: boolean;
  busy: boolean;
  channelSummary: string;
  onSelect: (checked: boolean) => void;
  onOpen: () => void;
}) {
  const design = product.artworks?.front || product.designDataUrl;
  const cover = product.generated[0]?.dataUrl || design;
  const status = product.renderState === 'ready' ? 'Ready' : product.renderState === 'rendering' ? 'Rendering' : product.renderState === 'error' ? 'Needs attention' : product.renderState === 'queued' ? 'Queued' : 'Needs mockups';
  return <article className={`group overflow-hidden border bg-white transition-colors hover:border-blue-300 ${selected ? 'border-blue-500 ring-1 ring-blue-500' : 'border-zinc-200'}`}>
    <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2"><label className="flex items-center gap-2 text-xs text-zinc-600"><input type="checkbox" aria-label={`Select ${product.name}`} checked={selected} onChange={event => onSelect(event.target.checked)} /> Select</label><span className={`px-2 py-0.5 text-[11px] font-medium ${product.renderState === 'ready' ? 'bg-emerald-50 text-emerald-700' : product.renderState === 'error' ? 'bg-red-50 text-red-700' : 'bg-zinc-100 text-zinc-600'}`}>{status}</span></div>
    <button aria-label={`Open ${product.name}`} disabled={busy} className="relative block aspect-[4/3] w-full bg-zinc-50 focus-visible:outline-2 focus-visible:outline-blue-600" onClick={onOpen}>{cover ? <Image src={cover} alt={product.generated[0] ? `${product.name} mockup` : `${product.name} design`} fill unoptimized sizes="(min-width: 1280px) 260px, (min-width: 768px) 33vw, 50vw" className="object-contain p-3 transition-transform group-hover:scale-[1.025]" /> : <Package className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-zinc-300" size={28} />}{product.generated[0] && design && <span className="absolute bottom-2 right-2 h-12 w-12 border border-zinc-200 bg-white shadow-sm"><Image src={design} alt="" fill unoptimized sizes="48px" className="object-contain p-1" /></span>}</button>
    <div className="space-y-2 border-t border-zinc-100 p-3"><h3 className="truncate text-sm font-semibold text-zinc-900" title={product.name}>{product.name}</h3><p className="truncate text-xs text-zinc-500">{product.preset.name} · {product.generated.length} views</p><p className="line-clamp-2 min-h-8 text-[11px] leading-4 text-zinc-500">{channelSummary}</p><button className="text-xs font-semibold text-blue-700 hover:text-blue-900" disabled={busy} onClick={onOpen}>Open product →</button></div>
  </article>;
}

export default function WorkspaceProducts({ onOpenListings, incomingArtwork, onArtworkConsumed, onOpenCreator, onProductCreated, initialTemplateId, mode = 'all' }: {
  onOpenListings: (channel: ProductChannel) => void;
  incomingArtwork?: PreparedArtwork[] | null;
  onArtworkConsumed?: () => void;
  onOpenCreator: (presetId?: string) => void;
  onProductCreated?: () => void;
  initialTemplateId?: string;
  mode?: 'all' | 'mockup' | 'listing';
}) {
  const [products, setProducts] = useState<WorkspaceProduct[]>([]);
  const productsRef = useRef(new Map<string, WorkspaceProduct>());
  const queues = useRef(new Map<string, Promise<WorkspaceProduct>>());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [templates, setTemplates] = useState<MockupPreset[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [templateSource, setTemplateSource] = useState<'app' | 'user'>('app');
  const [templatePage, setTemplatePage] = useState(1);
  const [templateSearch, setTemplateSearch] = useState('');
  const [draftSearch, setDraftSearch] = useState('');
  const [draftStatus, setDraftStatus] = useState<'all' | 'ready' | 'attention'>('all');
  const [draftPage, setDraftPage] = useState(1);
  const [selected, setSelected] = useState<WorkspaceProduct | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkspaceProduct | null>(null);
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState('');
  const [autoRender, setAutoRender] = useState(true);
  const [placementChoice, setPlacementChoice] = useState<'template' | ArtworkPresetId | 'both'>('template');
  const [pendingArtwork, setPendingArtwork] = useState(incomingArtwork);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [channelRecords, setChannelRecords] = useState<ListingRecord[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [channelsError, setChannelsError] = useState('');
  const [detailSection, setDetailSection] = useState<'media' | 'source' | 'channels'>('media');
  const [listingPresets, setListingPresets] = useState<ListingPresetValues[]>([]);
  const [listingPresetId, setListingPresetId] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const staticInputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);

  const remember = useCallback((product: WorkspaceProduct) => {
    productsRef.current.set(product.id, product);
    setProducts(previous => [product, ...previous.filter(p => p.id !== product.id)]);
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      const response = await fetch('/api/workspace/products', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      productsRef.current = new Map(data.products.map((p: WorkspaceProduct) => [p.id, p]));
      setProducts(data.products);
    } catch (error) { setLoadError(error instanceof Error ? error.message : 'Could not load products.'); }
    finally { setLoading(false); }
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      const saved = await loadMockupPresets();
      const presets = Array.isArray(saved) ? saved.filter(p => p && typeof p.id === 'string' && Array.isArray(p.frames)) as MockupPreset[] : [];
      const available = [...presets, ...CC1717_PRESETS, ...VINTAGE_FRONT_PRESETS].filter((preset, index, all) => all.findIndex(item => item.id === preset.id) === index);
      setTemplates(available);
      setTemplateId(current => {
        const preferred = initialTemplateId || current || browserStorage.getItem('workspace_default_template') || '';
        const next = available.some(p => p.id === preferred) ? preferred : CC1717_PRESETS[0].id;
        const source = next.startsWith('cc1717-') || next.startsWith('vintage-front-2k-') ? 'app' : 'user';
        setTemplateSource(source);
        const sourceIndex = available.filter(preset => source === 'app' ? preset.id.startsWith('cc1717-') || preset.id.startsWith('vintage-front-2k-') : !preset.id.startsWith('cc1717-') && !preset.id.startsWith('vintage-front-2k-')).findIndex(preset => preset.id === next);
        setTemplatePage(Math.floor(Math.max(0, sourceIndex) / 6) + 1);
        return next;
      });
    } catch { toast.error('Could not load recipes. Reload Products to retry.'); }
  }, [initialTemplateId]);

  useEffect(() => { const handlePresetChanges=()=>{void loadTemplates();};void load(); void loadTemplates(); setAutoRender(browserStorage.getItem('workspace_auto_render') !== 'false');window.addEventListener('agent-presets-changed',handlePresetChanges);return()=>window.removeEventListener('agent-presets-changed',handlePresetChanges); }, [load, loadTemplates]);
  useEffect(() => {
    const readPresets=()=>{try {
      const saved = JSON.parse(browserStorage.getItem('workstation_v2_presets_physical') || '[]');
      const presets = Array.isArray(saved) ? saved.filter((item): item is ListingPresetValues => item && typeof item.id === 'string' && typeof item.name === 'string') : [];
      setListingPresets(presets);
      setListingPresetId(current => current || (presets.some(item=>item.id===browserStorage.getItem('workspace_default_listing_preset'))?browserStorage.getItem('workspace_default_listing_preset')!:presets.length === 1 ? presets[0].id : ''));
    } catch { setListingPresets([]); }};
    readPresets();window.addEventListener('agent-presets-changed',readPresets);return()=>window.removeEventListener('agent-presets-changed',readPresets);
  }, []);
  useEffect(() => {
    if (incomingArtwork) setPendingArtwork(incomingArtwork);
  }, [incomingArtwork]);

  const loadChannels = useCallback(async () => {
    setChannelsLoading(true);
    try {
      const response = await fetch('/api/workspace/listing-records', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.listings)) throw new Error('Could not load channel drafts.');
      setChannelRecords(data.listings);
      setChannelsError('');
    } catch (error) { setChannelsError(error instanceof Error ? error.message : 'Could not load channel drafts.'); }
    finally { setChannelsLoading(false); }
  }, []);
  useEffect(() => {
    const refresh = () => { void loadChannels(); };
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('workstation-worksheet-changed', refresh);
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('storage', refresh); window.removeEventListener('workstation-worksheet-changed', refresh); };
  }, [loadChannels]);

  const openChannelListing = (record: ListingRecord) => {
    if (record.channel === 'etsy') browserStorage.setItem('workstation_v2_active_sheet', record.sheet === 'etsy-digital' ? 'digital' : 'physical');
    sessionStorage.setItem('workspace_listing_target', JSON.stringify({ channel: record.channel, sheet: record.sheet, productId: record.productId, listingId: record.id, createdAt: Date.now() }));
    onOpenListings(record.channel);
  };
  const save = useCallback((id: string, changes: Partial<WorkspaceProduct>) => {
    const prior = queues.current.get(id) ?? Promise.resolve(productsRef.current.get(id)!);
    const task = prior.catch(() => productsRef.current.get(id)!).then(async () => {
      const current = productsRef.current.get(id);
      if (!current) throw new Error('Product not found. Reload Products.');
      const saved = await persistProduct({ ...current, ...changes, id, revision: current.revision });
      remember(saved);
      return saved;
    });
    queues.current.set(id, task);
    void task.finally(() => { if (queues.current.get(id) === task) queues.current.delete(id); }).catch(() => undefined);
    return task;
  }, [remember]);

  const generate = async (product: WorkspaceProduct) => {
    return renderWorkspaceProduct(product, candidate => save(product.id, candidate));
  };

  const runBusy = async (label: string, operation: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(label);
    try { await operation(); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Operation failed.'); }
    finally { busyRef.current = false; setBusy(''); }
  };

  const create = async (files: File[]) => {
    if (files.length > 20) { toast.error('Upload up to 20 designs per batch.'); return; }
    if (pendingArtwork?.length && files.length) { toast.error('Use the selected designs or clear them before uploading other files.'); return; }
    await runBusy('Saving products…', async () => {
      const preset = templates.find(p => p.id === templateId);
      if (!preset || !preset.frames.some(frame => frame.imageDataUrl && frame.applyDesign)) throw new Error('Choose a template with a blank T-shirt photo and a print area. Set it up in Product Creator first.');
      const inputs = pendingArtwork ? [...pendingArtwork] : [];
      // Persist each input before starting its render; one bad file must not discard other drafts.
      const errors: string[] = [];
      const created: WorkspaceProduct[] = [];
      for (const file of files) {
        try { inputs.push({ name: file.name.replace(/\.[^.]+$/, ''), design: await readFile(file), source: undefined }); }
        catch (error) { errors.push(error instanceof Error ? error.message : file.name); }
      }
      if (!inputs.length) throw new Error(errors.join('\n') || 'Drop at least one design to create a product.');
      const backDesign = backFile ? await readFile(backFile) : null;
      const variants = placementChoice === 'both' ? ['top-center', 'pocket'] as const : [placementChoice];
      for (const input of inputs) {
        for (const variant of variants) {
          const configured = structuredClone(preset);
          for (const frame of configured.frames) {
            if (frame.imageDataUrl && isVintageMockupAsset(frame.imageDataUrl)) {
              const response = await fetch(frame.imageDataUrl);
              if (!response.ok) throw new Error(`Could not load ${preset.name} mockup image.`);
              frame.imageDataUrl = await readFile(new File([await response.blob()], `${frame.name}.jpg`, { type: 'image/jpeg' }));
            }
          }
          if (variant !== 'template') {
            for (const frame of configured.frames) {
              if (frame.applyDesign) frame.placement = { ...frame.placement, locked: false, margin: 0, artwork: presetArtwork(variant as ArtworkPresetId) };
            }
          }
          if (!backDesign && configured.id.startsWith('cc1717-')) {
            configured.frames = configured.frames.map(frame => frame.role === 'Back' ? { ...frame, applyDesign: false } : frame);
          }
          const productName = variant === 'template' ? input.name : `${input.name} — ${ARTWORK_PRESETS[variant as ArtworkPresetId].label}`;
          try {
            let product = await persistProduct(freshProduct(productName.slice(0, 200), input.design || null, configured, input.source, backDesign, input.name, pendingArtwork?.length ? 'design-stage' : 'upload', input.sourceAssetUrl));
            remember(product); created.push(product);
            if (autoRender && product.designDataUrl && configured.frames.some(frame => frame.imageDataUrl)) {
              setBusy(`Rendering ${product.name}…`);
              product = await generate(product);
              created[created.length - 1] = product;
            }
          } catch (error) { errors.push(`${productName}: ${error instanceof Error ? error.message : 'Creation failed.'}`); }
        }
      }
      if (created.length) {
        setPendingArtwork(null); setBackFile(null); onArtworkConsumed?.();
        toast.success(`${created.length} product${created.length === 1 ? '' : 's'} saved.`);
        if (created.length === 1) { setSelected(productsRef.current.get(created[0].id)!); setName(created[0].name); }
        onProductCreated?.();
      }
      if (errors.length) toast.error(errors.join('\n'), { duration: 8000 });
    });
  };

  const handoff = (product: WorkspaceProduct, channel: ProductChannel) => {
    void runBusy('Preparing listing folder…', async () => {
      const updateOnly = channelRecords.some(record => record.productId === product.id && record.channel === channel);
      if (galleryItems(product).filter(item => item.kind !== 'video').length > 10) throw new Error('Keep at most 10 images before preparing a listing.');
      if (!updateOnly && channel === 'etsy' && !listingPresets.some(preset => preset.id === listingPresetId)) throw new Error('Choose an Etsy listing preset before preparing the listing.');
      const exportResponse = await fetch(`/api/workspace/products/${product.id}/export`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel }),
      });
      const exported = await exportResponse.json();
      if (!exportResponse.ok) throw new Error(exported.error || 'Could not prepare the listing folder.');
      const pending = JSON.parse(browserStorage.getItem('workspace_listing_inbox') || '[]');
      if (!Array.isArray(pending)) throw new Error('Listing inbox is invalid.');
      const next = pending.filter(item => !(item.channel === channel && (item.productId === product.id || item.product?.id === product.id)));
      next.push({ channel, productId: product.id, updateOnly, ...(channel === 'etsy' && !updateOnly ? { listingPresetId } : {}) });
      browserStorage.setItem('workspace_listing_inbox', JSON.stringify(next));
      if (channel === 'etsy') browserStorage.setItem('workstation_v2_active_sheet', 'physical');
      sessionStorage.setItem('workspace_listing_target', JSON.stringify({ channel, sheet: channel === 'etsy' ? 'etsy-physical' : 'amazon', productId: product.id, createdAt: Date.now() }));
      onOpenListings(channel);
    });
  };

  const chooseTemplate = (id: string) => {
    setTemplateId(id);
    setTemplateSource(id.startsWith('cc1717-') || id.startsWith('vintage-front-2k-') ? 'app' : 'user');
    if (!templates.find(preset => preset.id === id)?.frames.some(frame => frame.role === 'Back')) setBackFile(null);
    browserStorage.setItem('workspace_default_template', id);
  };

  const galleryForEditing = (product: WorkspaceProduct) => {
    if (product.gallerySlots) return { slots: product.gallerySlots, generated: product.generated };
    const frames = product.preset.frames.filter(frame => frame.imageDataUrl);
    const generated = product.generated.map((image, index) => ({ ...image, id: frames[index]?.id || image.id }));
    const slots: GallerySlot[] = generated.map((image, index) => ({ id: `mockup-${image.id}`, kind: 'mockup', label: frames[index]?.role ? `${frames[index].role} shirt` : image.name, frameId: image.id }));
    return { slots, generated };
  };

  const addStaticMedia = (product: WorkspaceProduct, file: File) => runBusy('Adding gallery media…', async () => {
    const assetUrl = await readStaticMedia(file);
    const { slots, generated } = galleryForEditing(product);
    const kind = file.type.startsWith('video/') ? 'video' : 'image';
    await save(product.id, { generated, gallerySlots: [...slots, { id: crypto.randomUUID(), kind, label: file.name, assetUrl }] });
    toast.success(`${kind === 'video' ? 'Video' : 'Image'} added to the listing gallery.`);
  });

  const moveGallerySlot = (product: WorkspaceProduct, index: number, direction: -1 | 1) => runBusy('Saving gallery order…', async () => {
    const { slots, generated } = galleryForEditing(product);
    const target = index + direction;
    if (target < 0 || target >= slots.length) return;
    const reordered = [...slots];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    await save(product.id, { generated, gallerySlots: reordered });
  });

  const removeGallerySlot = (product: WorkspaceProduct, slotId: string) => runBusy('Updating gallery…', async () => {
    const { slots, generated } = galleryForEditing(product);
    await save(product.id, { generated, gallerySlots: slots.filter(slot => slot.id !== slotId) });
  });

  const saveTemplate = async (product: WorkspaceProduct) => {
    await runBusy('Saving reusable template…', async () => {
      const stored = await loadMockupPresets();
      if (stored !== undefined && !Array.isArray(stored)) throw new Error('Template storage is invalid. Existing templates were preserved.');
      const preset = { ...structuredClone(product.preset), id: crypto.randomUUID(), name: `${product.name} template`.slice(0, 200) };
      await saveMockupPresets([...(stored || []), preset]);
      await loadTemplates();
      chooseTemplate(preset.id);
      toast.success('Template saved. New products can reuse these blanks and placements.');
    });
  };

  const removeDraft = async (product: WorkspaceProduct) => {
    await runBusy('Deleting product…', async () => {
      const current = productsRef.current.get(product.id) || product;
      const response = await fetch(`/api/workspace/products/${current.id}?revision=${current.revision}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not delete product.');
      productsRef.current.delete(current.id);
      setProducts(previous => previous.filter(item => item.id !== current.id));
      setSelectedDraftIds(previous => previous.filter(id => id !== current.id));
      setSelected(null);
      setDeleteTarget(null);
      toast.success('Local product deleted. Marketplace listings were not changed.');
    });
  };

  const removeSelectedDrafts = async () => {
    await runBusy('Deleting selected products…', async () => {
      const drafts = selectedDraftIds.map(id => productsRef.current.get(id)).filter((item): item is WorkspaceProduct => Boolean(item));
      if (!drafts.length) throw new Error('Select at least one saved product.');
      const response = await fetch('/api/workspace/products/bulk-delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drafts: drafts.map(({ id, revision }) => ({ id, revision })) }),
      });
      const result = await response.json() as { error?: string; deleted?: string[]; failed?: { id: string; error: string }[] };
      if (!response.ok) throw new Error(result.error || 'Could not delete selected products.');
      const deleted = new Set(result.deleted || []);
      for (const id of deleted) productsRef.current.delete(id);
      setProducts(previous => previous.filter(product => !deleted.has(product.id)));
      setSelectedDraftIds(previous => previous.filter(id => !deleted.has(id)));
      setBulkDeleteOpen(false);
      if (result.failed?.length) toast.error(`${result.failed.length} product(s) could not be deleted. ${result.failed[0].error}`);
      if (deleted.size) toast.success(`${deleted.size} local product${deleted.size === 1 ? '' : 's'} deleted. Marketplace listings were not changed.`);
    });
  };

  if (selected && editing) {
    const editorProduct = selected;
    return <MockupStudio key={editorProduct.id} product={editorProduct} onSave={async (snapshot: ProductSnapshot) => {
      await save(editorProduct.id, { ...snapshot, renderState: snapshot.generated.length ? 'ready' : 'draft', error: undefined });
    }} onBack={() => { setSelected(productsRef.current.get(editorProduct.id) || editorProduct); setEditing(false); }} />;
  }

  const detail = selected ? products.find(p => p.id === selected.id) || selected : null;
  const selectedTemplate = templates.find(template => template.id === templateId);
  const sourceTemplates = templates.filter(template => templateSource === 'app' ? template.id.startsWith('cc1717-') || template.id.startsWith('vintage-front-2k-') : !template.id.startsWith('cc1717-') && !template.id.startsWith('vintage-front-2k-'));
  const filteredTemplates = sourceTemplates.filter(template => `${template.name} ${template.productType} ${template.color} ${template.brand || ''} ${template.model || ''}`.toLowerCase().includes(templateSearch.toLowerCase()));
  const pageCount = Math.max(1, Math.ceil(filteredTemplates.length / 6));
  const visibleTemplates = filteredTemplates.slice((Math.min(templatePage, pageCount) - 1) * 6, Math.min(templatePage, pageCount) * 6);
  const filteredProducts = products.filter(product => `${product.name} ${product.preset.name} ${product.preset.color}`.toLowerCase().includes(draftSearch.toLowerCase()) && (draftStatus === 'all' || (draftStatus === 'ready' ? product.renderState === 'ready' : product.renderState !== 'ready')));
  const draftPageCount = Math.max(1, Math.ceil(filteredProducts.length / 12));
  const visibleProducts = filteredProducts.slice((Math.min(draftPage, draftPageCount) - 1) * 12, Math.min(draftPage, draftPageCount) * 12);
  return <div className="flex h-full min-h-0 flex-col bg-white">
    <header className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-white px-5 py-4 lg:px-7">
      <div><h1 className="text-base font-semibold tracking-tight text-zinc-900">{detail ? detail.name : mode === 'mockup' ? 'Mockups' : 'Products'}</h1><p className="mt-1 text-xs text-zinc-500">{mode === 'mockup' ? 'Choose a mockup, then add your design.' : 'Manage artwork, mockups, and channel listings.'}</p></div>
      {mode === 'mockup' && <button disabled={!!busy} className={button} onClick={() => onOpenCreator()}>Build User mockup →</button>}
    </header>
    {busy && <div role="status" className="shrink-0 border-b border-blue-100 bg-blue-50 px-4 py-2 text-xs text-blue-700">{busy} Keep this workspace open while rendering. Saved products survive interruptions.</div>}
    <main className="min-h-0 flex-1 overflow-y-auto bg-[#f6f7f9] p-4 lg:p-7">
      <div className="mx-auto max-w-7xl">
      {detail ? <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2"><button disabled={!!busy} className={button} onClick={() => setSelected(null)}><ArrowLeft size={14} /> Products</button><button disabled={!!busy} className={primary} onClick={() => { setSelected(detail); setEditing(true); }}>Edit design & mockups</button><button disabled={!!busy} className={button} onClick={() => void runBusy('Duplicating product…', async () => { const copy = await persistProduct({ ...detail, id: crypto.randomUUID(), revision: 0, name: `${detail.name} copy`.slice(0, 200) }); remember(copy); setSelected(copy); setName(copy.name); })}><Copy size={14} /> Duplicate</button><button disabled={!!busy} className={`${button} text-red-600`} onClick={() => setDeleteTarget(detail)}><Trash2 size={14} /> Delete product</button></div>
        <div className="flex max-w-xl flex-wrap gap-2"><input aria-label="Product name" maxLength={200} value={name} onChange={e => setName(e.target.value)} className="min-w-0 flex-1 border border-zinc-200 px-3 py-2 text-sm" /><button disabled={!!busy || !name.trim() || name === detail.name} className={button} onClick={() => void runBusy('Saving name…', async () => { await save(detail.id, { name: name.trim() }); })}>Save name</button><button disabled={!!busy || !detail.preset.frames.some(frame => frame.imageDataUrl)} className={button} onClick={() => void saveTemplate(detail)}>Save as template</button></div>
        <nav aria-label="Product sections" className="flex flex-wrap gap-5 border-b border-zinc-200">
          {([['media', 'Artwork & Mockups'], ['source', 'Source Reference'], ['channels', 'Channel Listings']] as const).map(([section, label]) => <button key={section} type="button" aria-pressed={detailSection === section} onClick={() => setDetailSection(section)} className={`border-b-2 pb-3 text-xs font-medium ${detailSection === section ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-zinc-500 hover:text-zinc-900'}`}>{label}</button>)}
        </nav>
        {detailSection === 'source' && (detail.origin?.sourceAssetUrl ? <ProductSourceReference key={detail.origin.sourceAssetUrl} sourceAssetUrl={detail.origin.sourceAssetUrl} initiallyOpen /> : <p className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-500">No imported source is linked to this product. Products created from uploaded artwork may have no source reference.</p>)}
        {detailSection === 'channels' && <ProductChannelListings product={detail} records={channelRecords} loading={channelsLoading} error={channelsError} busy={!!busy} presets={listingPresets} presetId={listingPresetId} onPresetChange={setListingPresetId} onRetry={() => void loadChannels()} onOpen={openChannelListing} onPrepare={channel => handoff(detail, channel)} onSetupEtsyPreset={() => { sessionStorage.setItem('workstation_open_physical_presets', '1'); onOpenListings('etsy'); }} />}
        {detailSection === 'media' && <>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600"><span>Design: <strong className="text-zinc-900">{detail.origin?.designName || detail.name}</strong> · {detail.origin?.designKind === 'design-stage' || !detail.origin && detail.sourceImage ? 'Design step' : 'Uploaded file'}</span><span>Mockup: <strong className="text-zinc-900">{detail.preset.name}</strong> · {detail.origin?.mockupSource || (detail.preset.id.startsWith('cc1717-') || detail.preset.id.startsWith('vintage-front-2k-') ? 'app' : 'user')}</span>{templates.some(template => template.id === (detail.origin?.mockupPresetId || detail.preset.id)) ? <button className="font-medium text-blue-700 hover:underline" onClick={() => onOpenCreator(detail.origin?.mockupPresetId || detail.preset.id)}>View source mockup →</button> : <span className="text-amber-700">Source mockup is no longer in the library</span>}<span>{detail.generated.length} saved views</span><span>Status: {detail.renderState === 'rendering' && !busy ? 'Interrupted — retry available' : detail.renderState}</span></div>

        {detail.error && <p role="alert" className="text-sm text-red-600">{detail.error}</p>}
        <div className="flex flex-wrap gap-2"><button disabled={!!busy || !detail.designDataUrl} className={button} onClick={() => void runBusy('Rendering mockups…', async () => { await generate(detail); toast.success('Mockups saved.'); })}><RefreshCw size={14} /> {['error', 'rendering'].includes(detail.renderState) ? 'Retry mockups' : 'Generate mockups'}</button>{galleryItems(detail).length > 0 && <a className={button} href={`/api/workspace/products/${detail.id}/download`} download>Download listing media</a>}</div>

        <section className="space-y-3"><h3 className="text-sm font-semibold text-zinc-800">Production artwork</h3><p className="text-xs text-zinc-500">These files are separate from the customer-facing mockups.</p><div className="grid grid-cols-2 gap-3 sm:max-w-lg">{(['Front', 'Back'] as const).filter(role => role === 'Front' || detail.preset.frames.some(frame => frame.role === 'Back')).map(role => { const url = artworkForFrame(detail, role); return <div key={role} className="border border-zinc-200 bg-white p-3"><div className="relative aspect-square bg-zinc-50">{url ? <Image src={url} alt={`${role} production artwork`} fill unoptimized sizes="180px" className="object-contain p-2" /> : <div className="flex h-full items-center justify-center text-xs text-zinc-400">No design yet</div>}</div><p className="mt-2 text-xs font-medium">{role} artwork</p></div>; })}</div></section>
        <section className="space-y-3 border-t border-zinc-200 pt-5"><h3 className="text-sm font-semibold text-zinc-800">Real mockups</h3><p className="text-xs text-zinc-500">Generated from the shirt recipe and production artwork. Edit placement or color, then regenerate these views.</p>{detail.generated.length === 0 ? <div className="border border-dashed border-zinc-300 p-6 text-xs text-zinc-500">Generate mockups to preview the printed shirt.</div> : <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{detail.generated.map(image => <a key={image.id} href={image.dataUrl} target="_blank" rel="noreferrer" className="border border-zinc-200 bg-white p-2"><span className="relative block aspect-square bg-zinc-50"><Image src={image.dataUrl} alt={image.name} fill unoptimized sizes="220px" className="object-contain" /></span><span className="mt-2 block truncate text-xs">{image.name}</span></a>)}</div>}</section>
        <section className="space-y-3 border-t border-zinc-200 pt-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold text-zinc-800">Static listing media</h3><p className="mt-1 text-xs text-zinc-500">Size charts, care guides, and videos stay unchanged when mockups regenerate.</p></div><input ref={staticInputRef} type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm" className="hidden" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void addStaticMedia(detail, file); }} /><button className={button} disabled={!!busy} onClick={() => staticInputRef.current?.click()}>Add image or video</button></div><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{(detail.gallerySlots || []).filter(slot => slot.kind !== 'mockup').map(slot => <article key={slot.id} className="border border-zinc-200 bg-white p-2"><div className="relative aspect-square bg-zinc-50">{slot.kind === 'video' ? <video src={slot.assetUrl} controls className="h-full w-full object-contain" /> : <Image src={slot.assetUrl!} alt={slot.label} fill unoptimized sizes="220px" className="object-contain" />}</div><p className="mt-2 truncate text-xs">{slot.label}</p></article>)}</div></section>
        <section className="space-y-3 border-t border-zinc-200 pt-5"><h3 className="text-sm font-semibold text-zinc-800">Listing gallery</h3><p className="text-xs text-zinc-500">This order becomes the image order for the listing handoff and the downloaded media ZIP.</p>{galleryItems(detail).length === 0 ? <div className="border border-dashed border-zinc-300 p-6 text-xs text-zinc-500">Generate a mockup or add static media to start the gallery.</div> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{galleryItems(detail).map((item, index) => { const slotIndex = detail.gallerySlots?.findIndex(slot => slot.id === item.id) ?? index; return <article key={item.id} className="border border-zinc-200 bg-white p-2"><div className="relative aspect-square bg-zinc-50">{item.kind === 'video' ? <video src={item.url} controls className="h-full w-full object-contain" /> : <Image src={item.url} alt={item.label} fill unoptimized sizes="180px" className="object-contain" />}</div><p className="mt-2 truncate text-xs font-medium">{index + 1}. {item.label}</p><p className="text-[11px] capitalize text-zinc-500">{item.kind === 'mockup' ? 'Rendered mockup' : `Static ${item.kind}`}</p><div className="mt-2 flex flex-wrap gap-1"><button className={button} disabled={!!busy || slotIndex === 0} onClick={() => void moveGallerySlot(detail, slotIndex, -1)}>↑</button><button className={button} disabled={!!busy || slotIndex === (detail.gallerySlots?.length ?? detail.generated.length) - 1} onClick={() => void moveGallerySlot(detail, slotIndex, 1)}>↓</button><button className={button} disabled={!!busy} onClick={() => void removeGallerySlot(detail, item.id)}>Remove</button></div></article>; })}</div>}</section>
        </>}
      </div> : <>
        {mode !== 'listing' && !!pendingArtwork?.length && <div className="mb-3 flex flex-wrap items-center gap-3 border border-blue-200 bg-blue-50 p-3"><span className="relative h-14 w-14 shrink-0 bg-white"><Image src={pendingArtwork[0].design} alt="Selected design" fill unoptimized sizes="56px" className="object-contain" /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-zinc-800">{pendingArtwork.length} design{pendingArtwork.length === 1 ? '' : 's'} ready{pendingArtwork.length === 1 ? `: ${pendingArtwork[0].name}` : ''}</p><p className="text-xs text-zinc-600">Choose an App or User mockup below, then create one product per design.</p>{pendingArtwork.some(artwork => artwork.background === 'solid') && <p className="mt-1 text-xs text-amber-800">Solid-background designs will appear as rectangles in shirt mockups. The background removal workflow is a separate step.</p>}</div><button className={button} disabled={!!busy} onClick={() => { setPendingArtwork(null); onArtworkConsumed?.(); }}>Clear designs</button><button className={primary} disabled={!!busy || !selectedTemplate?.frames.some(frame => frame.imageDataUrl && frame.applyDesign)} onClick={() => void create([])}>Create {pendingArtwork.length} product{pendingArtwork.length === 1 ? '' : 's'} →</button></div>}
        {mode !== 'listing' && <section className="mb-4 grid gap-6 border border-zinc-200 bg-white p-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)] lg:p-5">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-zinc-900">Choose a mockup type</h3>
            <div role="tablist" aria-label="Mockup type source" className="grid grid-cols-2 border border-zinc-200 bg-white">
              {(['app', 'user'] as const).map(source => <button key={source} role="tab" aria-selected={templateSource === source} type="button" onClick={() => { setTemplateSource(source); setTemplatePage(1); }} className={`px-3 py-2 text-xs font-medium ${templateSource === source ? 'bg-blue-600 text-white' : 'text-zinc-600 hover:bg-zinc-50'}`}>{source === 'app' ? 'App mockups' : 'User mockups'} ({templates.filter(template => source === 'app' ? template.id.startsWith('cc1717-') || template.id.startsWith('vintage-front-2k-') : !template.id.startsWith('cc1717-') && !template.id.startsWith('vintage-front-2k-')).length})</button>)}
            </div>
            <input aria-label="Search mockup types" value={templateSearch} onChange={event => { setTemplateSearch(event.target.value); setTemplatePage(1); }} placeholder="Search mockup types" className="w-full border border-zinc-200 bg-white px-3 py-2 text-sm" />
            <div role="table" aria-label={`${templateSource === 'app' ? 'App' : 'User'} mockup types`} className="max-h-72 overflow-y-auto rounded-lg border border-zinc-200 bg-white">
              {visibleTemplates.map(template => <button key={template.id} type="button" role="row" aria-selected={templateId === template.id} onClick={() => chooseTemplate(template.id)} className={`flex w-full items-center gap-3 border-b border-zinc-100 p-2 text-left last:border-0 ${templateId === template.id ? 'bg-blue-50 ring-1 ring-inset ring-blue-500' : 'hover:bg-zinc-50'}`}>
                <span className="relative h-12 w-12 shrink-0 bg-zinc-100">{template.frames.find(frame => frame.imageDataUrl)?.imageDataUrl ? <Image src={template.frames.find(frame => frame.imageDataUrl)!.imageDataUrl!} alt="" fill unoptimized sizes="48px" className="object-contain" /> : <Package size={18} className="m-4 text-zinc-400" />}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium">{template.name}</span><span className="block truncate text-[11px] text-zinc-500">{template.productType} · {template.color} · {template.frames.filter(frame => frame.imageDataUrl).length} views</span></span>
              </button>)}
              {!visibleTemplates.length && <p className="p-4 text-xs text-zinc-500">{templateSource === 'user' ? 'No matching custom mockups. Create one in Mockup Recipes.' : 'No matching app mockups.'}</p>}
            </div>
            <div className="flex items-center justify-between text-xs text-zinc-500"><span>{filteredTemplates.length} mockup types · page {Math.min(templatePage, pageCount)} of {pageCount}</span><span className="flex gap-2"><button type="button" disabled={templatePage <= 1} onClick={() => setTemplatePage(page => page - 1)} className={button}>Previous</button><button type="button" disabled={templatePage >= pageCount} onClick={() => setTemplatePage(page => page + 1)} className={button}>Next</button></span></div>
            <p className="text-xs text-zinc-500">{selectedTemplate?.brand ? `${selectedTemplate.brand} ${selectedTemplate.model} · ${selectedTemplate.color}` : selectedTemplate ? `${selectedTemplate.productType} · ${selectedTemplate.color}` : 'Choose a garment to begin.'}</p>
            <details className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3"><summary className="cursor-pointer text-xs font-semibold text-zinc-700">Placement & output options</summary><div className="mt-3 space-y-3">
            {selectedTemplate?.id.startsWith('cc1717-') && <label className="block space-y-2 text-xs text-zinc-600"><span>Shirt color</span><select aria-label="Shirt color" disabled={!!busy} value={selectedTemplate.color} onChange={event => chooseTemplate(`cc1717-${event.target.value.toLowerCase()}`)} className="w-full border border-zinc-200 bg-white p-2 text-sm">{CC1717_COLORS.map(color => <option key={color}>{color}</option>)}</select></label>}
            <label className="block space-y-2 text-xs text-zinc-600"><span>Design placement</span><select aria-label="Design placement" disabled={!!busy} value={placementChoice} onChange={e => setPlacementChoice(e.target.value as typeof placementChoice)} className="w-full border border-zinc-200 bg-white p-2 text-sm"><option value="template">Use template placement (100%)</option><option value="top-center">Top center · Full size (100%)</option><option value="pocket">Pocket · Small (35%)</option><option value="both">Both placements — two products per design</option></select></label>
            <p className="text-xs text-zinc-500">Template placement keeps the saved print size. Front and back artwork stay separate from the customer-facing mockups.</p>
            {selectedTemplate?.frames.some(frame => frame.role === 'Back') && <div className="space-y-2 border-t border-zinc-200 pt-3"><input ref={backInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={event => setBackFile(event.target.files?.[0] || null)} /><button type="button" className={button} onClick={() => backInputRef.current?.click()}>{backFile ? `Back artwork: ${backFile.name}` : 'Add back artwork (optional)'}</button><p className="text-xs text-zinc-500">Without a back file, the back shirt stays blank until you add artwork in the product editor.</p></div>}
            <label className="flex items-center gap-2 text-xs text-zinc-600"><input type="checkbox" disabled={!!busy} checked={autoRender} onChange={e => { setAutoRender(e.target.checked); browserStorage.setItem('workspace_auto_render', String(e.target.checked)); }} /> Generate product images automatically</label>
            </div></details>
          </div>
          <div className="self-start space-y-3">
            <div className="border border-zinc-200 bg-zinc-50"><div className="relative flex aspect-[4/3] items-center justify-center border-b border-zinc-200 bg-zinc-100">{selectedTemplate?.frames.find(frame => frame.imageDataUrl)?.imageDataUrl ? <Image src={selectedTemplate.frames.find(frame => frame.imageDataUrl)!.imageDataUrl!} alt={`${selectedTemplate.name} preview`} fill unoptimized sizes="(min-width: 1024px) 400px, 80vw" className="object-contain p-4" /> : <Package size={30} className="text-zinc-300" />}</div><div className="px-4 py-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Selected mockup</p><p className="mt-1 text-sm font-semibold text-zinc-900">{selectedTemplate?.name || 'Choose a mockup'}</p><p className="mt-1 text-xs text-zinc-500">{selectedTemplate ? `${selectedTemplate.frames.filter(frame => frame.imageDataUrl).length} views · ${selectedTemplate.color}` : 'Pick an App or User mockup from the library.'}</p></div></div>
            <button disabled={!!busy || loading || !!loadError || !!pendingArtwork || !templates.some(p => p.id === templateId && p.frames.some(f => f.imageDataUrl && f.applyDesign))} className="flex w-full items-center justify-center gap-3 border border-dashed border-zinc-300 bg-white px-4 py-5 text-sm text-zinc-600 transition-colors hover:border-blue-500 hover:bg-blue-50/50 disabled:opacity-50" onClick={() => inputRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!busyRef.current && !loading && !loadError) void create(Array.from(e.dataTransfer.files)); }}><UploadCloud size={20} /><span><strong className="block text-zinc-800">Add front designs</strong><span className="text-xs">Drop files or click · PNG, JPEG, WebP · up to 20</span></span></button>
          </div>
        </section>}
        {mode !== 'mockup' && <>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-sm font-semibold text-zinc-900">Saved products</h2><p className="mt-1 text-xs text-zinc-500">{filteredProducts.length} of {products.length} products</p></div><div className="flex w-full flex-wrap gap-2 sm:w-auto"><label className="flex min-w-52 flex-1 items-center gap-2 border border-zinc-200 bg-white px-3 text-zinc-400 focus-within:border-blue-500 sm:flex-none"><Search size={15} /><input aria-label="Search products" value={draftSearch} onChange={event => { setDraftSearch(event.target.value); setDraftPage(1); }} placeholder="Search products" className="w-full bg-transparent py-2 text-sm text-zinc-800 outline-none sm:w-48" /></label><select aria-label="Filter product status" value={draftStatus} onChange={event => { setDraftStatus(event.target.value as typeof draftStatus); setDraftPage(1); }} className="border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700"><option value="all">All statuses</option><option value="ready">Ready</option><option value="attention">Needs mockups or attention</option></select></div></div>
        {!loading && products.length > 0 && <div className="mb-3 flex flex-wrap items-center gap-2 text-xs"><label className="flex items-center gap-2 text-zinc-600"><input type="checkbox" aria-label="Select visible products" checked={visibleProducts.length > 0 && visibleProducts.every(product => selectedDraftIds.includes(product.id))} onChange={event => setSelectedDraftIds(previous => event.target.checked ? Array.from(new Set([...previous, ...visibleProducts.map(product => product.id)])) : previous.filter(id => !visibleProducts.some(product => product.id === id)))} /> Select this page</label><span className="text-zinc-400">{selectedDraftIds.length} selected</span>{selectedDraftIds.length > 0 && <><button className={button} onClick={() => setSelectedDraftIds([])}>Clear selection</button><button className={`${button} text-red-600`} disabled={!!busy} onClick={() => setBulkDeleteOpen(true)}><Trash2 size={13} /> Delete selected</button></>}</div>}
        {loading ? <p className="text-sm text-zinc-500">Loading saved products…</p> : loadError ? <div role="alert"><p className="mb-3 text-sm text-red-600">{loadError}</p><button className={button} onClick={() => void load()}>Retry loading</button></div> : !products.length ? <div className="border border-dashed border-zinc-300 bg-white p-12 text-center"><Package size={32} className="mx-auto mb-3 text-zinc-400" /><h3 className="text-sm font-semibold">Create your first product</h3><p className="mx-auto mt-2 max-w-md text-xs text-zinc-500">Choose a mockup in Mockups and add your artwork to create a product.</p><button className={`${primary} mt-4`} onClick={() => onOpenCreator()}>Open Mockups →</button></div> : !filteredProducts.length ? <div className="border border-zinc-200 bg-white p-8 text-center text-xs text-zinc-500">No products match your search or filter. <button className="ml-1 font-medium text-blue-700" onClick={() => { setDraftSearch(''); setDraftStatus('all'); }}>Clear filters</button></div> : <><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{visibleProducts.map(product => <ProductCard key={product.id} product={product} channelSummary={channelsLoading ? 'Loading channels…' : channelsError ? 'Channel status unavailable' : (['etsy', 'amazon'] as const).map(channel => { const linked = channelRecords.filter(record => record.productId === product.id && record.channel === channel); return `${channel === 'etsy' ? 'Etsy' : 'Amazon'}: ${linked.length > 1 ? `${linked.length} listings` : linked[0]?.status || 'No draft'}`; }).join(' · ')} selected={selectedDraftIds.includes(product.id)} busy={!!busy} onSelect={checked => setSelectedDraftIds(previous => checked ? Array.from(new Set([...previous, product.id])) : previous.filter(id => id !== product.id))} onOpen={() => { setSelected(product); setName(product.name); setDetailSection('media'); }} />)}</div><div className="mt-5 flex items-center justify-between text-xs text-zinc-500"><span>Page {Math.min(draftPage, draftPageCount)} of {draftPageCount}</span><span className="flex gap-2"><button className={button} disabled={draftPage <= 1} onClick={() => setDraftPage(page => page - 1)}>Previous</button><button className={button} disabled={draftPage >= draftPageCount} onClick={() => setDraftPage(page => page + 1)}>Next</button></span></div></>}
        </>}
      </>}
      </div>
    </main>
    <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ''; if (files.length) void create(files); }} />
    {deleteTarget && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><section role="alertdialog" aria-modal="true" aria-labelledby="delete-draft-title" className="w-full max-w-md space-y-4 border border-zinc-200 bg-white p-5 shadow-xl"><h3 id="delete-draft-title" className="text-sm font-semibold">Delete this product?</h3><p className="text-sm text-zinc-600">{deleteTarget.name} and its saved mockup files will be removed from this workstation. Products linked to a saved worksheet listing cannot be deleted until that listing is removed. Marketplace listings stay unchanged.</p><div className="flex justify-end gap-2"><button className={button} disabled={!!busy} onClick={() => setDeleteTarget(null)}>Cancel</button><button className="bg-red-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50" disabled={!!busy} onClick={() => void removeDraft(deleteTarget)}>Delete product</button></div></section></div>}
    {bulkDeleteOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><section role="alertdialog" aria-modal="true" aria-labelledby="bulk-delete-title" className="w-full max-w-md space-y-4 border border-zinc-200 bg-white p-5 shadow-xl"><h3 id="bulk-delete-title" className="text-sm font-semibold">Delete {selectedDraftIds.length} selected products?</h3><p className="text-sm text-zinc-600">Their saved mockup files will be removed from this workstation. Etsy and Amazon listings stay unchanged. Selection can include products from multiple pages.</p><div className="flex justify-end gap-2"><button className={button} disabled={!!busy} onClick={() => setBulkDeleteOpen(false)}>Cancel</button><button className="bg-red-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50" disabled={!!busy} onClick={() => void removeSelectedDrafts()}>Delete selected</button></div></section></div>}
  </div>;
}
