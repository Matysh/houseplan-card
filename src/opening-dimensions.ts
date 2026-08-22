import type { OpeningPlacementCore } from './opening-placement';
import type { PartitionOpeningCut } from './physical-geometry';
import type { PartitionCfg, WallEntry } from './types';
import {
  insetContour,
  linearWallBody,
  roomWallProfile,
  wallCmToUnits,
  wallEdgeBodies,
  type RoomWallProfile,
} from './wall-thickness';

export type OpeningDimensionSource = 'room-face' | 'connected-face' | 'host-end';

export interface OpeningDimension {
  from: [number, number];
  to: [number, number];
  label: [number, number];
  axis: [number, number];
  labelNormal: [number, number];
  distance: number;
  roomId?: string;
  roomSide?: -1 | 1;
  source: OpeningDimensionSource;
}

interface RoomDimensionGeometry {
  roomId: string;
  profile: RoomWallProfile;
  inner: number[][];
}

interface BoundaryBody {
  body: number[][];
  partitionId?: string;
}

export interface OpeningDimensionContext {
  rooms: RoomDimensionGeometry[];
  boundaries: BoundaryBody[];
  epsilon: number;
}

export interface BuildOpeningDimensionContextInput {
  rooms: any[];
  walls: WallEntry[] | null | undefined;
  openCuts: number[][];
  partitions: readonly PartitionCfg[];
  roomOpenings?: ReadonlyArray<{ x: number; y: number; angle: number; length: number }>;
  partitionCuts?: readonly PartitionOpeningCut[];
  pitch: number;
  cellCm: number;
  gridPitch: number;
  coordScale?: number;
  epsilon?: number;
}

type DimensionCandidate = Pick<
  OpeningPlacementCore,
  'x' | 'y' | 'angle' | 'renderedLength' | 'target' | 'host'
>;

const cross = (a: readonly number[], b: readonly number[]): number =>
  a[0] * b[1] - a[1] * b[0];

const dot = (a: readonly number[], b: readonly number[]): number =>
  a[0] * b[0] + a[1] * b[1];

const sub = (a: readonly number[], b: readonly number[]): [number, number] =>
  [a[0] - b[0], a[1] - b[1]];

const at = (
  origin: readonly number[], direction: readonly number[], distance: number,
): [number, number] => [
  origin[0] + direction[0] * distance,
  origin[1] + direction[1] * distance,
];

function signedArea(poly: readonly number[][]): number {
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  return area / 2;
}

function inwardNormal(poly: readonly number[][], edge: number): [number, number] {
  const a = poly[edge], b = poly[(edge + 1) % poly.length];
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const length = Math.hypot(dx, dy) || 1;
  // Screen coordinates use +Y down. For a clockwise screen-space polygon the
  // mathematical signed area is positive, and the right normal points in.
  return signedArea(poly) >= 0
    ? [-dy / length, dx / length]
    : [dy / length, -dx / length];
}

function candidateBasis(candidate: DimensionCandidate): {
  center: [number, number];
  axis: [number, number];
  normal: [number, number];
  half: number;
  targetLo: number;
  targetHi: number;
} {
  const rad = candidate.angle * Math.PI / 180;
  const axis: [number, number] = [Math.cos(rad), Math.sin(rad)];
  const normal: [number, number] = [-axis[1], axis[0]];
  const center: [number, number] = [candidate.x, candidate.y];
  const projections = [candidate.target.a, candidate.target.b]
    .map((point) => dot(sub(point, center), axis));
  return {
    center,
    axis,
    normal,
    half: Math.max(0, candidate.renderedLength) / 2,
    targetLo: Math.min(...projections),
    targetHi: Math.max(...projections),
  };
}

function parallel(a: readonly number[], b: readonly number[], epsilon: number): boolean {
  return Math.abs(cross(a, b)) <= epsilon;
}

function pointLineDistance(
  point: readonly number[], origin: readonly number[], axis: readonly number[],
): number {
  return Math.abs(cross(sub(point, origin), axis));
}

function subtractRanges(
  length: number,
  ranges: Array<[number, number]>,
  epsilon: number,
): Array<[number, number]> {
  const clipped = ranges
    .map(([lo, hi]) => [Math.max(0, Math.min(lo, hi)), Math.min(length, Math.max(lo, hi))] as [number, number])
    .filter(([lo, hi]) => hi > lo + epsilon)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: Array<[number, number]> = [];
  for (const range of clipped) {
    const previous = merged[merged.length - 1];
    if (!previous || range[0] > previous[1] + epsilon) merged.push([...range]);
    else previous[1] = Math.max(previous[1], range[1]);
  }
  const solid: Array<[number, number]> = [];
  let cursor = 0;
  for (const [lo, hi] of merged) {
    if (lo > cursor + epsilon) solid.push([cursor, lo]);
    cursor = Math.max(cursor, hi);
  }
  if (length > cursor + epsilon) solid.push([cursor, length]);
  return solid;
}

