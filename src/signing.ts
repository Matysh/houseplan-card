import { contentUrl, chunk, MAX_SIGN_PATHS, SIGN_TTL_MS, SIGN_REFRESH_MS } from './logic';

/** A request older than this is presumed lost, and the url may be asked again. */
export const SIGN_INFLIGHT_MS = 15000;
/** After a failure, wait before retrying; doubles up to the cap. */
export const SIGN_BACKOFF_MIN_MS = 2000;
export const SIGN_BACKOFF_MAX_MS = 60000;

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
 * - a url that is queued or already in flight is not asked for again: renders
 *   are frequent and a slow socket used to turn every one of them into another
 *   `content/sign` call (review R4-2). An in-flight entry expires after
 *   SIGN_INFLIGHT_MS so a promise that never settles cannot block retries
 *   forever, and a failure backs off instead of retrying on the next frame.
 */
export class ContentSigner {
  private signed: Record<string, { url: string; at: number }> = {};
  /** Waiting for the batch timer to fire. */
  private queued = new Set<string>();
  /** Sent and not settled yet: url -> when the request went out. */
  private inFlight = new Map<string, number>();
  /** After a failure: when this url may be asked again, and the current delay. */
  private retry = new Map<string, { notBefore: number; delay: number }>();
  private batchTimer?: ReturnType<typeof setTimeout>;
  private resignTimer?: ReturnType<typeof setInterval>;
  private disposed = false;

  /**
   * @param onUpdate schedule a re-render (a signature arriving changes the DOM)
   * @param now      injectable clock — the tests need to age a signature
   */
  constructor(private onUpdate: () => void, private now: () => number = () => Date.now()) {}

  /** Start the periodic re-sign. `referenced` prunes the cache on each tick. */
  start(hass: () => any, referenced: () => Set<string>): void {
    this.disposed = false; // an element can be reconnected after a disconnect
    this.stopTimer();
    this.resignTimer = setInterval(() => this.resign(hass(), referenced()), SIGN_REFRESH_MS / 2);
  }

  /** Release every timer; the cache survives a reconnect, the timers must not. */
  dispose(): void {
    this.disposed = true;
    this.stopTimer();
    clearTimeout(this.batchTimer);
    this.queued.clear();
    this.inFlight.clear();
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
    if (!hass?.callWS || this.queued.has(url)) return;
    const now = this.now();
    const sent = this.inFlight.get(url);
    if (sent !== undefined && now - sent < SIGN_INFLIGHT_MS) return; // already asking
    const back = this.retry.get(url);
    if (back && now < back.notBefore) return;                        // still backing off
    this.queued.add(url);
    clearTimeout(this.batchTimer);
    // batch: switching space asks for several urls in the same tick
    this.batchTimer = setTimeout(() => {
      const paths = [...this.queued];
      this.queued.clear();
      this.sign(hass, paths);
    }, 30);
  }

  private sign(hass: any, paths: string[]): void {
    if (!paths.length || !hass?.callWS) return;
    for (const batch of chunk(paths, MAX_SIGN_PATHS)) {
      const sentAt = this.now();
      for (const p of batch) this.inFlight.set(p, sentAt);
      hass
        .callWS({ type: 'houseplan/content/sign', paths: batch })
        .then((r: any) => {
          if (this.disposed) return;
          // A successful call does NOT mean every path was signed: the backend
          // skips a path it cannot sign, logs it and still answers `{urls: …}`
          // with the rest. Treating the whole batch as done then cleared the
          // backoff for the missing ones, so every later render asked again —
          // the very amplification the backoff exists to stop (review R5-1).
          const at = this.now();
          const next = { ...this.signed };
          let accepted = 0;
          for (const p of batch) {
            const url = r?.urls?.[p];              // only keys we asked for
            if (typeof url === 'string' && url) {
              next[p] = { url, at };
              this.retry.delete(p);
              accepted++;
            } else {
              this.backOff(p);
            }
          }
          if (!accepted) return;
          this.signed = next;
          this.onUpdate();
        })
        .catch(() => {
          // back off rather than retry on the very next frame: a socket that
          // is refusing sign requests would otherwise be hammered per render
          for (const p of batch) this.backOff(p);
        })
        .finally(() => {
          // release only our own attempt: a later one may have superseded it
          for (const p of batch) if (this.inFlight.get(p) === sentAt) this.inFlight.delete(p);
        });
    }
  }

  /** Next attempt for this url waits, and each failure waits twice as long. */
  private backOff(url: string): void {
    const prev = this.retry.get(url)?.delay || 0;
    const delay = Math.min(SIGN_BACKOFF_MAX_MS, prev ? prev * 2 : SIGN_BACKOFF_MIN_MS);
    this.retry.set(url, { notBefore: this.now() + delay, delay });
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
    this.retry.clear(); // a scheduled refresh is a fresh chance for everything
    this.sign(hass, Object.keys(kept));
  }

  /** Test/debug view of the cache. */
  get entries(): Record<string, { url: string; at: number }> {
    return this.signed;
  }

  /** Test/debug view of what is currently being asked for. */
  get inFlightUrls(): string[] {
    return [...this.inFlight.keys()];
  }
}
