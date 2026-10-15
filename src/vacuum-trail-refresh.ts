/** A subscription owns its transport and only its latest still-current reply (#901). */
export function vacuumTrailRefresh<T>(
  read: () => Promise<T>,
  isCurrent: () => boolean,
  adopt: (response: T) => void,
): () => Promise<void> {
  let request = 0;
  return async () => {
    if (!isCurrent()) return;
    const ownRequest = ++request;
    try {
      const response = await read();
      if (ownRequest === request && isCurrent()) adopt(response);
    } catch { /* transient WS hiccup — the next event retries, preserving last-good */ }
  };
}
