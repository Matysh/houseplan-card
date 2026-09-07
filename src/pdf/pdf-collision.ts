export type PdfCollisionPoint = readonly [number, number];

export interface PdfCollisionBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const COORDINATE_EPSILON = 1e-8;

const finitePoint = (point: readonly number[]): point is PdfCollisionPoint =>
  point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]);

const pointInBox = (point: PdfCollisionPoint, box: PdfCollisionBox): boolean =>
  point[0] >= box.minX - COORDINATE_EPSILON && point[0] <= box.maxX + COORDINATE_EPSILON
  && point[1] >= box.minY - COORDINATE_EPSILON && point[1] <= box.maxY + COORDINATE_EPSILON;

const validBox = (box: PdfCollisionBox): boolean =>
  [box.minX, box.minY, box.maxX, box.maxY].every(Number.isFinite)
  && box.maxX >= box.minX && box.maxY >= box.minY;

export const pdfCollisionBoxCorners = (box: PdfCollisionBox): PdfCollisionPoint[] => [
  [box.minX, box.minY], [box.maxX, box.minY],
  [box.maxX, box.maxY], [box.minX, box.maxY],
];

/** Expand a finite collision box by an exact paper-space clearance. */
export function pdfInflateBox(box: PdfCollisionBox, clearance: number): PdfCollisionBox {
  const amount = Number.isFinite(clearance) && clearance >= 0 ? clearance : 0;
  return {
    minX: box.minX - amount,
    minY: box.minY - amount,
    maxX: box.maxX + amount,
    maxY: box.maxY + amount,
  };
}

const cross = (a: PdfCollisionPoint, b: PdfCollisionPoint, c: PdfCollisionPoint): number =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

const segmentParameter = (
  point: PdfCollisionPoint, start: PdfCollisionPoint, end: PdfCollisionPoint,
): number => {
  const dx = end[0] - start[0], dy = end[1] - start[1];
  const denominator = Math.abs(dx) >= Math.abs(dy) ? dx : dy;
  return Math.abs(denominator) <= COORDINATE_EPSILON ? 0
    : (Math.abs(dx) >= Math.abs(dy) ? point[0] - start[0] : point[1] - start[1]) / denominator;
};

const distance = (a: PdfCollisionPoint, b: PdfCollisionPoint): number =>
  Math.hypot(b[0] - a[0], b[1] - a[1]);

function pointOnSegment(
  point: PdfCollisionPoint, start: PdfCollisionPoint, end: PdfCollisionPoint,
): boolean {
  const length = distance(start, end);
  if (length <= COORDINATE_EPSILON) return distance(point, start) <= COORDINATE_EPSILON;
  if (Math.abs(cross(start, end, point)) / length > COORDINATE_EPSILON) return false;
  const parameter = segmentParameter(point, start, end);
  const parameterEpsilon = COORDINATE_EPSILON / length;
  return parameter >= -parameterEpsilon && parameter <= 1 + parameterEpsilon;
}

interface SegmentIntersection {
  /** Parameter on the first segment. */
  t: number;
  /** Inclusive end parameter on the first segment (equal to `t` for a point hit). */
  endT: number;
  /** Collinear overlap has no single harmless endpoint. */
  overlap: boolean;
}

function segmentIntersection(
  a: PdfCollisionPoint, b: PdfCollisionPoint,
  c: PdfCollisionPoint, d: PdfCollisionPoint,
): SegmentIntersection | null {
  const abx = b[0] - a[0], aby = b[1] - a[1];
  const cdx = d[0] - c[0], cdy = d[1] - c[1];
  const abLength = Math.hypot(abx, aby), cdLength = Math.hypot(cdx, cdy);
  if (abLength <= COORDINATE_EPSILON) {
    return pointOnSegment(a, c, d) ? { t: 0, endT: 0, overlap: false } : null;
  }
  if (cdLength <= COORDINATE_EPSILON) {
    if (!pointOnSegment(c, a, b)) return null;
    const t = Math.max(0, Math.min(1, segmentParameter(c, a, b)));
    return { t, endT: t, overlap: false };
  }
  const denominator = abx * cdy - aby * cdx;
  const acx = c[0] - a[0], acy = c[1] - a[1];
  const parallelTolerance = COORDINATE_EPSILON * abLength * cdLength;
  if (Math.abs(denominator) <= parallelTolerance) {
    if (Math.abs(cross(a, b, c)) / abLength > COORDINATE_EPSILON
        || Math.abs(cross(a, b, d)) / abLength > COORDINATE_EPSILON) return null;
    const first = segmentParameter(c, a, b), second = segmentParameter(d, a, b);
    const overlapStart = Math.max(0, Math.min(first, second));
    const overlapEnd = Math.min(1, Math.max(first, second));
    const parameterEpsilon = COORDINATE_EPSILON / abLength;
    if (overlapEnd < overlapStart - parameterEpsilon) return null;
    return { t: Math.max(0, Math.min(1, overlapStart)),
      endT: Math.max(0, Math.min(1, overlapEnd)),
      overlap: (overlapEnd - overlapStart) * abLength > COORDINATE_EPSILON };
  }
  const t = (acx * cdy - acy * cdx) / denominator;
  const u = (acx * aby - acy * abx) / denominator;
  const tEpsilon = COORDINATE_EPSILON / abLength;
  const uEpsilon = COORDINATE_EPSILON / cdLength;
  if (t < -tEpsilon || t > 1 + tEpsilon || u < -uEpsilon || u > 1 + uEpsilon) return null;
  const clampedT = Math.max(0, Math.min(1, t));
  return { t: clampedT, endT: clampedT, overlap: false };
}

