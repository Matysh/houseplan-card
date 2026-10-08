/** Exact ordered local replacements, composed before touching the full body.
 * T_i(A) = (A minus cuts_i) union pieces_i. Later cuts still remove earlier
 * additions, including overlapping masks; no locality approximation is used. */
import { difference, union, type Geom } from './wall-boolean-cache';

export interface WallLocalReplacement {
  cuts: Geom[];
  pieces: Geom[];
}

export function applyWallLocalReplacements(subject: Geom,
  replacements: readonly WallLocalReplacement[], restore: Geom | null,
): Geom {
  const cuts: Geom[] = [];
  let additions: Geom | null = null;
  for (const replacement of replacements) {
    if (additions && replacement.cuts.length)
      additions = difference(additions, ...replacement.cuts);
    cuts.push(...replacement.cuts);
    const pieces = [...(additions ? [additions] : []), ...replacement.pieces];
    additions = pieces.length > 1 ? union(pieces[0], ...pieces.slice(1)) : pieces[0] || null;
  }
  const remainder = cuts.length ? difference(subject, ...cuts) : subject;
  const added = [...(additions ? [additions] : []), ...(restore ? [restore] : [])];
  return added.length ? union(remainder, ...added) : remainder;
}
