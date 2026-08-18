import { cutSegments, distToSegment, roomEdges } from './logic';
import type { SpaceModel } from './types';

export type PlanSnapSourceKind = 'room' | 'draft' | 'partition';

export interface PlanSnapSegment {
  a: [number, number];
  b: [number, number];
  key: string;
  sourceKind: PlanSnapSourceKind;
  sourceId: string;
}

export interface PlanSnapEndpoint {
  point: [number, number];
  key: string;
}

export interface PlanSnapGeometry {
  segments: PlanSnapSegment[];
  endpoints: PlanSnapEndpoint[];
}

export interface PlanSnapExtraEndpoint {
  point: readonly number[];
  key: string;
}

export type PlanSnapCandidate =
  | {
      kind: 'endpoint';
      point: [number, number];
      key: string;
      distance: number;
    }
  | {
      kind: 'line';
      point: [number, number];
      key: string;
      distance: number;
      segment: PlanSnapSegment;
    };

export interface BuildPlanSnapGeometryOptions {
  space: Pick<SpaceModel, 'rooms' | 'room_drafts' | 'partitions'>;
  activeDraftId?: string | null;
  roomCuts?: readonly number[][];
  epsilon?: number;
}

export interface ResolvePlanSnapOptions {
  tolerance: number;
  gridStep: number;
  excludePoints?: readonly (readonly number[])[];
  extraEndpoints?: readonly PlanSnapExtraEndpoint[];
  epsilon?: number;
}

interface SourceSegment {
  a: [number, number];
  b: [number, number];
  kind: PlanSnapSourceKind;
  id: string;
  cuts: readonly number[][];
}

const DEFAULT_EPSILON = 0.001;

function finitePoint(point: readonly number[] | null | undefined): point is readonly [number, number] {
  return !!point && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]);
}

function comparePoint(a: readonly number[], b: readonly number[]): number {
  return a[0] - b[0] || a[1] - b[1];
}

function pointKey(point: readonly number[]): string {
  return `${point[0].toFixed(6)},${point[1].toFixed(6)}`;
}

function pointsEqual(a: readonly number[], b: readonly number[], epsilon: number): boolean {
  return Math.abs(a[0] - b[0]) < epsilon && Math.abs(a[1] - b[1]) < epsilon;
}

function canonicalPair(
  a: readonly number[],
  b: readonly number[],
): [[number, number], [number, number]] {
  const first = comparePoint(a, b) <= 0 ? a : b;
  const second = first === a ? b : a;
  return [[first[0], first[1]], [second[0], second[1]]];
}

function sourceKey(source: SourceSegment): string {
  const [a, b] = canonicalPair(source.a, source.b);
  return `${source.kind}|${source.id}|${pointKey(a)}|${pointKey(b)}`;
}

function segmentKey(source: SourceSegment, a: readonly number[], b: readonly number[]): string {
  const [ca, cb] = canonicalPair(a, b);
  return `${sourceKey(source)}|${pointKey(ca)}|${pointKey(cb)}`;
}

function sourceRank(kind: PlanSnapSourceKind): number {
  return kind === 'room' ? 0 : kind === 'draft' ? 1 : 2;
}

function touches(point: readonly number[], segment: readonly number[], epsilon: number): boolean {
  return pointsEqual(point, [segment[0], segment[1]], epsilon)
    || pointsEqual(point, [segment[2], segment[3]], epsilon);
}

/**
 * Build the immutable architectural axes used by both the overlay and snap resolver.
 * Opening/open-span cuts apply only to room-owned walls; saved drafts and independent
 * partitions keep their own complete axes. Cut boundaries never become static nodes.
 */
export function buildPlanSnapGeometry(options: BuildPlanSnapGeometryOptions): PlanSnapGeometry {
  const epsilon = options.epsilon ?? DEFAULT_EPSILON;
  const roomCuts = options.roomCuts || [];
  const sources: SourceSegment[] = [];

  for (const [index, segment] of roomEdges(options.space.rooms).entries()) {
    if (segment.length < 4) continue;
    sources.push({
      a: [segment[0], segment[1]],
      b: [segment[2], segment[3]],
      kind: 'room',
      id: `room-edge-${index}`,
      cuts: roomCuts,
    });
  }

  for (const draft of options.space.room_drafts || []) {
    if (draft.id === options.activeDraftId) continue;
    for (let index = 0; index + 1 < draft.points.length; index++) {
      const a = draft.points[index];
      const b = draft.points[index + 1];
      if (!finitePoint(a) || !finitePoint(b)) continue;
      sources.push({
        a: [a[0], a[1]], b: [b[0], b[1]], kind: 'draft',
        id: `${draft.id}:${index}`, cuts: [],
      });
    }
  }

  for (const partition of options.space.partitions || []) {
    if (!finitePoint(partition.a) || !finitePoint(partition.b)) continue;
    sources.push({
      a: [partition.a[0], partition.a[1]],
      b: [partition.b[0], partition.b[1]],
      kind: 'partition',
      id: partition.id,
      cuts: [],
    });
  }

  const segmentsByAxis = new Map<string, PlanSnapSegment>();
  const endpointKeys = new Map<string, PlanSnapEndpoint>();

  for (const source of sources) {
    const sourceLine = [source.a[0], source.a[1], source.b[0], source.b[1]];
    const solids = cutSegments([sourceLine], source.cuts as number[][], epsilon);
    if (!solids.length) continue;

    for (const solid of solids) {
      if (solid.length < 4) continue;
      const [a, b] = canonicalPair([solid[0], solid[1]], [solid[2], solid[3]]);
      if (pointsEqual(a, b, epsilon)) continue;
      const axisKey = `${pointKey(a)}|${pointKey(b)}`;
      const candidate: PlanSnapSegment = {
        a, b,
        key: segmentKey(source, a, b),
        sourceKind: source.kind,
        sourceId: source.id,
      };
      const existing = segmentsByAxis.get(axisKey);
      if (!existing
          || sourceRank(candidate.sourceKind) < sourceRank(existing.sourceKind)
          || (sourceRank(candidate.sourceKind) === sourceRank(existing.sourceKind)
            && candidate.key.localeCompare(existing.key) < 0)) {
        segmentsByAxis.set(axisKey, candidate);
      }
    }

    for (const point of [source.a, source.b] as const) {
      if (!solids.some((solid) => touches(point, solid, epsilon))) continue;
      const key = pointKey(point);
      if (!endpointKeys.has(key)) endpointKeys.set(key, { point: [point[0], point[1]], key });
    }
  }

  return {
    segments: [...segmentsByAxis.values()].sort((a, b) => a.key.localeCompare(b.key)),
    endpoints: [...endpointKeys.values()].sort((a, b) => a.key.localeCompare(b.key)),
  };
}

