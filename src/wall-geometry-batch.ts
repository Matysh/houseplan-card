/** Associative exact booleans traverse the complete connected body once.
 * No coordinate rounding, omitted patch or widened cut is involved. */
import { difference, union, type Geom } from './wall-boolean-cache';
import { unionLocalWallGeometry, intersectLocalWallGeometry } from './wall-local-boolean';

/** Historical per-fan clipping and optional-patch isolation. Ordinary View
 * uses this directly; Select replays it after any failed grouped stage. */
export function unionClippedWallCornersSequential(subject: Geom | null, pieces: Geom[], bound: Geom | null): Geom | null {
  const clipped: Geom[] = [];
  for (const piece of pieces) {
    try {
      const own = bound ? intersectLocalWallGeometry(piece, bound) : piece;
      if (own.length) clipped.push(own);
    } catch { /* Preserve the historical isolated optional-fan failure. */ }
  }
  return unionWallCornerPieces(subject, clipped);
}

/** Optional corner fans retain the historical per-piece isolation if the
 * combined operation fails. A malformed fan cannot discard other corners. */
export function unionWallCornerPieces(subject: Geom | null, pieces: Geom[]): Geom | null {
  if (!pieces.length) return subject;
  try {
    return subject ? union(subject, ...pieces) : union(pieces[0], ...pieces.slice(1));
  } catch {
    let current = subject;
    for (const piece of pieces) {
      try { current = current ? unionLocalWallGeometry(current, piece) : piece; }
      catch { /* Same isolated optional-patch failure as the sequential path. */ }
    }
    return current;
  }
}

/** A − B − C equals A − (B ∪ C). On failure retry the exact historical
 * ordering, but never swallow a failed mandatory opening subtraction. */
export function subtractWallOpeningCuts(subject: Geom, cuts: Geom[]): Geom {
  if (!cuts.length) return subject;
  try { return difference(subject, ...cuts); }
  catch {
    let current = subject;
    for (const cut of cuts) current = difference(current, cut);
    return current;
  }
}
