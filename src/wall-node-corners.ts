/** Select-only distributive clipping: traverse one common bound, not one
 * bound per fan. The immutable baseline can reuse the unchanged fan union. */
import { union, type Geom } from './wall-boolean-cache';
import { intersectLocalWallGeometry } from './wall-local-boolean';
import { unionClippedWallCornersSequential } from './wall-geometry-batch';
import { wallConvexCovered } from './wall-quad-coverage';

type Multi = ReturnType<typeof union>;
const asMulti = (geometry: Geom): Multi => !geometry.length ? []
  : typeof geometry[0][0][0] === 'number' ? [geometry as Multi[number]] : geometry as Multi;
const coveredFan = (piece: Geom, subject: Geom): boolean => {
  const polygons = asMulti(piece);
  if (polygons.length !== 1 || polygons[0].length !== 1) return false;
  const ring = polygons[0][0];
  if (ring.length < 4 || ring[0][0] !== ring[ring.length - 1][0]
      || ring[0][1] !== ring[ring.length - 1][1]) return false;
  return wallConvexCovered(ring.slice(0, -1), asMulti(subject));
};

/** Any grouped failure, including the final union with the body, replays the
 * complete historical per-fan clipping and optional union isolation. */
export function unionClippedWallCorners(subject: Geom | null, pieces: Geom[], bound: Geom | null | (() => Geom | null)): Geom | null {
  if (!pieces.length) return subject;
  let resolved = false, failed = false, clipping: Geom | null = null;
  let boundFailure: unknown;
  const readBound = (): Geom | null => {
    if (!resolved) {
      resolved = true;
      try { clipping = typeof bound === 'function' ? bound() : bound; }
      catch (error) { failed = true; boundFailure = error; }
    }
    if (failed) throw boundFailure;
    return clipping;
  };
  try {
    // F contained in the current body implies F intersect bound is contained
    // too. Ambiguous, non-convex or holed pieces always take exact clipping.
    const pending = subject ? pieces.filter(piece => !coveredFan(piece, subject)) : pieces;
    if (!pending.length) return subject;
    const fans = union(pending[0], ...pending.slice(1));
    const ownBound = readBound();
    const clipped = ownBound ? intersectLocalWallGeometry(fans, ownBound) : fans;
    return subject ? union(subject, clipped) : clipped;
  } catch { return unionClippedWallCornersSequential(subject, pieces, readBound()); }
}
