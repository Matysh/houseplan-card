import {
  polygonArea, roomPoly, roomsOverlap, segmentsProperlyCross,
} from './logic';

/** One drafting tolerance shared by authoring, maintenance and masonry joins. */
export const NEAR_AXIS_MAX_DEGREES = 0.25;
export const NEAR_AXIS_MAX_SLOPE = Math.tan(NEAR_AXIS_MAX_DEGREES * Math.PI / 180);

export type NearAxis = 'horizontal' | 'vertical';

export interface NearAxisClassification {
  axis: NearAxis;
  major: number;
  minor: number;
  angleDegrees: number;
}

/** Exact-axis segments are already canonical and are deliberately not candidates. */
export function classifyNearAxisSegment(
  a: readonly number[], b: readonly number[],
): NearAxisClassification | null {
  const dx = Math.abs(Number(b[0]) - Number(a[0]));
  const dy = Math.abs(Number(b[1]) - Number(a[1]));
  if (![dx, dy].every(Number.isFinite) || !(dx > 0) || !(dy > 0)) return null;
  const axis: NearAxis = dx >= dy ? 'horizontal' : 'vertical';
  const major = Math.max(dx, dy);
  const minor = Math.min(dx, dy);
  if (minor / major > NEAR_AXIS_MAX_SLOPE) return null;
  return {
    axis, major, minor,
    angleDegrees: Math.atan2(minor, major) * 180 / Math.PI,
  };
}

/** Authoring moves only the free endpoint; the anchor is never rewritten silently. */
export function snapNearAxisEndpoint(
  anchor: readonly number[], point: readonly number[],
): number[] {
  const classified = classifyNearAxisSegment(anchor, point);
  if (!classified) return [Number(point[0]), Number(point[1])];
  return classified.axis === 'horizontal'
    ? [Number(point[0]), Number(anchor[1])]
    : [Number(anchor[0]), Number(point[1])];
}

export interface NearAxisRepairReport {
  wallsStraightened: number;
  wallsStraightenSkipped: number;
  maxStraightenShift: number;
}

export interface NearAxisRepairResult {
  space: any;
  report: NearAxisRepairReport;
  changed: boolean;
}

interface EndpointMove {
  from: number[];
  to: number[];
}

interface RepairCandidate {
  key: string;
  a: number[];
  b: number[];
  axis: NearAxis;
}

const pointKey = (point: readonly number[]): string => `${point[0]},${point[1]}`;
const samePoint = (a: readonly number[], b: readonly number[]): boolean => (
  a[0] === b[0] && a[1] === b[1]
);
const segmentKey = (a: readonly number[], b: readonly number[]): string => {
  const ka = pointKey(a), kb = pointKey(b);
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
};

const signedArea = (poly: number[][]): number => {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return sum / 2;
};

const simplePolygon = (poly: number[][]): boolean => {
  if (poly.length < 3) return false;
  for (let i = 0; i < poly.length; i++) {
    if (samePoint(poly[i], poly[(i + 1) % poly.length])) return false;
    for (let j = i + 1; j < poly.length; j++) {
      if (j === i + 1 || (i === 0 && j === poly.length - 1)) continue;
      if (segmentsProperlyCross(
        poly[i], poly[(i + 1) % poly.length],
        poly[j], poly[(j + 1) % poly.length],
      )) return false;
    }
  }
  return polygonArea(poly) > 1e-12;
};

const simpleOpenPath = (points: number[][]): boolean => {
  for (let i = 0; i + 1 < points.length; i++) {
    if (samePoint(points[i], points[i + 1])) return false;
    for (let j = i + 2; j + 1 < points.length; j++) {
      if (segmentsProperlyCross(points[i], points[i + 1], points[j], points[j + 1])) {
        return false;
      }
    }
  }
  return true;
};

const replacePoint = (point: number[], move: EndpointMove): number[] => (
  samePoint(point, move.from) ? [...move.to] : [...point]
);

