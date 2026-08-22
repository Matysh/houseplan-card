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
