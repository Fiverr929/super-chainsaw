import { loadImage } from './mask-test/canvasAlpha';
import { removeEdgeBackground } from './mask-test/localBg';
import type { EdgeMode } from './mask-test/commands';
import { removeSolidDesignBackground } from './solidDesignCutout';

async function hasTransparency(source: string): Promise<boolean> {
  const image = await loadImage(source);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas is unavailable.');
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let index = 3; index < pixels.length; index += 64) {
    if (pixels[index] < 250) return true;
  }
  return false;
}

export async function prepareDesignCutout(source: string, edgeMode: EdgeMode = 'soft', inside = true) {
  const alreadyTransparent = await hasTransparency(source);
  const flatCutout = alreadyTransparent ? null : await removeSolidDesignBackground(source, edgeMode);
  const output = alreadyTransparent ? source : flatCutout || (await removeEdgeBackground(source, false, {
    kind: 'bg', mode: 'auto', edgeMode, inside,
  }, '/bg auto')).outputUrl;
  return { output, alreadyTransparent };
}
