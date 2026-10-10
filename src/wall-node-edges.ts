/** Select-only common-bound clipping of wall strips. No new coordinates,
 * clipping tolerance, or historical-candidate cache. */
import { union, type Geom } from './wall-boolean-cache';
import { intersectLocalWallGeometry, unionLocalWallGeometry } from './wall-local-boolean';
import { wallQuadCovered } from './wall-quad-coverage';

/** Intersection distributes over union. Only strips already proved covered by
 * the current body can be omitted. Every grouped-stage failure replays the
 * original per-edge coverage, clipping and isolated merge, in original order. */
export function unionNodeEdgeBodies(subject: Geom | null, quads: number[][][], centre: Geom): Geom | null {
  const closed = (quad: number[][]): Geom => {
    const ring = quad.map(point => [point[0], point[1]] as [number, number]);
    ring.push([quad[0][0], quad[0][1]]);
    return [ring];
  };
  try {
    const pieces = quads.filter(quad => !subject || !wallQuadCovered(quad, subject as ReturnType<typeof union>)).map(closed);
    if (!pieces.length) return subject;
    const strips = union(pieces[0], ...pieces.slice(1));
    const clipped = intersectLocalWallGeometry(strips, centre);
    return subject ? union(subject, clipped) : clipped;
  } catch {
    let current = subject;
    for (const quad of quads) {
      if (current && wallQuadCovered(quad, current as ReturnType<typeof union>)) continue;
      try {
        const piece = intersectLocalWallGeometry(closed(quad), centre);
        current = current ? unionLocalWallGeometry(current, piece) : piece;
      } catch { /* Preserve the previous body and continue to the next strip. */ }
    }
    return current;
  }
}
