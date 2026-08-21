/**
 * Pure planar wall graph used by the Plan editor.
 *
 * Source axes are atomized at endpoint, T, X and collinear-overlap vertices.
 * Every undirected atom retains all source keys. Faces are then obtained by a
 * clockwise turn from the reverse half-edge; positive signed walks are the
 * bounded faces, while the opposite walk is the unbounded exterior.
 *
 * The implementation is intentionally independent of Lit/config mutation.
 * A deterministic X sweep with an interval treap removes disjoint bounding
 * boxes before exact intersection work. Its cost is O((E + K) log E), where K
 * is the bounded-box candidate set (and includes the real intersections I).
 * The editor invokes it only for accepted clicks, never for pointermove/hover.
 */

export interface WallGraphSourceSegment {
  a: readonly number[];
  b: readonly number[];
  /** Stable provenance key. More than one source may own the same atom. */
  key: string;
}

export interface WallGraphAtom {
  a: [number, number];
  b: [number, number];
  key: string;
  sourceKeys: string[];
}

export interface WallGraphFace {
  /** Open ring: the first point is not repeated at the end. */
  ring: [number, number][];
  key: string;
  area: number;
  atomKeys: string[];
  sourceKeys: string[];
}

export interface WallFaceGraph {
  atoms: WallGraphAtom[];
  faces: WallGraphFace[];
}

export interface WallChainSegment {
  a: [number, number];
  b: [number, number];
  cm: number;
}

const DEFAULT_EPSILON = 0.001;

/** Compatibility projection for a session token written by the old toolbar. */
export function normalizeUnifiedWallTool(value: unknown): unknown {
  return value === 'partition' ? 'draw' : value;
}

/** Immutable open-chain projection used by explicit finish and full rejection. */
/**
 * Thickness of every segment in a chain — the single answer to that question.
 *
 * Issue #234: five call sites decided it independently and disagreed in three
 * different ways. The preview filled a gap with the toolbar field, the two
 * partition writers with a hard-coded 15 cm, the room writer with the first
 * edge's value. So a chain drawn at 30 cm was shown at 30 and stored at 15, and
 * the owner discovered it much later by hovering a wall. Two formulas for one
 * meaning always drift; there is exactly one here now.
 *
 * A missing record inherits the previous segment of the same chain, then the
 * toolbar field, then the default (owner's decision 2026-08-21): that is what
 * the person saw on screen while drawing, and a global default is not.
 *
 * Strictly positive is the validity boundary. The previous `wallChainSegments`
 * accepted a recorded zero, which cannot be drawn through the UI (1..100 cm,
 * `docs/WALL-THICKNESS.md`) but can sit in an old draft.
 */
export function chainSegmentCms(
  segmentCount: number,
  recorded: readonly (number | null | undefined)[] | null | undefined,
  activeCm: number | null | undefined,
  defaultCm: number,
): number[] {
  const count = Number.isFinite(segmentCount) && segmentCount > 0
    ? Math.floor(segmentCount) : 0;
  const valid = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
  // `defaultCm` — ответственность вызывающего: он передаёт
  // DRAW_WALL_DEFAULT_CM. Константа сюда не импортируется намеренно — этот
  // модуль не зависит ни от чего, и второе место, где живёт число 15, было бы
  // ровно тем дублированием, которое задача и убирает. Невалидный default —
  // дефект вызывающего, поэтому он приводится к минимальной допустимой
  // толщине (1 см, docs/WALL-THICKNESS.md), а не к выдуманному значению.
  const fallbackTail = valid(activeCm) ?? valid(defaultCm) ?? 1;
  const out: number[] = [];
  let previous: number | null = null;
  for (let i = 0; i < count; i++) {
    const own = valid(recorded?.[i]);
    const cm = own ?? previous ?? fallbackTail;
    out.push(cm);
    previous = cm;
  }
  return out;
}

/**
 * Drawable segments of a chain. Thickness arrives already resolved (#234): this
 * function no longer owns a fallback of its own, because owning one is how the
 * disagreement started.
 */
