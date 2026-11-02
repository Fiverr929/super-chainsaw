'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { getStoredGeminiApiKey } from '@/lib/clientApiKey';
import type { DesignResearchCase, ResearchObservation, ResearchOpportunity, ResearchResult } from '@/lib/designResearch';
import type { ListingAsset, ListingDetails } from '@/lib/workspaceAssets';

const STORAGE_KEY = 'workstation_design_research_v2';
const ANALYSIS_VERSION = 2;
const blank = (): DesignResearchCase => ({ keyword: '', audience: '', notes: '', observations: [] });
const date = (timestamp?: number) => timestamp && Number.isFinite(timestamp) ? new Date(timestamp * 1000).toISOString().slice(0, 10) : '';
type ImportedListing = { id: string; url: string; title: string; details?: ListingDetails; images: ListingAsset[] };

export default function DesignResearch({ onChoose }: { onChoose: (opportunity: ResearchOpportunity, imageUrl: string) => void }) {
  const [research, setResearch] = useState<DesignResearchCase | null>(null);
  const [listingUrl, setListingUrl] = useState('');
  const [images, setImages] = useState<ListingAsset[]>([]);
  const [selectedImageUrl, setSelectedImageUrl] = useState('');
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved?.research?.observations?.[0]?.assetId) {
        setResearch(saved.research);
        setListingUrl(saved.research.observations[0].url);
        setImages(Array.isArray(saved.images) ? saved.images : []);
        setSelectedImageUrl(saved.selectedImageUrl || saved.images?.[0]?.url || '');
        setResult(saved.analysisVersion === ANALYSIS_VERSION && saved.result?.sourceAnalysis ? saved.result : null);
        return;
      }
    } catch { /* Start fresh if storage is unavailable. */ }
    setResearch(blank());
  }, []);

  useEffect(() => {
    if (!research) return;
    const timer = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ analysisVersion: ANALYSIS_VERSION, research, images, selectedImageUrl, result })); }
      catch { /* This session remains usable without browser storage. */ }
    }, 500);
    return () => clearTimeout(timer);
  }, [research, images, selectedImageUrl, result]);

  const source = research?.observations[0];
  const loadedSource = source?.assetId && listingUrl.trim() === source.url ? source : undefined;
  const importListing = async () => {
    if (!listingUrl.trim()) return toast.error('Paste an Etsy listing URL.');
    setImporting(true);
    try {
      const response = await fetch('/api/design/research/listing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: listingUrl.trim() }),
        signal: AbortSignal.timeout(90000),
      });
      const data = await response.json();
      if (!response.ok || !data.listing) throw new Error(data.error || 'Could not load this listing.');
      const listing = data.listing as ImportedListing;
      const details = listing.details;
      const observation: ResearchObservation = {
        id: 'source-1', assetId: listing.id, url: listing.url, title: listing.title,
        description: details?.description || '', tags: details?.tags || [], imageUrl: listing.images[0]?.url || '',
        price: details?.price ? `${(details.price.amount / details.price.divisor).toFixed(2)} ${details.price.currency}` : '',
        observedAt: details?.fetchedAt?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        originalCreatedAt: date(details?.originalCreationTimestamp), lastModifiedAt: date(details?.lastModifiedTimestamp),
        favorites: details?.numFavorers === undefined ? '' : String(details.numFavorers),
        listedDate: date(details?.createdTimestamp), soldPageUrl: '', seenOnSoldPage: false, visualNotes: '',
      };
      setResearch(current => ({ ...(current || blank()), observations: [observation] }));
      setListingUrl(listing.url); setImages(listing.images); setSelectedImageUrl(listing.images[0]?.url || ''); setResult(null);
      toast.success('Listing imported. Review the source and find design opportunities.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not load this listing.'); }
    finally { setImporting(false); }
  };

  const analyze = async () => {
    if (!research || !loadedSource) return toast.error('Import this listing first.');
    setAnalyzing(true);
    try {
      const key = getStoredGeminiApiKey();
      const response = await fetch('/api/design/research', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(key ? { 'x-gemini-api-key': key } : {}) },
        body: JSON.stringify(research), signal: AbortSignal.timeout(105000),
      });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.opportunities)) throw new Error(data.error || 'Could not find opportunities.');
      setResult(data);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not find opportunities.'); }
    finally { setAnalyzing(false); }
  };

  if (!research) return null;
  return <section className="rounded-xl border border-indigo-200 bg-white p-4" aria-label="Design research">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-sm font-semibold text-zinc-900">Design research from a listing</h3><p className="mt-1 text-xs text-zinc-600">Paste one Etsy listing. Review its details, find original design directions, then generate from a chosen source image.</p></div><button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)} className="rounded border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-800">{open ? 'Hide' : 'Open research'}</button></div>
    {open && <div className="mt-4 space-y-4 text-xs">
      <form onSubmit={event => { event.preventDefault(); void importListing(); }} className="flex flex-wrap gap-2"><input aria-label="Etsy listing URL" type="url" value={listingUrl} onChange={event => { setListingUrl(event.target.value); setResult(null); }} placeholder="https://www.etsy.com/listing/..." className="min-w-64 flex-1 rounded border border-zinc-300 p-2" /><button type="submit" disabled={importing || analyzing} className="rounded bg-indigo-600 px-4 py-2 font-medium text-white disabled:opacity-50">{importing ? 'Importing…' : loadedSource ? 'Refresh listing' : 'Import listing'}</button></form>
      {loadedSource && <>
        <div className="grid gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
          <div><div className="relative aspect-square overflow-hidden rounded bg-white">{selectedImageUrl && <Image src={selectedImageUrl} alt={loadedSource.title} fill unoptimized sizes="220px" className="object-contain" />}</div><div className="mt-2 flex gap-1 overflow-x-auto">{images.map(image => <button type="button" key={image.url} aria-label={`Use listing image ${image.position}`} aria-pressed={selectedImageUrl === image.url} onClick={() => { setSelectedImageUrl(image.url); setResearch(current => current && { ...current, observations: current.observations.map(item => ({ ...item, imageUrl: image.url })) }); setResult(null); }} className={`relative h-12 w-12 shrink-0 border bg-white ${selectedImageUrl === image.url ? 'border-indigo-600' : 'border-zinc-200'}`}><Image src={image.url} alt="" fill unoptimized sizes="48px" className="object-contain" /></button>)}</div></div>
          <div className="space-y-2"><div><a href={loadedSource.url} target="_blank" rel="noreferrer" className="font-semibold text-indigo-800 underline">{loadedSource.title}</a><p className="text-zinc-500">Imported from Etsy API on {loadedSource.observedAt}</p></div><div className="flex flex-wrap gap-x-4 gap-y-1 text-zinc-700"><span>Price: {loadedSource.price || 'unavailable'}</span><span>Favorites: {loadedSource.favorites || 'unavailable'}</span><span>Original creation: {loadedSource.originalCreatedAt || 'unavailable'}</span><span>API listing date: {loadedSource.listedDate || 'unavailable'}</span><span>Last modified: {loadedSource.lastModifiedAt || 'unavailable'}</span></div><p className="line-clamp-4 leading-5 text-zinc-600">{loadedSource.description || 'No description returned.'}</p><p className="text-zinc-500">Tags: {loadedSource.tags?.join(', ') || 'none returned'}</p></div>
        </div>
        <details className="rounded border border-zinc-200 p-3"><summary className="cursor-pointer font-medium text-zinc-700">Optional context</summary><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="space-y-1"><span>Niche or keyword</span><input value={research.keyword} maxLength={120} onChange={event => { setResearch(current => current && { ...current, keyword: event.target.value }); setResult(null); }} placeholder="Inferred from listing if blank" className="w-full rounded border border-zinc-300 p-2" /></label><label className="space-y-1"><span>Target buyer</span><input value={research.audience} maxLength={200} onChange={event => { setResearch(current => current && { ...current, audience: event.target.value }); setResult(null); }} className="w-full rounded border border-zinc-300 p-2" /></label><label className="space-y-1 sm:col-span-2"><span>Your direction or rights you hold</span><textarea value={research.notes} maxLength={1000} rows={2} onChange={event => { setResearch(current => current && { ...current, notes: event.target.value }); setResult(null); }} className="w-full rounded border border-zinc-300 p-2" /></label></div></details>
        <p className="text-zinc-500">Favorites are cumulative. API dates do not confirm sales. This listing alone cannot establish search volume or whether a design will sell.</p>
        <button type="button" disabled={importing || analyzing} onClick={() => void analyze()} className="rounded bg-indigo-600 px-4 py-2 font-medium text-white disabled:opacity-50">{analyzing ? 'Analyzing artwork…' : result ? 'Refresh artwork analysis' : 'Analyze artwork and find 3 directions'}</button>
      </>}
      {result && loadedSource && <div className="space-y-4 border-t border-zinc-200 pt-4">
        <section className="space-y-2 rounded-lg border border-indigo-200 bg-indigo-50 p-4"><h4 className="text-sm font-semibold text-indigo-950">What this artwork actually shows · {result.sourceAnalysis.subject}</h4><p><span className="font-medium">Visible print:</span> {result.sourceAnalysis.visibleArtwork}</p><p><span className="font-medium">Composition:</span> {result.sourceAnalysis.composition}</p><p><span className="font-medium">Palette:</span> {result.sourceAnalysis.palette}</p><p><span className="font-medium">Why it might appeal:</span> {result.sourceAnalysis.buyerAppeal}</p>{result.sourceAnalysis.uncertainDetails && <p className="text-amber-800"><span className="font-medium">Unclear details:</span> {result.sourceAnalysis.uncertainDetails}</p>}</section>
        <div className="grid gap-3 lg:grid-cols-3">{result.opportunities.map(opportunity => <article key={opportunity.id} className="space-y-2 rounded-lg border border-zinc-200 p-3"><h4 className="font-semibold text-zinc-900">{opportunity.name}</h4><p><span className="font-medium">From the source:</span> {opportunity.sourceConnection}</p><p><span className="font-medium">New direction:</span> {opportunity.specificChange}</p><p><span className="font-medium">Buyer hypothesis:</span> {opportunity.buyerReason}</p><p className="text-zinc-500">Evidence: <a href={loadedSource.url} target="_blank" rel="noreferrer" className="text-indigo-700 underline">Imported listing</a></p><p className="text-amber-800">Uncertainty: {opportunity.uncertainty}</p><p className="text-zinc-700"><span className="font-medium">Image prompt:</span> {opportunity.designDirection}</p><button type="button" disabled={!selectedImageUrl} onClick={() => onChoose(opportunity, selectedImageUrl)} className="rounded bg-indigo-600 px-3 py-2 font-medium text-white disabled:opacity-50">Generate from selected image</button></article>)}</div>
      </div>}
    </div>}
  </section>;
}
