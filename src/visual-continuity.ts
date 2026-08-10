/**
 * Shared visual-continuity primitives for both House Plan cards (#73).
 *
 * The controller deliberately owns no House Plan model and never calls HA.
 * It only guards the transition from the last complete frame to a candidate,
 * keeps recovery-overlay timing deterministic, and exposes a small trace for
 * lifecycle diagnostics.
 */

export const CONTINUITY_LONG_HIDDEN_MS = 15_000;
export const RECOVERY_OVERLAY_DELAY_MS = 150;
export const RECOVERY_OVERLAY_FADE_IN_MS = 150;
export const RECOVERY_OVERLAY_MIN_OPAQUE_MS = 250;
export const RECOVERY_OVERLAY_FADE_OUT_MS = 180;
export const PAINT_BARRIER_MAX_MS = 2_000;

export type ContinuityState =
  | 'steady'
  | 'holding'
  | 'candidate-ready'
  | 'overlay-pending'
  | 'overlay-visible'
  | 'offline-stale'
  | 'recovery-error';

export type RecoveryReason = 'plan' | 'connection' | 'stage-size' | 'asset' | null;
export type OverlayPhase = 'none' | 'entering' | 'fading-in' | 'opaque' | 'leaving';

export interface ContinuityTraceEvent {
  at: number;
  token: number;
  event: string;
  state: ContinuityState;
  reason?: string;
  stage?: [number, number];
  configRev?: number;
  layoutRev?: number;
  assetPending?: number;
}

export interface PageVisibilitySignal {
  kind: 'hidden' | 'visible' | 'pageshow';
  token: number;
  at: number;
  hiddenFor: number;
  long: boolean;
  persisted?: boolean;
}

interface PageVisibilityRuntime {
  hiddenAt: number;
  token: number;
  subscribers: Set<(signal: PageVisibilitySignal) => void>;
  onVisibility: () => void;
  onPageShow: (event: PageTransitionEvent) => void;
}

const visibilityRuntimes = new WeakMap<Document, PageVisibilityRuntime>();

/** One visibility/pageshow listener per Document, shared by every card. */
export function subscribePageVisibility(
  doc: Document,
  subscriber: (signal: PageVisibilitySignal) => void,
): () => void {
  let runtime = visibilityRuntimes.get(doc);
  if (!runtime) {
    const subscribers = new Set<(signal: PageVisibilitySignal) => void>();
    runtime = {
      hiddenAt: doc.visibilityState === 'hidden' ? Date.now() : 0,
      token: 0,
      subscribers,
      onVisibility: () => {
        const current = visibilityRuntimes.get(doc);
        if (!current) return;
        const at = Date.now();
        if (doc.visibilityState === 'hidden') {
          if (!current.hiddenAt) current.hiddenAt = at;
          const signal: PageVisibilitySignal = {
            kind: 'hidden', token: current.token, at, hiddenFor: 0, long: false,
          };
          for (const listener of [...current.subscribers]) listener(signal);
          return;
        }
        const hiddenFor = current.hiddenAt ? Math.max(0, at - current.hiddenAt) : 0;
        current.hiddenAt = 0;
        current.token++;
        const signal: PageVisibilitySignal = {
          kind: 'visible', token: current.token, at, hiddenFor,
          long: hiddenFor >= CONTINUITY_LONG_HIDDEN_MS,
        };
        for (const listener of [...current.subscribers]) listener(signal);
      },
      onPageShow: (event: PageTransitionEvent) => {
        const current = visibilityRuntimes.get(doc);
        if (!current) return;
        const at = Date.now();
        current.token++;
        const signal: PageVisibilitySignal = {
          kind: 'pageshow', token: current.token, at, hiddenFor: 0,
          long: !!event.persisted, persisted: !!event.persisted,
        };
        for (const listener of [...current.subscribers]) listener(signal);
      },
    };
    visibilityRuntimes.set(doc, runtime);
    doc.addEventListener('visibilitychange', runtime.onVisibility);
    doc.defaultView?.addEventListener('pageshow', runtime.onPageShow);
  }
  runtime.subscribers.add(subscriber);
  return () => {
    const current = visibilityRuntimes.get(doc);
    if (!current) return;
    current.subscribers.delete(subscriber);
    if (current.subscribers.size) return;
    doc.removeEventListener('visibilitychange', current.onVisibility);
    doc.defaultView?.removeEventListener('pageshow', current.onPageShow);
    visibilityRuntimes.delete(doc);
  };
}

