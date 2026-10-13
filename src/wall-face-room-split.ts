/** Lazy Walls-only classification; neither a second model nor a config writer. */
import { difference, intersection, union, type Geom } from 'polyclip-ts';
import { closestPointOnBoundary, distToSegment, polygonArea } from './logic';
import { polyIsSimple } from './resize';
import type { WallGraphFace } from './wall-face-graph';

export interface WallFaceRoomSplit {
  roomId: string;
  mainPoly: number[][];
  newPoly: number[][];
}

export type WallFaceRoomClassification =
  | { kind: 'plain' }
  | { kind: 'refuse' }
  | { kind: 'split'; split: WallFaceRoomSplit };

interface RoomOutline { id: string; poly: number[][] }
interface FaceCarrier { id: string; a: readonly number[]; b: readonly number[] }
const geometry = (ring: number[][]): Geom => [ring.map(p => [p[0], p[1]] as [number, number])];
const multiArea = (polys: number[][][][]): number => polys.reduce((total, rings) => (
  total + polygonArea(rings[0]) - rings.slice(1).reduce((sum, ring) => sum + polygonArea(ring), 0)
), 0);

function simple(ring: number[][], epsilon: number): boolean {
  if (ring.length < 3 || ring.some(p => p.length < 2 || !p.every(Number.isFinite))
      || !polyIsSimple(ring)) return false;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) <= epsilon) return false;
    for (let j = i + 2; j < ring.length; j++) {
      if (i === 0 && j === ring.length - 1) continue;
      const c = ring[j], d = ring[(j + 1) % ring.length];
      if (distToSegment(a, [...c, ...d]) <= epsilon
          || distToSegment(b, [...c, ...d]) <= epsilon
          || distToSegment(c, [...a, ...b]) <= epsilon
          || distToSegment(d, [...a, ...b]) <= epsilon) return false;
    }
  }
  return polygonArea(ring) > epsilon * epsilon;
}

/** Point-only contacts deliberately do not qualify as a boundary cut. */
function sharesSpan(first: number[][], second: number[][], epsilon: number): boolean {
  return first.some((a, i) => {
    const b = first[(i + 1) % first.length];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length <= epsilon) return false;
    const ux = (b[0] - a[0]) / length, uy = (b[1] - a[1]) / length;
    const along = (p: number[]) => (p[0] - a[0]) * ux + (p[1] - a[1]) * uy;
    const across = (p: number[]) => Math.abs((p[0] - a[0]) * uy - (p[1] - a[1]) * ux);
    return second.some((c, j) => {
      const d = second[(j + 1) % second.length];
      return across(c) <= epsilon && across(d) <= epsilon
        && Math.min(length, Math.max(along(c), along(d)))
          - Math.max(0, Math.min(along(c), along(d))) > epsilon;
    });
  });
}

/** Stable winding/start-independent tie breaker; never picks by input order. */
function ringKey(ring: number[][], epsilon: number): string {
  const corners = ring.filter((p, i) => distToSegment(p, [
    ...ring[(i + ring.length - 1) % ring.length], ...ring[(i + 1) % ring.length],
  ]) > epsilon);
  const keys = corners.map(p => `${Math.round(p[0] / epsilon)},${Math.round(p[1] / epsilon)}`);
  const cycles = [keys, [...keys].reverse()].flatMap(sequence => sequence.map((_, index) => (
    [...sequence.slice(index), ...sequence.slice(0, index)].join(';')
  )));
  return cycles.sort()[0];
}

/**
 * A face touching its containing room's boundary is a Split, not an island.
 * Only a proven two-part partition is accepted; failed clipping never falls
 * back to the nested-room path that would manufacture a third owner (#874).
 */
