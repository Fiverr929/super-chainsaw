import { loadImage } from './mask-test/canvasAlpha';

/** Level the flat background and enlarge artwork that the model left small on its canvas. */
export async function prepareFlatDesign(source: string): Promise<string> {
  const image = await loadImage(source);
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height) throw new Error('The extracted design image is empty.');
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas is unavailable.');
  context.drawImage(image, 0, 0);
  const imageData = context.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  const channels: number[][] = [[], [], []];
  const sample = (x: number, y: number) => {
    const index = (y * width + x) * 4;
    if (pixels[index + 3] < 250) return;
    for (let channel = 0; channel < 3; channel++) channels[channel].push(pixels[index + channel]);
  };
  for (let x = 0; x < width; x++) { sample(x, 0); sample(x, height - 1); }
  for (let y = 1; y < height - 1; y++) { sample(0, y); sample(width - 1, y); }
  if (!channels[0].length) throw new Error('The model returned a transparent background. Regenerate to extract onto a solid shirt-colored background.');
  const color = channels.map(values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]);
  // Level minor generation/compression noise in the solid base color.
  // This changes RGB only: it does not create a mask or remove any background.
  for (let index = 0; index < pixels.length; index += 4) {
    if (Math.max(Math.abs(pixels[index] - color[0]), Math.abs(pixels[index + 1] - color[1]), Math.abs(pixels[index + 2] - color[2])) > 8) continue;
    for (let channel = 0; channel < 3; channel++) pixels[index + channel] = color[channel];
  }
  context.putImageData(imageData, 0, 0);
  context.globalCompositeOperation = 'destination-over';
  context.fillStyle = 'rgb(' + color.join(',') + ')';
  context.fillRect(0, 0, width, height);
  const rowCounts = new Uint32Array(height);
  const columnCounts = new Uint32Array(width);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = (y * width + x) * 4;
    if (Math.max(Math.abs(pixels[index] - color[0]), Math.abs(pixels[index + 1] - color[1]), Math.abs(pixels[index + 2] - color[2])) < 28) continue;
    rowCounts[y]++;
    columnCounts[x]++;
  }
  const rowFloor = Math.max(2, Math.floor(width * 0.003));
  const columnFloor = Math.max(2, Math.floor(height * 0.003));
  const first = (counts: Uint32Array, floor: number) => counts.findIndex(count => count >= floor);
  const last = (counts: Uint32Array, floor: number) => {
    for (let index = counts.length - 1; index >= 0; index--) if (counts[index] >= floor) return index;
    return -1;
  };
  const left = first(columnCounts, columnFloor);
  const right = last(columnCounts, columnFloor);
  const top = first(rowCounts, rowFloor);
  const bottom = last(rowCounts, rowFloor);
  if (left >= 0 && top >= 0 && right > left && bottom > top) {
    const artworkWidth = right - left + 1;
    const artworkHeight = bottom - top + 1;
    const scale = Math.min(width * 0.88 / artworkWidth, height * 0.88 / artworkHeight);
    if (scale > 1.15) {
      const normalized = document.createElement('canvas');
      normalized.width = width;
      normalized.height = height;
      const target = normalized.getContext('2d');
      if (!target) throw new Error('Canvas is unavailable.');
      target.fillStyle = context.fillStyle;
      target.fillRect(0, 0, width, height);
      const insetX = Math.max(2, Math.floor(artworkWidth * 0.025));
      const insetY = Math.max(2, Math.floor(artworkHeight * 0.025));
      const cropLeft = Math.max(0, left - insetX);
      const cropTop = Math.max(0, top - insetY);
      const cropWidth = Math.min(width - cropLeft, artworkWidth + insetX * 2);
      const cropHeight = Math.min(height - cropTop, artworkHeight + insetY * 2);
      const fittedScale = Math.min(width * 0.94 / cropWidth, height * 0.94 / cropHeight);
      const drawWidth = cropWidth * fittedScale;
      const drawHeight = cropHeight * fittedScale;
      target.drawImage(canvas, cropLeft, cropTop, cropWidth, cropHeight, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
      return normalized.toDataURL('image/png');
    }
  }
  return canvas.toDataURL('image/png');
}
