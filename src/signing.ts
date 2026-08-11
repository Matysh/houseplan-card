import { contentUrl, chunk, MAX_SIGN_PATHS, SIGN_TTL_MS, SIGN_REFRESH_MS } from './logic';
import { PAINT_BARRIER_MAX_MS } from './visual-continuity';

/** A request older than this is presumed lost, and the url may be asked again. */
export const SIGN_INFLIGHT_MS = 15000;
/** After a failure, wait before retrying; doubles up to the cap. */
export const SIGN_BACKOFF_MIN_MS = 2000;
export const SIGN_BACKOFF_MAX_MS = 60000;

type SharedSignedEntry = {
  url: string;
  at: number;
  loaded: boolean;
  /** A refresh is decoded off-DOM before it may replace the visible url. */
  pending?: { url: string; at: number };
  preload?: Promise<boolean>;
};
type SharedSignerRuntime = {
  signed: Record<string, SharedSignedEntry>;
  queued: Set<string>;
  inFlight: Map<string, number>;
  retry: Map<string, { notBefore: number; delay: number }>;
  listeners: Set<() => void>;
  /** Internal terminal-attempt listeners used by prepareImage(). */
  settlers: Set<() => void>;
  references: Map<object, Set<string>>;
};

const sharedSignerRuntimes = new WeakMap<object, SharedSignerRuntime>();
// A single marker may legitimately carry more than MAX_SIGN_PATHS attachments:
// signing is chunked at the transport boundary, while the shared cache must
// retain the complete referenced set. Keep it bounded, but comfortably above
// the 201-item regression contract (and ordinary multi-card plans).
const SHARED_SIGNED_MAX = 512;

const signerAuthority = (hass: any, fallback: object): object => {
  // `hass` itself is commonly replaced on every HA state tick. Keying the
  // shared signer by it discarded the cache continuously in reduced/demo
  // environments without a Connection object. The transport function is the
  // next stable authority; a per-signer fallback is the final option.
  const authority = hass?.connection || hass?.callWS || fallback;
  return authority && (typeof authority === 'object' || typeof authority === 'function')
    ? authority : fallback;
};

