'use client';

import { useEffect, useState } from 'react';
import type { ListingAssetFolder } from '@/lib/workspaceAssets';
import SourceListingDetails from './SourceListingDetails';

/** Follow existing product provenance without copying imported text into the product. */
export default function ProductSourceReference({ sourceAssetUrl, initiallyOpen = false }: { sourceAssetUrl: string; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const [result, setResult] = useState<{ folder?: ListingAssetFolder; error?: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch('/api/workspace/assets', { cache: 'no-store', signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load source information.');
        const folders = data.folders as ListingAssetFolder[];
        const folder = folders.find(item => item.images.some(image => image.url === sourceAssetUrl) || item.imports?.some(version => version.images.some(image => image.url === sourceAssetUrl)));
        if (!folder) throw new Error('The imported source record is unavailable.');
        if (!controller.signal.aborted) setResult({ folder });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ error: error instanceof Error ? error.message : 'Could not load source information.' });
      }
    })();
    return () => controller.abort();
  }, [open, sourceAssetUrl, attempt]);

  return <section className="rounded-xl border border-zinc-200 bg-white">
    <button type="button" aria-expanded={open} aria-controls="product-source-reference" onClick={() => { setResult(null); setOpen(value => !value); }} className="flex w-full flex-wrap items-center justify-between gap-2 p-4 text-left"><span><span className="block text-sm font-semibold">Source reference</span><span className="mt-1 block text-xs text-zinc-500">Imported Etsy information behind this product</span></span><span className="text-xs font-medium text-indigo-700">{open ? 'Hide details −' : 'View details +'}</span></button>
    {open && <div id="product-source-reference" className="border-t border-zinc-100 p-4">{!result && <p className="text-xs text-zinc-500">Loading source information…</p>}{result?.error && <div role="alert" className="text-xs text-red-700">{result.error}<button type="button" className="ml-2 underline" onClick={() => { setResult(null); setAttempt(value => value + 1); }}>Retry</button></div>}{result?.folder && <SourceListingDetails key={result.folder.id} folder={result.folder} />}<a href={sourceAssetUrl} target="_blank" rel="noreferrer" className="mt-4 inline-block text-xs text-indigo-700 hover:underline">View original imported image ↗</a></div>}
  </section>;
}
