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

/**
 * Roll back only the failed candidate represented by this attempt. A conflict
 * reload or a newer edit owns a different revision/content and must win.
 */
export function rollbackOptimistic<T>(
  host: {
    _serverCfg: T | null;
    _cfgRev: number;
    _cfgContentFingerprint: string;
    requestUpdate: () => unknown;
  },
  attempt: OptimisticAttempt<T>,
  fingerprint: (value: T) => string,
): boolean {
  const current = host._serverCfg;
  if (!current || host._cfgRev !== attempt.revision
      || (current !== attempt.attempted
        && fingerprint(current) !== attempt.attemptedFingerprint)) return false;
  host._serverCfg = attempt.previous;
  host._cfgContentFingerprint = attempt.previousFingerprint;
  host.requestUpdate();
  return true;
}
