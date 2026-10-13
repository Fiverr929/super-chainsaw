export type ArtworkPlacement = { x: number; y: number; scale: number; rotation?: number; fit?: 'contain' | 'cover' };
export type FitPosition = 'top' | 'center' | 'bottom' | 'left' | 'right';
export type Rect = { x: number; y: number; width: number; height: number };

export function visiblePixelBounds(data: Uint8ClampedArray, width: number, height: number, alphaThreshold = 16): Rect {
  if (width <= 0 || height <= 0 || data.length !== width * height * 4) return { x: 0, y: 0, width: Math.max(0, width), height: Math.max(0, height) };
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4 + 3] < alphaThreshold) continue;
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  return right < left || bottom < top ? { x: 0, y: 0, width, height } : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

const clamp = (value: number, min: number, max: number) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;

export function normalizeArtwork(value?: Partial<ArtworkPlacement>): ArtworkPlacement {
  const rotation = clamp(value?.rotation ?? 0, -180, 180);
  return { x: clamp(value?.x ?? 50, 0, 100), y: clamp(value?.y ?? 50, 0, 100), scale: clamp(value?.scale ?? 100, 10, 100), ...(rotation ? { rotation } : {}), ...(value?.fit === 'cover' ? { fit: 'cover' as const } : {}) };
}

export function fitArtwork(position: FitPosition): ArtworkPlacement {
  return { x: position === 'left' ? 0 : position === 'right' ? 100 : 50, y: position === 'top' ? 0 : position === 'bottom' ? 100 : 50, scale: 100 };
}

export function artworkRect(sourceWidth: number, sourceHeight: number, region: Rect, settings?: Partial<ArtworkPlacement>): Rect {
  if (sourceWidth <= 0 || sourceHeight <= 0 || region.width <= 0 || region.height <= 0) return { x: region.x, y: region.y, width: 0, height: 0 };
  const placement = normalizeArtwork(settings);
  const fit = (placement.fit === 'cover' ? Math.max : Math.min)(region.width / sourceWidth, region.height / sourceHeight) * placement.scale / 100;
  const width = sourceWidth * fit;
  const height = sourceHeight * fit;
  return { x: region.x + (region.width - width) * placement.x / 100, y: region.y + (region.height - height) * placement.y / 100, width, height };
}

export function dragArtwork(start: ArtworkPlacement, deltaX: number, deltaY: number, availableX: number, availableY: number): ArtworkPlacement {
  return normalizeArtwork({ ...start, x: Math.abs(availableX) > 0.0001 ? start.x + deltaX / availableX * 100 : start.x, y: Math.abs(availableY) > 0.0001 ? start.y + deltaY / availableY * 100 : start.y });
}

/** Positions are relative to the mapped print area; pocket is wearer-left (image-right). */
export const ARTWORK_PRESETS = {
  'top-center': { label: 'Top center · Full size', placement: { x: 50, y: 0, scale: 100 } },
  pocket: { label: 'Pocket · Small', placement: { x: 90, y: 8, scale: 35 } },
} satisfies Record<string, { label: string; placement: ArtworkPlacement }>;
export type ArtworkPresetId = keyof typeof ARTWORK_PRESETS;

export function presetArtwork(id: ArtworkPresetId): ArtworkPlacement {
  return { ...ARTWORK_PRESETS[id].placement };
}


export type ArtworkResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/** Resize from an edge/corner while preserving aspect ratio and the opposite anchor. */
export function resizeArtwork(start: ArtworkPlacement, rect: Rect, region: Rect, handle: ArtworkResizeHandle, dx: number, dy: number): ArtworkPlacement {
  if (rect.width <= 0 || rect.height <= 0) return normalizeArtwork(start);
  const sx = handle.includes('e') ? 1 : handle.includes('w') ? -1 : 0;
  const sy = handle.includes('s') ? 1 : handle.includes('n') ? -1 : 0;
  const ratio = sx && sy
    ? 1 + (sx * dx * rect.width + sy * dy * rect.height) / (rect.width ** 2 + rect.height ** 2)
    : sx ? 1 + sx * dx / rect.width : 1 + sy * dy / rect.height;
  const scale = clamp(start.scale * ratio, 10, 100);
  const width = rect.width * scale / start.scale;
  const height = rect.height * scale / start.scale;
  const x = rect.x + (sx < 0 ? rect.width - width : sx === 0 ? (rect.width - width) / 2 : 0);
  const y = rect.y + (sy < 0 ? rect.height - height : sy === 0 ? (rect.height - height) / 2 : 0);
  const slackX = region.width - width;
  const slackY = region.height - height;
  return normalizeArtwork({ ...start, scale,
    x: Math.abs(slackX) > 0.0001 ? (x - region.x) / slackX * 100 : 50,
    y: Math.abs(slackY) > 0.0001 ? (y - region.y) / slackY * 100 : 50,
  });
}
