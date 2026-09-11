/**
 * Append one write to a promise chain without letting an earlier rejection
 * poison later edits. The callback is deliberately invoked only when its turn
 * starts, so it can read the latest local state at that moment.
 */
export function enqueueSerializedWrite(
  previous: Promise<void>,
  write: () => Promise<void>,
): Promise<void> {
  return previous.catch(() => undefined).then(write);
}

export interface OptimisticAttempt<T> {
  previous: T;
  previousFingerprint: string;
  revision: number;
  attempted: T;
  attemptedFingerprint: string;
}

/** Capture the server-backed value before exposing a write candidate locally. */
export function optimisticAttempt<T>(
  previous: T,
  attempted: T,
  previousFingerprint: string,
  revision: number,
  fingerprint: (value: T) => string,
): OptimisticAttempt<T> {
  return {
    previous: JSON.parse(JSON.stringify(previous)) as T,
    previousFingerprint,
    revision,
    attempted,
    attemptedFingerprint: fingerprint(attempted),
  };
}

// The rollback of an attempt lives with the identity owner:
// `ConfigAdoption.rollbackOptimistic` (#500).