function bodyPieces(
  a: readonly number[],
  b: readonly number[],
  halfDepth: number,
  cuts: ReadonlyArray<{ a: readonly number[]; b: readonly number[] }>,
  epsilon: number,
): number[][][] {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const length = Math.hypot(dx, dy);
  if (!(length > epsilon) || !(halfDepth > 0)) return [];
  const axis: [number, number] = [dx / length, dy / length];
  const ranges = cuts.flatMap((cut) => {
    const cdx = cut.b[0] - cut.a[0], cdy = cut.b[1] - cut.a[1];
    const cutLength = Math.hypot(cdx, cdy);
    if (!(cutLength > epsilon) || !parallel(axis, [cdx / cutLength, cdy / cutLength], 1e-6)) return [];
    if (pointLineDistance(cut.a, a, axis) > Math.max(halfDepth, epsilon) * 1.1
        || pointLineDistance(cut.b, a, axis) > Math.max(halfDepth, epsilon) * 1.1) return [];
    const lo = dot(sub(cut.a, a), axis);
    const hi = dot(sub(cut.b, a), axis);
    return [[lo, hi] as [number, number]];
  });
  return subtractRanges(length, ranges, epsilon).flatMap(([lo, hi]) => {
    const body = linearWallBody({
      a: at(a, axis, lo),
      b: at(a, axis, hi),
      halfDepth,
    });
    return body ? [body] : [];
  });
}

/** Build everything which is independent of the current pointer/candidate. */
export function buildOpeningDimensionContext(
  input: BuildOpeningDimensionContextInput,
): OpeningDimensionContext {
  const coordScale = input.coordScale ?? 1;
  const epsilon = Math.max(input.epsilon ?? input.gridPitch * 0.0002, 1e-9);
  const rooms: RoomDimensionGeometry[] = [];
  for (const room of input.rooms || []) {
    if (!room?.id) continue;
    const profile = roomWallProfile(
      input.rooms, room.id, input.walls, input.openCuts,
      input.pitch, input.cellCm, input.gridPitch, coordScale,
    );
    if (!profile || profile.poly.length < 3) continue;
    const inner = insetContour(profile.poly, profile.offsets);
    if (!inner || inner.length < 3) continue;
    rooms.push({ roomId: room.id, profile, inner });
  }
  rooms.sort((a, b) => a.roomId.localeCompare(b.roomId));

  const roomCuts = (input.roomOpenings || []).map((opening) => {
    const rad = opening.angle * Math.PI / 180;
    const axis: [number, number] = [Math.cos(rad), Math.sin(rad)];
    const half = Math.max(0, opening.length) / 2;
    return {
      a: at([opening.x, opening.y], axis, -half),
      b: at([opening.x, opening.y], axis, half),
    };
  });
  const boundaries: BoundaryBody[] = [];
  for (const edge of wallEdgeBodies(
    input.rooms, input.walls, input.openCuts,
    input.pitch, input.cellCm, input.gridPitch, coordScale,
  )) {
    for (const body of bodyPieces(
      edge.a, edge.b, edge.depthUnits / 2, roomCuts, epsilon,
    )) boundaries.push({ body });
  }

  const cutsByPartition = new Map<string, PartitionOpeningCut[]>();
  for (const cut of input.partitionCuts || []) {
    const list = cutsByPartition.get(cut.hostId) || [];
    list.push(cut);
    cutsByPartition.set(cut.hostId, list);
  }
  for (const partition of input.partitions || []) {
    const half = wallCmToUnits(partition.cm, input.cellCm, input.gridPitch) / 2;
    for (const body of bodyPieces(
      partition.a, partition.b, half,
      cutsByPartition.get(partition.id) || [], epsilon,
    )) boundaries.push({ body, partitionId: partition.id });
  }

  return { rooms, boundaries, epsilon };
}