const replaceRoomPoints = (rooms: any[], move: EndpointMove): any[] => rooms.map((room) => {
  if (!Array.isArray(room?.poly)) return room;
  return { ...room, poly: room.poly.map((point: number[]) => replacePoint(point, move)) };
});

const roomMoveIsSafe = (before: any[], after: any[], move: EndpointMove): boolean => {
  const changed = before.flatMap((room, index) => (
    roomPoly(room)?.some((point) => samePoint(point, move.from)) ? [index] : []
  ));
  if (!changed.length) return false;
  for (const i of changed) {
    const source = roomPoly(before[i]);
    const candidate = roomPoly(after[i]);
    if (!source || !candidate) continue;
    if (!simplePolygon(candidate)) return false;
    const sourceSign = Math.sign(signedArea(source));
    const candidateSign = Math.sign(signedArea(candidate));
    if (sourceSign && candidateSign && sourceSign !== candidateSign) return false;
  }
  const compared = new Set<string>();
  for (const i of changed) {
    const a = roomPoly(after[i]);
    if (!a) continue;
    for (let j = 0; j < after.length; j++) {
      if (i === j) continue;
      const pair = i < j ? `${i}:${j}` : `${j}:${i}`;
      if (compared.has(pair)) continue;
      compared.add(pair);
      const b = roomPoly(after[j]);
      if (b && roomsOverlap(a, b)) return false;
    }
  }
  return true;
};

const exactIncidentDegree = (rooms: any[], point: number[]): number => {
  let count = 0;
  for (const room of rooms) {
    const poly = roomPoly(room);
    if (!poly) continue;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      if (!samePoint(a, point) && !samePoint(b, point)) continue;
      if (a[0] === b[0] || a[1] === b[1]) count++;
    }
  }
  return count;
};

const candidateMoves = (candidate: RepairCandidate, rooms: any[]): EndpointMove[] => {
  const { a, b, axis } = candidate;
  const moveB = axis === 'horizontal'
    ? { from: b, to: [b[0], a[1]] }
    : { from: b, to: [a[0], b[1]] };
  const moveA = axis === 'horizontal'
    ? { from: a, to: [a[0], b[1]] }
    : { from: a, to: [b[0], a[1]] };
  const ranked = [
    { move: moveB, preservedDegree: exactIncidentDegree(rooms, a) },
    { move: moveA, preservedDegree: exactIncidentDegree(rooms, b) },
  ];
  return ranked.sort((left, right) => (
    right.preservedDegree - left.preservedDegree
      || pointKey(left.move.to).localeCompare(pointKey(right.move.to))
      || pointKey(left.move.from).localeCompare(pointKey(right.move.from))
  )).map((item) => item.move);
};

/**
 * Explicit Optimize repair for room walls. Candidates come from immutable input;
 * coincident room-owner copies are deduplicated by physical segment identity.
 */