export function classifyWallFaceRoom(
  face: number[][], rooms: readonly RoomOutline[], epsilon: number,
): WallFaceRoomClassification {
  if (!(epsilon > 0) || !simple(face, epsilon)) return { kind: 'refuse' };
  let result: WallFaceRoomSplit | null = null;
  for (const room of rooms) {
    if (!sharesSpan(face, room.poly, epsilon)) continue;
    if (!simple(room.poly, epsilon)) return { kind: 'refuse' };
    try {
      // Computed graph vertices may differ by ULPs from the saved carrier.
      // Reuse only a proven boundary point; never round the parent's outline.
      const childRing = face.map(p => {
        const vertex = room.poly.find(q => Math.hypot(p[0] - q[0], p[1] - q[1]) <= epsilon);
        if (vertex) return [...vertex];
        const onBoundary = closestPointOnBoundary(p, room.poly);
        return onBoundary && Math.hypot(p[0] - onBoundary[0], p[1] - onBoundary[1]) <= epsilon
          ? onBoundary : [...p];
      });
      if (!simple(childRing, epsilon)) return { kind: 'refuse' };
      const parent = geometry(room.poly), child = geometry(childRing);
      const parentArea = polygonArea(room.poly), faceArea = polygonArea(childRing);
      const tolerance = Math.max(epsilon * epsilon, parentArea * 1e-6);
      const overlap = multiArea(intersection(parent, child));
      // Adjacent rooms share a span but no area: they are not the parent.
      if (overlap <= epsilon * epsilon) continue;
      if (Math.abs(overlap - faceArea) > tolerance
          || multiArea(difference(child, parent)) > tolerance
          || parentArea - faceArea <= tolerance) return { kind: 'refuse' };
      const remainder = difference(parent, child);
      if (remainder.length !== 1 || remainder[0].length !== 1) return { kind: 'refuse' };
      // Boolean arithmetic may emit two ULP-separated vertices at a shared
      // original corner. Restore those source coordinates, not a new lattice.
      const anchors = [...room.poly, ...childRing];
      const rest = remainder[0][0].slice(0, -1).map(p => {
        const anchor = anchors.find(q => Math.hypot(p[0] - q[0], p[1] - q[1]) <= epsilon);
        return anchor ? [...anchor] : [p[0], p[1]];
      }).filter((p, i, ring) => !i || p[0] !== ring[i - 1][0] || p[1] !== ring[i - 1][1]);
      if (rest.length > 1 && rest[0][0] === rest[rest.length - 1][0]
          && rest[0][1] === rest[rest.length - 1][1]) rest.pop();
      if (!simple(rest, epsilon)) return { kind: 'refuse' };
      const restArea = polygonArea(rest);
      if (Math.abs(restArea + faceArea - parentArea) > tolerance
          || multiArea(intersection(geometry(rest), child)) > tolerance
          || multiArea(difference(parent, union(geometry(rest), child))) > tolerance
          || multiArea(difference(union(geometry(rest), child), parent)) > tolerance)
        return { kind: 'refuse' };
      if (result) return { kind: 'refuse' }; // Never select an arbitrary parent.
      const mainIsFace = faceArea > restArea || (faceArea === restArea
        && ringKey(childRing, epsilon).localeCompare(ringKey(rest, epsilon)) <= 0);
      result = {
        roomId: room.id,
        mainPoly: (mainIsFace ? childRing : rest).map(p => [...p]),
        newPoly: (mainIsFace ? rest : childRing).map(p => [...p]),
      };
    } catch { return { kind: 'refuse' }; }
  }
  return result ? { kind: 'split', split: result } : { kind: 'plain' };
}

/** Complementary faces describe one split; conflicting cuts are never queued. */
export function classifyWallFaceCandidates<T extends WallGraphFace>(
  faces: readonly T[], rooms: readonly RoomOutline[], epsilon: number,
): Array<T & { split?: WallFaceRoomSplit }> {
  const plain: T[] = [];
  const splits = new Map<string, T & { split: WallFaceRoomSplit }>();
  const conflicts = new Set<string>();
  for (const face of faces) {
    const result = classifyWallFaceRoom(face.ring, rooms, epsilon);
    if (result.kind === 'plain') { plain.push(face); continue; }
    if (result.kind !== 'split') continue;
    const { split } = result;
    const key = ringKey(split.newPoly, epsilon);
    const previous = splits.get(split.roomId);
    if (previous && previous.key !== `split:${split.roomId}:${key}`) conflicts.add(split.roomId);
    else if (!previous) splits.set(split.roomId, {
      ...face, key: `split:${split.roomId}:${key}`,
      ring: split.newPoly.map(p => [p[0], p[1]]), area: polygonArea(split.newPoly), split,
    });
  }
  return [...plain, ...[...splits].filter(([id]) => !conflicts.has(id)).map(([, face]) => face)];
}

/** Acceptance consumes only carriers on an accepted face, not remote old debt. */
export function selectWallFacePromotionIds(
  rings: readonly number[][][], carriers: readonly FaceCarrier[], epsilon: number,
): string[] {
  return carriers.filter(carrier => rings.some(ring => sharesSpan(
    ring, [[...carrier.a], [...carrier.b]], epsilon,
  ))).map(carrier => carrier.id);
}
