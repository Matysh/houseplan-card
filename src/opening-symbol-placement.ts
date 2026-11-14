import type { OpeningCfg } from './types';
import { gridVisualUnits } from './grid-scale';

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

export type OpeningLeafPresentation = 'flat' | 'iso-volume';

/** Ground-plane origin of the actual leaf, independent of camera and state.
 * Flat swing symbols retain #250's axis; sliding and volumetric leaves use
 * the already-resolved host face. This never moves saved opening geometry. */
export function openingLeafOriginOffset(type: OpeningCfg['type'],
  face: Pick<OpeningFaceOffset, 'ox' | 'oy'>,
  presentation: OpeningLeafPresentation = 'flat', sliding = false): OpeningSymbolOffset {
  return (type === 'door' || type === 'gate') && (sliding || presentation === 'iso-volume')
    ? { ox: face.ox, oy: face.oy } : { ox: 0, oy: 0 };
}

/** One physical slide placement for plan symbols and print geometry. */
export function openingSlidePlacement(angle: number, length: number, direction: 'start' | 'end',
  amount: number, face: Pick<OpeningFaceOffset, 'ox' | 'oy'>): { x: number; y: number; shift: number } {
  const radians = angle * Math.PI / 180;
  const origin = openingLeafOriginOffset('door', face, 'flat', true);
  return { x: origin.ox * Math.cos(radians) + origin.oy * Math.sin(radians),
    y: -origin.ox * Math.sin(radians) + origin.oy * Math.cos(radians),
    shift: (direction === 'end' ? 1 : -1) * length * Math.max(0, Math.min(1, amount)) };
}

export interface OpeningLockAnchorInput {
  x: number;
  y: number;
  angle: number;
  flipV: boolean;
  gateFace?: Pick<OpeningFaceOffset, 'side'> | null;
}

export type OpeningLockFloorPlacement = [
  floorAnchor: [number, number],
  negativeSide: boolean,
];

/**
 * Resolve only the visible symbol translation. Every opening symbol stays on
 * the saved wall centreline: wall-face direction/depth and flip direction are
 * separate inputs and must never move its origin (#250).
 */
export function openingSymbolOffset(
  type: OpeningCfg['type'],
  _flipV: boolean,
  _angle: number,
  face: Pick<OpeningFaceOffset, 'ox' | 'oy'>,
): OpeningSymbolOffset {
  return openingLeafOriginOffset(type, face);
}

/** One Flat/Iso authority for an opening lock's immutable floor placement. */
export function openingLockFloorPlacement(
  opening: OpeningLockAnchorInput, cellCm: number,
): OpeningLockFloorPlacement {
  const rad = ((opening.angle + 90) * Math.PI) / 180;
  const lockOffset = gridVisualUnits(16, cellCm);
  const offset = opening.gateFace
    ? -lockOffset * opening.gateFace.side
    : lockOffset * (opening.flipV ? -1 : 1);
  return [
    [
      opening.x + Math.cos(rad) * offset,
      opening.y + Math.sin(rad) * offset,
    ],
    offset < 0,
  ];
}
