import { formatLength } from '../logic';
import { NEAR_AXIS_MAX_SLOPE, type NearAxis } from '../near-axis';

export const PDF_DIMENSION_EPSILON_MM = 1;

export type DimensionAxis = NearAxis;
export type DimensionPoint = readonly [number, number];

export interface DimensionSourceIdentity {
  /** Index of the local contour supplied by the caller. */
  ringIndex: number;
  /** Lowest original edge index represented by this compacted edge. */
  edgeIndex: number;
}

export interface DimensionEdge {
  /** Actual normalized contour endpoints; extension lines start on these faces. */
  sourceA: DimensionPoint;
  sourceB: DimensionPoint;
  /** Projected printable edge. The source contour is never mutated. */
  a: DimensionPoint;
  b: DimensionPoint;
  text: string;
  short: boolean;
  angle: number;
  mid: DimensionPoint;
  axis: DimensionAxis;
  projectedLength: number;
  tangentInterval: readonly [number, number];
  normalCoordinate: number;
  inwardNormal: DimensionPoint;
  normalSign: -1 | 1;
  source: DimensionSourceIdentity;
  /** All pre-compaction source edges represented by this printable edge. */
  sourceEdgeIndices: readonly number[];
  /** Stable tie-break key; it is metadata and is not serialized to PDF. */
  stableKey: string;
}

export interface DimensionEdgeBuildOptions {
  ringIndex?: number;
  /** Duplicate tolerance in render-coordinate units. */
  epsilon?: number;
}

export interface DimensionPlacementScore {
  hardCollisions: number;
  normalClearance: number;
}

export interface OppositeDimensionDedupeOptions {
  /** The one local room contour or connected outer ring owning `edges`. */
  ring: readonly (readonly number[])[];
  /** 1 mm physical tolerance translated to render-coordinate units. */
  epsilon: number;
  score?: (edge: DimensionEdge) => DimensionPlacementScore;
}

interface NormalizedRing {
  points: Array<[number, number]>;
  /** `edgeSources[i]` belongs to points[i] -> points[i + 1]. */
  edgeSources: number[][];
}

export interface DimensionAxisProjection {
  axis: DimensionAxis;
  a: [number, number];
  b: [number, number];
  mid: [number, number];
  projectedLength: number;
  tangentInterval: [number, number];
  normalCoordinate: number;
}

const samePoint = (a: readonly number[], b: readonly number[], epsilon: number): boolean =>
  Math.hypot(a[0] - b[0], a[1] - b[1]) <= epsilon;

const finiteEpsilon = (value: number): number => (
  Number.isFinite(value) && value >= 0 ? value : 0
);

/** Translate the PDF's physical 1 mm geometry tolerance without touching config. */
export function dimensionEpsilonUnits(cmPerUnit: number): number {
  const scale = Number(cmPerUnit);
  return Number.isFinite(scale) && scale > 0
    ? PDF_DIMENSION_EPSILON_MM / 10 / scale
    : 0;
}

const mergeSources = (a: readonly number[], b: readonly number[]): number[] => (
  [...new Set([...a, ...b])].sort((left, right) => left - right)
);

const collapseSeamDuplicate = (ring: NormalizedRing, epsilon: number): boolean => {
  const length = ring.points.length;
  if (length <= 1 || !samePoint(ring.points[length - 1], ring.points[0], epsilon)) return false;
  const previous = length - 2;
  ring.edgeSources[previous] = mergeSources(
    ring.edgeSources[previous], ring.edgeSources[length - 1],
  );
  ring.points.splice(length - 1, 1);
  ring.edgeSources.splice(length - 1, 1);
  return true;
};

const collapseAdjacentDuplicate = (ring: NormalizedRing, epsilon: number): boolean => {
  for (let index = 0; index + 1 < ring.points.length; index++) {
    if (!samePoint(ring.points[index], ring.points[index + 1], epsilon)) continue;
    ring.edgeSources[index] = mergeSources(
      ring.edgeSources[index], ring.edgeSources[index + 1],
    );
    ring.points.splice(index + 1, 1);
    ring.edgeSources.splice(index + 1, 1);
    return true;
  }
  return false;
};

