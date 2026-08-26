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

export interface HiddenWallDiagnosticEndpoint extends PlanSnapEndpoint {
  sourceKind: 'draft' | 'partition';
  sourceId: string;
}

export interface HiddenWallDiagnosticGeometry {
  segments: PlanSnapSegment[];
  endpoints: HiddenWallDiagnosticEndpoint[];
}

export interface PlanSnapExtraEndpoint {
  point: readonly number[];
  key: string;
}

export interface PlanSnapPartitionCut {
  hostId: string;
  a: readonly number[];
  b: readonly number[];
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
  partitionCuts?: readonly PlanSnapPartitionCut[];
  epsilon?: number;
}

export interface ResolvePlanSnapOptions {
  tolerance: number;
  gridStep: number;
  /** Screen-space ambiguity threshold already converted to plan units. */
  distinguishTolerance?: number;
  excludePoints?: readonly (readonly number[])[];
  extraEndpoints?: readonly PlanSnapExtraEndpoint[];
  epsilon?: number;
}

export type PlanSnapResolution =
  | { kind: 'none'; candidate: null; conflicts: [] }
  | { kind: 'resolved'; candidate: PlanSnapCandidate; conflicts: [] }
  | { kind: 'ambiguous'; candidate: null; conflicts: PlanSnapEndpoint[] };

