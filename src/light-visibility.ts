/**
 * What a lamp can see.
 *
 * The whole light model is one question asked once per source: which points of
 * the plan does a straight line from the lamp reach without crossing something
 * opaque? Walls, columns and free-standing partitions are opaque; doorways,
 * gates and virtual (open) boundaries are simply absent from the occluder set,
 * so light travels through them without any special case for "spill",
 * "sector", "tunnel" or "open zone". Everything the plan shows — a beam
 * through a door, a shadow behind a column, a wall corner cutting that beam —
 * falls out of this one polygon.
 *
 * The algorithm is the classic angular sweep: cast a ray at every occluder
 * corner (and just to either side of it), keep the nearest hit, and close the
 * fan with an arc at the lamp's own radius.
 */

/** Opaque edge in plan coordinates: [x1, y1, x2, y2]. */
export type LightSegment = readonly number[];

/** Rays are nudged by this angle either side of a corner to catch what the
 *  corner hides and what it does not. Radians; ~2 µm at a 2 m radius. */
const CORNER_NUDGE = 1e-5;
/** Rays this close together resolve to the same point; keeping both only feeds
 *  polyclip degenerate slivers. */
const ANGLE_EPS = 1e-9;

/**
 * Break every barrier at the points where barriers cross each other.
 *
 * The sweep casts a ray at each barrier ENDPOINT, which is exact only while
 * barriers meet end to end. Two that cross in their middles — the face of one
 * wall running through the face of another at a junction — leave that corner
 * unsampled, and the fan closes it with a chord: a sliver of floor next to the
 * corner goes dark although the lamp sees it. Splitting first turns every
 * crossing into an endpoint and the sweep is exact again, whatever shape the
 * geometry arrived in. Collinear overlaps need no split: their corners are
 * already somebody's endpoint.
 */
export function splitAtIntersections(segments: readonly LightSegment[]): LightSegment[] {
  const cuts: number[][] = segments.map(() => []);
  for (let i = 0; i < segments.length; i++) {
    const a = segments[i];
    const ax = a[2] - a[0];
    const ay = a[3] - a[1];
    for (let j = i + 1; j < segments.length; j++) {
      const b = segments[j];
      const denominator = ax * (b[3] - b[1]) - ay * (b[2] - b[0]);
      if (Math.abs(denominator) < 1e-12) continue;
      const ox = b[0] - a[0];
      const oy = b[1] - a[1];
      const t = (ox * (b[3] - b[1]) - oy * (b[2] - b[0])) / denominator;
      const u = (ox * ay - oy * ax) / denominator;
      if (t <= 1e-9 || t >= 1 - 1e-9 || u <= 1e-9 || u >= 1 - 1e-9) continue;
      cuts[i].push(t);
      cuts[j].push(u);
    }
  }
  const out: LightSegment[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (!cuts[i].length) { out.push(seg); continue; }
    const stops = [0, ...cuts[i].sort((left, right) => left - right), 1];
    for (let k = 1; k < stops.length; k++) {
      if (stops[k] - stops[k - 1] < 1e-9) continue;
      out.push([
        seg[0] + (seg[2] - seg[0]) * stops[k - 1], seg[1] + (seg[3] - seg[1]) * stops[k - 1],
        seg[0] + (seg[2] - seg[0]) * stops[k], seg[1] + (seg[3] - seg[1]) * stops[k],
      ]);
    }
  }
  return out;
}

export function polygonSegments(poly: readonly (readonly number[])[]): LightSegment[] {
  const out: LightSegment[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if (!a || !b) continue;
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-9) continue;
    out.push([a[0], a[1], b[0], b[1]]);
  }
  return out;
}

const distanceToSegment = (point: readonly number[], seg: LightSegment): number => {
  const dx = seg[2] - seg[0];
  const dy = seg[3] - seg[1];
  const len2 = dx * dx + dy * dy;
  if (!(len2 > 0)) return Math.hypot(point[0] - seg[0], point[1] - seg[1]);
  const t = Math.max(0, Math.min(1,
    ((point[0] - seg[0]) * dx + (point[1] - seg[1]) * dy) / len2));
  return Math.hypot(point[0] - (seg[0] + t * dx), point[1] - (seg[1] + t * dy));
};

/** Distance from `source` along `dir` to a segment, or Infinity. */
const rayHit = (
  source: readonly number[], dirX: number, dirY: number, seg: LightSegment,
): number => {
  const ex = seg[2] - seg[0];
  const ey = seg[3] - seg[1];
  const denominator = dirX * ey - dirY * ex;
  if (Math.abs(denominator) < 1e-12) return Infinity; // parallel: never a blocker
  const ox = seg[0] - source[0];
  const oy = seg[1] - source[1];
  const t = (ox * ey - oy * ex) / denominator;
  if (!(t > 1e-9)) return Infinity;
  const s = (ox * dirY - oy * dirX) / denominator;
  if (s < -1e-9 || s > 1 + 1e-9) return Infinity;
  return t;
};

/**
 * Region lit by a point source, as a single ring in plan coordinates.
 *
 * `segments` may contain anything: only the ones that can reach into the
 * radius are considered. A source on an opaque edge is invalid and returns no
 * lit region. Dropping that edge would make the wall disappear precisely at a
 * grid-snapped placement and illuminate the room on its other side.
 */
export function visibilityPolygon(
  source: readonly number[],
  radius: number,
  segments: readonly LightSegment[],
  arcSteps = 96,
): number[][] {
  if (!(radius > 0) || !Number.isFinite(source[0]) || !Number.isFinite(source[1])) return [];
  const near: LightSegment[] = [];
  for (const seg of segments) {
    if (!seg || seg.length < 4) continue;
    if (![seg[0], seg[1], seg[2], seg[3]].every(Number.isFinite)) continue;
    const distance = distanceToSegment(source, seg);
    if (distance < 1e-7) return [];
    if (distance > radius) continue;
    near.push(seg);
  }
  const angles: number[] = [];
  const steps = Math.max(12, Math.round(arcSteps));
  for (let i = 0; i < steps; i++) angles.push((i / steps) * Math.PI * 2 - Math.PI);
  for (const seg of near) {
    for (const point of [[seg[0], seg[1]], [seg[2], seg[3]]]) {
      const angle = Math.atan2(point[1] - source[1], point[0] - source[0]);
      angles.push(angle - CORNER_NUDGE, angle, angle + CORNER_NUDGE);
    }
  }
  // atan2's seam is a geometric non-event. Normalising every ray onto one
  // cyclic interval keeps the +nudge ray beside its corner instead of sorting
  // it to the opposite end and closing the fan with a long chord.
  const turn = Math.PI * 2;
  for (let i = 0; i < angles.length; i++) angles[i] = ((angles[i] % turn) + turn) % turn;
  angles.sort((left, right) => left - right);
  const ring: number[][] = [];
  let previous = Number.NEGATIVE_INFINITY;
  for (const angle of angles) {
    if (angle - previous < ANGLE_EPS) continue;
    previous = angle;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    let reach = radius;
    for (const seg of near) {
      const hit = rayHit(source, dirX, dirY, seg);
      if (hit < reach) reach = hit;
    }
    ring.push([source[0] + dirX * reach, source[1] + dirY * reach]);
  }
  return ring.length >= 3 ? ring : [];
}
