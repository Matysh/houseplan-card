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

export const MIN_JUNCTION_ANGLE_DEG = 15;
export const MAX_JUNCTION_VALENCE = 6;
export const MIN_SEGMENT_LENGTH_CM = 20;
export const MIN_NODE_DISTANCE_CM = 5;
export const MIN_ROOM_CLEARANCE_CM2 = 25;

export type JunctionLimitRule =
  | 'angle' | 'valence' | 'length' | 'distance' | 'clearance';

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

const EPS = 1e-9;
/** Below this a node is ON the wall (T-joint), not near it. */
const INCIDENT_EPS = 1e-9;
const key = (point: number[]): string => `${point[0].toFixed(6)},${point[1].toFixed(6)}`;
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
      // Collinear rays of one straight wall passing through the node are a
      // 180° pair, not a violation; only a genuine narrow wedge counts.
      const degrees = (delta * 180) / Math.PI;
      if (degrees > EPS && degrees < smallest) smallest = degrees;
    }
    if (smallest < minAngleDeg - 1e-9) {
      violations.push({ rule: 'angle', subject: node, actual: smallest, limit: minAngleDeg });
    }
  }
  return violations;
}

/** П3: a segment is at least 20 cm and never shorter than its own thickness. */
export function checkSegmentLengths(
  segments: readonly LimitSegment[],
  cellCm: number,
  gridPitch: number,
  { minLengthCm = MIN_SEGMENT_LENGTH_CM } = {},
): JunctionLimitViolation[] {
  const violations: JunctionLimitViolation[] = [];
  for (const segment of usableSegments(segments)) {
    const units = length(segment.a, segment.b);
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

/** П4: non-incident nodes and node-to-foreign-wall clearance (absolute cm). */
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
  const violations: JunctionLimitViolation[] = [];
  const entries = [...nodes.entries()];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const distance = length(entries[i][1], entries[j][1]);
      if (distance < minUnits - 1e-9) {
        violations.push({
          rule: 'distance', subject: `${entries[i][0]} ↔ ${entries[j][0]}`,
          actual: (distance / gridPitch) * (cellCm || 1), limit: minDistanceCm,
        });
      }
    }
  }
  for (const [nodeKey, node] of nodes) {
    for (const segment of usable) {
      // A node that belongs to the wall (either end) is a legal T-joint or
      // corner — the rule is about NEAR misses, not incidence.
      if (key(segment.a) === nodeKey || key(segment.b) === nodeKey) continue;
      const distance = distanceToSegment(node, segment.a, segment.b);
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
