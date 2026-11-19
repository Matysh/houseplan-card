import type { OpeningCfg, SwingDoorPosition } from './types';
import { motionOpeningFeatures } from './opening-features';
import type { ResolvedPartitionOpening } from './partition-openings';
import { openingWallFaceHalfDepth, type OpeningWallIndex } from './wall-thickness';
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

/** Existing slide, gate and optical origins. The closed-door barrier keeps
 * its Flat axis and room-relative 2.5D face when swing paint moves. */
export function openingLeafOriginOffset(type: OpeningCfg['type'],
  face: Pick<OpeningFaceOffset, 'ox' | 'oy'>,
  presentation: OpeningLeafPresentation = 'flat', sliding = false): OpeningSymbolOffset {
  return (type === 'door' || type === 'gate') && (sliding || presentation === 'iso-volume')
    ? { ox: face.ox, oy: face.oy } : { ox: 0, oy: 0 };
}

export function swingDoorPosition(value: unknown): value is SwingDoorPosition {
  return value === 'negative' || value === 'positive' || value === 'center' || value === 'auto';
}

export function swingDoorPositionInBasis(position: SwingDoorPosition | undefined,
  fromAngle: number, toAngle: number): SwingDoorPosition | undefined {
  if ((position === 'negative' || position === 'positive')
      && Math.cos((toAngle - fromAngle) * Math.PI / 180) < 0) {
    return position === 'negative' ? 'positive' : 'negative';
  }
  return position;
}

export function effectiveSwingDoorPosition(
  opening: Pick<OpeningCfg, 'type' | 'opening_features' | 'swing_position'>,
): SwingDoorPosition | undefined {
  return opening.type === 'door' && motionOpeningFeatures(opening)?.mechanism !== 'slide'
    ? opening.swing_position ?? 'auto' : undefined;
}

/** Drawing-only, signed distance along the normal of the rendered axis. */
export function openingSwingDepth(
  opening: Pick<OpeningCfg, 'type' | 'opening_features' | 'swing_position' | 'angle' | 'flip_v'> & {
    rx: number; ry: number; rlen: number; partitionHost?: ResolvedPartitionOpening;
  },
  index: OpeningWallIndex | null | undefined,
): number | undefined {
  const position = effectiveSwingDoorPosition(opening);
  if (position === undefined) return undefined;
  if (position === 'center') return 0;
  const side = position === 'auto' ? (opening.flip_v ? 1 : -1)
    : position === 'positive' ? 1 : -1;
  const half = opening.partitionHost ? opening.partitionHost.depth / 2
    : index ? openingWallFaceHalfDepth(index, {
      x: opening.rx, y: opening.ry, angle: opening.angle, length: opening.rlen,
    }, side) : 0;
  return half > 0 ? half * side : 0;
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
