import { contentUrl, chunk, MAX_SIGN_PATHS, SIGN_TTL_MS, SIGN_REFRESH_MS } from './logic';

/**
 * Signed urls for the authenticated content endpoint, shared by both cards.
 *
 * A browser cannot authenticate an `<image href>` or an `<a href>`: Home
 * Assistant takes a Bearer header or an `authSig` signed path, and an element
 * sends neither. So whatever is about to be displayed has to be signed first.
 *
 * This used to be implemented twice — and the second copy (houseplan-space-card)
 * signed correctly but never handed the result to its renderer, so the plan
 * background asked for the raw protected url and got a 401 on every render
 * (review R3-2). One implementation, one set of rules:
 *
 * - requests are chunked to MAX_SIGN_PATHS, the cap the backend silently
 *   applies (an oversized call comes back partial with no way to tell what was
 *   dropped, and those entries then expire for good);
 * - every entry carries the time it was issued: past SIGN_REFRESH_MS a
 *   replacement is fetched while the old url keeps rendering, past SIGN_TTL_MS
 *   the entry is dropped rather than served (it would 401 and raise a
 *   failed-login warning for the viewer's own IP);
 * - `pending` is always released, so one failed request does not wedge a url
 *   forever.
 */
export class ContentSigner {
  private signed: Record<string, { url: string; at: number }> = {};
  private pending = new Set<string>();
  private batchTimer?: ReturnType<typeof setTimeout>;
  private resignTimer?: ReturnType<typeof setInterval>;

  /**
   * @param onUpdate schedule a re-render (a signature arriving changes the DOM)
   * @param now      injectable clock — the tests need to age a signature
   */
  constructor(private onUpdate: () => void, private now: () => number = () => Date.now()) {}

  /** Start the periodic re-sign. `referenced` prunes the cache on each tick. */
  start(hass: () => any, referenced: () => Set<string>): void {
    this.stopTimer();
    this.resignTimer = setInterval(() => this.resign(hass(), referenced()), SIGN_REFRESH_MS / 2);
  }

  /** Release every timer; the cache survives a reconnect, the timers must not. */
  dispose(): void {
    this.stopTimer();
    clearTimeout(this.batchTimer);
    this.pending.clear();
  }

  private stopTimer(): void {
    if (this.resignTimer !== undefined) clearInterval(this.resignTimer);
    this.resignTimer = undefined;
  }

  /** The url to put in the DOM: a signature we hold and still trust, else ''. */
  display(hass: any, url: string | null | undefined): string {
    const u = contentUrl(url);
    if (!u.startsWith('/api/houseplan/content/')) return u;
    const hit = this.signed[u];
    const age = hit ? this.now() - hit.at : Infinity;
    if (age < SIGN_REFRESH_MS) return hit.url;
    if (age < SIGN_TTL_MS) {
      // aging but still valid: keep showing it while a fresh one is fetched
      this.request(hass, u);
      return hit.url;
    }
    if (hit) delete this.signed[u];
    this.request(hass, u);
    // Empty, NOT the plain path: an unsigned request to a `requires_auth` view
    // returns 401 and Home Assistant raises a "failed login attempt".
    return '';
  }

  private request(hass: any, url: string): void {
    if (this.pending.has(url) || !hass?.callWS) return;
    this.pending.add(url);
    clearTimeout(this.batchTimer);
    // batch: switching space asks for several urls in the same tick
    this.batchTimer = setTimeout(() => {
      const paths = [...this.pending];
      this.pending.clear();
      this.sign(hass, paths);
    }, 30);
  }

  private sign(hass: any, paths: string[]): void {
    if (!paths.length || !hass?.callWS) return;
    for (const batch of chunk(paths, MAX_SIGN_PATHS)) {
      hass
        .callWS({ type: 'houseplan/content/sign', paths: batch })
        .then((r: any) => {
          if (!r?.urls) return;
          const at = this.now();
          const next = { ...this.signed };
          for (const [k, v] of Object.entries<string>(r.urls)) next[k] = { url: v, at };
          this.signed = next;
          this.onUpdate();
        })
        .catch(() => undefined) // a retry happens on the next render
        .finally(() => {
          // never leave a url wedged in `pending`: the first failure would
          // otherwise make it unrequestable for the life of the page (R3-2)
          for (const p of batch) this.pending.delete(p);
        });
    }
  }

  /**
   * Re-sign what is still in use. A wall tablet outlives a signature, and an
   * entry for a plan replaced months ago must not consume a slot in the capped
   * request — so prune to the urls the live config still references.
   */
  resign(hass: any, referenced: Set<string>): void {
    const now = this.now();
    const kept: Record<string, { url: string; at: number }> = {};
    for (const [k, v] of Object.entries(this.signed)) {
      if (referenced.has(k) && now - v.at < SIGN_TTL_MS) kept[k] = v;
    }
    this.signed = kept;
    this.sign(hass, Object.keys(kept));
  }

  /** Test/debug view of the cache. */
  get entries(): Record<string, { url: string; at: number }> {
    return this.signed;
  }
}