const collapseAdjacentDuplicates = (ring: NormalizedRing, epsilon: number): boolean => {
  let changed = false;
  while (ring.points.length > 1) {
    // The seam is checked first so an explicit closing point never participates
    // in collinearity and cannot turn two real sides into a chord.
    if (collapseSeamDuplicate(ring, epsilon)) {
      changed = true;
      continue;
    }
    if (collapseAdjacentDuplicate(ring, epsilon)) {
      changed = true;
      continue;
    }
    break;
  }
  return changed;
};

const forwardCollinear = (
  previous: readonly number[], point: readonly number[], next: readonly number[],
): boolean => {
  const ax = point[0] - previous[0], ay = point[1] - previous[1];
  const bx = next[0] - point[0], by = next[1] - point[1];
  const aLength = Math.hypot(ax, ay), bLength = Math.hypot(bx, by);
  if (!(aLength > 0) || !(bLength > 0)) return false;
  const dot = ax * bx + ay * by;
  if (!(dot > 0)) return false;
  const cross = ax * by - ay * bx;
  // Since dot is positive, |cross| / dot is tan(turn angle). Reusing the
  // canonical near-axis slope keeps the inclusive 0.25 degree contract.
  return Math.abs(cross) <= dot * NEAR_AXIS_MAX_SLOPE;
};

const removeForwardCollinearPoint = (ring: NormalizedRing): boolean => {
  const length = ring.points.length;
  if (length < 3) return false;
  for (let index = 0; index < length; index++) {
    const previous = (index - 1 + length) % length;
    const next = (index + 1) % length;
    if (!forwardCollinear(ring.points[previous], ring.points[index], ring.points[next])) continue;
    ring.edgeSources[previous] = mergeSources(
      ring.edgeSources[previous], ring.edgeSources[index],
    );
    ring.points.splice(index, 1);
    ring.edgeSources.splice(index, 1);
    return true;
  }
  return false;
};

const normalizeRing = (
  input: readonly (readonly number[])[], epsilonInput: number,
): NormalizedRing => {
  const epsilon = finiteEpsilon(epsilonInput);
  const points: Array<[number, number]> = [];
  const sourceIndices: number[] = [];
  for (let index = 0; index < input.length; index++) {
    const point: [number, number] = [Number(input[index]?.[0]), Number(input[index]?.[1])];
    // A ring has no meaningful continuity across a corrupt vertex. Dropping
    // that vertex would connect its neighbours and could print a phantom wall
    // dimension, so malformed contours fail closed as a whole.
    if (!point.every(Number.isFinite)) return { points: [], edgeSources: [] };
    points.push(point);
    sourceIndices.push(index);
  }
  const ring: NormalizedRing = {
    points,
    edgeSources: sourceIndices.map((sourceIndex) => [sourceIndex]),
  };
  // Duplicate collapse must precede every collinearity pass. Removing one
  // point per pass makes the result a true fixed point instead of a
  // simultaneous-filter chord across adjacent turns.
  while (ring.points.length > 1) {
    const duplicatesChanged = collapseAdjacentDuplicates(ring, epsilon);
    if (ring.points.length < 3) break;
    if (removeForwardCollinearPoint(ring)) continue;
    if (!duplicatesChanged) break;
  }
  collapseAdjacentDuplicates(ring, epsilon);
  return ring;
};

/**
 * Collapse print-only duplicate and forward-collinear vertices. The caller may
 * pass a physical epsilon translated with `dimensionEpsilonUnits()`.
 */
export function compactRing(
  input: readonly (readonly number[])[], epsilon = 1e-7,
): number[][] {
  return normalizeRing(input, epsilon).points.map((point) => [...point]);
}

