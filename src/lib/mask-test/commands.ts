export type EdgeMode = 'balanced' | 'strict' | 'soft' | 'max';

type ColorTarget = {
  mode: 'color' | 'auto';
  color?: [number, number, number];
  colorName?: string;
  edgeMode: EdgeMode;
};

export type BgCommand = ColorTarget & { kind: 'bg'; inside: boolean };
export type ColorCommand = ColorTarget & { kind: 'color' };
