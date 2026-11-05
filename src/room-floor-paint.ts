/** Presentation floor only. Clean area, light geometry and storage stay separate. */
import { difference, union, type Geom } from 'polyclip-ts';
import { polyclipPathD } from './physical-geometry';
import type { OpeningTunnelGeometry } from './wall-thickness';

export interface RoomFloorSeed { id: string; geom: Geom }
export interface RoomFloorPaint { path: string; basePath: string; bounds: [number, number, number, number]; extended: boolean }
const polygon = (points: number[][]): Geom => [[[
  ...points.map(p => [p[0], p[1]] as [number, number]), [points[0][0], points[0][1]],
]]];
export function roomFloorGeometry(poly: number[][], holes: number[][][], clean?: Geom | null): Geom {
  const base = clean || polygon(poly);
  return holes.length ? difference(base, ...holes.map(polygon)) : base;
}

/** One geometry-only build per physical epoch. Faces are already associated,
 * de-duplicated and split at the wall axis by the canonical opening index.
 * Subtract their whole domain before assigning it: a nested room must not
 * double-paint the exterior half owned by its child. Foreign masonry stays
 * opaque even where another host's opening occupies the same coordinates.
 */
export function buildRoomFloorPaint(seeds: readonly RoomFloorSeed[],
  openings: readonly { rx: number; ry: number; angle: number }[],
  tunnels: readonly (OpeningTunnelGeometry | null)[], blockers: readonly Geom[] = [],
): Map<string, RoomFloorPaint> {
  const owned = new Map<string, Geom[]>(), all: Geom[] = [];
  for (let i = 0; i < openings.length; i++) {
    const opening = openings[i], angle = opening.angle * Math.PI / 180;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    for (const face of tunnels[i]?.faces || []) for (const contour of face.contours) {
      if (contour.length < 3) continue;
      const geom = polygon(contour.map(([x, y]) => [opening.rx + cos * x - sin * y, opening.ry + sin * x + cos * y]));
      all.push(geom); const list = owned.get(face.roomId) || []; list.push(geom); owned.set(face.roomId, list);
    }
  }
  const out = new Map<string, RoomFloorPaint>();
  const domain = all.length ? union(all[0], ...all.slice(1)) : null;
  for (const seed of seeds) {
    let geom = seed.geom;
    const faces = owned.get(seed.id) || [];
    // No color, alpha, HA state, camera or mode weight enters this projection.
    if (domain?.length) geom = difference(geom, domain);
    if (faces.length) {
      geom = union(geom, ...faces);
      if (blockers.length) geom = difference(geom, ...blockers);
    }
    // Inputs and all operations above are MultiPolygons, not bare polygons.
    const points = (geom as [number, number][][][]).flat(2);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of points) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    out.set(seed.id, { path: polyclipPathD(geom), basePath: polyclipPathD(seed.geom), extended: !!faces.length,
      bounds: points.length ? [x0 - 1, y0 - 1, x1 - x0 + 2, y1 - y0 + 2] : [0, 0, 1, 1] });
  }
  return out;
}
