export type InitialSpaceSource = 'fixed' | 'hash' | 'current' | 'saved' | 'default' | 'first' | 'none';

export interface InitialSpaceSelectionInput {
  spaceIds: readonly string[];
  hashSpace?: string | null;
  acceptHash?: boolean;
  currentSpace?: string | null;
  preserveCurrent?: boolean;
  savedSpace?: string | null;
  defaultSpace?: string | null;
}

export interface InitialSpaceSelection {
  id: string | null;
  source: InitialSpaceSource;
}

export type FixedFloorInvalidReason =
  | 'empty-id'
  | 'unknown-id'
  | 'non-finite-index'
  | 'fractional-index'
  | 'negative-index'
  | 'out-of-range-index'
  | 'invalid-type';

export type FixedFloorSelection =
  | { kind: 'absent' }
  | { kind: 'valid'; id: string; source: 'id' | 'index' }
  | { kind: 'invalid'; reason: FixedFloorInvalidReason; value: unknown };

export interface FixedFloorSelectionInput {
  spaceIds: readonly string[];
  /** Presence is semantic: an explicit empty/null value is invalid, not absent. */
  hasFloor: boolean;
  floor?: unknown;
}

/** Resolve the public fixed-floor card option without JavaScript coercion. */
export function resolveFixedFloor(input: FixedFloorSelectionInput): FixedFloorSelection {
  if (!input.hasFloor) return { kind: 'absent' };
  const value = input.floor;
  if (typeof value === 'string') {
    if (!value.length) return { kind: 'invalid', reason: 'empty-id', value };
    return input.spaceIds.includes(value)
      ? { kind: 'valid', id: value, source: 'id' }
      : { kind: 'invalid', reason: 'unknown-id', value };
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return { kind: 'invalid', reason: 'non-finite-index', value };
    if (!Number.isInteger(value)) return { kind: 'invalid', reason: 'fractional-index', value };
    if (value < 0) return { kind: 'invalid', reason: 'negative-index', value };
    const id = input.spaceIds[value];
    return id === undefined
      ? { kind: 'invalid', reason: 'out-of-range-index', value }
      : { kind: 'valid', id, source: 'index' };
  }
  return { kind: 'invalid', reason: 'invalid-type', value };
}

/**
 * Resolve the one exact space that may back a spatial frame.
 *
 * A same-route warm/hash/nav selection has already recorded newer intent and
 * may be preserved by the caller. Otherwise the public cold-start precedence
 * is hash -> saved -> default -> first. Every candidate is checked against the
 * live model; the legacy `f1` field is never accepted merely because it is the
 * class initializer.
 */
export function resolveInitialSpace(input: InitialSpaceSelectionInput): InitialSpaceSelection {
  const ids = new Set(input.spaceIds.filter((id) => !!id));
  if (!ids.size) return { id: null, source: 'none' };

  const candidates: Array<[InitialSpaceSource, string | null | undefined]> = [
    ['hash', input.acceptHash === false ? null : input.hashSpace],
    ['current', input.preserveCurrent ? input.currentSpace : null],
    ['saved', input.savedSpace],
    ['default', input.defaultSpace],
    ['first', input.spaceIds[0]],
  ];
  for (const [source, id] of candidates) {
    if (id && ids.has(id)) return { id, source };
  }
  return { id: null, source: 'none' };
}

/** Start every optional operation and wait only for their individual result. */
export function settleBestEffort<T>(
  attempts: ReadonlyArray<() => Promise<T>>,
): Promise<PromiseSettledResult<T>[]> {
  return Promise.allSettled(attempts.map((attempt) => Promise.resolve().then(attempt)));
}
