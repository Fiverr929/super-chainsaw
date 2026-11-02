'use client';

import { useState } from 'react';
import { Copy, ExternalLink } from 'lucide-react';
import type { ListingAssetFolder } from '@/lib/workspaceAssets';

/** Imported reference data only. Channel copy is owned by its worksheet. */
export default function SourceListingDetails({ folder, showSourceLink = true }: { folder: ListingAssetFolder; showSourceLink?: boolean }) {
  const [copyStatus, setCopyStatus] = useState('');
  const [expanded, setExpanded] = useState(false);
  const details = folder.details;
  const description = details?.description?.trim() || '';
  const canExpand = description.length > 300 || description.split('\n').length > 5;
  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus(`${label} copied`);
    } catch { setCopyStatus('Could not copy. Select the text to copy it manually.'); }
  };
  const copyButton = (label: string, value: string) => <button type="button" aria-label={`Copy ${label.toLowerCase()}`} onClick={() => void copy(label, value)} className="inline-flex shrink-0 items-center gap-1.5 text-xs text-zinc-400 hover:text-indigo-700"><Copy size={13} />Copy</button>;

  return <section aria-label="Source listing information" className="min-w-0 overflow-hidden rounded-xl border border-zinc-200 bg-white">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-5 py-3"><h3 className="text-sm font-semibold">Listing information</h3><span className="text-[11px] text-zinc-400">Source reference</span></div>
    <div className="divide-y divide-zinc-100 px-5">
      <section className="py-4"><div className="mb-2 flex items-center justify-between gap-3"><h4 className="text-xs font-medium text-zinc-500">Title</h4>{copyButton('Title', folder.title)}</div><p className="break-words text-sm font-medium leading-6 text-zinc-800">{folder.title}</p></section>
      <section className="py-4"><div className="mb-2 flex items-center justify-between gap-3"><h4 className="text-xs font-medium text-zinc-500">Description</h4>{description && copyButton('Description', details!.description)}</div>{description ? <><p className={`whitespace-pre-wrap break-words text-sm leading-6 text-zinc-600 ${!expanded && canExpand ? 'line-clamp-5' : ''}`}>{description}</p>{canExpand && <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} className="mt-2 text-xs font-medium text-indigo-700 hover:underline">{expanded ? 'Show less' : 'Read full description'}</button>}</> : <p className="text-sm text-zinc-400">No description saved.</p>}</section>
      <section className="py-4"><div className="mb-3 flex items-center justify-between gap-3"><h4 className="text-xs font-medium text-zinc-500">Tags <span className="ml-1 text-zinc-400">{details?.tags?.length || 0}</span></h4>{!!details?.tags?.length && copyButton('Tags', details.tags.join(', '))}</div>{details?.tags?.length ? <ul className="flex flex-wrap gap-1.5">{details.tags.map((tag, index) => <li key={`${tag}-${index}`} className="max-w-full break-words rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600">{tag}</li>)}</ul> : <p className="text-sm text-zinc-400">No tags saved.</p>}</section>
      {!!details?.materials?.length && <section className="py-4"><h4 className="text-xs font-medium text-zinc-500">Source materials</h4><p className="mt-2 break-words text-sm text-zinc-600">{details.materials.join(', ')}</p></section>}
    </div>
    <div className="border-t border-zinc-100 bg-zinc-50/60 px-5 py-3"><p className="text-[11px] leading-5 text-zinc-500">Imported reference only. Your product and channel listing details are managed separately.</p>{(!description || !details?.tags?.length) && <p className="mt-1 text-[11px] leading-5 text-amber-700">Missing information? Ask Agent to fetch this Etsy listing, then refresh Assets.</p>}{showSourceLink && <a href={folder.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-700 hover:underline">Original Etsy listing <ExternalLink size={12} /></a>}<p role="status" className={copyStatus ? 'mt-2 text-xs text-zinc-600' : 'sr-only'}>{copyStatus}</p></div>
  </section>;
}
