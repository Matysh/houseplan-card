/** A new root URL, not a new build. Shared dependency failures stay terminal. */
let retrySequence = 0;
export function viewRuntimeRetryUrl(asset: string, base: string): string {
  const url = new URL(asset, base);
  url.searchParams.set('hp_retry', `view-${++retrySequence}`);
  return url.href;
}