export interface ContinuityClock {
  now(): number;
  setTimeout(callback: () => void, delay: number): number;
  clearTimeout(id: number): void;
  requestAnimationFrame(callback: FrameRequestCallback): number;
  cancelAnimationFrame(id: number): void;
}

const browserClock: ContinuityClock = {
  now: () => Date.now(),
  setTimeout: (callback, delay) => window.setTimeout(callback, delay),
  clearTimeout: (id) => window.clearTimeout(id),
  requestAnimationFrame: (callback) => window.requestAnimationFrame(callback),
  cancelAnimationFrame: (id) => window.cancelAnimationFrame(id),
};

export interface PaintBarrierHooks {
  updateComplete(): Promise<unknown>;
  stageValid(): boolean;
  assetsReady(): boolean;
  frameFingerprint(): string;
}

/** A bounded, placement-owned state machine; business data stays in the card. */
export class VisualContinuityController {
  private _state: ContinuityState = 'steady';
  private _token = 0;
  private _frameFingerprint = '';
  private _hasCompleteFrame = false;
  private _overlayPhase: OverlayPhase = 'none';
  private _recoveryReason: RecoveryReason = null;
  private _overlayTimer = 0;
  private _overlayRaf = 0;
  private _overlayOpaqueAt = 0;
  private _barrierRafs = new Set<number>();
  private _trace: ContinuityTraceEvent[] = [];
  private _disposed = false;

  constructor(
    private readonly onChange: () => void,
    private readonly clock: ContinuityClock = browserClock,
  ) {}

  get state(): ContinuityState { return this._state; }
  get token(): number { return this._token; }
  get frameFingerprint(): string { return this._frameFingerprint; }
  get hasCompleteFrame(): boolean { return this._hasCompleteFrame; }
  get overlayPhase(): OverlayPhase { return this._overlayPhase; }
  get overlayVisible(): boolean { return this._overlayPhase !== 'none'; }
  get overlayBlocksInteraction(): boolean { return this.overlayVisible; }
  get recoveryReason(): RecoveryReason { return this._recoveryReason; }
  get trace(): readonly ContinuityTraceEvent[] { return this._trace; }

  /** Redacted card-owned lifecycle markers; never pass ids or urls here. */
  note(event: string, detail: Partial<ContinuityTraceEvent> = {}): void {
    this.record(event, undefined, detail);
  }

  private record(event: string, reason?: string, detail: Partial<ContinuityTraceEvent> = {}): void {
    this._trace.push({
      at: this.clock.now(), token: this._token, event, state: this._state,
      ...(reason ? { reason } : {}), ...detail,
    });
    if (this._trace.length > 80) this._trace.splice(0, this._trace.length - 80);
  }

  private changed(): void {
    if (!this._disposed) this.onChange();
  }

  /** Warm memo/static cache adoption happens before the first visible render. */
  adoptCompleteFrame(fingerprint: string): void {
    if (!fingerprint) return;
    this._hasCompleteFrame = true;
    this._frameFingerprint = fingerprint;
    this._state = 'steady';
    this._recoveryReason = null;
    this.clearOverlay();
    this.record('frame-adopted');
    this.changed();
  }

  markCompleteFrame(fingerprint: string): void {
    if (!fingerprint) return;
    this._hasCompleteFrame = true;
    this._frameFingerprint = fingerprint;
    this._state = 'steady';
    this._recoveryReason = null;
    this.clearOverlay();
    this.record('frame-complete');
    this.changed();
  }

  /**
   * State-only renders are already one synchronous Lit commit and do not need
   * a structural candidate. Keep diagnostics/warm placement identity current
   * without scheduling the extra render that `markCompleteFrame()` uses for a
   * cold/adopted frame.
   */
  refreshCompleteFrame(fingerprint: string): void {
    if (this._disposed || !this._hasCompleteFrame || this._state !== 'steady'
        || !fingerprint || fingerprint === this._frameFingerprint) return;
    this._frameFingerprint = fingerprint;
    this.record('frame-refreshed');
  }

