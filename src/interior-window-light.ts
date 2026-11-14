/** Proven floor-to-floor portions of glass; no state, storage or camera work. */
import { resolveOpeningWallCandidates, type OpeningWallIndex } from './wall-thickness';
import type { GeometryOpeningProjection } from './plan-geometry-preflight';
import type { SpaceModel } from './types';
import { physicalOpeningHostRange } from './opening-optics';

/**
 * Split at actual room-side ends, then admit only an unambiguous pair of
 * different rooms. A centre-only test would open an exterior remainder, or
 * miss an interior part whose centre lies outside the second room (#1079).
 * Runs once on a structural barrier-cache miss, shared by every light source.
 */
export function interiorWindowLightPassages(
  opening: GeometryOpeningProjection, space: SpaceModel, index: OpeningWallIndex,
): GeometryOpeningProjection[] {
  if (opening.type !== 'window' || ![opening.rx, opening.ry, opening.angle, opening.rlen]
    .every(Number.isFinite) || !(opening.rlen > 0)) return [];
  const rad = opening.angle * Math.PI / 180, ux = Math.cos(rad), uy = Math.sin(rad);
  const eps = Math.max(1e-9, index.adjacencyEps);
  const range = physicalOpeningHostRange(opening, space, ux, uy, eps);
  if (!range || range[1] - range[0] <= eps) return [];
  const candidates = resolveOpeningWallCandidates(index, {
    x: opening.rx, y: opening.ry, angle: opening.angle, length: opening.rlen,
  }, opening.host?.kind !== 'partition');
  const cuts = [...new Set([range[0], range[1], ...candidates.flatMap(side =>
    side.pieces.flatMap(piece => [piece.x0, piece.x1]))])]
    .filter(value => value >= range[0] && value <= range[1]).sort((a, b) => a - b);
  const intervals: Array<[number, number]> = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const lo = cuts[i], hi = cuts[i + 1], mid = (lo + hi) / 2;
    if (hi - lo <= eps) continue;
    const rooms = (side: -1 | 1) => new Set(candidates.filter(candidate =>
      candidate.side === side && candidate.pieces.some(piece => piece.x0 < mid && piece.x1 > mid))
      .map(candidate => candidate.roomId));
    const negative = rooms(-1), positive = rooms(1);
    if (negative.size !== 1 || positive.size !== 1 || [...negative][0] === [...positive][0]) continue;
    const last = intervals[intervals.length - 1];
    if (last && last[1] === lo) last[1] = hi;
    else intervals.push([lo, hi]);
  }
  return intervals.map(([lo, hi]) => {
    const offset = (lo + hi) / 2, length = hi - lo;
    const rx = opening.rx + ux * offset, ry = opening.ry + uy * offset;
    return {
      ...opening, rx, ry, rlen: length,
      ...(opening.partitionHost ? { partitionHost: {
        ...opening.partitionHost, center: [rx, ry] as [number, number], length,
        t: opening.partitionHost.t + offset * (ux * opening.partitionHost.axis.ux
          + uy * opening.partitionHost.axis.uy) / opening.partitionHost.axis.length,
      } } : {}),
    };
  });
}

/** Optical classification adapter: reuse the exact host/room proof, never
 * modify the door's saved type, sensor state, symbol or geometry. */
export function interiorGlassDoorPassages(
  opening: GeometryOpeningProjection, space: SpaceModel, index: OpeningWallIndex,
): GeometryOpeningProjection[] {
  return opening.type === 'door' && opening.light_transparent === true
    ? interiorWindowLightPassages({ ...opening, type: 'window' }, space, index)
      .map(slice => ({ ...slice, type: 'door' as const })) : [];
}
