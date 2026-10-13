import type { MockupPreset } from './workspaceProducts';

export const VINTAGE_COLORS = ['Pepper', 'White', 'Ivory', 'Orchid', 'Midnight', 'Denim', 'Black'] as const;
export type VintageColor = typeof VINTAGE_COLORS[number];
export const CC1717_COLORS = ['Pepper', 'White', 'Ivory', 'Orchid', 'Black'] as const;
export type CC1717Color = typeof CC1717_COLORS[number];

/** Two-kilopixel blanks reconstructed from the color, mask, shadow, and highlight layers of VINTAGE Front.xcf. */
export const VINTAGE_FRONT_PRESETS: MockupPreset[] = VINTAGE_COLORS.map(color => ({
  id: `vintage-front-2k-${color.toLowerCase()}`,
  name: `Vintage Front 2K · ${color}`,
  productType: 'T-Shirt',
  color,
  frames: [{
    id: `vintage-front-${color.toLowerCase()}`,
    name: 'Front',
    role: 'Front',
    imageDataUrl: `/mockups/vintage-front-2k/${color.toLowerCase()}.jpg`,
    applyDesign: true,
    placement: {
      x: 33, y: 26, width: 34, height: 48,
      opacity: 96, margin: 0, realism: 18, softness: 1,
      artwork: { x: 50, y: 50, scale: 100 },
    },
  }],
}));

export const isVintageMockupAsset = (value: string) =>
  /^\/mockups\/vintage-(front|back)-2k\/(pepper|white|ivory|orchid|midnight|denim|black)\.jpg$/.test(value);

/** Front and back listing recipe. Both views are sourced from the matching GIMP masters. */
export const CC1717_PRESETS: MockupPreset[] = CC1717_COLORS.map(color => ({
  id: `cc1717-${color.toLowerCase()}`,
  name: `Comfort Colors 1717 · ${color}`,
  productType: 'T-Shirt', brand: 'Comfort Colors', model: '1717', color,
  frames: (['Front', 'Back'] as const).map(role => ({
    id: `cc1717-${role.toLowerCase()}`,
    name: role, role,
    imageDataUrl: `/mockups/vintage-${role.toLowerCase()}-2k/${color.toLowerCase()}.jpg`,
    applyDesign: true,
    placement: {
      x: 33, y: role === 'Front' ? 26 : 23, width: 34, height: role === 'Front' ? 48 : 49,
      opacity: 96, margin: 0, realism: 18, softness: 1,
      artwork: { x: 50, y: 50, scale: 100 },
    },
  })),
}));
