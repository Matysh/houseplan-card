export type InitialSpaceSource = 'hash' | 'current' | 'saved' | 'default' | 'first' | 'none';

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