function pointOnSnapSegment(
  point: readonly number[], segment: PlanSnapSegment, epsilon: number,
): boolean {
  const dx = segment.b[0] - segment.a[0];
  const dy = segment.b[1] - segment.a[1];
  const length = Math.hypot(dx, dy);
  if (!(length > epsilon)) return false;
  const ux = dx / length;
  const uy = dy / length;
  const px = point[0] - segment.a[0];
  const py = point[1] - segment.a[1];
  const along = px * ux + py * uy;
  const perpendicular = Math.abs(px * uy - py * ux);
  return perpendicular <= epsilon && along >= -epsilon && along <= length + epsilon;
}

/**
 * Return the stable completed-room solid interval that contains both points.
 * Because room openings and open spans are cut while the snapshot is built,
 * points on opposite sides of a gap can never share a returned segment.
 */
export function findSharedRoomSnapSegment(
  geometry: PlanSnapGeometry,
  a: readonly number[],
  b: readonly number[],
  epsilon = DEFAULT_EPSILON,
): PlanSnapSegment | null {
  if (!finitePoint(a) || !finitePoint(b) || pointsEqual(a, b, epsilon)) return null;
  return geometry.segments.find((segment) => segment.sourceKind === 'room'
    && pointOnSnapSegment(a, segment, epsilon)
    && pointOnSnapSegment(b, segment, epsilon)) || null;
}

function isExcluded(
  point: readonly number[],
  excluded: readonly (readonly number[])[],
  epsilon: number,
): boolean {
  return excluded.some((candidate) => finitePoint(candidate) && pointsEqual(
    point, candidate, epsilon,
  ));
}

function better(distance: number, key: string, current: PlanSnapCandidate | null): boolean {
  if (!current) return true;
  const delta = distance - current.distance;
  return delta < -1e-9 || (Math.abs(delta) <= 1e-9 && key.localeCompare(current.key) < 0);
}

function quantizedPoint(segment: PlanSnapSegment, pointer: readonly number[], step: number): [number, number] {
  const dx = segment.b[0] - segment.a[0];
  const dy = segment.b[1] - segment.a[1];
  const length = Math.hypot(dx, dy);
  if (!(length > 0)) return [...segment.a];
  const ux = dx / length;
  const uy = dy / length;
  const projected = Math.max(0, Math.min(
    length,
    (pointer[0] - segment.a[0]) * ux + (pointer[1] - segment.a[1]) * uy,
  ));
  const distance = step > 0
    ? Math.max(0, Math.min(length, Math.round(projected / step) * step))
    : projected;
  return [segment.a[0] + ux * distance, segment.a[1] + uy * distance];
}

/** Resolve exactly one endpoint-first or wall-bound line candidate. */
export function resolvePlanSnap(
  geometry: PlanSnapGeometry,
  pointer: readonly number[],
  options: ResolvePlanSnapOptions,
): PlanSnapCandidate | null {
  if (!finitePoint(pointer) || !(options.tolerance >= 0)) return null;
  const epsilon = options.epsilon ?? DEFAULT_EPSILON;
  const excluded = options.excludePoints || [];
  let bestEndpoint: PlanSnapCandidate | null = null;
  const endpoints: PlanSnapEndpoint[] = [
    ...geometry.endpoints,
    ...(options.extraEndpoints || [])
      .filter((entry) => finitePoint(entry.point))
      .map((entry): PlanSnapEndpoint => ({
        point: [entry.point[0], entry.point[1]], key: entry.key,
      })),
  ];

  for (const endpoint of endpoints) {
    if (isExcluded(endpoint.point, excluded, epsilon)) continue;
    const distance = Math.hypot(pointer[0] - endpoint.point[0], pointer[1] - endpoint.point[1]);
    if (distance > options.tolerance || !better(distance, endpoint.key, bestEndpoint)) continue;
    bestEndpoint = {
      kind: 'endpoint', point: [...endpoint.point], key: endpoint.key, distance,
    };
  }
  if (bestEndpoint) return bestEndpoint;

  let bestLine: PlanSnapCandidate | null = null;
  for (const segment of geometry.segments) {
    const line = [segment.a[0], segment.a[1], segment.b[0], segment.b[1]];
    const distance = distToSegment([pointer[0], pointer[1]], line);
    if (distance > options.tolerance) continue;
    const point = quantizedPoint(segment, pointer, options.gridStep);
    if (isExcluded(point, excluded, epsilon) || !better(distance, segment.key, bestLine)) continue;
    bestLine = { kind: 'line', point, key: segment.key, distance, segment };
  }
  return bestLine;
}