/** Return the printable major-axis projection, or null for a true diagonal. */
export function projectDimensionEdge(
  sourceA: readonly number[], sourceB: readonly number[],
): DimensionAxisProjection | null {
  const ax = Number(sourceA[0]), ay = Number(sourceA[1]);
  const bx = Number(sourceB[0]), by = Number(sourceB[1]);
  if (![ax, ay, bx, by].every(Number.isFinite)) return null;
  const dx = bx - ax, dy = by - ay;
  const absX = Math.abs(dx), absY = Math.abs(dy);
  const major = Math.max(absX, absY), minor = Math.min(absX, absY);
  if (!(major > 0) || minor / major > NEAR_AXIS_MAX_SLOPE) return null;
  const mid: [number, number] = [(ax + bx) / 2, (ay + by) / 2];
  if (absX >= absY) {
    const a: [number, number] = [ax, mid[1]], b: [number, number] = [bx, mid[1]];
    return {
      axis: 'horizontal', a, b, mid, projectedLength: absX,
      tangentInterval: [Math.min(ax, bx), Math.max(ax, bx)], normalCoordinate: mid[1],
    };
  }
  const a: [number, number] = [mid[0], ay], b: [number, number] = [mid[0], by];
  return {
    axis: 'vertical', a, b, mid, projectedLength: absY,
    tangentInterval: [Math.min(ay, by), Math.max(ay, by)], normalCoordinate: mid[0],
  };
}

const pointOnRingBoundary = (
  point: readonly number[], ring: readonly (readonly number[])[],
): boolean => {
  const coordinateScale = Math.max(1, Math.abs(point[0]), Math.abs(point[1]),
    ...ring.flatMap((candidate) => [Math.abs(candidate[0]), Math.abs(candidate[1])]));
  const tolerance = coordinateScale * 1e-12;
  for (let index = 0; index < ring.length; index++) {
    const a = ring[index], b = ring[(index + 1) % ring.length];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const length = Math.hypot(dx, dy);
    if (!(length > 0)) continue;
    const cross = (point[0] - a[0]) * dy - (point[1] - a[1]) * dx;
    if (Math.abs(cross) > tolerance * length) continue;
    const dot = (point[0] - a[0]) * dx + (point[1] - a[1]) * dy;
    if (dot >= -tolerance && dot <= length * length + tolerance) return true;
  }
  return false;
};

/** Strict point-in-simple-ring predicate used only by print geometry. */
export function pointInSimpleRing(
  point: readonly number[], ringInput: readonly (readonly number[])[],
): boolean {
  const ring = ringInput.map((candidate) => [Number(candidate[0]), Number(candidate[1])]);
  if (!ring.every((candidate) => candidate.every(Number.isFinite))) return false;
  if (ring.length < 3 || pointOnRingBoundary(point, ring)) return false;
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const a = ring[index], b = ring[previous];
    if ((a[1] > point[1]) === (b[1] > point[1])) continue;
    const crossingX = (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0];
    if (point[0] < crossingX) inside = !inside;
  }
  return inside;
}

/** Concave-safe inward normal, determined by probes on both sides of the edge. */
export function inwardNormalForEdge(
  ring: readonly (readonly number[])[], a: readonly number[], b: readonly number[], epsilon = 0,
): DimensionPoint {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const length = Math.hypot(dx, dy) || 1;
  const clean = (value: number): number => Object.is(value, -0) ? 0 : value;
  const left: [number, number] = [clean(-dy / length), clean(dx / length)];
  const right: [number, number] = [clean(-left[0]), clean(-left[1])];
  const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const numericScale = Math.max(1, length, Math.abs(mid[0]), Math.abs(mid[1]));
  const base = Math.max(numericScale * 1e-9, finiteEpsilon(epsilon) * 0.01);
  for (const distance of [base, base * 4, base * 16]) {
    const leftInside = pointInSimpleRing(
      [mid[0] + left[0] * distance, mid[1] + left[1] * distance], ring,
    );
    const rightInside = pointInSimpleRing(
      [mid[0] + right[0] * distance, mid[1] + right[1] * distance], ring,
    );
    if (leftInside !== rightInside) return leftInside ? left : right;
  }
  // Degenerate/corrupt rings fail deterministically; ordinary concave edges
  // resolve above and never depend on a centroid heuristic.
  return signedRingArea(ring) >= 0 ? left : right;
}

