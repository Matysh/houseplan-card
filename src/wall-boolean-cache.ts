/** Shared boolean dispatch. Ordinary View calls go straight to the library;
 * the lazy editor may install a gesture-owned reuse scope while computing. */
import * as clipping from 'polyclip-ts';
import type { Geom } from 'polyclip-ts';
export type { Geom } from 'polyclip-ts';

type Multi = ReturnType<typeof clipping.union>;
export type WallBooleanOperation = 'union' | 'difference' | 'intersection';
/** Structural port only: no editor cache implementation is imported by View. */
export interface WallBooleanScope {
  apply(operation: WallBooleanOperation, operands: Geom[], record: boolean): Multi;
}

let current: { baseline: WallBooleanScope; record: boolean } | null = null;

/** Scope is synchronous, re-entrant and restored even on a failed geometry.
 * Callers keep the baseline only for their frozen gesture/context identity. */
export function withWallBooleanBaseline<T>(baseline: WallBooleanScope, record: boolean, work: () => T): T {
  const previous = current; current = { baseline, record };
  try { return work(); }
  finally { current = previous; }
}

export const union: typeof clipping.union = (subject, ...rest) => current
  ? current.baseline.apply('union', [subject, ...rest], current.record) : clipping.union(subject, ...rest);
export const difference: typeof clipping.difference = (subject, ...rest) => current
  ? current.baseline.apply('difference', [subject, ...rest], current.record) : clipping.difference(subject, ...rest);
export const intersection: typeof clipping.intersection = (subject, ...rest) => current
  ? current.baseline.apply('intersection', [subject, ...rest], current.record) : clipping.intersection(subject, ...rest);