function activeProfileEdge(
  room: RoomDimensionGeometry,
  basis: ReturnType<typeof candidateBasis>,
  epsilon: number,
): number | null {
  const { profile } = room;
  let picked: { edge: number; offset: number } | null = null;
  for (let edge = 0; edge < profile.poly.length; edge++) {
    if (!profile.kinds[edge] || !(profile.offsets[edge] > 0)) continue;
    const a = profile.poly[edge], b = profile.poly[(edge + 1) % profile.poly.length];
    const delta = sub(b, a);
    const length = Math.hypot(delta[0], delta[1]);
    if (!(length > epsilon) || !parallel(basis.axis, [delta[0] / length, delta[1] / length], 1e-6)) continue;
    if (pointLineDistance(a, basis.center, basis.axis) > epsilon
        || pointLineDistance(b, basis.center, basis.axis) > epsilon) continue;
    const ta = dot(sub(a, basis.center), basis.axis);
    const tb = dot(sub(b, basis.center), basis.axis);
    const lo = Math.min(ta, tb), hi = Math.max(ta, tb);
    if (lo > -basis.half + epsilon || hi < basis.half - epsilon) continue;
    const offset = Math.max(0, lo > 0 ? lo : hi < 0 ? -hi : 0);
    if (!picked || offset < picked.offset - epsilon
        || (Math.abs(offset - picked.offset) <= epsilon && edge < picked.edge)) {
      picked = { edge, offset };
    }
  }
  return picked?.edge ?? null;
}

function mergeIntervals(
  intervals: Array<[number, number]>, epsilon: number,
): Array<[number, number]> {
  intervals.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: Array<[number, number]> = [];
  for (const interval of intervals) {
    const previous = merged[merged.length - 1];
    if (!previous || interval[0] > previous[1] + epsilon) merged.push([...interval]);
    else previous[1] = Math.max(previous[1], interval[1]);
  }
  return merged;
}

function roomPair(
  room: RoomDimensionGeometry,
  edge: number,
  basis: ReturnType<typeof candidateBasis>,
  epsilon: number,
): { left: OpeningDimension; right: OpeningDimension } | null {
  const offset = room.profile.offsets[edge];
  if (!(offset > 0)) return null;
  const inward = inwardNormal(room.profile.poly, edge);
  const innerOrigin = at(basis.center, inward, offset);
  const intervals: Array<[number, number]> = [];
  for (let i = 0; i < room.inner.length; i++) {
    const a = room.inner[i], b = room.inner[(i + 1) % room.inner.length];
    const delta = sub(b, a);
    const length = Math.hypot(delta[0], delta[1]);
    if (!(length > epsilon) || !parallel(basis.axis, [delta[0] / length, delta[1] / length], 1e-6)) continue;
    if (pointLineDistance(a, innerOrigin, basis.axis) > epsilon
        || pointLineDistance(b, innerOrigin, basis.axis) > epsilon) continue;
    const ta = dot(sub(a, innerOrigin), basis.axis);
    const tb = dot(sub(b, innerOrigin), basis.axis);
    intervals.push([Math.min(ta, tb), Math.max(ta, tb)]);
  }
  const run = mergeIntervals(intervals, epsilon)
    .find(([lo, hi]) => lo <= epsilon && hi >= -epsilon);
  if (!run) return null;
  const [lo, hi] = run;
  const leftFrom = at(innerOrigin, basis.axis, -basis.half);
  const rightFrom = at(innerOrigin, basis.axis, basis.half);
  const leftDistance = Math.max(0, -basis.half - lo);
  const rightDistance = Math.max(0, hi - basis.half);
  const leftTo = leftDistance > 0 ? at(innerOrigin, basis.axis, lo) : leftFrom;
  const rightTo = rightDistance > 0 ? at(innerOrigin, basis.axis, hi) : rightFrom;
  const side = dot(inward, basis.normal) >= 0 ? 1 : -1;
  const make = (
    from: [number, number], to: [number, number], distance: number,
  ): OpeningDimension => ({
    from, to,
    label: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2],
    axis: basis.axis,
    labelNormal: inward,
    distance,
    roomId: room.roomId,
    roomSide: side,
    source: 'room-face',
  });
  return {
    left: make(leftFrom, leftTo, leftDistance),
    right: make(rightFrom, rightTo, rightDistance),
  };
}

function fallbackDimensions(
  basis: ReturnType<typeof candidateBasis>,
): [OpeningDimension, OpeningDimension] {
  const leftFrom = at(basis.center, basis.axis, -basis.half);
  const rightFrom = at(basis.center, basis.axis, basis.half);
  const leftTo = at(basis.center, basis.axis, Math.min(-basis.half, basis.targetLo));
  const rightTo = at(basis.center, basis.axis, Math.max(basis.half, basis.targetHi));
  const make = (
    from: [number, number], to: [number, number],
  ): OpeningDimension => ({
    from, to,
    label: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2],
    axis: basis.axis,
    labelNormal: basis.normal,
    distance: Math.hypot(to[0] - from[0], to[1] - from[1]),
    source: 'host-end',
  });
  return [make(leftFrom, leftTo), make(rightFrom, rightTo)];
}