export function readableAngle(a: readonly number[], b: readonly number[]): number {
  let angle = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle <= -90) angle += 180;
  return angle;
}

export function dimensionEdges(
  ring: readonly (readonly number[])[],
  cmPerUnit: number,
  imperial: boolean,
  options: DimensionEdgeBuildOptions = {},
): DimensionEdge[] {
  const scale = Number(cmPerUnit);
  if (!(scale > 0) || !Number.isFinite(scale)) return [];
  const epsilon = options.epsilon === undefined
    ? dimensionEpsilonUnits(scale)
    : finiteEpsilon(options.epsilon);
  return dimensionEdgesFromNormalized(normalizeRing(ring, epsilon), scale, imperial, {
    ...options, epsilon,
  });
}

const dimensionEdgesFromNormalized = (
  compact: NormalizedRing,
  cmPerUnit: number,
  imperial: boolean,
  options: DimensionEdgeBuildOptions,
): DimensionEdge[] => {
  if (compact.points.length < 3) return [];
  const epsilon = finiteEpsilon(options.epsilon ?? dimensionEpsilonUnits(cmPerUnit));
  const ringIndex = Number.isFinite(Number(options.ringIndex)) ? Number(options.ringIndex) : 0;
  const edges: DimensionEdge[] = [];
  for (let index = 0; index < compact.points.length; index++) {
    const sourceA = compact.points[index];
    const sourceB = compact.points[(index + 1) % compact.points.length];
    const projected = projectDimensionEdge(sourceA, sourceB);
    if (!projected || !(projected.projectedLength > epsilon)) continue;
    const sourceEdgeIndices = [...(compact.edgeSources[index] || [index])]
      .sort((left, right) => left - right);
    const sourceEdgeIndex = sourceEdgeIndices[0] ?? index;
    const inwardNormal = inwardNormalForEdge(
      compact.points, projected.a, projected.b, epsilon,
    );
    const normalComponent = projected.axis === 'horizontal'
      ? inwardNormal[1]
      : inwardNormal[0];
    const normalSign: -1 | 1 = normalComponent < 0 ? -1 : 1;
    const stableKey = [
      projected.axis,
      stableNumber(projected.tangentInterval[0]),
      String(normalSign),
      stableNumber(ringIndex),
      stableNumber(sourceEdgeIndex),
    ].join('|');
    const cm = projected.projectedLength * cmPerUnit;
    edges.push({
      sourceA: [...sourceA],
      sourceB: [...sourceB],
      a: projected.a,
      b: projected.b,
      text: formatLength(cm, imperial),
      short: cm < 30,
      angle: readableAngle(projected.a, projected.b),
      mid: projected.mid,
      axis: projected.axis,
      projectedLength: projected.projectedLength,
      tangentInterval: projected.tangentInterval,
      normalCoordinate: projected.normalCoordinate,
      inwardNormal,
      normalSign,
      source: { ringIndex, edgeIndex: sourceEdgeIndex },
      sourceEdgeIndices,
      stableKey,
    });
  }
  return edges;
};

const reverseNormalizedRing = (ring: NormalizedRing): NormalizedRing => {
  const length = ring.points.length;
  return {
    points: [...ring.points].reverse().map((point) => [...point]),
    edgeSources: ring.points.map((_, index) => (
      [...ring.edgeSources[(length - 2 - index + length) % length]]
    )),
  };
};

const rotateNormalizedRing = (ring: NormalizedRing, first: number): NormalizedRing => ({
  points: [...ring.points.slice(first), ...ring.points.slice(0, first)],
  edgeSources: [...ring.edgeSources.slice(first), ...ring.edgeSources.slice(0, first)],
});

