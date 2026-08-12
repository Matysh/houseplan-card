import type { WallInterval } from './wall-thickness';

export type OpeningPlacementType = 'window' | 'door' | 'gate';

export interface OpeningPlacementPreset {
  type: OpeningPlacementType;
  lengthCm: number;
  flipH: boolean;
  flipV: boolean;
  revision: number;
}

export interface OpeningPlacementTarget {
  segmentKey: string;
  a: [number, number];
  b: [number, number];
  physicalHalfWidth: number;
  sourceOrder: number;
}

export interface OpeningPlacementMeasureGeometry {
  labels: readonly [
    { distance: number; midpoint: [number, number] },
    { distance: number; midpoint: [number, number] },
  ];
  guide: { x: number; y: number; angle: number } | null;
}

export interface OpeningPlacementCore {
  presetRevision: number;
  geometryRevision: number;
  pointer: [number, number];
  type: OpeningPlacementType;
  lengthCm: number;
  flipH: boolean;
  flipV: boolean;
  x: number;
  y: number;
  angle: number;
  renderedLength: number;
  target: OpeningPlacementTarget;
  measure: OpeningPlacementMeasureGeometry;
}

export interface ResolveOpeningPlacementInput {
  pointer: readonly [number, number];
  preset: OpeningPlacementPreset;
  geometryRevision: number;
  renderedLength: number;
  intervals: readonly WallInterval[];
  baseTolerance: number;
  bodyPointerPadding: number;
  gridStep: number;
}

const DEFAULTS: Record<OpeningPlacementType, number> = {
  window: 120,
  door: 90,
  gate: 300,
};

/** One authority for toolbar presets and dialog type changes. */
export function openingDefaultLengthCm(type: OpeningPlacementType): number {
  return DEFAULTS[type];
}

export function openingPlacementPreset(
  type: OpeningPlacementType,
  revision: number,
): OpeningPlacementPreset {
  return { type, lengthCm: openingDefaultLengthCm(type), flipH: false, flipV: false, revision };
}

function pointOrder(a: readonly number[], b: readonly number[]): number {
  return a[0] - b[0] || a[1] - b[1];
}

function canonicalEnds(a: readonly number[], b: readonly number[]): {
  a: [number, number]; b: [number, number];
} {
  const aa: [number, number] = [a[0], a[1]];
  const bb: [number, number] = [b[0], b[1]];
  return pointOrder(aa, bb) <= 0 ? { a: aa, b: bb } : { a: bb, b: aa };
}

/** WallEntry.key intentionally omits segment length so it can survive some
 * geometry rewrites. Placement identity has a narrower job: only the two
 * room-owned copies of the exact same atomic span may collapse. Include both
 * canonical endpoints so concentric/overlapping spans cannot alias. */
function atomicSegmentKey(a: readonly number[], b: readonly number[]): string {
  const clean = (value: number): string => {
    const rounded = Math.abs(value) <= 5e-10 ? 0 : Math.round(value * 1e6) / 1e6;
    return rounded.toFixed(6);
  };
  return `${clean(a[0])},${clean(a[1])}>${clean(b[0])},${clean(b[1])}`;
}

/**
 * Collapse the two room-owned copies of a shared wall into one transient target.
 * The key is valid only for this derived geometry epoch; it is never persisted
 * into OpeningCfg, whose compatibility contract remains absolute x/y/angle.
 */