export interface ResolveStrictPlanSnapOptions extends ResolvePlanSnapOptions {
  anchor: readonly number[];
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

function positiveCollinearOverlap(
  first: SourceSegment, second: SourceSegment, epsilon: number,
): boolean {
  const dx = first.b[0] - first.a[0];
  const dy = first.b[1] - first.a[1];
  const length = Math.hypot(dx, dy);
  if (!(length > epsilon)) return false;
  const ux = dx / length, uy = dy / length;
  const across = (point: readonly number[]) => Math.abs(
    (point[0] - first.a[0]) * uy - (point[1] - first.a[1]) * ux
  );
  if (across(second.a) > epsilon || across(second.b) > epsilon) return false;
  const firstAlong = (second.a[0] - first.a[0]) * ux
    + (second.a[1] - first.a[1]) * uy;
  const secondAlong = (second.b[0] - first.a[0]) * ux
    + (second.b[1] - first.a[1]) * uy;
  return Math.min(length, Math.max(firstAlong, secondAlong))
    - Math.max(0, Math.min(firstAlong, secondAlong)) > epsilon;
}

/**
 * Preserve the identity of an independent source which is visually hidden by
 * another wall. Unlike buildPlanSnapGeometry this projection deliberately does
 * not deduplicate a room-owned axis over a partition/draft-owned one.
 */
export function buildHiddenWallDiagnosticGeometry(options: {
  space: Pick<SpaceModel, 'rooms' | 'room_drafts' | 'partitions'>;
  activeDraftId?: string | null;
  epsilon?: number;
}): HiddenWallDiagnosticGeometry {
  const epsilon = options.epsilon ?? DEFAULT_EPSILON;
  const sources: SourceSegment[] = [];
  for (const [index, segment] of roomEdges(options.space.rooms).entries()) {
    if (segment.length < 4) continue;
    sources.push({
      a: [segment[0], segment[1]], b: [segment[2], segment[3]],
      kind: 'room', id: `room-edge-${index}`, cuts: [],
    });
  }
  for (const draft of options.space.room_drafts || []) {
    if (draft.id === options.activeDraftId) continue;
    for (let index = 0; index + 1 < draft.points.length; index++) {
      const a = draft.points[index], b = draft.points[index + 1];
      if (!finitePoint(a) || !finitePoint(b) || pointsEqual(a, b, epsilon)) continue;
      sources.push({
        a: [a[0], a[1]], b: [b[0], b[1]],
        kind: 'draft', id: `${draft.id}:${index}`, cuts: [],
      });
    }
  }
  for (const partition of options.space.partitions || []) {
    if (!finitePoint(partition.a) || !finitePoint(partition.b)
        || pointsEqual(partition.a, partition.b, epsilon)) continue;
    sources.push({
      a: [partition.a[0], partition.a[1]],
      b: [partition.b[0], partition.b[1]],
      kind: 'partition', id: partition.id, cuts: [],
    });
  }

  const hidden = sources.filter((source) => source.kind !== 'room'
    && sources.some((other) => other !== source
      && positiveCollinearOverlap(source, other, epsilon)));
  const segments = hidden.map((source): PlanSnapSegment => {
    const [a, b] = canonicalPair(source.a, source.b);
    return {
      a, b, key: `hidden|${segmentKey(source, a, b)}`,
      sourceKind: source.kind, sourceId: source.id,
    };
  }).sort((a, b) => a.key.localeCompare(b.key));
  const endpoints = hidden.flatMap((source): HiddenWallDiagnosticEndpoint[] => (
    [source.a, source.b].map((point, index) => ({
      point: [point[0], point[1]],
      key: `hidden|${sourceKey(source)}|endpoint-${index}`,
      sourceKind: source.kind as 'draft' | 'partition',
      sourceId: source.id,
    }))
  )).sort((a, b) => a.key.localeCompare(b.key));
  return { segments, endpoints };
}

/**
 * Build the immutable architectural axes used by both the overlay and snap resolver.
 * Opening cuts apply to room-owned walls, while hosted opening cuts apply only to
 * their explicit partition source. Zero-thickness walls and saved drafts keep
 * complete axes. Cut boundaries never become static nodes.
 */
export function buildPlanSnapGeometry(options: BuildPlanSnapGeometryOptions): PlanSnapGeometry {
  const epsilon = options.epsilon ?? DEFAULT_EPSILON;
  const roomCuts = options.roomCuts || [];
  const partitionCuts = new Map<string, number[][]>();
  for (const cut of options.partitionCuts || []) {
    if (typeof cut.hostId !== 'string' || !cut.hostId
        || !finitePoint(cut.a) || !finitePoint(cut.b)) continue;
    const cuts = partitionCuts.get(cut.hostId) || [];
    cuts.push([cut.a[0], cut.a[1], cut.b[0], cut.b[1]]);
    partitionCuts.set(cut.hostId, cuts);
  }
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
      cuts: partitionCuts.get(partition.id) || [],
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

function endpointCandidates(
  geometry: PlanSnapGeometry,
  pointer: readonly number[],
  options: ResolvePlanSnapOptions,
): PlanSnapCandidate[] {
  const epsilon = options.epsilon ?? DEFAULT_EPSILON;
  const excluded = options.excludePoints || [];
  const endpoints: PlanSnapEndpoint[] = [
    ...geometry.endpoints,
    ...(options.extraEndpoints || [])
      .filter((entry) => finitePoint(entry.point))
      .map((entry): PlanSnapEndpoint => ({
        point: [entry.point[0], entry.point[1]], key: entry.key,
      })),
  ];
  const deduped = new Map<string, PlanSnapEndpoint>();
  for (const endpoint of endpoints) {
    if (isExcluded(endpoint.point, excluded, epsilon)) continue;
    const identity = pointKey(endpoint.point);
    const previous = deduped.get(identity);
    if (!previous || endpoint.key.localeCompare(previous.key) < 0) deduped.set(identity, endpoint);
  }
  return [...deduped.values()].map((endpoint): PlanSnapCandidate => ({
    kind: 'endpoint', point: [...endpoint.point], key: endpoint.key,
    distance: Math.hypot(pointer[0] - endpoint.point[0], pointer[1] - endpoint.point[1]),
  })).filter((candidate) => candidate.distance <= options.tolerance)
    .sort((left, right) => left.distance - right.distance || left.key.localeCompare(right.key));
}

function endpointResolution(
  candidates: readonly PlanSnapCandidate[], distinguishTolerance: number,
): PlanSnapResolution | null {
  if (!candidates.length) return null;
  if (distinguishTolerance > 0) {
    const conflictKeys = new Set<string>();
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        if (Math.hypot(
          candidates[i].point[0] - candidates[j].point[0],
          candidates[i].point[1] - candidates[j].point[1],
        ) < distinguishTolerance) {
          conflictKeys.add(candidates[i].key);
          conflictKeys.add(candidates[j].key);
        }
      }
    }
    if (conflictKeys.size > 1) return {
      kind: 'ambiguous', candidate: null,
      conflicts: candidates.filter((candidate) => conflictKeys.has(candidate.key))
        .map((candidate) => ({ point: [...candidate.point], key: candidate.key })),
    };
  }
  return { kind: 'resolved', candidate: candidates[0], conflicts: [] };
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
  const resolution = resolvePlanSnapResult(geometry, pointer, options);
  return resolution.kind === 'resolved' ? resolution.candidate : null;
}

