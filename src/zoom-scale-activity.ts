/** A paint-only zoom lease: pan, invalid cameras and pointer lifetimes do not own it. */
export const ZOOM_SCALE_QUIET_MS = 160;

interface Extent { w: number; h: number }
export interface ZoomScaleClock {
  setTimeout(callback: () => void, delay: number): number;
  clearTimeout(handle: number): void;
}

const browserClock: ZoomScaleClock = {
  setTimeout: (callback, delay) => window.setTimeout(callback, delay),
  clearTimeout: (handle) => window.clearTimeout(handle),
};
const valid = (view: Extent): boolean =>
  Number.isFinite(view.w) && view.w > 0 && Number.isFinite(view.h) && view.h > 0;
// log/exp camera interpolation can perturb an unchanged extent by a few ULPs.
// This is arithmetic uncertainty, not a screen-space or geometry tolerance.
const sameExtent = (a: number, b: number): boolean =>
  Math.abs(a - b) <= 16 * Number.EPSILON * Math.max(Math.abs(a), Math.abs(b));

/** One owner, one timer; no camera writes, scene references or render requests. */
export class ZoomScaleActivity {
  private timer: number | null = null;
  private generation = 0;
  private current = false;

  constructor(
    private readonly changed: (active: boolean) => void,
    private readonly clock: ZoomScaleClock = browserClock,
  ) {}

  get active(): boolean { return this.current; }

  change(before: Extent, after: Extent): boolean {
    if (!valid(before) || !valid(after)
        || (sameExtent(before.w, after.w) && sameExtent(before.h, after.h))) return false;
    if (this.timer !== null) this.clock.clearTimeout(this.timer);
    const generation = ++this.generation;
    if (!this.current) { this.current = true; this.changed(true); }
    this.timer = this.clock.setTimeout(() => {
      if (generation !== this.generation) return;
      this.timer = null;
      this.current = false;
      this.changed(false);
    }, ZOOM_SCALE_QUIET_MS);
    return true;
  }

  reset(): void {
    ++this.generation;
    if (this.timer !== null) this.clock.clearTimeout(this.timer);
    this.timer = null;
    if (this.current) { this.current = false; this.changed(false); }
  }

  /** The same host may reconnect; a new change starts a fresh, isolated lease. */
  dispose(): void { this.reset(); }
}
