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
 * Resolve only the visible symbol translation. Wall-face direction and wall
 * depth remain separate inputs: the default symbol is centred, while the
 * saved door/window flip keeps its explicit edge-aligned compatibility mode.
 */
export function openingSymbolOffset(
  type: OpeningCfg['type'],
  flipV: boolean,
  angle: number,
  face: Pick<OpeningFaceOffset, 'ox' | 'oy'>,
): OpeningSymbolOffset {
  if (!flipV || type === 'gate' || type === 'passage') return { ox: 0, oy: 0 };
  const half = Math.hypot(face.ox, face.oy);
  if (!(half > 0) || !Number.isFinite(angle)) return { ox: 0, oy: 0 };
  const rad = angle * Math.PI / 180;
  const ox = -Math.sin(rad) * half;
  const oy = Math.cos(rad) * half;
  return {
    ox: Math.abs(ox) < 1e-12 ? 0 : ox,
    oy: Math.abs(oy) < 1e-12 ? 0 : oy,
  };
}