/** Resolve endpoint-first snap while making visually inseparable endpoints explicit. */
export function resolvePlanSnapResult(
  geometry: PlanSnapGeometry,
  pointer: readonly number[],
  options: ResolvePlanSnapOptions,
): PlanSnapResolution {
  if (!finitePoint(pointer) || !(options.tolerance >= 0)) {
    return { kind: 'none', candidate: null, conflicts: [] };
  }
  const epsilon = options.epsilon ?? DEFAULT_EPSILON;
  const excluded = options.excludePoints || [];
  const endpoint = endpointResolution(
    endpointCandidates(geometry, pointer, options), options.distinguishTolerance || 0,
  );
  if (endpoint) return endpoint;

  let bestLine: PlanSnapCandidate | null = null;
  for (const segment of geometry.segments) {
    const line = [segment.a[0], segment.a[1], segment.b[0], segment.b[1]];
    const distance = distToSegment([pointer[0], pointer[1]], line);
    if (distance > options.tolerance) continue;
    const point = quantizedPoint(segment, pointer, options.gridStep);
    if (isExcluded(point, excluded, epsilon) || !better(distance, segment.key, bestLine)) continue;
    bestLine = { kind: 'line', point, key: segment.key, distance, segment };
  }
  return bestLine
    ? { kind: 'resolved', candidate: bestLine, conflicts: [] }
    : { kind: 'none', candidate: null, conflicts: [] };
}

function selectedRay(anchor: readonly number[], pointer: readonly number[]): [number, number] | null {
  const dx = pointer[0] - anchor[0];
  const dy = pointer[1] - anchor[1];
  if (!(Math.hypot(dx, dy) > Number.EPSILON)) return null;
  const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  return [Math.cos(angle), Math.sin(angle)];
}

function pointOnForwardRay(
  point: readonly number[], anchor: readonly number[], ray: readonly number[], epsilon: number,
): boolean {
  const dx = point[0] - anchor[0];
  const dy = point[1] - anchor[1];
  return dx * ray[0] + dy * ray[1] > epsilon
    && Math.abs(dx * ray[1] - dy * ray[0]) <= epsilon * Math.max(Math.hypot(dx, dy), 1);
}

/** Exact endpoint/segment snap constrained to the Shift-selected 45 degree ray. */
export function resolveStrictPlanSnap(
  geometry: PlanSnapGeometry,
  pointer: readonly number[],
  options: ResolveStrictPlanSnapOptions,
): PlanSnapResolution {
  if (!finitePoint(pointer) || !finitePoint(options.anchor) || !(options.tolerance >= 0)) {
    return { kind: 'none', candidate: null, conflicts: [] };
  }
  const epsilon = options.epsilon ?? DEFAULT_EPSILON;
  const ray = selectedRay(options.anchor, pointer);
  if (!ray) return { kind: 'none', candidate: null, conflicts: [] };
  const endpoints = endpointCandidates(geometry, pointer, options)
    .filter((candidate) => pointOnForwardRay(candidate.point, options.anchor, ray, epsilon));
  const endpoint = endpointResolution(endpoints, options.distinguishTolerance || 0);
  if (endpoint) return endpoint;

  let best: PlanSnapCandidate | null = null;
  for (const segment of geometry.segments) {
    const sx = segment.b[0] - segment.a[0];
    const sy = segment.b[1] - segment.a[1];
    const qx = segment.a[0] - options.anchor[0];
    const qy = segment.a[1] - options.anchor[1];
    const denominator = ray[0] * sy - ray[1] * sx;
    let point: [number, number] | null = null;
    if (Math.abs(denominator) <= epsilon * Math.max(Math.hypot(sx, sy), 1)) {
      if (Math.abs(qx * ray[1] - qy * ray[0]) > epsilon * Math.max(Math.hypot(qx, qy), 1)) continue;
      const candidates = [segment.a, segment.b]
        .map((candidate) => ({
          point: candidate,
          along: (candidate[0] - options.anchor[0]) * ray[0]
            + (candidate[1] - options.anchor[1]) * ray[1],
        }))
        .filter((candidate) => candidate.along > epsilon)
        .sort((left, right) => left.along - right.along);
      if (candidates.length) point = [...candidates[0].point];
    } else {
      const t = (qx * sy - qy * sx) / denominator;
      const u = (qx * ray[1] - qy * ray[0]) / denominator;
      if (t > epsilon && u >= -epsilon && u <= 1 + epsilon) {
        point = [options.anchor[0] + ray[0] * t, options.anchor[1] + ray[1] * t];
      }
    }
    if (!point) continue;
    const distance = Math.hypot(pointer[0] - point[0], pointer[1] - point[1]);
    if (distance > options.tolerance || isExcluded(point, options.excludePoints || [], epsilon)
        || !better(distance, segment.key, best)) continue;
    best = { kind: 'line', point, key: segment.key, distance, segment };
  }
  return best
    ? { kind: 'resolved', candidate: best, conflicts: [] }
    : { kind: 'none', candidate: null, conflicts: [] };
}
