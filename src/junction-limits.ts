/**
 * Issue #329 — limits on wall junctions (owner decision 2026-08-27).
 *
 * Reasonable plans never contain the shapes that break wall-body geometry:
 * a 10° apex whose wall bodies overlap for 86 cm, seven walls in one node,
 * a segment shorter than its own thickness, two nodes 4 cm apart, or a room
 * whose masonry eats the whole interior. These pure checks refuse such a
 * WRITE; existing documents are never re-validated (spec §3) — migration,
 * import and restore stay untouched.
 *
 * Thresholds are absolute (centimetres, degrees) and do not scale with the
 * space's `cell_cm` (spec r1-L1).
*/

import { GRID_STEP_N } from './space-geometry';
import {
  innerContourForRoom, multiWallNodesForGeometry, wallBodiesGeometry,
} from './wall-thickness';

export const MIN_JUNCTION_ANGLE_DEG = 15;
export const MAX_JUNCTION_VALENCE = 6;
export const MIN_SEGMENT_LENGTH_CM = 20;
export const MIN_NODE_DISTANCE_CM = 5;
export const MIN_ROOM_CLEARANCE_CM2 = 25;

export type JunctionLimitRule =
  | 'angle' | 'valence' | 'length' | 'distance' | 'clearance'
  /** #331 §2.5: the check itself failed — the write is refused, not waved through. */
  | 'check_failed';

export interface JunctionLimitViolation {
  rule: JunctionLimitRule;
  /** Node key, segment id or room id — whatever the rule is about. */
  subject: string;
  /** Actual value in the rule's own unit (degrees, count, cm, cm²). */
  actual: number;
  /** The limit that was violated, same unit. */
  limit: number;
}

export interface LimitSegment {
  id?: string;
  a: number[];
  b: number[];
  /** Wall thickness in centimetres; 0 for a bodyless wall (#306). */
  cm?: number;
}

/** Shared full/affected-room validation used by editor writes and lightweight resize previews. */
export function junctionLimitViolations(
  config: any,
  spaceId: string,
  segments: readonly LimitSegment[],
  sharedGeometry?: any,
  roomIds?: ReadonlySet<string>,
): JunctionLimitViolation[] {
  const space = (config?.spaces || []).find((item: any) => item?.id === spaceId);
  if (!space) return [];
  const cellCm = Number(space.cell_cm) > 0 ? Number(space.cell_cm) : 5;
  const violations = [
    ...checkNodes(segments), ...checkSegmentLengths(segments, cellCm, GRID_STEP_N),
    ...checkNodeDistances(segments, cellCm, GRID_STEP_N),
  ];
  let nodes: ReturnType<typeof multiWallNodesForGeometry> | null =
    sharedGeometry?.multiWallNodes || null;
  if (!nodes) {
    try {
      nodes = multiWallNodesForGeometry(
        space.rooms || [], space.walls || [], [], GRID_STEP_N, cellCm, GRID_STEP_N, 1,
      );
    } catch { nodes = null; }
  }
  let roomGeometry: any = sharedGeometry?.status === 'ok'
    || sharedGeometry?.status === 'degraded-extra' ? sharedGeometry.roomGeom : null;
  const lightweight = sharedGeometry === null || sharedGeometry?.status === 'lightweight';
  if (!roomGeometry && !lightweight && nodes?.nodes.length) {
    try {
      const geometry = wallBodiesGeometry(
        space.rooms || [], space.walls || [], [], [], GRID_STEP_N, cellCm, GRID_STEP_N, 1,
      );
      roomGeometry = geometry?.status === 'ok' || geometry?.status === 'degraded-extra'
        ? geometry.roomGeom : null;
    } catch { roomGeometry = null; }
  }
  for (const room of space.rooms || []) {
    const roomId = String(room?.id || '');
    if (!roomId || (roomIds && !roomIds.has(roomId))) continue;
    let inner: number[][] | null = null;
    try {
      inner = innerContourForRoom(
        space.rooms || [], roomId, space.walls || [], [], GRID_STEP_N, cellCm, GRID_STEP_N, 1,
        lightweight ? null : roomGeometry ?? undefined, nodes,
      );
    } catch { inner = null; }
    violations.push(...checkRoomClearance(roomId, inner, cellCm, GRID_STEP_N));
  }
  return violations;
}

const EPS = 1e-9;
/**
 * #331 §2.1: below this two points are ONE node / a node is ON the wall —
 * floating debris of pre-canonicalisation arithmetic, not a near miss. Two
 * orders above the storage grid (1e-9), orders below any meaningful plan
 * gap (the smallest rule threshold is 5 cm ≈ 4e-4).
 */
