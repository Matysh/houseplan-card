/** A proven closed door cuts its physical slot and seals it at the drawn leaf.
 * No state lookup, camera geometry, second renderer or persistent model. */
import { assertOpeningFeatures, motionOpeningFeatures, openingSlideDirection } from './opening-features';
import { physicalOpeningHostRange } from './opening-optics';
import { openingSlidePlacement } from './opening-symbol-placement';
import { partitionOpeningFace } from './partition-openings';
import { openingInnerFaceOffsetFromIndex, openingTunnelGeometriesFromIndex,
  resolveOpeningWallCandidates, type OpeningWallIndex } from './wall-thickness';
import type { GeometryOpeningProjection } from './plan-geometry-preflight';
import type { LightSegment } from './light-visibility';
import type { SpaceModel } from './types';

export function closedDoorLightGeometry(opening: GeometryOpeningProjection, space: SpaceModel,
  index: OpeningWallIndex): { barrier: LightSegment; floor: number[][][] } | null {
  if (opening.type !== 'door' || opening.light_transparent === true
      || ![opening.rx, opening.ry, opening.rlen, opening.angle].every(Number.isFinite) || !(opening.rlen > 0)) return null;
  try { assertOpeningFeatures(opening); } catch { return null; }
  const rad = opening.angle * Math.PI / 180, ux = Math.cos(rad), uy = Math.sin(rad), nx = -uy, ny = ux;
  const eps = Math.max(1e-9, index.adjacencyEps), half = opening.rlen / 2;
  const range = physicalOpeningHostRange(opening, space, ux, uy, eps);
  if (!range || range[0] > -half + eps || range[1] < half - eps) return null;
  const wallOpening = { x: opening.rx, y: opening.ry, angle: opening.angle, length: opening.rlen };
  const candidates = resolveOpeningWallCandidates(index, wallOpening, true);
  if (!opening.partitionHost && (!candidates.some(side => side.full)
      || [-1, 1].some(side => new Set(candidates.filter(c => c.side === side).map(c => c.roomId)).size > 1))) return null;
  const face = opening.partitionHost ? partitionOpeningFace(opening.partitionHost, !!opening.flip_v)
    : openingInnerFaceOffsetFromIndex(index, { ...wallOpening, flip_v: !!opening.flip_v });
  const motion = motionOpeningFeatures(opening);
  // This is the renderer's exact placement authority, not the sweep arc or
  // the bounds of the whole symbol (which include jambs and handles).
  const panel = motion?.mechanism === 'slide'
    ? openingSlidePlacement(opening.angle, opening.rlen, openingSlideDirection(motion), 0, face)
    : { x: 0, y: 0 };
  const world = (x: number, y: number) => [opening.rx + ux * x + nx * y, opening.ry + uy * x + ny * y];
  const seal = Math.max(1e-9, eps * .001), a = world(panel.x - half - seal, panel.y), b = world(panel.x + half + seal, panel.y);
  // The same physical tunnel that is painted already owns both halves at an
  // exterior wall. Add only this bounded floor, never the outdoor light fan.
  const tunnel = openingTunnelGeometriesFromIndex(index, [wallOpening])[0];
  const floor = tunnel?.faces.flatMap(face => face.contours.map(poly => poly.map(([x, y]) => world(x, y)))) ?? [];
  if (opening.partitionHost) {
    const depth = opening.partitionHost.depth / 2;
    floor.push([world(-half, -depth), world(half, -depth), world(half, depth), world(-half, depth)]);
  }
  return { barrier: [a[0], a[1], b[0], b[1]], floor };
}