export function wallChainSegments(
  path: readonly (readonly number[])[],
  cms: readonly number[],
): WallChainSegment[] {
  const result: WallChainSegment[] = [];
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i];
    const b = path[i + 1];
    if (!finitePoint(a) || !finitePoint(b)
        || Math.hypot(b[0] - a[0], b[1] - a[1]) <= Number.EPSILON) continue;
    // The resolver guarantees a positive number per index; a caller that skips
    // it is a defect, so the value is used as given rather than re-defaulted.
    result.push({ a: [a[0], a[1]], b: [b[0], b[1]], cm: cms[i] });
  }
  return result;
}

function finitePoint(point: readonly number[] | null | undefined): point is readonly [number, number] {
  return !!point && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]);
}

function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

function signedArea(ring: readonly (readonly number[])[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return sum / 2;
}

function canonicalVertex(point: readonly number[], epsilon: number): [number, number] {
  const step = Math.max(epsilon, Number.EPSILON);
  const x = Math.round(point[0] / step) * step;
  const y = Math.round(point[1] / step) * step;
  return [Object.is(x, -0) ? 0 : x, Object.is(y, -0) ? 0 : y];
}

function vertexKey(point: readonly number[], epsilon: number): string {
  const canonical = canonicalVertex(point, epsilon);
  return `${Math.round(canonical[0] / epsilon)},${Math.round(canonical[1] / epsilon)}`;
}

function edgeKey(aKey: string, bKey: string): string {
  return aKey.localeCompare(bKey) <= 0 ? `${aKey}|${bKey}` : `${bKey}|${aKey}`;
}

function canonicalCycle(keys: readonly string[]): string {
  if (!keys.length) return '';
  const candidates: string[] = [];
  for (const sequence of [keys, [...keys].reverse()] as const) {
    for (let i = 0; i < sequence.length; i++) {
      candidates.push([...sequence.slice(i), ...sequence.slice(0, i)].join(';'));
    }
  }
  candidates.sort((a, b) => a.localeCompare(b));
  return candidates[0];
}

function identityCycle(
  keys: readonly string[], points: ReadonlyMap<string, readonly number[]>, epsilon: number,
): string[] {
  const result = [...keys];
  for (let changed = true; changed && result.length >= 3;) {
    changed = false;
    for (let i = 0; i < result.length; i++) {
      const a = points.get(result[(i - 1 + result.length) % result.length])!;
      const b = points.get(result[i])!;
      const c = points.get(result[(i + 1) % result.length])!;
      const abx = b[0] - a[0];
      const aby = b[1] - a[1];
      const bcx = c[0] - b[0];
      const bcy = c[1] - b[1];
      if (Math.abs(cross(abx, aby, bcx, bcy))
          <= epsilon * Math.max(Math.hypot(abx, aby), Math.hypot(bcx, bcy), 1)
          && abx * bcx + aby * bcy >= 0) {
        result.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return result;
}

function uniqueSorted(values: number[], epsilon: number): number[] {
  const sorted = values
    .map((value) => Math.max(0, Math.min(1, value)))
    .sort((a, b) => a - b);
  const result: number[] = [];
  for (const value of sorted) {
    if (!result.length || Math.abs(value - result[result.length - 1]) > epsilon) result.push(value);
  }
  return result;
}

function pointAt(source: WallGraphSourceSegment, t: number): [number, number] {
  return [
    source.a[0] + (source.b[0] - source.a[0]) * t,
    source.a[1] + (source.b[1] - source.a[1]) * t,
  ];
}

function projectedParameter(point: readonly number[], source: WallGraphSourceSegment): number {
  const dx = source.b[0] - source.a[0];
  const dy = source.b[1] - source.a[1];
  const length2 = dx * dx + dy * dy;
  return length2 > 0
    ? ((point[0] - source.a[0]) * dx + (point[1] - source.a[1]) * dy) / length2
    : 0;
}

function pointOnSource(
  point: readonly number[], source: WallGraphSourceSegment, epsilon: number,
): number | null {
  const t = projectedParameter(point, source);
  if (t < -epsilon || t > 1 + epsilon) return null;
  const projected = pointAt(source, t);
  return Math.hypot(projected[0] - point[0], projected[1] - point[1]) <= epsilon
    ? Math.max(0, Math.min(1, t)) : null;
}

function addPairCuts(
  left: WallGraphSourceSegment,
  right: WallGraphSourceSegment,
  leftCuts: number[],
  rightCuts: number[],
  epsilon: number,
): void {
  const rx = left.b[0] - left.a[0];
  const ry = left.b[1] - left.a[1];
  const sx = right.b[0] - right.a[0];
  const sy = right.b[1] - right.a[1];
  const qpx = right.a[0] - left.a[0];
  const qpy = right.a[1] - left.a[1];
  const denominator = cross(rx, ry, sx, sy);
  const scale = Math.max(Math.hypot(rx, ry), Math.hypot(sx, sy), 1);
  if (Math.abs(denominator) > epsilon * scale) {
    const t = cross(qpx, qpy, sx, sy) / denominator;
    const u = cross(qpx, qpy, rx, ry) / denominator;
    if (t >= -epsilon && t <= 1 + epsilon && u >= -epsilon && u <= 1 + epsilon) {
      leftCuts.push(Math.max(0, Math.min(1, t)));
      rightCuts.push(Math.max(0, Math.min(1, u)));
    }
    return;
  }

  // Parallel but non-collinear axes never meet. For collinear overlaps, every
  // endpoint which lies on the other source becomes a cut on both owners.
  if (Math.abs(cross(qpx, qpy, rx, ry)) > epsilon * scale) return;
  for (const point of [right.a, right.b]) {
    const t = pointOnSource(point, left, epsilon);
    if (t != null) leftCuts.push(t);
  }
  for (const point of [left.a, left.b]) {
    const u = pointOnSource(point, right, epsilon);
    if (u != null) rightCuts.push(u);
  }
}

interface SegmentBounds {
  index: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface IntervalNode {
  item: SegmentBounds;
  priority: number;
  subtreeMaxY: number;
  left: IntervalNode | null;
  right: IntervalNode | null;
}

function intervalPriority(index: number): number {
  let value = (index + 1) | 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return value >>> 0;
}

function intervalCompare(left: SegmentBounds, right: SegmentBounds): number {
  return left.minY - right.minY || left.index - right.index;
}

function refreshInterval(node: IntervalNode): IntervalNode {
  node.subtreeMaxY = Math.max(
    node.item.maxY,
    node.left?.subtreeMaxY ?? -Infinity,
    node.right?.subtreeMaxY ?? -Infinity,
  );
  return node;
}

function rotateIntervalLeft(node: IntervalNode): IntervalNode {
  const root = node.right!;
  node.right = root.left;
  root.left = refreshInterval(node);
  return refreshInterval(root);
}

function rotateIntervalRight(node: IntervalNode): IntervalNode {
  const root = node.left!;
  node.left = root.right;
  root.right = refreshInterval(node);
  return refreshInterval(root);
}

function insertInterval(root: IntervalNode | null, item: SegmentBounds): IntervalNode {
  if (!root) return {
    item, priority: intervalPriority(item.index), subtreeMaxY: item.maxY,
    left: null, right: null,
  };
  if (intervalCompare(item, root.item) < 0) {
    root.left = insertInterval(root.left, item);
    if (root.left.priority < root.priority) root = rotateIntervalRight(root);
  } else {
    root.right = insertInterval(root.right, item);
    if (root.right.priority < root.priority) root = rotateIntervalLeft(root);
  }
  return refreshInterval(root);
}

function removeInterval(root: IntervalNode | null, item: SegmentBounds): IntervalNode | null {
  if (!root) return null;
  const order = intervalCompare(item, root.item);
  if (order < 0) root.left = removeInterval(root.left, item);
  else if (order > 0) root.right = removeInterval(root.right, item);
  else if (!root.left) return root.right;
  else if (!root.right) return root.left;
  else if (root.left.priority < root.right.priority) {
    root = rotateIntervalRight(root);
    root.right = removeInterval(root.right, item);
  } else {
    root = rotateIntervalLeft(root);
    root.left = removeInterval(root.left, item);
  }
  return refreshInterval(root);
}

function queryIntervals(
  root: IntervalNode | null, minY: number, maxY: number, output: SegmentBounds[],
): void {
  if (!root || root.subtreeMaxY < minY) return;
  if (root.left?.subtreeMaxY != null && root.left.subtreeMaxY >= minY)
    queryIntervals(root.left, minY, maxY, output);
  if (root.item.minY <= maxY && root.item.maxY >= minY) output.push(root.item);
  if (root.item.minY <= maxY) queryIntervals(root.right, minY, maxY, output);
}

function discoverPairCuts(
  sources: readonly WallGraphSourceSegment[], cuts: number[][], epsilon: number,
): void {
  const bounds = sources.map((source, index): SegmentBounds => ({
    index,
    minX: Math.min(source.a[0], source.b[0]) - epsilon,
    maxX: Math.max(source.a[0], source.b[0]) + epsilon,
    minY: Math.min(source.a[1], source.b[1]) - epsilon,
    maxY: Math.max(source.a[1], source.b[1]) + epsilon,
  }));
  const starts = [...bounds].sort((left, right) =>
    left.minX - right.minX || left.minY - right.minY || left.index - right.index);
  const ends = [...bounds].sort((left, right) =>
    left.maxX - right.maxX || left.index - right.index);
  const active = new Set<number>();
  let intervalRoot: IntervalNode | null = null;
  let endIndex = 0;
  for (const item of starts) {
    while (endIndex < ends.length && ends[endIndex].maxX < item.minX) {
      const expired = ends[endIndex++];
      if (!active.delete(expired.index)) continue;
      intervalRoot = removeInterval(intervalRoot, expired);
    }
    const candidates: SegmentBounds[] = [];
    queryIntervals(intervalRoot, item.minY, item.maxY, candidates);
    candidates.sort((left, right) => left.index - right.index);
    for (const candidate of candidates) {
      addPairCuts(
        sources[candidate.index], sources[item.index],
        cuts[candidate.index], cuts[item.index], epsilon,
      );
    }
    active.add(item.index);
    intervalRoot = insertInterval(intervalRoot, item);
  }
}

/** Atomize valid source axes without changing their persisted representation. */
export function atomizeWallSegments(
  input: readonly WallGraphSourceSegment[],
  epsilon = DEFAULT_EPSILON,
): WallGraphAtom[] {
  const safeEpsilon = Number.isFinite(epsilon) && epsilon > 0 ? epsilon : DEFAULT_EPSILON;
  const sources = input.filter((source) => finitePoint(source.a) && finitePoint(source.b)
    && typeof source.key === 'string' && source.key.length > 0
    && Math.hypot(source.b[0] - source.a[0], source.b[1] - source.a[1]) > safeEpsilon);
  const cuts = sources.map(() => [0, 1]);
  discoverPairCuts(sources, cuts, safeEpsilon);

  const atoms = new Map<string, {
    a: [number, number]; b: [number, number]; sourceKeys: Set<string>;
  }>();
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    const length = Math.hypot(
      source.b[0] - source.a[0], source.b[1] - source.a[1],
    );
    const parameters = uniqueSorted(cuts[i], safeEpsilon / Math.max(length, 1));
    for (let j = 0; j + 1 < parameters.length; j++) {
      const a = canonicalVertex(pointAt(source, parameters[j]), safeEpsilon);
      const b = canonicalVertex(pointAt(source, parameters[j + 1]), safeEpsilon);
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) <= safeEpsilon) continue;
      const aKey = vertexKey(a, safeEpsilon);
      const bKey = vertexKey(b, safeEpsilon);
      const key = edgeKey(aKey, bKey);
      const existing = atoms.get(key);
      if (existing) existing.sourceKeys.add(source.key);
      else atoms.set(key, {
        a: aKey.localeCompare(bKey) <= 0 ? a : b,
        b: aKey.localeCompare(bKey) <= 0 ? b : a,
        sourceKeys: new Set([source.key]),
      });
    }
  }
  return [...atoms.entries()]
    .map(([key, atom]) => ({
      key, a: atom.a, b: atom.b,
      sourceKeys: [...atom.sourceKeys].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

/** Build deterministic simple bounded faces from already-atomized axes. */
export function buildWallFaceGraph(
  input: readonly WallGraphSourceSegment[],
  epsilon = DEFAULT_EPSILON,
): WallFaceGraph {
  const safeEpsilon = Number.isFinite(epsilon) && epsilon > 0 ? epsilon : DEFAULT_EPSILON;
  const atoms = atomizeWallSegments(input, safeEpsilon);
  const points = new Map<string, [number, number]>();
  const adjacency = new Map<string, Set<string>>();
  const atomsByKey = new Map(atoms.map((atom) => [atom.key, atom]));
  for (const atom of atoms) {
    const aKey = vertexKey(atom.a, safeEpsilon);
    const bKey = vertexKey(atom.b, safeEpsilon);
    points.set(aKey, atom.a);
    points.set(bKey, atom.b);
    if (!adjacency.has(aKey)) adjacency.set(aKey, new Set());
    if (!adjacency.has(bKey)) adjacency.set(bKey, new Set());
    adjacency.get(aKey)!.add(bKey);
    adjacency.get(bKey)!.add(aKey);
  }
  const sortedAdjacency = new Map<string, string[]>();
  for (const [key, neighbours] of adjacency) {
    const origin = points.get(key)!;
    sortedAdjacency.set(key, [...neighbours].sort((left, right) => {
      const a = points.get(left)!;
      const b = points.get(right)!;
      return Math.atan2(a[1] - origin[1], a[0] - origin[0])
        - Math.atan2(b[1] - origin[1], b[0] - origin[0])
        || left.localeCompare(right);
    }));
  }

  const directedVisited = new Set<string>();
  const facesByKey = new Map<string, WallGraphFace>();
  const directedKey = (a: string, b: string): string => `${a}>${b}`;
  for (const atom of atoms) {
    const endpoints = [vertexKey(atom.a, safeEpsilon), vertexKey(atom.b, safeEpsilon)] as const;
    for (const [startA, startB] of [endpoints, [endpoints[1], endpoints[0]]] as const) {
      if (directedVisited.has(directedKey(startA, startB))) continue;
      const vertexKeys: string[] = [];
      const atomKeys: string[] = [];
      let a = startA;
      let b = startB;
      let closed = false;
      for (let guard = 0; guard <= atoms.length * 2 + 2; guard++) {
        const halfKey = directedKey(a, b);
        if (directedVisited.has(halfKey)) {
          closed = a === startA && b === startB;
          break;
        }
        directedVisited.add(halfKey);
        vertexKeys.push(a);
        atomKeys.push(edgeKey(a, b));
        const outgoing = sortedAdjacency.get(b) || [];
        const reverseIndex = outgoing.indexOf(a);
        if (reverseIndex < 0 || !outgoing.length) break;
        const next = outgoing[(reverseIndex - 1 + outgoing.length) % outgoing.length];
        a = b;
        b = next;
        if (a === startA && b === startB) {
          closed = true;
          break;
        }
      }
      if (!closed || new Set(vertexKeys).size < 3
          || new Set(vertexKeys).size !== vertexKeys.length) continue;
      const ring = vertexKeys.map((key) => points.get(key)!) as [number, number][];
      const area = signedArea(ring);
      if (!(area > safeEpsilon * safeEpsilon)) continue;
      // Derived T/X vertices are topology, not polygon identity. A harmless
      // subdivision of a straight wall must not make an old face look new.
      const key = canonicalCycle(identityCycle(vertexKeys, points, safeEpsilon));
      const sources = new Set<string>();
      for (const key of atomKeys) {
        for (const sourceKey of atomsByKey.get(key)?.sourceKeys || []) sources.add(sourceKey);
      }
      const face: WallGraphFace = {
        ring, key, area,
        atomKeys: [...atomKeys],
        sourceKeys: [...sources].sort((left, right) => left.localeCompare(right)),
      };
      if (!facesByKey.has(key)) facesByKey.set(key, face);
    }
  }

  return {
    atoms,
    faces: [...facesByKey.values()].sort((left, right) =>
      left.area - right.area || left.key.localeCompare(right.key)),
  };
}

/** Faces introduced by one accepted source segment, ordered area-first. */
export function findNewWallFaces(
  before: readonly WallGraphSourceSegment[],
  after: readonly WallGraphSourceSegment[],
  addedSourceKey: string,
  epsilon = DEFAULT_EPSILON,
): WallGraphFace[] {
  return findNewWallFacesInGraphs(
    buildWallFaceGraph(before, epsilon), buildWallFaceGraph(after, epsilon), addedSourceKey,
  );
}

/** Delta projection for callers that retain a bounded structural graph cache. */
export function findNewWallFacesInGraphs(
  before: WallFaceGraph,
  after: WallFaceGraph,
  addedSourceKey: string,
): WallGraphFace[] {
  const beforeKeys = new Set(before.faces.map((face) => face.key));
  return after.faces.filter((face) =>
    !beforeKeys.has(face.key) && face.sourceKeys.includes(addedSourceKey));
}