/** Stable clockwise edge order used by numbered PDF callouts. */
export function stableDimensionEdges(
  ring: readonly (readonly number[])[],
  cmPerUnit: number,
  imperial: boolean,
  options: DimensionEdgeBuildOptions = {},
): DimensionEdge[] {
  const scale = Number(cmPerUnit);
  if (!(scale > 0) || !Number.isFinite(scale)) return [];
  const epsilon = options.epsilon === undefined
    ? dimensionEpsilonUnits(scale)
    : finiteEpsilon(options.epsilon);
  let compact = normalizeRing(ring, epsilon);
  if (signedRingArea(compact.points) < 0) compact = reverseNormalizedRing(compact);
  if (compact.points.length) {
    let first = 0;
    for (let index = 1; index < compact.points.length; index++) {
      if (compact.points[index][0] < compact.points[first][0]
          || (compact.points[index][0] === compact.points[first][0]
            && compact.points[index][1] < compact.points[first][1])) {
        first = index;
      }
    }
    compact = rotateNormalizedRing(compact, first);
  }
  return dimensionEdgesFromNormalized(compact, scale, imperial, { ...options, epsilon });
}

/**
 * Build deterministic dimension lanes only from genuinely collinear edges.
 * Parallel steps on different facade lines must be laid out independently:
 * one local obstacle must not shift every parallel annotation on the page.
 */
export function groupCollinearDimensionEdges(
  edges: readonly DimensionEdge[], epsilonInput: number,
): DimensionEdge[][] {
  const epsilon = finiteEpsilon(epsilonInput);
  const groups: Array<{
    axis: DimensionAxis;
    normalSign: -1 | 1;
    normalCoordinate: number;
    edges: DimensionEdge[];
  }> = [];
  for (const edge of edges) {
    const group = groups.find((candidate) => candidate.axis === edge.axis
      && candidate.normalSign === edge.normalSign
      && Math.abs(candidate.normalCoordinate - edge.normalCoordinate) <= epsilon);
    if (group) group.edges.push(edge);
    else groups.push({ axis: edge.axis, normalSign: edge.normalSign,
      normalCoordinate: edge.normalCoordinate, edges: [edge] });
  }
  return groups.map((group) => group.edges);
}

const stableNumber = (value: number): string => (
  Object.is(value, -0) ? '0' : String(value)
);

const axisRank = (axis: DimensionAxis): number => axis === 'horizontal' ? 0 : 1;

/** Numeric form of the spec's deterministic dimension tie-break tuple. */
export function compareStableDimensionEdges(left: DimensionEdge, right: DimensionEdge): number {
  return axisRank(left.axis) - axisRank(right.axis)
    || left.tangentInterval[0] - right.tangentInterval[0]
    || left.normalSign - right.normalSign
    || left.source.ringIndex - right.source.ringIndex
    || left.source.edgeIndex - right.source.edgeIndex;
}

const intervalsMatch = (
  left: readonly [number, number], right: readonly [number, number], epsilon: number,
): boolean => Math.abs(left[0] - right[0]) <= epsilon
  && Math.abs(left[1] - right[1]) <= epsilon;

/** Geometry-only pair predicate; formatted labels deliberately do not participate. */
export function areOppositeDimensionEdges(
  left: DimensionEdge,
  right: DimensionEdge,
  ring: readonly (readonly number[])[],
  epsilonInput: number,
): boolean {
  const epsilon = finiteEpsilon(epsilonInput);
  if (left.axis !== right.axis) return false;
  if (left.source.ringIndex !== right.source.ringIndex) return false;
  if (left.inwardNormal[0] * right.inwardNormal[0]
      + left.inwardNormal[1] * right.inwardNormal[1] >= -0.5) return false;
  if (!intervalsMatch(left.tangentInterval, right.tangentInterval, epsilon)) return false;
  if (Math.abs(left.projectedLength - right.projectedLength) > epsilon) return false;
  const connectorMidpoint: [number, number] = [
    (left.mid[0] + right.mid[0]) / 2,
    (left.mid[1] + right.mid[1]) / 2,
  ];
  return pointInSimpleRing(connectorMidpoint, ring);
}