export function openingPlacementTargets(
  intervals: readonly WallInterval[],
): OpeningPlacementTarget[] {
  const targets = new Map<string, OpeningPlacementTarget>();
  intervals.forEach((interval, sourceOrder) => {
    if (!interval.kind || interval.open) return;
    const ends = canonicalEnds(interval.a, interval.b);
    if (Math.hypot(ends.b[0] - ends.a[0], ends.b[1] - ends.a[1]) <= 1e-9) return;
    const segmentKey = atomicSegmentKey(ends.a, ends.b);
    const previous = targets.get(segmentKey);
    if (previous) {
      previous.physicalHalfWidth = Math.max(previous.physicalHalfWidth, interval.half || 0);
      previous.sourceOrder = Math.min(previous.sourceOrder, sourceOrder);
      return;
    }
    targets.set(segmentKey, {
      segmentKey,
      a: ends.a,
      b: ends.b,
      physicalHalfWidth: Math.max(0, interval.half || 0),
      sourceOrder,
    });
  });
  return [...targets.values()];
}

/** A thick target's generous body envelope may extend beyond its endpoint.
 * If that endpoint continues as a collinear virtual interval, the virtual
 * centreline owns the longitudinal region and must block placement there. A
 * crossing virtual wall does not block the physical target underneath it. */
function pointerInsideCollinearOpenSpan(
  pointer: readonly [number, number],
  target: OpeningPlacementTarget,
  intervals: readonly WallInterval[],
  envelope: number,
  lineEpsilon: number,
): boolean {
  const tx = target.b[0] - target.a[0], ty = target.b[1] - target.a[1];
  const targetLength = Math.hypot(tx, ty);
  if (!(targetLength > 1e-9)) return false;
  const tux = tx / targetLength, tuy = ty / targetLength;
  for (const interval of intervals) {
    if (!interval.open && interval.kind) continue;
    const ends = canonicalEnds(interval.a, interval.b);
    const dx = ends.b[0] - ends.a[0], dy = ends.b[1] - ends.a[1];
    const length = Math.hypot(dx, dy);
    if (!(length > 1e-9)) continue;
    const ux = dx / length, uy = dy / length;
    if (Math.abs(tux * uy - tuy * ux) > 1e-6) continue;
    const lineOffset = Math.abs(
      (ends.a[0] - target.a[0]) * tuy - (ends.a[1] - target.a[1]) * tux,
    );
    if (lineOffset > lineEpsilon) continue;
    const along = (pointer[0] - ends.a[0]) * ux + (pointer[1] - ends.a[1]) * uy;
    // Only the mathematical endpoint remains available to the adjacent
    // physical segment. Reusing the looser line-collinearity epsilon here
    // would leave a small but real physical hit strip inside the virtual span.
    const endpointEpsilon = 1e-9;
    if (along <= endpointEpsilon || along >= length - endpointEpsilon) continue;
    const perpendicular = Math.abs(
      (pointer[0] - ends.a[0]) * uy - (pointer[1] - ends.a[1]) * ux,
    );
    if (perpendicular <= envelope + 1e-9) return true;
  }
  return false;
}

function projection(
  point: readonly [number, number],
  target: OpeningPlacementTarget,
): { along: number; length: number; x: number; y: number; distance: number; perpendicular: number } {
  const dx = target.b[0] - target.a[0];
  const dy = target.b[1] - target.a[1];
  const length = Math.hypot(dx, dy);
  const ux = dx / length, uy = dy / length;
  const rawAlong = (point[0] - target.a[0]) * ux + (point[1] - target.a[1]) * uy;
  const along = Math.max(0, Math.min(length, rawAlong));
  const x = target.a[0] + along * ux;
  const y = target.a[1] + along * uy;
  return {
    along,
    length,
    x,
    y,
    distance: Math.hypot(point[0] - x, point[1] - y),
    perpendicular: Math.abs((point[0] - target.a[0]) * uy - (point[1] - target.a[1]) * ux),
  };
}

function targetCompare(
  a: { target: OpeningPlacementTarget; distance: number; perpendicular: number },
  b: { target: OpeningPlacementTarget; distance: number; perpendicular: number },
): number {
  const eps = 1e-9;
  if (Math.abs(a.distance - b.distance) > eps) return a.distance - b.distance;
  if (Math.abs(a.perpendicular - b.perpendicular) > eps)
    return a.perpendicular - b.perpendicular;
  const key = a.target.segmentKey < b.target.segmentKey ? -1
    : a.target.segmentKey > b.target.segmentKey ? 1 : 0;
  return key || a.target.sourceOrder - b.target.sourceOrder;
}

