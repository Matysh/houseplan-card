/** Select-only distributive clipping: traverse one common bound, not one
 * bound per fan. The immutable baseline can reuse the unchanged fan union. */
import { union, type Geom } from './wall-boolean-cache';
import { intersectLocalWallGeometry } from './wall-local-boolean';
import { unionClippedWallCornersSequential } from './wall-geometry-batch';

/** Any grouped failure, including the final union with the body, replays the
 * complete historical per-fan clipping and optional union isolation. */
export function unionClippedWallCorners(subject: Geom | null, pieces: Geom[], bound: Geom | null): Geom | null {
  if (!pieces.length) return subject;
  try {
    const fans = union(pieces[0], ...pieces.slice(1));
    const clipped = bound ? intersectLocalWallGeometry(fans, bound) : fans;
    return subject ? union(subject, clipped) : clipped;
  } catch { return unionClippedWallCornersSequential(subject, pieces, bound); }
}