export function repairNearAxisRoomWalls(spaceIn: any): NearAxisRepairResult {
  const space = JSON.parse(JSON.stringify(spaceIn || {}));
  let rooms = Array.isArray(space.rooms) ? space.rooms : [];
  const candidates = new Map<string, RepairCandidate>();
  for (const room of rooms) {
    const poly = roomPoly(room);
    if (!poly) continue;
    for (let i = 0; i < poly.length; i++) {
      const a = [...poly[i]], b = [...poly[(i + 1) % poly.length]];
      const classified = classifyNearAxisSegment(a, b);
      if (!classified) continue;
      const key = segmentKey(a, b);
      if (!candidates.has(key)) candidates.set(key, { key, a, b, axis: classified.axis });
    }
  }

  let wallsStraightened = 0;
  let wallsStraightenSkipped = 0;
  let maxStraightenShift = 0;
  const reservedMoves = new Map<string, string>();
  for (const candidate of [...candidates.values()].sort((a, b) => a.key.localeCompare(b.key))) {
    let accepted: EndpointMove | null = null;
    for (const move of candidateMoves(candidate, rooms)) {
      const reserved = reservedMoves.get(pointKey(move.from));
      if (reserved && reserved !== pointKey(move.to)) continue;
      const nextRooms = replaceRoomPoints(rooms, move);
      if (!roomMoveIsSafe(rooms, nextRooms, move)) continue;
      accepted = move;
      rooms = nextRooms;
      break;
    }
    if (!accepted) {
      wallsStraightenSkipped++;
      continue;
    }
    reservedMoves.set(pointKey(accepted.from), pointKey(accepted.to));
    wallsStraightened++;
    maxStraightenShift = Math.max(
      maxStraightenShift,
      Math.hypot(accepted.to[0] - accepted.from[0], accepted.to[1] - accepted.from[1]),
    );
  }
  space.rooms = rooms;

  // Saved wall chains are independent authoring records. Preserve their point
  // and segment counts; only an equivalence-class endpoint coordinate moves.
  for (const draft of space.room_drafts || []) {
    if (!Array.isArray(draft?.points) || draft.points.length < 2) continue;
    const source = draft.points.map((point: number[]) => [...point]);
    const draftCandidates = source.slice(0, -1).flatMap((a: number[], index: number) => {
      const b = source[index + 1];
      const classified = classifyNearAxisSegment(a, b);
      return classified ? [{
        key: `${String(draft.id || '')}:${index}`,
        a: [...a], b: [...b], axis: classified.axis,
      } as RepairCandidate] : [];
    });
    let points = source;
    for (const candidate of draftCandidates) {
      let accepted: EndpointMove | null = null;
      for (const move of candidateMoves(candidate, [{ poly: points }])) {
        const next = points.map((point: number[]) => replacePoint(point, move));
        const closed = next.length >= 4 && samePoint(next[0], next[next.length - 1]);
        const ring = closed ? next.slice(0, -1) : next;
        if (closed ? !simplePolygon(ring) : !simpleOpenPath(ring)) continue;
        accepted = move;
        points = next;
        break;
      }
      if (!accepted) {
        wallsStraightenSkipped++;
        continue;
      }
      wallsStraightened++;
      maxStraightenShift = Math.max(
        maxStraightenShift,
        Math.hypot(accepted.to[0] - accepted.from[0], accepted.to[1] - accepted.from[1]),
      );
    }
    draft.points = points;
  }

  // Independent partitions have one owner. Hosted openings are retained only
  // when their along-wall interval still fits the exact-axis candidate.
  for (const partition of space.partitions || []) {
    if (!Array.isArray(partition?.a) || !Array.isArray(partition?.b)) continue;
    const classified = classifyNearAxisSegment(partition.a, partition.b);
    if (!classified) continue;
    const candidate: RepairCandidate = {
      key: String(partition.id || segmentKey(partition.a, partition.b)),
      a: [...partition.a], b: [...partition.b], axis: classified.axis,
    };
    let accepted: EndpointMove | null = null;
    for (const move of candidateMoves(candidate, [{ poly: [partition.a, partition.b] }])) {
      const a = replacePoint(partition.a, move);
      const b = replacePoint(partition.b, move);
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (!(length > 0)) continue;
      const openingsFit = (space.openings || []).filter((opening: any) => (
        opening?.host?.kind === 'partition' && opening.host.id === partition.id
      )).every((opening: any) => {
        const t = Number(opening.host.t);
        const openingLength = Number(opening.length);
        return Number.isFinite(t) && t >= 0 && t <= 1
          && Number.isFinite(openingLength) && openingLength > 0
          && t * length - openingLength / 2 >= -1e-12
          && t * length + openingLength / 2 <= length + 1e-12;
      });
      if (!openingsFit) continue;
      accepted = move;
      partition.a = a;
      partition.b = b;
      break;
    }
    if (!accepted) {
      wallsStraightenSkipped++;
      continue;
    }
    wallsStraightened++;
    maxStraightenShift = Math.max(
      maxStraightenShift,
      Math.hypot(accepted.to[0] - accepted.from[0], accepted.to[1] - accepted.from[1]),
    );
  }
  return {
    space,
    report: { wallsStraightened, wallsStraightenSkipped, maxStraightenShift },
    changed: wallsStraightened > 0,
  };
}
