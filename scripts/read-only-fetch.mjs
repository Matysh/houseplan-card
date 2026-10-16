// #921: transient socket recovery for release proof reads only. HTTP errors,
// malformed evidence and publication writes are deliberately outside this policy.
const retryable = new Set(['EPIPE', 'ECONNRESET', 'UND_ERR_SOCKET']);
const delays = [100, 400];
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function transientSocketError(error) {
  const seen = new Set();
  for (let current = error; current && seen.size < 8 && !seen.has(current); current = current.cause) {
    seen.add(current);
    if (current.name === 'AbortError' || current.name === 'TimeoutError') return false;
    if (retryable.has(current.code)) return true;
  }
  return false;
}

export function retryingReadFetch(fetchImpl = fetch, { pause = sleep } = {}) {
  return async (url, init = {}) => {
    const method = String(init.method || url?.method || 'GET').toUpperCase();
    if (method !== 'GET' || init.body != null || url?.body != null)
      throw new Error('release proof transport accepts bodyless GET reads only');
    for (let attempt = 0; ; attempt += 1) {
      try { return await fetchImpl(url, init); }
      catch (error) {
        if (attempt >= delays.length || init.signal?.aborted || url?.signal?.aborted || !transientSocketError(error)) throw error;
        await pause(delays[attempt]);
      }
    }
  };
}