const INCIDENT_EPS = 2e-7;
const KEY_FACTOR = 1e7;
/**
 * #331 §2.1: quantised with the repository's canonicalisation formula —
 * native Math.round and Python round() part ways on .5 ticks (banker's
 * rounding), the exact parity lesson coordinate-canonicalization encodes.
 * `-0` normalises to `0` so the string key cannot fork on the sign of zero.
 */
const quantizeKeyCoord = (value: number): number => {
  const rounded = Math.sign(value) * Math.floor(Math.abs(value) * KEY_FACTOR + 0.5) / KEY_FACTOR;
  return Object.is(rounded, -0) ? 0 : rounded;
};
const key = (point: number[]): string =>
  `${quantizeKeyCoord(point[0])},${quantizeKeyCoord(point[1])}`;
const length = (a: number[], b: number[]): number => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** Normalised units per centimetre for a space (`cell_cm` on a grid pitch). */
export const cmToUnits = (cm: number, cellCm: number, gridPitch: number): number =>
  (cm / (cellCm || 1)) * gridPitch;

const angleBetween = (from: number[], to: number[]): number =>
  Math.atan2(to[1] - from[1], to[0] - from[0]);

const finitePoint = (point: unknown): point is number[] =>
  Array.isArray(point) && point.length >= 2 && point.every((value) => Number.isFinite(value));

const usableSegments = (segments: readonly LimitSegment[]): LimitSegment[] =>
  (segments || []).filter((segment) => finitePoint(segment?.a) && finitePoint(segment?.b)
    && length(segment.a, segment.b) > EPS);

/** П1 + П2: per-node valence and the smallest angle between neighbours. */
export function checkNodes(
  segments: readonly LimitSegment[],
  { minAngleDeg = MIN_JUNCTION_ANGLE_DEG, maxValence = MAX_JUNCTION_VALENCE } = {},
): JunctionLimitViolation[] {
  const rays = new Map<string, number[]>();
  for (const segment of usableSegments(segments)) {
    for (const [from, to] of [[segment.a, segment.b], [segment.b, segment.a]]) {
      const list = rays.get(key(from)) || [];
      list.push(angleBetween(from, to));
      rays.set(key(from), list);
    }
  }
  const violations: JunctionLimitViolation[] = [];
  for (const [node, angles] of rays) {
    if (angles.length > maxValence) {
      violations.push({ rule: 'valence', subject: node, actual: angles.length, limit: maxValence });
    }
    if (angles.length < 2) continue;
    const sorted = [...angles].sort((x, y) => x - y);
    let smallest = Infinity;
    for (let index = 0; index < sorted.length; index++) {
      const next = sorted[(index + 1) % sorted.length];
      let delta = next - sorted[index];
      if (index === sorted.length - 1) delta += Math.PI * 2;
      const degrees = (delta * 180) / Math.PI;
      // A ~0° pair is NOT a violation — and cannot be (#331 revision 4,
      // learned in the field): a shared wall of two adjacent rooms is two
      // co-located owner atoms ON ONE LINE, so every shared-wall node
      // carries a legitimate 0° pair by construction, and resizing a room
      // until its wall lands on a neighbour's is an ordinary edit. An exact
      // duplicate wall is therefore indistinguishable from the shared-wall
      // model at this level and stays a KNOWN LIMITATION of П1.
      if (degrees > EPS && degrees < smallest) smallest = degrees;
    }
    if (smallest < minAngleDeg - 1e-9) {
      violations.push({ rule: 'angle', subject: node, actual: smallest, limit: minAngleDeg });
    }
  }
  return violations;
}

/** Direction of a segment normalised to [0, 180). */
const axisDegrees = (segment: LimitSegment): number => {
  const degrees = (Math.atan2(segment.b[1] - segment.a[1], segment.b[0] - segment.a[0])
    * 180) / Math.PI;
  return ((degrees % 180) + 180) % 180;
};

const collinear = (left: LimitSegment, right: LimitSegment, toleranceDeg = 1): boolean => {
  const delta = Math.abs(axisDegrees(left) - axisDegrees(right));
  return Math.min(delta, 180 - delta) <= toleranceDeg;
};

const buildNodeIndex = (segments: readonly LimitSegment[]): Map<string, LimitSegment[]> => {
  const byNode = new Map<string, LimitSegment[]>();
  for (const item of segments) {
    for (const point of [item.a, item.b]) {
      const list = byNode.get(key(point));
      if (list) list.push(item);
      else byNode.set(key(point), [item]);
    }
  }
  return byNode;
};

/**
 * Length of the whole WALL a segment belongs to, not of the atom.
 *
 * The model splits a straight wall into atoms at every junction, so a plain
 * run picks up short pieces that no one drew: where a 30 cm wall meets a
 * 20 cm one, atomisation leaves a (30−20)/2 = 5 cm piece that compensates the
 * thickness step (owner report 2026-08-27). Those pieces are collinear
 * continuations of the same wall at the same thickness, so П3 measures the
 * maximal collinear chain through the segment's nodes.
 */
