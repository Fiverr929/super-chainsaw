'use client';

import type { ListingRecord } from '@/lib/workspaceListingStore';
import { productListingMediaState, type ListingPresetValues, type ProductChannel, type WorkspaceProduct } from '@/lib/workspaceProducts';

export default function ProductChannelListings({ product, records, loading, error, busy, presets, presetId, onPresetChange, onRetry, onOpen, onPrepare, onSetupEtsyPreset }: {
  product: WorkspaceProduct; records: ListingRecord[]; loading: boolean; error: string; busy: boolean;
  presets: ListingPresetValues[]; presetId: string; onPresetChange: (id: string) => void;
  onRetry: () => void; onOpen: (record: ListingRecord) => void; onPrepare: (channel: ProductChannel) => void; onSetupEtsyPreset: () => void;
}) {
  const action = 'rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40';
  return <section aria-label="Channel listings" className="space-y-4">
    <div><h3 className="text-sm font-semibold">Channel listings</h3><p className="mt-1 text-xs leading-5 text-zinc-500">Each channel owns its copy, price, and publishing status. Creating or updating a local draft does not publish it.</p></div>
    {loading ? <p role="status" className="text-sm text-zinc-500">Loading linked drafts…</p> : error ? <p role="alert" className="text-sm text-red-700">{error} <button type="button" onClick={onRetry} className="underline">Retry</button></p> : <div className="grid gap-4 md:grid-cols-2">{(['etsy', 'amazon'] as const).map(channel => {
      const linked = records.filter(record => record.productId === product.id && record.channel === channel);
      const refreshable = linked.length === 1 && (channel === 'amazon' || linked[0].sheet === 'etsy-physical');
      return <article key={channel} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2"><h4 className="text-sm font-semibold">{channel === 'etsy' ? 'Etsy' : 'Amazon'}</h4><span className="text-xs text-zinc-400">{linked.length ? `${linked.length} linked ${linked.length === 1 ? 'listing' : 'listings'}` : 'No draft yet'}</span></div>
        {linked.map(record => {
          const media = productListingMediaState(product, record.images);
          return <div key={record.id} className="space-y-3 border-t border-zinc-100 pt-3"><div className="flex flex-wrap items-center gap-2 text-xs"><span className="rounded-md bg-zinc-100 px-2 py-1 text-zinc-700">{record.status}</span><span className="text-zinc-400">{record.sheet === 'etsy-digital' ? 'Digital worksheet' : record.sheet === 'etsy-physical' ? 'Physical worksheet' : 'Amazon worksheet'}</span></div>{(record.remoteListingId || record.asin || record.sku) && <p className="break-all text-xs text-zinc-500">{record.remoteListingId ? `Listing ${record.remoteListingId}` : record.asin ? `ASIN ${record.asin}` : `SKU ${record.sku}`}</p>}<p className={`text-xs ${media === 'changed' ? 'text-amber-700' : media === 'current' ? 'text-emerald-700' : 'text-zinc-500'}`}>{media === 'current' ? 'Draft images are up to date' : media === 'changed' ? 'Product images have changed' : media === 'not-ready' ? 'Generate and save mockups before updating images' : 'Image comparison unavailable'}</p><div className="flex flex-wrap gap-2"><button type="button" disabled={busy} className={action} onClick={() => onOpen(record)}>Open {record.remoteListingId || record.asin ? 'listing' : 'draft'}</button>{refreshable && media !== 'current' && <button type="button" disabled={busy || product.renderState !== 'ready'} className={action} onClick={() => onPrepare(channel)}>Update draft images</button>}</div></div>;
        })}
        {channel === 'etsy' && !linked.length && <div><label className="block text-xs text-zinc-500">Listing preset<select aria-label="Etsy listing preset" className="mt-1.5 block w-full rounded-lg border border-zinc-200 bg-white p-2 text-xs text-zinc-700" value={presetId} onChange={event => onPresetChange(event.target.value)}><option value="">Choose a preset</option>{presets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select></label>{!presets.length && <div className="mt-2 space-y-2 text-xs leading-5 text-zinc-500"><p>The physical worksheet shows a starter preset for editing. Save it before creating a product draft.</p><button type="button" className="font-medium text-blue-700 underline" onClick={onSetupEtsyPreset}>Open physical listing presets →</button></div>}</div>}
        {!linked.length && <button type="button" disabled={busy || product.renderState !== 'ready' || (channel === 'etsy' && !presetId)} className={action} onClick={() => onPrepare(channel)}>Create draft</button>}
        {!linked.length && product.renderState !== 'ready' && <p className="text-xs text-zinc-500">Generate mockups in Artwork &amp; Mockups first.</p>}
        {linked.length > 1 && <p className="text-xs leading-5 text-zinc-500">Open the specific listing to manage its images.</p>}
      </article>;
    })}</div>}
    <p className="text-xs leading-5 text-zinc-400">Image updates preserve listing text and pricing. Publishing and marketplace updates happen in the channel worksheet. Videos remain in the product download; channel video upload is not connected.</p>
  </section>;
}
