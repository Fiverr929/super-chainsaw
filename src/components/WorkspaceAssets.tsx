'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, ExternalLink, FolderOpen, RefreshCw, Search, Trash2 } from 'lucide-react';
import type { ListingAssetFolder } from '@/lib/workspaceAssets';
import { isEtsyListingImageUrl } from '@/lib/etsyListingImage';
import SourceListingDetails from './SourceListingDetails';

const dateLabel = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export default function WorkspaceAssets({ onUseInDesign }: { onUseInDesign?: (asset: { url: string; name: string }) => void }) {
  const [folders, setFolders] = useState<ListingAssetFolder[]>([]);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const [imagePosition, setImagePosition] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [infoFilter, setInfoFilter] = useState('all');
  const [selecting, setSelecting] = useState(false);
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

  const hasSourceCopy = (item: ListingAssetFolder) => !!item.details?.description?.trim() && !!item.details?.tags?.length;
  const filtered = folders.filter(item => `${item.title} ${item.id} ${item.details?.tags?.join(' ') || ''}`.toLowerCase().includes(query.toLowerCase().trim()) && (infoFilter === 'all' || (infoFilter === 'saved' ? hasSourceCopy(item) : !hasSourceCopy(item))));
  const folder = folders.find(item => item.id === folderId);
  const selectedImport = folder?.imports?.find(item => item.id === importId);
  const images = selectedImport?.images ?? folder?.images ?? [];
  const selectedImage = images.find(item => item.position === imagePosition) ?? images[0];
  const invalidImages = images.filter(image => !isEtsyListingImageUrl(image.sourceUrl));
  const totalImages = folders.reduce((sum, item) => sum + item.images.filter(image => isEtsyListingImageUrl(image.sourceUrl)).length, 0);
  const folderIndex = filtered.findIndex(item => item.id === folderId);
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

  const action = 'inline-flex items-center justify-center gap-2 border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-40';

  return <div className="@container flex h-full min-h-0 flex-col bg-[#f6f7f9] text-zinc-900">
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-white px-5 py-4 lg:px-7">
      <div><h1 className="text-base font-semibold tracking-tight">Assets</h1><p className="mt-1 text-xs text-zinc-500">Imported images and listing references</p></div>
      <button type="button" onClick={() => void load()} disabled={loading} className={action}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>
    </header>
    {error && <p role="alert" className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="mx-5 mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    <div className="min-h-0 flex-1 overflow-y-auto" key={folder?.id || 'library'}>
      <div className="mx-auto max-w-7xl p-5 lg:p-7">
        {!folder && <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-zinc-500">{folders.length} references <span className="mx-1 text-zinc-300">/</span> {totalImages} images</p>
            {folders.length > 0 && <button type="button" className={action} onClick={() => { setSelecting(value => !value); setSelectedFolderIds([]); }}>{selecting ? 'Done selecting' : 'Select assets'}</button>}
          </div>
          <div className="mb-5 flex flex-wrap gap-3">
            <label className="flex min-w-48 flex-1 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-zinc-400 focus-within:ring-2 focus-within:ring-indigo-100"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by title, tag, or listing ID" className="min-w-0 flex-1 bg-transparent text-sm text-zinc-800 outline-none" aria-label="Search assets" />{query && <button type="button" onClick={() => setQuery('')} className="text-xs text-zinc-500 hover:text-zinc-900">Clear</button>}</label>
            <select aria-label="Filter source information" value={infoFilter} onChange={event => setInfoFilter(event.target.value)} className="rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-xs text-zinc-600"><option value="all">All assets</option><option value="saved">With description &amp; tags</option><option value="missing">Missing information</option></select>
          </div>
          {selecting && <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 text-xs"><label className="flex items-center gap-2"><input type="checkbox" aria-label="Select visible asset folders" disabled={deleting || !filtered.length} checked={filtered.length > 0 && filtered.every(item => selectedFolderIds.includes(item.id))} onChange={event => setSelectedFolderIds(previous => event.target.checked ? Array.from(new Set([...previous, ...filtered.map(item => item.id)])) : previous.filter(id => !filtered.some(item => item.id === id)))} />Select all shown</label><span className="text-zinc-400">{selectedFolderIds.length} selected</span><button type="button" disabled={deleting || !selectedFolderIds.length} onClick={() => setBulkDeleteOpen(true)} className="ml-auto inline-flex items-center gap-1.5 font-medium text-red-700 disabled:opacity-40"><Trash2 size={13} />Delete selected</button></div>}
          {loading && !folders.length ? <p className="py-10 text-center text-sm text-zinc-500">Loading assets…</p> : !folders.length ? <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-5 py-14 text-center"><FolderOpen className="mx-auto mb-3 text-zinc-400" size={30} /><h2 className="text-sm font-semibold">Your asset library is empty</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-500">Import an Etsy listing with Flat Earth or ask Agent to fetch a listing. Its images and available information will appear here.</p></div> : !filtered.length ? <div className="py-12 text-center"><p className="text-sm text-zinc-500">No assets match your search or filter.</p><button type="button" className="mt-3 text-xs font-medium text-indigo-700" onClick={() => { setQuery(''); setInfoFilter('all'); }}>Clear filters</button></div> : <>
            <p className="mb-3 text-xs text-zinc-400">{filtered.length === folders.length ? 'Newest first' : `${filtered.length} of ${folders.length} references`}</p>
            <div className="grid grid-cols-1 gap-4 @min-[480px]:grid-cols-2 @min-[850px]:grid-cols-3 @min-[1150px]:grid-cols-4">
              {filtered.map(item => <article key={item.id} className={`relative overflow-hidden border bg-white transition-colors hover:border-blue-300 ${selectedFolderIds.includes(item.id) ? 'border-blue-500 ring-1 ring-blue-500' : 'border-zinc-200'}`}>
                {selecting && <label className="absolute left-3 top-3 z-10 flex rounded-md bg-white p-2 shadow-sm"><input type="checkbox" aria-label={`Select ${item.title}`} checked={selectedFolderIds.includes(item.id)} disabled={deleting} onChange={event => toggleFolder(item.id, event.target.checked)} /></label>}
                <button type="button" aria-label={`Open ${item.title}`} onClick={() => openFolder(item.id)} className="block w-full text-left">
                  <div className="relative aspect-[1.6] bg-zinc-100">{item.images[0] ? <Image src={item.images[0].url} fill unoptimized sizes="350px" alt="" className="object-contain p-2" /> : <FolderOpen size={32} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-zinc-300" />}<span className="absolute bottom-2 right-2 bg-white/95 px-2 py-1 text-[11px] text-zinc-700">{item.images.length} {item.images.length === 1 ? 'image' : 'images'}</span></div>
                  <div className="border-t border-zinc-100 p-4"><h2 className="line-clamp-2 min-h-10 text-sm font-medium leading-5">{item.title}</h2><div className="mt-3 flex items-center justify-between gap-2 text-[11px]"><span className="text-zinc-500">Etsy #{item.id}</span><span className={hasSourceCopy(item) ? 'text-emerald-700' : 'text-amber-700'}>{hasSourceCopy(item) ? 'Details saved' : 'Details incomplete'}</span></div></div>
                </button>
              </article>)}
            </div>
          </>}
        </>}
        {folder && <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={() => openFolder(null)} className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-indigo-700"><ArrowLeft size={16} />All assets</button>
            <div className="flex items-center gap-2"><span className="mr-1 text-xs text-zinc-400">{folderIndex >= 0 ? `${folderIndex + 1} of ${filtered.length}` : 'Asset details'}</span><button type="button" aria-label="Previous asset" disabled={folderIndex <= 0} className={action} onClick={() => openFolder(filtered[folderIndex - 1].id)}><ChevronLeft size={15} /></button><button type="button" aria-label="Next asset" disabled={folderIndex < 0 || folderIndex >= filtered.length - 1} className={action} onClick={() => openFolder(filtered[folderIndex + 1].id)}><ChevronRight size={15} /></button></div>
          </div>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-4"><div><h2 className="text-sm font-semibold">Etsy reference <span className="font-normal text-zinc-400">#{folder.id}</span></h2><p className="mt-1 text-xs text-zinc-400">Imported {dateLabel(folder.importedAt)}</p></div><a href={folder.sourceUrl} target="_blank" rel="noreferrer" className={action}>Original listing <ExternalLink size={13} /></a></div>
          <div className="grid items-start gap-6 @min-[720px]:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <section aria-label="Asset images" className="min-w-0 space-y-3">
              {selectedImage ? <>
                <div className="relative flex h-72 items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-white @min-[720px]:h-80"><Image src={selectedImage.url} fill unoptimized sizes="600px" alt={`${folder.title}, image ${selectedImage.position}`} className="object-contain p-4" /><a href={selectedImage.url} target="_blank" rel="noreferrer" aria-label="Open full image" className="absolute right-3 top-3 rounded-lg border border-zinc-200 bg-white p-2 text-zinc-500 hover:text-indigo-700"><ExternalLink size={14} /></a><span className="absolute bottom-3 left-3 rounded-md bg-white/95 px-2 py-1 text-xs text-zinc-500">Image {images.findIndex(image => image.url === selectedImage.url) + 1} of {images.length}</span></div>
                <div aria-label="Choose image" className="flex gap-2 overflow-x-auto pb-1">{images.map(image => <button key={image.url} type="button" aria-label={`Image ${image.position}`} aria-pressed={selectedImage.url === image.url} onClick={() => setImagePosition(image.position)} className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-white ${selectedImage.url === image.url ? 'border-indigo-600 ring-1 ring-indigo-600' : 'border-zinc-200 hover:border-zinc-400'}`}><Image src={image.url} fill unoptimized sizes="64px" alt="" className="object-contain p-1" /></button>)}</div>
                <button type="button" disabled={!onUseInDesign || !isEtsyListingImageUrl(selectedImage.sourceUrl)} onClick={() => onUseInDesign?.({ url: selectedImage.url, name: `etsy-${folder.id}-${selectedImage.position}` })} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-zinc-300">Use image in Design <ArrowRight size={15} /></button>
              </> : <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">No images in this import.</p>}
              {invalidImages.length > 0 && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800">This import includes {invalidImages.length} review photos. Reimport the listing’s product images to use them in Design.</p>}
              {folder.imports?.length > 1 && <details className="border-t border-zinc-200 pt-3"><summary className="cursor-pointer text-xs text-zinc-500">Image import history</summary><label className="mt-3 block text-xs text-zinc-500">Import version<select value={importId ?? 'latest'} onChange={event => { setImportId(event.target.value === 'latest' ? null : event.target.value); setImagePosition(null); }} className="mt-2 block w-full rounded-lg border border-zinc-200 bg-white p-2 text-xs"><option value="latest">Latest · {dateLabel(folder.importedAt)}</option>{folder.imports.slice(0, -1).reverse().map(item => <option key={item.id} value={item.id}>{dateLabel(item.importedAt)} · {item.images.length} images</option>)}</select></label><p className="mt-2 text-xs text-zinc-400">History applies to images. Listing text shows the latest saved information.</p></details>}
            </section>
            <SourceListingDetails key={folder.id} folder={folder} showSourceLink={false} />
          </div>
        </>}
      </div>
    </div>
    {bulkDeleteOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><section role="alertdialog" aria-modal="true" aria-labelledby="asset-bulk-delete-title" className="w-full max-w-md space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-xl"><h3 id="asset-bulk-delete-title" className="text-sm font-semibold">Delete {selectedFolderIds.length} selected assets?</h3><p className="text-sm leading-6 text-zinc-600">Imported images and their history will be removed. Assets used by saved products will be kept. Etsy listings stay unchanged.</p><div className="flex justify-end gap-2"><button type="button" onClick={() => setBulkDeleteOpen(false)} disabled={deleting} className={action}>Cancel</button><button type="button" onClick={() => void deleteSelected()} disabled={deleting || !selectedFolderIds.length} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50">{deleting ? 'Deleting…' : 'Delete selected'}</button></div></section></div>}
  </div>;
}