const signerRuntime = (authority: object): SharedSignerRuntime => {
  let runtime = sharedSignerRuntimes.get(authority);
  if (!runtime) {
    runtime = {
      signed: {}, queued: new Set(), inFlight: new Map(), retry: new Map(),
      listeners: new Set(), settlers: new Set(), references: new Map(),
    };
    sharedSignerRuntimes.set(authority, runtime);
  }
  return runtime;
};

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
  private readonly fallbackAuthority = {};
  private readonly referenceOwner = {};
  private shared?: SharedSignerRuntime;
  private authority?: object;
  private referenced = new Set<string>();
  /** Waiting for the batch timer to fire. */
  private queued = new Set<string>();
  private batchTimer?: ReturnType<typeof setTimeout>;
  private resignTimer?: ReturnType<typeof setInterval>;
  private disposed = false;
  private readonly sharedUpdate = () => {
    if (!this.disposed) this.onUpdate();
  };

  /**
   * @param onUpdate schedule a re-render (a signature arriving changes the DOM)
   * @param now      injectable clock — the tests need to age a signature
   */
  constructor(private onUpdate: () => void, private now: () => number = () => Date.now()) {}

  private bind(hass: any): SharedSignerRuntime {
    const authority = signerAuthority(hass, this.fallbackAuthority);
    if (this.shared && this.authority === authority) return this.shared;
    if (this.shared) {
      this.shared.listeners.delete(this.sharedUpdate);
      this.shared.references.delete(this.referenceOwner);
    }
    this.authority = authority;
    this.shared = signerRuntime(authority);
    if (!this.disposed) {
      this.shared.listeners.add(this.sharedUpdate);
      this.shared.references.set(this.referenceOwner, new Set(this.referenced));
    }
    return this.shared;
  }

  /** Start the periodic re-sign. `referenced` prunes the cache on each tick. */
  start(hass: () => any, referenced: () => Set<string>): void {
    this.disposed = false; // an element can be reconnected after a disconnect
    this.referenced = new Set(referenced());
    const shared = this.bind(hass());
    shared.listeners.add(this.sharedUpdate);
    shared.references.set(this.referenceOwner, new Set(this.referenced));
    this.stopTimer();
    this.resignTimer = setInterval(() => this.resign(hass(), referenced()), SIGN_REFRESH_MS / 2);
  }

  /** Release every timer; the cache survives a reconnect, the timers must not. */
  dispose(): void {
    this.disposed = true;
    this.stopTimer();
    clearTimeout(this.batchTimer);
    if (this.shared) {
      this.shared.listeners.delete(this.sharedUpdate);
      this.shared.references.delete(this.referenceOwner);
      for (const url of this.queued) this.shared.queued.delete(url);
    }
    this.queued.clear();
  }

  /** Drop signed/runtime state after a whole-model replacement. */
  invalidate(hass: any): void {
    const shared = this.bind(hass);
    clearTimeout(this.batchTimer);
    this.queued.clear();
    shared.queued.clear();
    shared.inFlight.clear();
    shared.retry.clear();
    shared.signed = {};
  }

  private stopTimer(): void {
    if (this.resignTimer !== undefined) clearInterval(this.resignTimer);
    this.resignTimer = undefined;
  }

  /** The url to put in the DOM: a signature we hold and still trust, else ''. */
  display(hass: any, url: string | null | undefined): string {
    const u = contentUrl(url);
    if (!u.startsWith('/api/houseplan/content/')) return u;
    const shared = this.bind(hass);
    this.referenced.add(u);
    shared.references.set(this.referenceOwner, new Set(this.referenced));
    const hit = shared.signed[u];
    const age = hit ? this.now() - hit.at : Infinity;
    if (age < SIGN_REFRESH_MS) return hit.url;
    if (age < SIGN_TTL_MS) {
      // aging but still valid: keep showing it while a fresh one is fetched
      if (!hit.pending) this.request(hass, u);
      return hit.url;
    }
    if (hit) delete shared.signed[u];
    this.request(hass, u);
    // Empty, NOT the plain path: an unsigned request to a `requires_auth` view
    // returns 401 and Home Assistant raises a "failed login attempt".
    return '';
  }

  private request(hass: any, url: string): void {
    if (!hass?.callWS || this.queued.has(url)) return;
    const shared = this.bind(hass);
    const now = this.now();
    const sent = shared.inFlight.get(url);
    if (sent !== undefined && now - sent < SIGN_INFLIGHT_MS) return; // already asking
    if (shared.queued.has(url)) return;
    const back = shared.retry.get(url);
    if (back && now < back.notBefore) return;                        // still backing off
    this.queued.add(url);
    shared.queued.add(url);
    clearTimeout(this.batchTimer);
    // batch: switching space asks for several urls in the same tick
    this.batchTimer = setTimeout(() => {
      const paths = [...this.queued];
      this.queued.clear();
      for (const path of paths) shared.queued.delete(path);
      this.sign(hass, paths);
    }, 30);
  }

  private sign(hass: any, paths: string[]): void {
    if (!paths.length || !hass?.callWS) return;
    const shared = this.bind(hass);
    for (const batch of chunk(paths, MAX_SIGN_PATHS)) {
      const sentAt = this.now();
      const claimed = batch.filter((p) => {
        const sent = shared.inFlight.get(p);
        if (sent !== undefined && sentAt - sent < SIGN_INFLIGHT_MS) return false;
        shared.inFlight.set(p, sentAt);
        return true;
      });
      if (!claimed.length) continue;
      hass
        .callWS({ type: 'houseplan/content/sign', paths: claimed })
        .then((r: any) => {
          // A successful call does NOT mean every path was signed: the backend
          // skips a path it cannot sign, logs it and still answers `{urls: …}`
          // with the rest. Treating the whole batch as done then cleared the
          // backoff for the missing ones, so every later render asked again —
          // the very amplification the backoff exists to stop (review R5-1).
          const at = this.now();
          let accepted = 0;
          let notifyNow = false;
          for (const p of claimed) {
            const url = r?.urls?.[p];              // only keys we asked for
            if (typeof url === 'string' && url) {
              const previous = shared.signed[p];
              if (previous?.loaded && previous.url !== url) {
                // Stale-while-decode: never swap an already painted backdrop
                // for a network/decode candidate. The old signed URL remains
                // in every card until the replacement is ready to paint.
                previous.pending = { url, at };
                this.preloadReplacement(shared, p, url, at);
              } else {
                shared.signed[p] = {
                  url,
                  at,
                  loaded: previous?.url === url ? !!previous.loaded : false,
                };
                notifyNow = true;
              }
              shared.retry.delete(p);
              accepted++;
            } else {
              this.backOff(shared, p);
            }
          }
          if (!accepted) return;
          this.trimShared(shared);
          if (notifyNow) for (const listener of [...shared.listeners]) listener();
        })
        .catch(() => {
          // back off rather than retry on the very next frame: a socket that
          // is refusing sign requests would otherwise be hammered per render
          for (const p of claimed) this.backOff(shared, p);
        })
        .finally(() => {
          // release only our own attempt: a later one may have superseded it
          for (const p of claimed) if (shared.inFlight.get(p) === sentAt) shared.inFlight.delete(p);
          // `prepareImage()` also listens for terminal failures. Without this
          // notification it waited for the full 15 s lost-request timeout even
          // when the websocket had already rejected, delaying the card's
          // bounded retry and keeping the previous frame far too long.
          for (const settle of [...shared.settlers]) settle();
        });
    }
  }

  private preloadReplacement(
    shared: SharedSignerRuntime,
    path: string,
    url: string,
    at: number,
  ): void {
    const promote = (): void => {
      const current = shared.signed[path];
      if (current?.pending?.url !== url) return;
      shared.signed[path] = { url, at, loaded: true };
      shared.retry.delete(path);
      this.trimShared(shared);
      for (const listener of [...shared.listeners]) listener();
    };
    const reject = (): void => {
      const current = shared.signed[path];
      if (current?.pending?.url !== url) return;
      delete current.pending;
      this.backOff(shared, path);
    };
    // Unit/non-DOM runtimes cannot preload; accepting synchronously preserves
    // the cache contract while browsers take the stricter decode path.
    if (typeof Image === 'undefined') {
      promote();
      return;
    }
    const image = new Image();
    image.onload = () => {
      const decoded = typeof image.decode === 'function' ? image.decode() : Promise.resolve();
      decoded.then(promote).catch(reject);
    };
    image.onerror = reject;
    image.src = url;
  }

  private preloadCurrentImage(
    shared: SharedSignerRuntime,
    path: string,
    entry: SharedSignedEntry,
  ): Promise<boolean> {
    if (entry.loaded) return Promise.resolve(true);
    if (entry.preload) return entry.preload;
    if (typeof Image === 'undefined') {
      entry.loaded = true;
      return Promise.resolve(true);
    }
    const url = entry.url;
    entry.preload = new Promise<boolean>((resolve) => {
      const image = new Image();
      let settled = false;
      const finish = (ready: boolean): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const current = shared.signed[path];
        if (current === entry) delete current.preload;
        if (ready && current === entry && current.url === url) {
          current.loaded = true;
          for (const listener of [...shared.listeners]) listener();
          resolve(true);
          return;
        }
        if (!ready && current === entry) this.backOff(shared, path);
        resolve(false);
      };
      image.onload = () => {
        const decoded = typeof image.decode === 'function' ? image.decode() : Promise.resolve();
        decoded.then(() => finish(true)).catch(() => finish(false));
      };
      image.onerror = () => finish(false);
      // A browser may leave an image request pending forever (sleep, dead
      // service worker, stalled authenticated endpoint). Release the shared
      // preload slot so Retry can start a genuinely new request.
      const timer = setTimeout(() => finish(false), PAINT_BARRIER_MAX_MS);
      image.src = url;
    });
    return entry.preload;
  }

  /**
   * Sign and decode a protected image before a structural candidate adopts it.
   * The current frame can therefore keep its old backdrop for the whole wait.
   */
  prepareImage(hass: any, url: string | null | undefined): Promise<boolean> {
    const path = contentUrl(url);
    if (!path.startsWith('/api/houseplan/content/')) return Promise.resolve(true);
    const shared = this.bind(hass);
    const attempt = (): Promise<boolean> | null => {
      const entry = shared.signed[path];
      if (entry && this.now() - entry.at < SIGN_TTL_MS) {
        return this.preloadCurrentImage(shared, path, entry);
      }
      this.display(hass, path);
      const retry = shared.retry.get(path);
      if (retry && retry.notBefore > this.now()
          && !shared.inFlight.has(path) && !shared.queued.has(path)) {
        return Promise.resolve(false);
      }
      return null;
    };
    const bounded = (promise: Promise<boolean>): Promise<boolean> => new Promise((resolve) => {
      let done = false;
      const finish = (ready: boolean): void => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(ready);
      };
      const timer = setTimeout(() => finish(false), PAINT_BARRIER_MAX_MS);
      promise.then(finish).catch(() => finish(false));
    });
    const immediate = attempt();
    if (immediate) return bounded(immediate);
    return new Promise<boolean>((resolve) => {
      let done = false;
      let active: Promise<boolean> | null = null;
      const finish = (ready: boolean): void => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        shared.settlers.delete(check);
        resolve(ready);
      };
      const check = (): void => {
        if (done || active) return;
        active = attempt();
        if (!active) return;
        active.then(finish).catch(() => finish(false));
      };
      const timer = setTimeout(() => finish(false), PAINT_BARRIER_MAX_MS);
      shared.settlers.add(check);
      check();
    });
  }

  /** Next attempt for this url waits, and each failure waits twice as long. */
  private backOff(shared: SharedSignerRuntime, url: string): void {
    const prev = shared.retry.get(url)?.delay || 0;
    const delay = Math.min(SIGN_BACKOFF_MAX_MS, prev ? prev * 2 : SIGN_BACKOFF_MIN_MS);
    shared.retry.set(url, { notBefore: this.now() + delay, delay });
  }

  private trimShared(shared: SharedSignerRuntime): void {
    const entries = Object.entries(shared.signed);
    if (entries.length <= SHARED_SIGNED_MAX) return;
    const protectedPaths = new Set<string>(shared.inFlight.keys());
    for (const refs of shared.references.values()) for (const path of refs) protectedPaths.add(path);
    for (const [path, entry] of entries) {
      if (entry.pending || entry.preload) protectedPaths.add(path);
    }
    entries.sort((left, right) => right[1].at - left[1].at);
    const kept = entries.filter(([path]) => protectedPaths.has(path));
    for (const entry of entries) {
      if (kept.length >= SHARED_SIGNED_MAX) break;
      if (!protectedPaths.has(entry[0])) kept.push(entry);
    }
    shared.signed = Object.fromEntries(kept);
  }

  /**
   * Re-sign what is still in use. A wall tablet outlives a signature, and an
   * entry for a plan replaced months ago must not consume a slot in the capped
   * request — so prune to the urls the live config still references.
   */
  resign(hass: any, referenced: Set<string>): void {
    const shared = this.bind(hass);
    this.referenced = new Set(referenced);
    shared.references.set(this.referenceOwner, new Set(this.referenced));
    const now = this.now();
    const allReferenced = new Set<string>();
    for (const refs of shared.references.values()) for (const path of refs) allReferenced.add(path);
    const kept: Record<string, SharedSignedEntry> = {};
    for (const [k, v] of Object.entries(shared.signed)) {
      if (allReferenced.has(k) && now - v.at < SIGN_TTL_MS) kept[k] = v;
    }
    shared.signed = kept;
    shared.retry.clear(); // a scheduled refresh is a fresh chance for everything
    this.sign(hass, [...referenced].filter((path) => !!kept[path] && !kept[path].pending));
  }

  /** Mark a protected image as decoded/paintable; shared warm mounts inherit it. */
  markLoaded(hass: any, url: string | null | undefined, paintedUrl?: string): void {
    const path = contentUrl(url);
    if (!path.startsWith('/api/houseplan/content/')) return;
    const entry = this.bind(hass).signed[path];
    // A late load event from an expired/re-signed URL must not bless the newer
    // entry that happens to share the same raw content path.
    if (entry && (!paintedUrl || entry.url === paintedUrl) && !entry.loaded) {
      entry.loaded = true;
      for (const listener of [...this.bind(hass).listeners]) listener();
    }
  }

  /** Required protected assets are ready only after signing and image load. */
  isReady(hass: any, url: string | null | undefined): boolean {
    const path = contentUrl(url);
    if (!path.startsWith('/api/houseplan/content/')) return true;
    const entry = this.bind(hass).signed[path];
    return !!entry && this.now() - entry.at < SIGN_TTL_MS && entry.loaded;
  }

  /** Test/debug view of the cache. */
  get entries(): Record<string, { url: string; at: number }> {
    const entries: Record<string, { url: string; at: number }> = {};
    for (const [path, entry] of Object.entries(this.shared?.signed || {})) {
      entries[path] = { url: entry.url, at: entry.at };
    }
    return entries;
  }

  /** Test/debug view of what is currently being asked for. */
  get inFlightUrls(): string[] {
    return [...(this.shared?.inFlight.keys() || [])];
  }
}
