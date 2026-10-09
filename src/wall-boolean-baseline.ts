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
  private readonly values = new Map<string, { value: Multi; resultKey: string }>();
  private characters = 0;
  private readonly incremental = new WallBooleanIncremental();
  readonly counts = { hits: 0, misses: 0, stored: 0 };
  readonly reuseCounts = this.incremental.counts;

  apply(operation: WallBooleanOperation, operands: Geom[], record: boolean): Multi {
    // Fresh complete serialization on EVERY call, never an identity-key cache.
    // Joining serialized array entries is exactly JSON.stringify(operands),
    // including order/arity and JSON's null encoding of invalid array entries.
    const operandKeys = Array.from(operands, operand => JSON.stringify(operand) ?? 'null');
    const key = `${operation}:[${operandKeys.join(',')}]`;
    // Invalid/nonfinite input must reach the original validator. JSON's null
    // encoding cannot distinguish it from a genuinely different operand.
    const reusable = !key.includes('null');
    const cached = reusable ? this.values.get(key) : undefined;
    if (cached) {
      // Only our private copied value uses a saved key. Caller-owned operands
      // and returned copies always cross the fresh-serialization boundary.
      this.counts.hits++; this.incremental.remember(cached.resultKey); return copy(cached.value);
    }
    this.counts.misses++;
    const reused = !record && reusable ? this.incremental.reuse(operation, operands, operandKeys) : null;
    const result = reused || clipping[operation](operands[0], ...operands.slice(1));
    const resultKey = JSON.stringify(result);
    if (record && reusable) this.incremental.record(operation, operands, result, operandKeys, resultKey);
    this.incremental.remember(resultKey);
    if (record && reusable && this.values.size < 512) {
      const characters = key.length + resultKey.length;
      if (this.characters + characters <= 2_000_000) {
        this.values.set(key, { value: copy(result), resultKey }); this.characters += characters;
        this.counts.stored = this.values.size;
      }
    }
    return result;
  }
}