  visibility(signal: PageVisibilitySignal): number {
    if (signal.kind === 'hidden') {
      this.record('visibility-hidden');
      return this._token;
    }
    if (!signal.long && (signal.kind === 'visible' || signal.kind === 'pageshow')) {
      // A quick return with no changed inputs is a strict no-op: no Lit update.
      this.record(signal.kind === 'pageshow' ? 'pageshow-noop' : 'visibility-visible-quick');
      return this._token;
    }
    return this.beginCandidate(signal.kind === 'pageshow' ? 'pageshow' : 'long-resume');
  }

  beginCandidate(reason: string, recoveryReason: RecoveryReason = 'plan'): number {
    this._token++;
    this._recoveryReason = recoveryReason;
    if (this._hasCompleteFrame) {
      this._state = recoveryReason === 'connection' ? 'offline-stale' : 'holding';
      this.clearOverlay();
    } else if (this.overlayVisible) {
      // Retry/late reconnect keeps an already opaque fallback in place; it may
      // only leave after the new token crosses the paint barrier.
      this._state = 'overlay-visible';
    } else {
      this._state = 'overlay-pending';
      this.scheduleOverlay(recoveryReason);
    }
    this.record('candidate-start', reason);
    this.changed();
    return this._token;
  }

  connectionLost(): number {
    return this.beginCandidate('connection-lost', 'connection');
  }

  candidateReady(token: number): boolean {
    if (this._disposed || token !== this._token) return false;
    this._state = 'candidate-ready';
    this.record('candidate-ready');
    this.changed();
    return true;
  }

  /**
   * Lit completion + two animation opportunities form one cancellable paint
   * barrier. A stale token can never reveal an older candidate.
   */
  async commitAfterPaint(token: number, hooks: PaintBarrierHooks): Promise<boolean> {
    if (this._disposed || token !== this._token) return false;
    const barrier = (async () => {
      await hooks.updateComplete();
      if (token !== this._token || !hooks.stageValid() || !hooks.assetsReady()) return false;
      await this.nextFrame();
      if (token !== this._token || !hooks.stageValid() || !hooks.assetsReady()) return false;
      await this.nextFrame();
      return token === this._token && hooks.stageValid() && hooks.assetsReady();
    })();
    let timeout = 0;
    const timed = new Promise<{ ready: false; timedOut: true }>((resolve) => {
      timeout = this.clock.setTimeout(
        () => resolve({ ready: false, timedOut: true }), PAINT_BARRIER_MAX_MS,
      );
    });
    const outcome = await Promise.race([
      barrier.then((ready) => ({ ready, timedOut: false as const })),
      timed,
    ]);
    this.clock.clearTimeout(timeout);
    if (this._disposed || token !== this._token) return false;
    if (!outcome.ready && !outcome.timedOut) {
      // Stage/resource readiness can change between the two paint checks.
      // This is a recoverable rejection, not the two-second timeout: retain
      // the token and let the card retry when the missing readiness signal
      // arrives, without converting a transient image decode into an error.
      this.record('paint-barrier-rejected');
      if (this._hasCompleteFrame) {
        this._state = this._recoveryReason === 'connection' ? 'offline-stale' : 'holding';
      } else {
        this._state = this.overlayVisible ? 'overlay-visible' : 'overlay-pending';
      }
      this.changed();
      return false;
    }
    if (!outcome.ready) {
      this.record('paint-barrier-timeout');
      if (this._hasCompleteFrame) {
        this._state = this._recoveryReason === 'connection' ? 'offline-stale' : 'steady';
        this.clearOverlay();
      } else {
        this._state = 'recovery-error';
        if (this._overlayPhase === 'none') this.showOverlayNow();
      }
      this.changed();
      return false;
    }
    this._hasCompleteFrame = true;
    this._frameFingerprint = hooks.frameFingerprint();
    this.record('paint-barrier');
    this.finishOverlayAfterCommit();
    return true;
  }

  retry(reason: RecoveryReason = this._recoveryReason || 'plan'): number {
    return this.beginCandidate('retry', reason);
  }

  private nextFrame(): Promise<void> {
    return new Promise((resolve) => {
      const id = this.clock.requestAnimationFrame(() => {
        this._barrierRafs.delete(id);
        resolve();
      });
      this._barrierRafs.add(id);
    });
  }

