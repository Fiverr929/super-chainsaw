export const OPENROUTER_IMAGE_MODELS = [
  { id: 'openai/gpt-image-2.5-flare', label: 'GPT Image 2.5 Flare', qualities: ['low', 'medium', 'high', 'xhigh', 'max'] },
  { id: 'openai/gpt-image-2.5-sunburst', label: 'GPT Image 2.5 Sunburst', qualities: ['low', 'medium', 'high', 'xhigh', 'max'] },
  { id: 'openai/gpt-image-2', label: 'GPT Image 2', qualities: ['low', 'medium', 'high'] },
] as const;

export const OPENROUTER_IMAGE_ASPECT_RATIOS = ['auto', '1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16'] as const;
export type OpenRouterImageModel = typeof OPENROUTER_IMAGE_MODELS[number]['id'];
export type OpenRouterImageQuality = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
export type OpenRouterImageAspectRatio = typeof OPENROUTER_IMAGE_ASPECT_RATIOS[number];

export const DEFAULT_OPENROUTER_IMAGE_MODEL: OpenRouterImageModel = 'openai/gpt-image-2.5-flare';
export const DEFAULT_OPENROUTER_IMAGE_QUALITY: OpenRouterImageQuality = 'high';
export const DEFAULT_OPENROUTER_IMAGE_ASPECT_RATIO: OpenRouterImageAspectRatio = 'auto';

export function openRouterQualityForModel(model: OpenRouterImageModel, requested: string): OpenRouterImageQuality {
  const option = OPENROUTER_IMAGE_MODELS.find(item => item.id === model)!;
  return option.qualities.some(quality => quality === requested) ? requested as OpenRouterImageQuality : DEFAULT_OPENROUTER_IMAGE_QUALITY;
}
