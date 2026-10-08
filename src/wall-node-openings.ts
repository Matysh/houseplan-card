/** Select-only exact mask reuse. Opening slots are commonly unchanged while
 * a node moves; the frozen boolean baseline can reuse their canonical union
 * even though the masonry operand changes on every pointer frame. */
import { difference, union, type Geom } from './wall-boolean-cache';
import { subtractWallOpeningCuts } from './wall-geometry-batch';

export function subtractNodeOpeningCuts(subject: Geom, cuts: Geom[]): Geom {
  if (cuts.length < 2) return subtractWallOpeningCuts(subject, cuts);
  try {
    const mask = union(cuts[0], ...cuts.slice(1));
    return difference(subject, mask);
  } catch {
    // Replay every mandatory cut. A failed union or subtraction must never
    // silently retain masonry across a door, window, or overlapping slot.
    return subtractWallOpeningCuts(subject, cuts);
  }
}