export function collinearRunLengthUnits(
  segment: LimitSegment, segments: readonly LimitSegment[],
  byNodeIndex?: Map<string, LimitSegment[]>,
): number {
  const usable = usableSegments(segments);
  // #330 §4.3: building the node index per SEGMENT made П3 quadratic
  // (289 ms on 576 atoms). The caller that loops over every segment builds
  // it once and passes it in; a direct call still builds its own.
  const byNode = byNodeIndex ?? buildNodeIndex(usable);
  // #331 §2.3/§2.4: an iterative edge walk over the collinear component —
  // no recursion (a 10 000-atom chain must answer, not overflow the stack),
  // no combinatorial DFS (every atom joins the run at most once, O(E)), and
  // no silently dropped branch (the old `.find` lost every fork but the
  // first). Collinearity is measured against the BASE segment's axis, not
  // the previous atom's, so an arc of 0.9°-per-atom pieces cannot creep
  // around a corner while posing as one straight wall.
  const visited = new Set<LimitSegment>([segment]);
  let total = length(segment.a, segment.b);
  const frontier: number[][] = [segment.a, segment.b];
  while (frontier.length) {
    const node = frontier.pop() as number[];
    for (const candidate of byNode.get(key(node)) || []) {
      if (visited.has(candidate)) continue;
      if (!collinear(candidate, segment)) continue;
      if (Number(candidate.cm || 0) !== Number(segment.cm || 0)) continue;
      visited.add(candidate);
      total += length(candidate.a, candidate.b);
      frontier.push(candidate.a, candidate.b);
    }
  }
  return total;
}

/** П3: a wall is at least 20 cm and never shorter than its own thickness. */
export function checkSegmentLengths(
  segments: readonly LimitSegment[],
  cellCm: number,
  gridPitch: number,
  { minLengthCm = MIN_SEGMENT_LENGTH_CM } = {},
): JunctionLimitViolation[] {
  const violations: JunctionLimitViolation[] = [];
  const usable = usableSegments(segments);
  const byNode = buildNodeIndex(usable);
  for (const segment of usable) {
    const units = collinearRunLengthUnits(segment, usable, byNode);
    const cm = (units / gridPitch) * (cellCm || 1);
    const limit = Math.max(minLengthCm, Number(segment.cm) > 0 ? Number(segment.cm) : 0);
    if (cm < limit - 1e-9) {
      violations.push({
        rule: 'length', subject: String(segment.id || key(segment.a)), actual: cm, limit,
      });
    }
  }
  return violations;
}

const distanceToSegment = (point: number[], a: number[], b: number[]): number => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq <= EPS ? 0
    : Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lengthSq));
  return Math.hypot(point[0] - (a[0] + dx * t), point[1] - (a[1] + dy * t));
};

/**
 * П4: non-incident nodes and node-to-foreign-wall clearance (absolute cm).
 *
 * #330 §4.5: the all-pairs form cost 104 ms on 576 atoms and grew
 * quadratically. Nodes and segment bounding boxes (padded by the threshold)
 * are hashed into a grid with the threshold as cell size, so each node is
 * compared only against its 9-cell neighbourhood — verdicts are identical
 * (equivalence pinned by unit tests and the TS↔Python parity suite).
 */