  private scheduleOverlay(reason: RecoveryReason): void {
    this.clearOverlayTimer();
    this._recoveryReason = reason;
    this._overlayTimer = this.clock.setTimeout(() => {
      this._overlayTimer = 0;
      if (this._hasCompleteFrame || this._state !== 'overlay-pending') return;
      this._state = 'overlay-visible';
      this._overlayPhase = 'entering';
      this.record('overlay-enter');
      this.changed();
      this._overlayRaf = this.clock.requestAnimationFrame(() => {
        this._overlayRaf = 0;
        if (this._overlayPhase !== 'entering') return;
        this._overlayPhase = 'fading-in';
        this.changed();
        this._overlayTimer = this.clock.setTimeout(() => {
          this._overlayTimer = 0;
          if (this._overlayPhase !== 'fading-in') return;
          this._overlayPhase = 'opaque';
          this._overlayOpaqueAt = this.clock.now();
          this.record('overlay-opaque');
          this.changed();
        }, RECOVERY_OVERLAY_FADE_IN_MS);
      });
    }, RECOVERY_OVERLAY_DELAY_MS);
  }

  private showOverlayNow(): void {
    this.clearOverlayTimer();
    this._overlayPhase = 'opaque';
    this._overlayOpaqueAt = this.clock.now();
    this.record('overlay-error');
  }

  private finishOverlayAfterCommit(): void {
    this.clearOverlayTimer();
    if (this._overlayPhase === 'none' || this._overlayPhase === 'entering'
        || this._overlayPhase === 'fading-in') {
      // A candidate that wins during fade-in cancels it without a minimum hold.
      this.clearOverlay();
      this._state = 'steady';
      this._recoveryReason = null;
      this.record('candidate-committed');
      this.changed();
      return;
    }
    const wait = Math.max(0,
      this._overlayOpaqueAt + RECOVERY_OVERLAY_MIN_OPAQUE_MS - this.clock.now());
    this._overlayTimer = this.clock.setTimeout(() => {
      this._overlayTimer = 0;
      this._overlayPhase = 'leaving';
      this.record('overlay-leave');
      this.changed();
      this._overlayTimer = this.clock.setTimeout(() => {
        this._overlayTimer = 0;
        this._overlayPhase = 'none';
        this._state = 'steady';
        this._recoveryReason = null;
        this.record('candidate-committed');
        this.changed();
      }, RECOVERY_OVERLAY_FADE_OUT_MS);
    }, wait);
  }

  private clearOverlayTimer(): void {
    if (this._overlayTimer) this.clock.clearTimeout(this._overlayTimer);
    this._overlayTimer = 0;
  }

  private clearOverlay(): void {
    this.clearOverlayTimer();
    if (this._overlayRaf) this.clock.cancelAnimationFrame(this._overlayRaf);
    this._overlayRaf = 0;
    this._overlayPhase = 'none';
    this._overlayOpaqueAt = 0;
  }

  dispose(): void {
    this._disposed = true;
    this._token++;
    this.clearOverlay();
    for (const id of this._barrierRafs) this.clock.cancelAnimationFrame(id);
    this._barrierRafs.clear();
  }
}

/** Stable, inexpensive content identity for structural WS responses. */
export function contentFingerprint(value: unknown): string {
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;
  const seen = new WeakSet<object>();
  const feed = (text: string): void => {
    for (let index = 0; index < text.length; index++) {
      const code = text.charCodeAt(index);
      a ^= code;
      a = Math.imul(a, 0x01000193);
      b ^= code + ((b << 6) >>> 0) + (b >>> 2);
    }
  };
  const visit = (node: unknown): void => {
    if (node === null) { feed('n'); return; }
    const type = typeof node;
    if (type === 'string') { feed(`s${(node as string).length}:${node}`); return; }
    if (type === 'number') { feed(`d${Number.isNaN(node) ? 'NaN' : String(node)}`); return; }
    if (type === 'boolean') { feed(node ? 't' : 'f'); return; }
    if (type === 'undefined') { feed('u'); return; }
    if (type !== 'object') { feed(`${type}:${String(node)}`); return; }
    const object = node as object;
    if (seen.has(object)) { feed('[cycle]'); return; }
    seen.add(object);
    if (Array.isArray(node)) {
      feed('[');
      for (const item of node) visit(item);
      feed(']');
      return;
    }
    feed('{');
    for (const key of Object.keys(node as Record<string, unknown>).sort()) {
      feed(key);
      visit((node as Record<string, unknown>)[key]);
    }
    feed('}');
  };
  visit(value);
  return `${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0).toString(16).padStart(8, '0')}`;
}

export function visualFrameFingerprint(parts: readonly unknown[]): string {
  return contentFingerprint(parts);
}
