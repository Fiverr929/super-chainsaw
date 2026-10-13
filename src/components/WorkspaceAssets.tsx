'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { ArrowRight, ChevronRight, ExternalLink, Folder, FolderOpen, Grid2X2, Images, RefreshCw, Search, Trash2 } from 'lucide-react';
import type { ListingAssetFolder } from '@/lib/workspaceAssets';
import { isEtsyListingImageUrl } from '@/lib/etsyListingImage';

const dateLabel = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export default function WorkspaceAssets({ onUseInDesign }: { onUseInDesign?: (asset: { url: string; name: string }) => void }) {
  const [folders, setFolders] = useState<ListingAssetFolder[]>([]);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const [imagePosition, setImagePosition] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch('/api/workspace/assets', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load assets.');
      setFolders(data.folders);
      setError('');
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Could not load assets.');
    } finally { if (!silent) setLoading(false); }
  }, []);
  useEffect(() => {
    void load();
    const refresh = () => { if (document.visibilityState === 'visible') void load(true); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [load]);

  const filtered = folders.filter(item => `${item.title} ${item.id}`.toLowerCase().includes(query.toLowerCase().trim()));
  const folder = folders.find(item => item.id === folderId);
  const selectedImport = folder?.imports?.find(item => item.id === importId);
  const images = selectedImport?.images ?? folder?.images ?? [];
  const selectedImage = images.find(item => item.position === imagePosition) ?? images[0];
  const invalidImages = images.filter(image => !isEtsyListingImageUrl(image.sourceUrl));
  const totalImages = folders.reduce((sum, item) => sum + item.images.filter(image => isEtsyListingImageUrl(image.sourceUrl)).length, 0);
  const needsReimport = folders.filter(item => item.images.some(image => !isEtsyListingImageUrl(image.sourceUrl))).length;
  const openFolder = (id: string | null) => { setFolderId(id); setImportId(null); setImagePosition(null); };
  const toggleFolder = (id: string, checked: boolean) => setSelectedFolderIds(previous => checked ? Array.from(new Set([...previous, id])) : previous.filter(item => item !== id));
  const deleteSelected = async () => {
    if (!selectedFolderIds.length) return;
    setDeleting(true);
    setError('');
    try {
      const response = await fetch('/api/workspace/assets/bulk-delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: selectedFolderIds }) });
      const result = await response.json() as { error?: string; deleted?: string[]; failed?: { id: string; error: string }[] };
      if (!response.ok) throw new Error(result.error || 'Could not delete selected asset folders.');
      const deleted = new Set(result.deleted || []);
      setFolders(previous => previous.filter(item => !deleted.has(item.id)));
      setSelectedFolderIds(previous => previous.filter(id => !deleted.has(id)));
      if (folderId && deleted.has(folderId)) openFolder(null);
      setBulkDeleteOpen(false);
      setNotice(deleted.size ? `${deleted.size} asset ${deleted.size === 1 ? 'folder' : 'folders'} deleted.` : 'No asset folders were deleted.');
      if (result.failed?.length) setError(`${result.failed.length} folder${result.failed.length === 1 ? '' : 's'} could not be deleted. ${result.failed[0].error}`);
    } catch (issue) { setError(issue instanceof Error ? issue.message : 'Could not delete asset folders.'); }
    finally { setDeleting(false); }
  };

  return <div className="flex h-full min-h-0 flex-col bg-[#f6f7f9] text-zinc-900">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-white px-5 py-4 lg:px-7">
      <div><div className="flex items-center gap-2"><span className="rounded-lg bg-indigo-50 p-2 text-indigo-600"><Images size={19} /></span><h1 className="text-xl font-semibold tracking-tight">Assets</h1></div><p className="mt-1 text-xs text-zinc-500">Your imported listing images, organized like files.</p></div>
      <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>
    </header>
    {error && <p role="alert" className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 lg:mx-7">{error}</p>}
    {notice && <p role="status" className="mx-5 mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 lg:mx-7">{notice}</p>}
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <aside className="shrink-0 border-b border-zinc-200 bg-white lg:w-64 lg:overflow-y-auto lg:border-b-0 lg:border-r"><div className="p-4">
        <label className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-400 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100"><Search size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a listing" className="min-w-0 flex-1 bg-transparent text-sm text-zinc-800 outline-none placeholder:text-zinc-400" aria-label="Find a listing" /></label>
        <button type="button" onClick={() => openFolder(null)} className={`mt-4 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium ${!folder ? 'bg-indigo-50 text-indigo-700' : 'text-zinc-600 hover:bg-zinc-50'}`}><Grid2X2 size={17} /><span className="flex-1">All listings</span><span className="text-xs opacity-60">{folders.length}</span></button>
        <div className="mt-5 flex items-center justify-between px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400"><span>Listing folders</span><span>{filtered.length}</span></div>
        <nav aria-label="Listing folders" className="mt-2 flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">{filtered.map(item => <button key={item.id} type="button" onClick={() => openFolder(item.id)} title={item.title} className={`flex min-w-48 items-center gap-2.5 rounded-lg px-3 py-2.5 text-left lg:min-w-0 ${folder?.id === item.id ? 'bg-indigo-50 text-indigo-700' : 'text-zinc-700 hover:bg-zinc-50'}`}>{folder?.id === item.id ? <FolderOpen size={17} className="shrink-0" /> : <Folder size={17} className="shrink-0 text-amber-500" />}<span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.title}</span><span className="block text-[11px] opacity-60">Etsy #{item.id}</span></span></button>)}{!loading && query && filtered.length === 0 && <p className="px-3 py-3 text-xs text-zinc-500">No matching folders.</p>}</nav>
      </div></aside>
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto px-5 py-5 lg:px-7 lg:py-6">
        <nav aria-label="Asset location" className="mb-5 flex min-w-0 items-center gap-2 text-xs text-zinc-500"><button type="button" onClick={() => openFolder(null)} className="hover:text-indigo-700">Assets</button>{folder && <><ChevronRight size={14} /><span className="truncate font-medium text-zinc-800">{folder.title}</span></>}</nav>
        {loading && folders.length === 0 && <p className="text-sm text-zinc-500">Loading assets…</p>}
        {!loading && folders.length === 0 && <div className="mx-auto mt-12 max-w-md rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center shadow-sm"><span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><FolderOpen size={26} /></span><h2 className="font-semibold">No listing folders yet</h2><p className="mt-2 text-sm leading-6 text-zinc-500">Open an Etsy listing in Flat Earth, choose the images you want, then use Download &amp; import. They will appear here in a listing folder.</p></div>}
        {!folder && folders.length > 0 && <><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">Listing folders</h2><p className="mt-1 text-sm text-zinc-500">{folders.length} {folders.length === 1 ? 'listing' : 'listings'} · {totalImages} listing {totalImages === 1 ? 'image' : 'images'}{needsReimport > 0 ? ` · ${needsReimport} needs reimport` : ''}</p></div><span className="text-xs text-zinc-400">Newest import first</span></div>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs"><label className="flex items-center gap-2 text-zinc-600"><input type="checkbox" aria-label="Select visible asset folders" disabled={deleting || filtered.length === 0} checked={filtered.length > 0 && filtered.every(item => selectedFolderIds.includes(item.id))} onChange={event => setSelectedFolderIds(previous => event.target.checked ? Array.from(new Set([...previous, ...filtered.map(item => item.id)])) : previous.filter(id => !filtered.some(item => item.id === id)))} /> Select visible</label><span className="text-zinc-400">{selectedFolderIds.length} selected</span>{selectedFolderIds.length > 0 && <><button type="button" onClick={() => setSelectedFolderIds([])} disabled={deleting} className="rounded-md px-2 py-1.5 text-zinc-600 hover:bg-zinc-200 disabled:opacity-50">Clear selection</button><button type="button" onClick={() => setBulkDeleteOpen(true)} disabled={deleting} className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 size={13} /> Delete selected</button></>}</div>
          {filtered.length === 0 ? <p className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">No folders match “{query}”.</p> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{filtered.map(item => <article key={item.id} className={`group relative overflow-hidden rounded-xl border bg-white shadow-sm transition hover:border-indigo-300 hover:shadow-md ${selectedFolderIds.includes(item.id) ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-zinc-200'}`}><label className="absolute left-3 top-3 z-10 flex cursor-pointer items-center gap-1.5 rounded-md bg-white/95 px-2 py-1.5 text-xs font-medium text-zinc-700 shadow-sm"><input type="checkbox" aria-label={`Select ${item.title}`} checked={selectedFolderIds.includes(item.id)} disabled={deleting} onChange={event => toggleFolder(item.id, event.target.checked)} /><span>Select</span></label><button type="button" onClick={() => openFolder(item.id)} className="w-full text-left"><div className="relative flex aspect-[1.7] items-center justify-center bg-zinc-100">{item.images[0] && isEtsyListingImageUrl(item.images[0].sourceUrl) ? <Image src={item.images[0].url} fill unoptimized alt="" className="object-contain" /> : <Folder size={40} className="text-amber-400" />}<span className="absolute bottom-2 right-2 rounded-md bg-white/95 px-2 py-1 text-[11px] font-medium text-zinc-700 shadow-sm">{item.images.length} {item.images.length === 1 ? 'image' : 'images'}</span></div><div className="p-4"><div className="flex items-start gap-2"><Folder size={17} className="mt-0.5 shrink-0 text-amber-500" /><span className="line-clamp-2 flex-1 text-sm font-medium leading-5 group-hover:text-indigo-700">{item.title}</span><ChevronRight size={15} className="mt-0.5 shrink-0 text-zinc-400" /></div>{item.images.some(image => !isEtsyListingImageUrl(image.sourceUrl)) && <p className="mt-2 pl-6 text-xs font-medium text-amber-700">Review photo detected · reimport listing</p>}<p className="mt-3 pl-6 text-xs text-zinc-500">Etsy #{item.id} · {dateLabel(item.importedAt)}</p></div></button></article>)}</div>}
        </>}
        {folder && <><div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-start gap-2"><FolderOpen size={22} className="mt-0.5 shrink-0 text-amber-500" /><h2 className="max-w-3xl text-lg font-semibold leading-7">{folder.title}</h2></div><p className="mt-1 pl-8 text-xs text-zinc-500">Etsy #{folder.id} · {images.length} {images.length === 1 ? 'image' : 'images'} · imported {dateLabel(selectedImport?.importedAt ?? folder.importedAt)}</p></div><a href={folder.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50">View Etsy listing <ExternalLink size={13} /></a></div>
          {invalidImages.length > 0 && <p role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">This import contains {invalidImages.length} review {invalidImages.length === 1 ? 'photo' : 'photos'}. Reimport this listing with Flat Earth v1.6.4 to use its product images in Design.</p>}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3"><div className="flex items-center gap-2 text-sm font-medium"><Images size={16} className="text-zinc-500" /> Images <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">{images.length}</span></div>{folder.imports?.length > 1 && <label className="flex items-center gap-2 text-xs text-zinc-500">Import version <select value={importId ?? 'latest'} onChange={event => { setImportId(event.target.value === 'latest' ? null : event.target.value); setImagePosition(null); }} className="max-w-52 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700"><option value="latest">Latest · {dateLabel(folder.importedAt)}</option>{folder.imports.slice(0, -1).reverse().map(item => <option key={item.id} value={item.id}>{dateLabel(item.importedAt)} · {item.images.length} images</option>)}</select></label>}</div>
          {images.length === 0 ? <p className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">This import has no images.</p> : <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_260px] 2xl:grid-cols-[minmax(0,1fr)_320px]"><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{images.map(image => <button key={`${image.position}-${image.url}`} type="button" onClick={() => setImagePosition(image.position)} className={`group overflow-hidden rounded-xl border bg-white text-left shadow-sm transition hover:border-indigo-300 hover:shadow-md ${selectedImage?.url === image.url ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-zinc-200'}`} aria-pressed={selectedImage?.url === image.url}><div className="relative aspect-square bg-zinc-100"><Image src={image.url} fill unoptimized alt={`${folder.title}, image ${image.position}`} className="object-contain" /></div><div className="flex items-center justify-between gap-2 px-3 py-2.5"><span className="truncate text-xs font-medium">Image {image.position}</span><span className="text-[11px] text-zinc-400">{image.url.split('.').pop()?.toUpperCase() || 'IMAGE'}</span></div></button>)}</div>
            {selectedImage && <aside className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm lg:sticky lg:top-0"><div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3"><div className="min-w-0"><h3 className="text-sm font-semibold">Image {selectedImage.position}</h3><p className="mt-0.5 truncate text-xs text-zinc-500">etsy-{folder.id}-{selectedImage.position}</p></div><button type="button" disabled={!isEtsyListingImageUrl(selectedImage.sourceUrl)} onClick={() => onUseInDesign?.({ url: selectedImage.url, name: `etsy-${folder.id}-${selectedImage.position}` })} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-zinc-300">Design <ArrowRight size={13} /></button></div><div className="relative aspect-[4/3] bg-zinc-50"><Image src={selectedImage.url} fill unoptimized alt={`${folder.title}, selected image ${selectedImage.position}`} className="object-contain" /></div><div className="space-y-3 p-4"><p className="text-xs leading-5 text-zinc-500">Source: Etsy listing #{folder.id}</p><a href={selectedImage.url} target="_blank" rel="noreferrer" className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50">View full image <ExternalLink size={13} /></a></div></aside>}
          </div>}
        </>}
      </main>
    </div>
    {bulkDeleteOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><section role="alertdialog" aria-modal="true" aria-labelledby="asset-bulk-delete-title" className="w-full max-w-md space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-xl"><h3 id="asset-bulk-delete-title" className="text-sm font-semibold">Delete {selectedFolderIds.length} selected asset folders?</h3><p className="text-sm leading-6 text-zinc-600">All imported images and import versions in these folders will be removed from this workstation. Folders linked to saved products will be kept and reported. Etsy listings stay unchanged.</p><div className="flex justify-end gap-2"><button type="button" onClick={() => setBulkDeleteOpen(false)} disabled={deleting} className="rounded-md border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">Cancel</button><button type="button" onClick={() => void deleteSelected()} disabled={deleting || selectedFolderIds.length === 0} className="rounded-md bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50">{deleting ? 'Deleting…' : 'Delete selected'}</button></div></section></div>}
  </div>;
}