/** Pure hover/click resolver. It selects one bounded physical wall interval,
 * projects to its canonical axis and applies the established along-wall grid
 * plus centre magnet. No config, history or renderer cache is mutated. */
export function resolveOpeningPlacement(
  input: ResolveOpeningPlacementInput,
): OpeningPlacementCore | null {
  const targets = openingPlacementTargets(input.intervals);
  const eligible = targets.map((target) => {
    const p = projection(input.pointer, target);
    const envelope = Math.max(
      input.baseTolerance,
      target.physicalHalfWidth + input.bodyPointerPadding,
    );
    return { target, ...p, envelope };
  }).filter((item) => item.distance <= item.envelope + 1e-9)
    .filter((item) => !pointerInsideCollinearOpenSpan(
      input.pointer,
      item.target,
      input.intervals,
      item.envelope,
      Math.max(1e-9, Math.min(input.baseTolerance, input.gridStep * 0.04)),
    ))
    .sort(targetCompare);
  const picked = eligible[0];
  if (!picked) return null;

  const { target, length } = picked;
  const dx = target.b[0] - target.a[0], dy = target.b[1] - target.a[1];
  const ux = dx / length, uy = dy / length;
  const half = Math.min(Math.max(0, input.renderedLength) / 2, length / 2);
  let along = picked.along;
  const grid = Math.max(input.gridStep, 1e-9);
  const wallCenter = length / 2;
  const centered = Math.abs(along - wallCenter) <= grid / 2;
  along = centered ? wallCenter : Math.round(along / grid) * grid;
  along = Math.max(half, Math.min(length - half, along));

  const x = target.a[0] + ux * along;
  const y = target.a[1] + uy * along;
  const openingHalf = Math.max(0, input.renderedLength) / 2;
  const leftEdge = along - openingHalf;
  const rightEdge = along + openingHalf;
  const sideA = Math.max(0, leftEdge);
  const sideB = Math.max(0, length - rightEdge);
  const midpointA: [number, number] = [
    target.a[0] + ux * (leftEdge - sideA / 2),
    target.a[1] + uy * (leftEdge - sideA / 2),
  ];
  const midpointB: [number, number] = [
    target.a[0] + ux * (rightEdge + sideB / 2),
    target.a[1] + uy * (rightEdge + sideB / 2),
  ];
  let angle = Math.atan2(dy, dx) * 180 / Math.PI;
  if (angle >= 90) angle -= 180;
  else if (angle < -90) angle += 180;
  const isCentered = Math.abs(along - wallCenter) <= 1e-9;

  return {
    presetRevision: input.preset.revision,
    geometryRevision: input.geometryRevision,
    pointer: [input.pointer[0], input.pointer[1]],
    type: input.preset.type,
    lengthCm: input.preset.lengthCm,
    flipH: input.preset.flipH,
    flipV: input.preset.flipV,
    x,
    y,
    angle,
    renderedLength: input.renderedLength,
    target,
    measure: {
      labels: [
        { distance: sideA, midpoint: midpointA },
        { distance: sideB, midpoint: midpointB },
      ],
      guide: isCentered ? { x, y, angle } : null,
    },
  };
}

export function sameOpeningPlacementInput(
  candidate: Pick<OpeningPlacementCore, 'presetRevision' | 'geometryRevision' | 'pointer'>,
  pointer: readonly [number, number],
  presetRevision: number,
  geometryRevision: number,
  epsilon = 1e-6,
): boolean {
  return candidate.presetRevision === presetRevision
    && candidate.geometryRevision === geometryRevision
    && Math.hypot(candidate.pointer[0] - pointer[0], candidate.pointer[1] - pointer[1]) <= epsilon;
}