const placementScore = (
  edge: DimensionEdge, score: OppositeDimensionDedupeOptions['score'],
): DimensionPlacementScore => {
  const value = score?.(edge);
  return {
    hardCollisions: Number.isFinite(Number(value?.hardCollisions))
      ? Number(value?.hardCollisions) : 0,
    normalClearance: Number.isFinite(Number(value?.normalClearance))
      ? Number(value?.normalClearance) : 0,
  };
};

const comparePlacement = (
  left: DimensionEdge, right: DimensionEdge, score: OppositeDimensionDedupeOptions['score'],
): number => {
  const leftScore = placementScore(left, score), rightScore = placementScore(right, score);
  return leftScore.hardCollisions - rightScore.hardCollisions
    || rightScore.normalClearance - leftScore.normalClearance
    || compareStableDimensionEdges(left, right);
};

interface OppositePair {
  left: DimensionEdge;
  right: DimensionEdge;
  separation: number;
}

/**
 * Remove at most one candidate from each geometrically opposite pair in one
 * local contour. Call this helper separately for every room/ring; it never
 * performs global equal-text deduplication.
 */
export function dedupeOppositeDimensionEdges(
  edges: readonly DimensionEdge[], options: OppositeDimensionDedupeOptions,
): DimensionEdge[] {
  if (edges.length < 2) return [...edges];
  const epsilon = finiteEpsilon(options.epsilon);
  const ring = compactRing(options.ring, epsilon);
  const pairs: OppositePair[] = [];
  for (let leftIndex = 0; leftIndex < edges.length; leftIndex++) {
    for (let rightIndex = leftIndex + 1; rightIndex < edges.length; rightIndex++) {
      const left = edges[leftIndex], right = edges[rightIndex];
      if (!areOppositeDimensionEdges(left, right, ring, epsilon)) continue;
      pairs.push({
        left, right,
        separation: Math.abs(left.normalCoordinate - right.normalCoordinate),
      });
    }
  }
  pairs.sort((left, right) => {
    const distance = left.separation - right.separation;
    if (distance) return distance;
    const leftFirst = compareStableDimensionEdges(left.left, left.right) <= 0
      ? left.left : left.right;
    const leftSecond = leftFirst === left.left ? left.right : left.left;
    const rightFirst = compareStableDimensionEdges(right.left, right.right) <= 0
      ? right.left : right.right;
    const rightSecond = rightFirst === right.left ? right.right : right.left;
    return compareStableDimensionEdges(leftFirst, rightFirst)
      || compareStableDimensionEdges(leftSecond, rightSecond);
  });

  const paired = new Set<DimensionEdge>();
  const removed = new Set<DimensionEdge>();
  for (const pair of pairs) {
    if (paired.has(pair.left) || paired.has(pair.right)) continue;
    paired.add(pair.left);
    paired.add(pair.right);
    const winner = comparePlacement(pair.left, pair.right, options.score) <= 0
      ? pair.left : pair.right;
    removed.add(winner === pair.left ? pair.right : pair.left);
  }
  return edges.filter((edge) => !removed.has(edge));
}

export function signedRingArea(ring: readonly (readonly number[])[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return sum / 2;
}

export const PDF_SCALE_SERIES = [20, 25, 50, 75, 100, 150, 200, 250, 500] as const;

export function choosePdfScale(
  widthCm: number, heightCm: number, availableWidthMm: number, availableHeightMm: number,
): number {
  for (const scale of PDF_SCALE_SERIES) {
    if (widthCm * 10 / scale <= availableWidthMm
        && heightCm * 10 / scale <= availableHeightMm) return scale;
  }
  return Math.max(500, Math.ceil(Math.max(
    widthCm * 10 / availableWidthMm, heightCm * 10 / availableHeightMm,
  ) / 50) * 50);
}
