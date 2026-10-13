export type MaskResult = {
  rawMaskUrl: string;
  outputUrl: string;
  width: number;
  height: number;
  source: 'local-bg' | 'color';
  sourceLabel: string;
  notes: string[];
};

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load the uploaded image.'));
    image.src = src;
  });
}