const validRings = (rings: readonly (readonly (readonly number[])[])[]): boolean =>
  rings.every((ring) => ring.length >= 2 && ring.every(finitePoint));

function forEachRingSegment(
  rings: readonly (readonly (readonly number[])[])[],
  visit: (a: PdfCollisionPoint, b: PdfCollisionPoint) => boolean,
): boolean {
  for (const rawRing of rings) {
    const ring = rawRing as readonly PdfCollisionPoint[];
    for (let index = 0; index < ring.length; index++) {
      if (visit(ring[index], ring[(index + 1) % ring.length])) return true;
    }
  }
  return false;
}

/** Exact, conservative AABB-vs-polygon test. Holes are resolved by `isSolid`. */
export function pdfBoxTouchesGeometry(
  box: PdfCollisionBox,
  rings: readonly (readonly (readonly number[])[])[],
  isSolid: (point: PdfCollisionPoint) => boolean,
): boolean {
  if (!validBox(box) || !validRings(rings)) return true;
  const corners = pdfCollisionBoxCorners(box);
  if (corners.some(isSolid)) return true;
  if (rings.some((ring) => ring.some((point) => finitePoint(point) && pointInBox(point, box)))) return true;
  return forEachRingSegment(rings, (a, b) => corners.some((corner, index) =>
    segmentIntersection(a, b, corner, corners[(index + 1) % corners.length]) !== null));
}

/** A box is wholly inside a simple ring only when no concave edge cuts it. */
export function pdfBoxInsideRing(
  box: PdfCollisionBox,
  ring: readonly (readonly number[])[],
  isInside: (point: PdfCollisionPoint) => boolean,
): boolean {
  if (!validBox(box) || !validRings([ring])) return false;
  const corners = pdfCollisionBoxCorners(box);
  if (!corners.every(isInside)) return false;
  return !forEachRingSegment([ring], (a, b) => corners.some((corner, index) =>
    segmentIntersection(a, b, corner, corners[(index + 1) % corners.length]) !== null));
}

/**
 * Exact segment-vs-polygon test. Extension lines may start on their own wall
 * face, but every later crossing (and every collinear overlap) remains invalid.
 */
export function pdfSegmentTouchesGeometry(
  start: PdfCollisionPoint,
  end: PdfCollisionPoint,
  rings: readonly (readonly (readonly number[])[])[],
  isSolid: (point: PdfCollisionPoint) => boolean,
  options: { allowStartBoundary?: boolean; allowStartExit?: boolean } = {},
): boolean {
  if (!finitePoint(start) || !finitePoint(end) || !validRings(rings)) return true;
  if (options.allowStartExit) {
    const length = distance(start, end);
    if (length <= COORDINATE_EPSILON) return true;
    const startOnBoundary = forEachRingSegment(rings, (a, b) => pointOnSegment(start, a, b));
    if (!startOnBoundary) return true;

    const hits: SegmentIntersection[] = [];
    forEachRingSegment(rings, (a, b) => {
      const hit = segmentIntersection(start, end, a, b);
      if (hit) hits.push(hit);
      return false;
    });
    const parameterEpsilon = COORDINATE_EPSILON / length;
    const breakpoints = [0, 1, ...hits.flatMap((hit) => [hit.t, hit.endT])]
      .sort((left, right) => left - right)
      .filter((value, index, values) => index === 0
        || value - values[index - 1] > parameterEpsilon);
    const pointAt = (t: number): PdfCollisionPoint => [
      start[0] + (end[0] - start[0]) * t,
      start[1] + (end[1] - start[1]) * t,
    ];
    const overlapAt = (t: number): boolean => hits.some((hit) => hit.overlap
      && t > hit.t + parameterEpsilon && t < hit.endT - parameterEpsilon);

    let exitT: number | null = null;
    for (let index = 0; index + 1 < breakpoints.length; index++) {
      const from = breakpoints[index], to = breakpoints[index + 1];
      if (to - from <= parameterEpsilon) continue;
      const middleT = (from + to) / 2;
      const blocked = overlapAt(middleT) || isSolid(pointAt(middleT));
      if (exitT === null) {
        if (!blocked) exitT = from;
      } else if (blocked) {
        return true;
      }
    }
    // The extension must actually reach free space. Once it has, every later
    // boundary contact is a re-entry/tangent collision, not part of its source exit.
    if (exitT === null) return true;
    return hits.some((hit) => hit.t > exitT! + parameterEpsilon
      || hit.endT > exitT! + parameterEpsilon);
  }
  const midpoint: PdfCollisionPoint = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
  const startOnBoundary = forEachRingSegment(rings, (a, b) => pointOnSegment(start, a, b));
  if ((isSolid(start) && !(options.allowStartBoundary && startOnBoundary))
      || isSolid(midpoint) || isSolid(end)) return true;
  return forEachRingSegment(rings, (a, b) => {
    const hit = segmentIntersection(start, end, a, b);
    if (!hit) return false;
    return hit.overlap || !options.allowStartBoundary || !startOnBoundary
      || hit.t * distance(start, end) > COORDINATE_EPSILON;
  });
}

/** Includes contact: a printed line may not touch or pass through another label. */
export function pdfSegmentTouchesBox(
  start: PdfCollisionPoint, end: PdfCollisionPoint, box: PdfCollisionBox,
): boolean {
  if (!finitePoint(start) || !finitePoint(end) || !validBox(box)) return true;
  if (pointInBox(start, box) || pointInBox(end, box)) return true;
  const corners = pdfCollisionBoxCorners(box);
  return corners.some((corner, index) =>
    segmentIntersection(start, end, corner, corners[(index + 1) % corners.length]) !== null);
}
