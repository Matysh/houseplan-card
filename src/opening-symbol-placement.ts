import type { OpeningCfg } from './types';

export interface OpeningFaceOffset {
  ox: number;
  oy: number;
  cm: number;
  side: -1 | 1;
}

export interface OpeningSymbolOffset {
  ox: number;
  oy: number;
}

/**
 * Resolve only the visible symbol translation. Every opening symbol stays on
 * the saved wall centreline: wall-face direction/depth and flip direction are
 * separate inputs and must never move its origin (#250).
 */
export function openingSymbolOffset(
  _type: OpeningCfg['type'],
  _flipV: boolean,
  _angle: number,
  _face: Pick<OpeningFaceOffset, 'ox' | 'oy'>,
): OpeningSymbolOffset {
  return { ox: 0, oy: 0 };
}