function pointOnSegment(
  point: readonly number[], a: readonly number[], b: readonly number[], epsilon: number,
): boolean {
  const delta = sub(b, a);
  const length2 = dot(delta, delta);
  if (!(length2 > epsilon * epsilon)) return Math.hypot(...sub(point, a)) <= epsilon;
  const t = dot(sub(point, a), delta) / length2;
  if (t < -epsilon || t > 1 + epsilon) return false;
  const projected = at(a, delta, Math.max(0, Math.min(1, t)));
  return Math.hypot(...sub(point, projected)) <= epsilon;
}

function pointInBody(point: readonly number[], body: readonly number[][], epsilon: number): boolean {
  let inside = false;
  for (let i = 0, j = body.length - 1; i < body.length; j = i++) {
    if (pointOnSegment(point, body[j], body[i], epsilon)) return true;
    const [xi, yi] = body[i], [xj, yj] = body[j];
    if ((yi > point[1]) !== (yj > point[1])
        && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function rayEdgeDistance(
  origin: readonly number[],
  direction: readonly number[],
  a: readonly number[],
  b: readonly number[],
  maxDistance: number,
  epsilon: number,
): number | null {
  const edge = sub(b, a);
  const divisor = cross(direction, edge);
  if (Math.abs(divisor) <= epsilon) return null;
  const rel = sub(a, origin);
  const t = cross(rel, edge) / divisor;
  const u = cross(rel, direction) / divisor;
  if (t < -epsilon || t > maxDistance + epsilon || u < -epsilon || u > 1 + epsilon) return null;
  return Math.max(0, Math.min(maxDistance, t));
}

function nearestBoundary(
  origin: [number, number],
  direction: [number, number],
  maxDistance: number,
  boundaries: readonly BoundaryBody[],
  excludedPartitionId: string | undefined,
  epsilon: number,
): number | null {
  let best: number | null = null;
  for (const boundary of boundaries) {
    if (excludedPartitionId && boundary.partitionId === excludedPartitionId) continue;
    if (pointInBody(origin, boundary.body, epsilon)) return 0;
    for (let i = 0; i < boundary.body.length; i++) {
      const distance = rayEdgeDistance(
        origin, direction,
        boundary.body[i], boundary.body[(i + 1) % boundary.body.length],
        maxDistance, epsilon,
      );
      if (distance == null) continue;
      if (best == null || distance < best) best = distance;
    }
  }
  return best;
}

function independentDimensions(
  candidate: DimensionCandidate,
  context: OpeningDimensionContext,
  basis: ReturnType<typeof candidateBasis>,
): [OpeningDimension, OpeningDimension] {
  const fallback = fallbackDimensions(basis);
  const excluded = candidate.host?.kind === 'partition' ? candidate.host.id : undefined;
  const sides = [
    { base: fallback[0], direction: [-basis.axis[0], -basis.axis[1]] as [number, number] },
    { base: fallback[1], direction: basis.axis },
  ];
  return sides.map(({ base, direction }) => {
    const maxDistance = base.distance;
    const hit = nearestBoundary(
      base.from, direction, maxDistance,
      context.boundaries, excluded, context.epsilon,
    );
    if (hit == null) return base;
    const to = at(base.from, direction, hit);
    return {
      ...base,
      to,
      label: [(base.from[0] + to[0]) / 2, (base.from[1] + to[1]) / 2],
      distance: hit,
      source: 'connected-face' as const,
    };
  }) as [OpeningDimension, OpeningDimension];
}

/** Resolve 2/4 physical dimensions without re-running placement or snap. */
export function resolveOpeningDimensions(
  candidate: DimensionCandidate,
  context: OpeningDimensionContext,
): OpeningDimension[] {
  const basis = candidateBasis(candidate);
  const owners = context.rooms.flatMap((room) => {
    const edge = activeProfileEdge(room, basis, context.epsilon);
    return edge == null ? [] : [{ room, edge }];
  });
  if (owners.length > 2) return fallbackDimensions(basis);
  if (owners.length) {
    const pairs = owners.map(({ room, edge }) => roomPair(room, edge, basis, context.epsilon));
    if (pairs.some((pair) => !pair)) return fallbackDimensions(basis);
    const complete = pairs as Array<{ left: OpeningDimension; right: OpeningDimension }>;
    // Canonical direction first, stable roomId second.
    return [
      ...complete.map((pair) => pair.left),
      ...complete.map((pair) => pair.right),
    ];
  }
  return independentDimensions(candidate, context, basis);
}
