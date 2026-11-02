"use client";

import { useEffect, useState } from 'react';
import BulkBackgroundRemover from './BulkBackgroundRemover';
import ImagePresetManagerModal, { DEFAULT_IMAGE_PRESET, type ImagePreset } from './ImagePresetManagerModal';
import type { PreparedArtwork } from '@/lib/workspaceArtwork';
import DesignResearch from './DesignResearch';
import type { ResearchOpportunity } from '@/lib/designResearch';

export default function DesignExtractor({ onCreateProduct, incomingAsset }: { onCreateProduct?: (artworks: PreparedArtwork[]) => void; incomingAsset?: { url: string; name: string; requestId?: string } | null } = {}) {
  const [defaultPreset, setDefaultPreset] = useState<ImagePreset>(DEFAULT_IMAGE_PRESET);
  const [showPresets, setShowPresets] = useState(false);
  const [researchDirection, setResearchDirection] = useState<{ id: string; prompt: string; imageUrl: string } | null>(null);

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
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-white px-5 py-4 lg:px-7">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-zinc-900">Design</h2>
          <p className="mt-1 text-xs text-zinc-500">Extract artwork, remove backgrounds, and prepare designs for mockups.</p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-zinc-50">
        <div className="mx-auto w-full max-w-6xl px-4 pt-4 lg:px-6 lg:pt-6"><DesignResearch onChoose={(opportunity: ResearchOpportunity, imageUrl: string) => setResearchDirection({ id: crypto.randomUUID(), prompt: opportunity.designDirection, imageUrl })} /></div>
        <BulkBackgroundRemover incomingAsset={incomingAsset} preset={defaultPreset} researchDirection={researchDirection} onOpenPresets={() => setShowPresets(true)} onContinue={artworks => onCreateProduct?.(artworks)} />
      </div>

      {showPresets && (
        <ImagePresetManagerModal
          onClose={() => setShowPresets(false)}
          onSelectDefault={preset => setDefaultPreset(preset)}
        />
      )}
    </div>
  );
}
