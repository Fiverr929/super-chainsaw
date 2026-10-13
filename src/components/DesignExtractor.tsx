"use client";

import { useEffect, useState } from 'react';
import BulkBackgroundRemover from './BulkBackgroundRemover';
import ImagePresetManagerModal, { DEFAULT_IMAGE_PRESET, type ImagePreset } from './ImagePresetManagerModal';
import type { PreparedArtwork } from '@/lib/workspaceArtwork';

export default function DesignExtractor({ onCreateProduct, incomingAsset }: { onCreateProduct?: (artworks: PreparedArtwork[]) => void; incomingAsset?: { url: string; name: string; requestId?: string } | null } = {}) {
  const [defaultPreset, setDefaultPreset] = useState<ImagePreset>(DEFAULT_IMAGE_PRESET);
  const [showPresets, setShowPresets] = useState(false);

  useEffect(() => {
    const savedPresets = localStorage.getItem('workstation_image_presets');
    const defaultId = localStorage.getItem('workstation_default_image_preset') || DEFAULT_IMAGE_PRESET.id;
    if (!savedPresets) return;
    try {
      const parsed: unknown = JSON.parse(savedPresets);
      if (!Array.isArray(parsed)) return;
      const active = (parsed as ImagePreset[]).find(preset => preset.id === defaultId);
      if (active) setDefaultPreset(active);
    } catch {
      // Keep the built-in preset if saved settings cannot be read.
    }
  }, []);

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-white">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2.5">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-zinc-900">Design</h2>
          <p className="text-xs text-zinc-500">Make transparent artwork from photos or design files.</p>
        </div>
      </div>

      <BulkBackgroundRemover incomingAsset={incomingAsset} preset={defaultPreset} onOpenPresets={() => setShowPresets(true)} onContinue={artworks => onCreateProduct?.(artworks)} />

      {showPresets && (
        <ImagePresetManagerModal
          onClose={() => setShowPresets(false)}
          onSelectDefault={preset => setDefaultPreset(preset)}
        />
      )}
    </div>
  );
}
