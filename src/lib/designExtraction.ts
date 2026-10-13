export const DEFAULT_IMAGE_MODEL = 'gemini-3.1-flash-image';
export const DEFAULT_IMAGE_QUALITY = '2K';

export const IMAGE_MODEL_OPTIONS = [
  { id: 'gemini-3.1-flash-lite-image', label: 'Nano Banana 2 Lite', qualities: ['1K'] },
  { id: 'gemini-3.1-flash-image', label: 'Nano Banana 2', qualities: ['1K', '2K', '4K'] },
  { id: 'gemini-3-pro-image', label: 'Nano Banana Pro', qualities: ['1K', '2K', '4K'] },
] as const;

export type ImageModelId = typeof IMAGE_MODEL_OPTIONS[number]['id'];
export type ImageQuality = '1K' | '2K' | '4K';

export function imageQualityForModel(model: ImageModelId, requested?: string | null): ImageQuality {
  const option = IMAGE_MODEL_OPTIONS.find(item => item.id === model)!;
  if (option.qualities.some(quality => quality === requested)) return requested as ImageQuality;
  return option.qualities.some(quality => quality === DEFAULT_IMAGE_QUALITY) ? DEFAULT_IMAGE_QUALITY : '1K';
}

export type ImageResponsePart = {
  thought?: boolean;
  text?: string;
  inlineData?: { data?: string; mimeType?: string };
};

/** Intermediate reasoning images are not finished extraction results. */
export function finalGeneratedImage(parts: ImageResponsePart[]) {
  for (const part of parts) {
    if (!part.thought && part.inlineData?.data && (!part.inlineData.mimeType || part.inlineData.mimeType.startsWith('image/'))) {
      return { data: part.inlineData.data, mimeType: part.inlineData.mimeType || 'image/png' };
    }
  }
}

export const DETAIL_ANALYSIS_PROMPT = [
  'Inspect the supplied product photo. Return only JSON with keys "details" (string) and "bounds" (object with x, y, width, height as integers from 0 to 1000 relative to the full image).',
  'The bounds must tightly enclose ALL printed artwork, including small lettering and separate symbols, but exclude the garment and seller captions outside the print.',
  'In details, describe the printed artwork: composition, subjects, illustration style, palette, texture, shapes, and positions. Identify any overlaid seller watermark separately, including its position and appearance, so it can be removed rather than copied into the print.',
  'Transcribe lettering only when each character is confidently readable. Otherwise say "illegible lettering" without guessing.',
  'Distinguish a person portrayed in the printed artwork from a person wearing or holding the product.',
  'Also describe the base garment color immediately behind the print, including an approximate hex color, separately from the ink colors. Ignore folds and lighting when estimating it. Exclude the garment shape, model, room, and photographic background. Distinguish intended lettering in the design from repeated, translucent, diagonal, or banner-like seller watermarks laid over it.',
  'Keep the brief factual and concise. Do not suggest new artwork or embellishments.',
].join(' ');

export const DEFAULT_EXTRACTION_PROMPT = [
  'The attached image is a close reference crop of the artwork printed on a product.',
  'Create a new, flat, front-facing image of that printed artwork alone, flattening the printed area into a rectangular artwork image.',
  'The artwork must fill most of the output canvas with a small even margin. Do not keep its small size or placement from the product photo.',
  'Use one completely uniform, opaque background matching the base garment color outside the printed composition. For a pepper-gray shirt, use solid pepper gray in unprinted areas. Preserve intentional printed backdrops, glows, shadows, distressed texture, and interior color fields as part of the artwork; do not flatten them into the shirt color. Remove fabric weave, folds, lighting gradients, garment outline, props, and the surrounding photo scene. Preserve actual ink colors, including white lettering. Do not add transparency or a checkerboard.',
  'Prioritize faithful reconstruction of the reference pixels: preserve the subject identity, facial features, composition, lettering, colors, texture, and proportions. Do not beautify, redesign, or invent tiny text. If lettering cannot be read, reproduce its visual shape without making up words.',
  'Remove any watermark already present in the reference, including translucent text, repeated logos, diagonal marks, and opaque seller banners crossing the design. Reconstruct the artwork and shirt-colored background naturally under those marks. Keep lettering that belongs to the actual design. Do not reproduce watermark letters, shapes, shadows, or partial fragments.',
].join(' ');

export const WATERMARK_REMOVAL_PROMPT = 'Treat seller watermarks and overlay banners in the reference as obstructions, not printed artwork. Remove them completely and reconstruct the obscured design consistently with the visible surroundings. Preserve genuine design text and graphics.';
