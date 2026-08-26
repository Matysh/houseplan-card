/**
 * Canonical zero-thickness wall policy (issue #306).
 *
 * Geometry answers whether a segment has a body (`cm > 0`).  The one
 * space-level style answers both how bodyless walls are drawn and whether
 * their centre lines stop light.  Keeping those decisions together prevents
 * Glow, sun and the renderers from inventing subtly different meanings.
 */

import type { RoomCfg, SpaceModel, WallSegmentEntry, ZeroWallStyle } from './types';
import { resolveOpenCuts, sanitizeOpenSpans } from './open-spans';

export interface ZeroWallResolution {
  style: ZeroWallStyle;
  /** Every bodyless wall axis in render coordinates, including independent walls. */
  lines: number[][];
  /** Contour-only bodyless axes. These are also the physical-body cuts. */
  contour: number[][];
  /** Axes which stop Glow and sun. */
  barriers: number[][];
  /** Shared contour axes through which the visibility field can propagate. */
  transmissive: number[][];
}

const finitePoint = (value: unknown): value is number[] => (
  Array.isArray(value) && value.length >= 2
  && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]))
);

const segment = (a: number[], b: number[], scale: number): number[] => [
  Number(a[0]) * scale, Number(a[1]) * scale,
  Number(b[0]) * scale, Number(b[1]) * scale,
];

const keyOf = (line: readonly number[]): string => {
  const a = `${Number(line[0]).toFixed(9)},${Number(line[1]).toFixed(9)}`;
  const b = `${Number(line[2]).toFixed(9)},${Number(line[3]).toFixed(9)}`;
  return a <= b ? `${a}|${b}` : `${b}|${a}`;
};

const unique = (lines: readonly number[][][]): number[][] => {
  const byKey = new Map<string, number[]>();
  for (const line of lines.flat()) {
    if (!Array.isArray(line) || line.length < 4 || !line.every(Number.isFinite)) continue;
    if (Math.hypot(line[2] - line[0], line[3] - line[1]) <= 1e-9) continue;
    byKey.set(keyOf(line), [...line]);
  }
  return [...byKey.values()];
};

/** Missing and future values deliberately keep the migration default. */
export function zeroWallStyleOf(space: any): ZeroWallStyle {
  return space?.zero_wall_style === 'solid' ? 'solid' : 'dashed';
}

/** Canonical contour atoms only; `scale=1000` projects stored config to render units. */
export function zeroContourLines(
  space: any, scale = 1, referencedIds?: ReadonlySet<string>,
): number[][] {
  const result: number[][] = [];
  for (const wall of Array.isArray(space?.wall_segments) ? space.wall_segments : []) {
    if (Number(wall?.cm) !== 0 || !finitePoint(wall?.a) || !finitePoint(wall?.b)) continue;
    if (referencedIds && !referencedIds.has(String(wall.id || ''))) continue;
    result.push(segment(wall.a, wall.b, scale));
  }
  return unique([result]);
}

/** Bodyless independent walls and unfinished contour segments. */
export function zeroIndependentLines(space: any, scale = 1): number[][] {
  const result: number[][] = [];
  for (const wall of Array.isArray(space?.partitions) ? space.partitions : []) {
    if (Number(wall?.cm) !== 0 || !finitePoint(wall?.a) || !finitePoint(wall?.b)) continue;
    result.push(segment(wall.a, wall.b, scale));
  }
  for (const draft of Array.isArray(space?.room_drafts) ? space.room_drafts : []) {
    const points = Array.isArray(draft?.points) ? draft.points : [];
    for (let index = 0; index + 1 < points.length; index++) {
      if (Number(draft?.segments?.[index]?.cm) !== 0
          || !finitePoint(points[index]) || !finitePoint(points[index + 1])) continue;
      result.push(segment(points[index], points[index + 1], scale));
    }
  }
  return unique([result]);
}

/**
 * Compatibility projection for a read-only v8 document.  Explicit spans win;
 * only their absence enables the old `rooms[].open_to` fallback.  The result
 * is never persisted by this resolver.
 */
export function legacyZeroContourLines(
  spaceConfig: any,
  roomsModel: readonly RoomCfg[],
  coordScale: number,
  epsilon: number,
): number[][] {
  if (!spaceConfig) return [];
  const spans = sanitizeOpenSpans(spaceConfig.open_spans);
  return resolveOpenCuts(
    roomsModel as any[], spans.length ? spans : null,
    coordScale, epsilon, true,
  );
}

/** One answer consumed by flat/isometric rendering, Glow and sun. */
export function resolveZeroWalls(
  spaceConfig: any,
  spaceModel: Pick<SpaceModel, 'rooms' | 'wall_segments' | 'partitions' | 'room_drafts'>,
  coordScale: number,
  epsilon: number,
): ZeroWallResolution {
  const style = zeroWallStyleOf(spaceConfig);
  const referencedIds = new Set<string>();
  for (const room of spaceModel.rooms || []) {
    for (const id of Array.isArray(room.wall_ids) ? room.wall_ids : []) {
      if (typeof id === 'string' && id) referencedIds.add(id);
    }
  }
  const contour = unique([
    zeroContourLines(spaceModel, 1, referencedIds.size ? referencedIds : undefined),
    legacyZeroContourLines(spaceConfig, spaceModel.rooms, coordScale, epsilon),
  ]);
  const lines = unique([contour, zeroIndependentLines(spaceModel, 1)]);
  return {
    style,
    lines,
    contour,
    barriers: style === 'solid' ? lines : [],
    transmissive: style === 'dashed' ? contour : [],
  };
}

/** Exact persisted host check used before a positive wall becomes bodyless. */
export function zeroWallHasOpening(
  openings: readonly any[] | null | undefined,
  host: { kind: 'wall' | 'partition'; id: string },
): boolean {
  return (openings || []).some((opening) => (
    opening?.host?.kind === host.kind && opening.host.id === host.id
  ));
}

/** Type-only assertion used by tests and import adapters. */
export const isZeroWallSegment = (wall: WallSegmentEntry): boolean => Number(wall.cm) === 0;