export function checkNodeDistances(
  segments: readonly LimitSegment[],
  cellCm: number,
  gridPitch: number,
  { minDistanceCm = MIN_NODE_DISTANCE_CM } = {},
): JunctionLimitViolation[] {
  const usable = usableSegments(segments);
  const nodes = new Map<string, number[]>();
  for (const segment of usable) {
    nodes.set(key(segment.a), segment.a);
    nodes.set(key(segment.b), segment.b);
  }
  const minUnits = cmToUnits(minDistanceCm, cellCm, gridPitch);
  const size = minUnits > EPS ? minUnits : 1;
  const cellOf = (x: number, y: number): string =>
    `${Math.floor(x / size)},${Math.floor(y / size)}`;

  const nodeGrid = new Map<string, [string, number[]][]>();
  for (const [nodeKey, point] of nodes) {
    const cell = cellOf(point[0], point[1]);
    const list = nodeGrid.get(cell);
    if (list) list.push([nodeKey, point]);
    else nodeGrid.set(cell, [[nodeKey, point]]);
  }
  const segmentGrid = new Map<string, LimitSegment[]>();
  for (const segment of usable) {
    const x0 = Math.min(segment.a[0], segment.b[0]) - minUnits;
    const x1 = Math.max(segment.a[0], segment.b[0]) + minUnits;
    const y0 = Math.min(segment.a[1], segment.b[1]) - minUnits;
    const y1 = Math.max(segment.a[1], segment.b[1]) + minUnits;
    for (let cx = Math.floor(x0 / size); cx <= Math.floor(x1 / size); cx++) {
      for (let cy = Math.floor(y0 / size); cy <= Math.floor(y1 / size); cy++) {
        const cell = `${cx},${cy}`;
        const list = segmentGrid.get(cell);
        if (list) list.push(segment);
        else segmentGrid.set(cell, [segment]);
      }
    }
  }

  const violations: JunctionLimitViolation[] = [];
  for (const [nodeKey, point] of nodes) {
    const cx = Math.floor(point[0] / size);
    const cy = Math.floor(point[1] / size);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const [otherKey, other] of nodeGrid.get(`${cx + dx},${cy + dy}`) || []) {
          // Each unordered pair once: the lexicographic order replaces the
          // i<j of the all-pairs loop, so the verdict set is identical.
          if (nodeKey >= otherKey) continue;
          const distance = length(point, other);
          // #331 §2.1: raw-coordinate debris within the incidence quantum is
          // ONE node that landed on two neighbouring keys — never a near miss.
          if (distance <= INCIDENT_EPS) continue;
          if (distance < minUnits - 1e-9) {
            violations.push({
              rule: 'distance', subject: `${nodeKey} ↔ ${otherKey}`,
              actual: (distance / gridPitch) * (cellCm || 1), limit: minDistanceCm,
            });
          }
        }
      }
    }
    for (const segment of segmentGrid.get(`${cx},${cy}`) || []) {
      // A node that belongs to the wall (either end) is a legal T-joint or
      // corner — the rule is about NEAR misses, not incidence.
      if (key(segment.a) === nodeKey || key(segment.b) === nodeKey) continue;
      const distance = distanceToSegment(point, segment.a, segment.b);
      // Sitting exactly ON the wall is the other legal incidence: a T-joint
      // into the middle of a foreign wall (spec П4). Only a real gap counts.
      if (distance <= INCIDENT_EPS) continue;
      if (distance < minUnits - 1e-9) {
        violations.push({
          rule: 'distance', subject: `${nodeKey} → ${String(segment.id || key(segment.a))}`,
          actual: (distance / gridPitch) * (cellCm || 1), limit: minDistanceCm,
        });
      }
    }
  }
  return violations;
}

/** П5: the room keeps a real interior after its masonry is subtracted. */
export function checkRoomClearance(
  roomId: string,
  innerContour: number[][] | null | undefined,
  cellCm: number,
  gridPitch: number,
  { minClearanceCm2 = MIN_ROOM_CLEARANCE_CM2 } = {},
): JunctionLimitViolation[] {
  const points = (innerContour || []).filter(finitePoint);
  const areaUnits = points.length < 3 ? 0 : Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + (point[0] * next[1] - next[0] * point[1]);
  }, 0)) / 2;
  const cmPerUnit = (cellCm || 1) / gridPitch;
  const areaCm2 = areaUnits * cmPerUnit * cmPerUnit;
  if (areaCm2 < minClearanceCm2 - 1e-9) {
    return [{
      rule: 'clearance', subject: roomId, actual: areaCm2, limit: minClearanceCm2,
    }];
  }
  return [];
}

/**
 * Violations introduced BY THIS WRITE, counted per rule.
 *
 * Subject identity churns across a structural write (segments are re-atomised
 * and re-keyed), so matching by subject would report an inherited violation as
 * new the moment its carrier is re-keyed — that alone refused legitimate
 * resizes of a real plan. Counting per rule keeps the spec's boundary (§3)
 * without depending on identity: a write may keep existing violations, never
 * add one.
 */
export function increasedViolations(
  candidate: readonly JunctionLimitViolation[],
  previous: readonly JunctionLimitViolation[],
): JunctionLimitViolation[] {
  const before = new Map<JunctionLimitRule, number>();
  for (const item of previous || []) before.set(item.rule, (before.get(item.rule) || 0) + 1);
  const after = new Map<JunctionLimitRule, JunctionLimitViolation[]>();
  for (const item of candidate || []) {
    after.set(item.rule, [...(after.get(item.rule) || []), item]);
  }
  const introduced: JunctionLimitViolation[] = [];
  for (const [rule, items] of after) {
    const grew = items.length - (before.get(rule) || 0);
    if (grew > 0) introduced.push(...items.slice(0, grew));
  }
  return introduced;
}

/** Violations introduced BY THIS WRITE: inherited ones are never reported. */
export function newViolations(
  candidate: readonly JunctionLimitViolation[],
  previous: readonly JunctionLimitViolation[],
): JunctionLimitViolation[] {
  const inherited = new Set((previous || []).map((item) => `${item.rule}|${item.subject}`));
  return (candidate || []).filter((item) => !inherited.has(`${item.rule}|${item.subject}`));
}
