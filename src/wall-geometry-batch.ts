/** Associative exact booleans traverse the complete connected body once.
 * No coordinate rounding, omitted patch or widened cut is involved. */
import { difference, union, type Geom } from './wall-boolean-cache';
import { unionLocalWallGeometry } from './wall-local-boolean';

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
