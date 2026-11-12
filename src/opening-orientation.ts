/** Physical-operation adapter around the single v1 basis transform. */
import type { OpeningCfg } from './types';
import { roomPoly } from './logic';
import { openingInnerFaceOffset } from './wall-thickness';
import { motionOpeningFeatures, reparameterizeOpeningFeatures } from './opening-features';

type Point = readonly number[];
type Space = { rooms?: any[]; walls?: any[]; partitions?: any[]; cell_cm?: number; openings?: OpeningCfg[] };
export function openingAxisRotation(a: Point, b: Point, nextA: Point, nextB: Point): number {
  const ux = b[0] - a[0], uy = b[1] - a[1], vx = nextB[0] - nextA[0], vy = nextB[1] - nextA[1];
  return Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy) * 180 / Math.PI;
}

/** Use the real type-specific symbol resolver; do not blindly toggle flip_v. */
export function openingFaceNormal(space: Space, opening: OpeningCfg, flipV = !!opening.flip_v): [number, number] {
  const faceFlip = opening.type === 'gate' ? !flipV : flipV;
  if (opening.host?.kind === 'partition') {
    const carrier = space.partitions?.find(item => item.id === opening.host!.id);
    if (carrier) {
      const dx = carrier.b[0] - carrier.a[0], dy = carrier.b[1] - carrier.a[1], length = Math.hypot(dx, dy);
      const side = faceFlip ? 1 : -1;
      if (length) return [-dy / length * side, dx / length * side];
    }
  }
  const rooms = (space.rooms || []).map(room => ({ ...room,
    poly: roomPoly(room)?.map(point => point.map(value => value * 1000)) }));
  const face = openingInnerFaceOffset(rooms, {
    x: opening.x * 1000, y: opening.y * 1000, angle: opening.angle,
    length: opening.length * 1000, flip_v: faceFlip,
  }, space.walls || [], 1 / 240, Number(space.cell_cm) || 5, 1000 / 240, 1000);
  const length = Math.hypot(face.ox, face.oy);
  if (length) return [face.ox / length, face.oy / length];
  const angle = opening.angle * Math.PI / 180;
  return [-Math.sin(angle) * face.side, Math.cos(angle) * face.side];
}

/** Run after the existing physical projection, before validating its complete candidate.
 * `rotations` uses endpoint lineage during node operations; nearest-axis rotation
 * is reserved for small canonical cleanup/rehost, not a substitute for that lineage.
 * Reading/ACK never calls this adapter. Recomputing from the same before is idempotent. */
export function transportOpeningOrientations<T extends Space>(before: Space, after: T,
  rotations: ReadonlyMap<string, number> = new Map()): T {
  const old = new Map((before.openings || []).map(opening => [opening.id, opening]));
  for (const opening of after.openings || []) {
    const source = old.get(opening.id);
    if (source?.opening_features?.version !== 1 || source.type !== opening.type) continue;
    // Invalid documents still belong to the strict schema, not a geometry
    // reader exception before that schema can explain the malformed import.
    if (source.type === 'window' && !Array.isArray((source.opening_features as any).leaves)) continue;
    let delta = rotations.get(opening.id);
    if (delta === undefined) {
      delta = opening.angle - source.angle;
      delta -= 180 * Math.floor((delta + 90) / 180);
    }
    const expected = source.angle + delta;
    const intended = opening.angle + 180 * Math.round((expected - opening.angle) / 180);
    const transformed = reparameterizeOpeningFeatures(source, intended);
    opening.angle = transformed.angle;
    opening.opening_features = transformed.opening_features;
    if (motionOpeningFeatures(source)?.mechanism !== 'slide') continue;
    const previous = openingFaceNormal(before, source), radians = delta * Math.PI / 180;
    const desired = [previous[0] * Math.cos(radians) - previous[1] * Math.sin(radians),
      previous[0] * Math.sin(radians) + previous[1] * Math.cos(radians)];
    const negative = openingFaceNormal(after, opening, false), positive = openingFaceNormal(after, opening, true);
    const dot = (vector: number[]) => vector[0] * desired[0] + vector[1] * desired[1];
    if (dot(positive) > dot(negative)) opening.flip_v = true;
    else delete opening.flip_v;
  }
  return after;
}
