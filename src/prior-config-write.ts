/** Wait for the config tail before an independent paired operation.
 * A historical refusal must not poison a later user intent. A write still in
 * flight at this boundary can affect that intent, so its refusal propagates.
 * Call after flushing a pending config debounce; do not replace the tail.
 */
export async function waitForPriorConfigWrite(host: {
  _writeChain: Promise<void>;
  _writesPending: number;
}): Promise<void> {
  const pending = host._writesPending > 0;
  const tail = host._writeChain;
  try { await tail; }
  catch (error) { if (pending) throw error; }
}
