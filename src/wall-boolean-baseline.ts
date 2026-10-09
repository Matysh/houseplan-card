/** Select-only exact reuse of a frozen gesture baseline's booleans. Kept out
 * of the View graph; candidates only read the frozen result table. A separately
 * bounded canonical-content ledger enables proved local boundary replacement. */
import * as clipping from 'polyclip-ts';
import type { Geom } from 'polyclip-ts';
import type { WallBooleanOperation, WallBooleanScope } from './wall-boolean-cache';
import { WallBooleanIncremental } from './wall-boolean-incremental';

type Multi = ReturnType<typeof clipping.union>;
const copy = (value: Multi): Multi => value.map(polygon => polygon.map(ring =>
  ring.map(point => [point[0], point[1]] as [number, number])));

export class WallBooleanBaseline implements WallBooleanScope {
  private readonly values = new Map<string, Multi>();
  private characters = 0;
  private readonly incremental = new WallBooleanIncremental();
  readonly counts = { hits: 0, misses: 0, stored: 0 };
  readonly reuseCounts = this.incremental.counts;

  apply(operation: WallBooleanOperation, operands: Geom[], record: boolean): Multi {
    const key = `${operation}:${JSON.stringify(operands)}`;
    // Invalid/nonfinite input must reach the original validator. JSON's null
    // encoding cannot distinguish it from a genuinely different operand.
    const reusable = !key.includes('null');
    const cached = reusable ? this.values.get(key) : undefined;
    if (cached) {
      this.counts.hits++; this.incremental.remember(cached); return copy(cached);
    }
    this.counts.misses++;
    const reused = !record && reusable ? this.incremental.reuse(operation, operands) : null;
    const result = reused || clipping[operation](operands[0], ...operands.slice(1));
    if (record && reusable) this.incremental.record(operation, operands, result);
    this.incremental.remember(result);
    if (record && reusable && this.values.size < 512) {
      const characters = key.length + JSON.stringify(result).length;
      if (this.characters + characters <= 2_000_000) {
        this.values.set(key, copy(result)); this.characters += characters;
        this.counts.stored = this.values.size;
      }
    }
    return result;
  }
}
