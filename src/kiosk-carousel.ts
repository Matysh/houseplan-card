/** One carousel interval and one idle deadline; no frame/pointermove polling. */
export const KIOSK_INTERACTION_PAUSE_MS = 60_000;

export interface KioskCarouselState {
  readonly connected: boolean;
  /** Zero unless kiosk has >1 spaces and no fixed floor. */
  readonly intervalMs: number;
  readonly pausedUntil: number;
  readonly gesturesIdle: boolean;
  readonly surfacesIdle: boolean;
}
export interface KioskCarouselClock {
  now(): number;
  setTimeout(callback: () => void, delay: number): number;
  clearTimeout(handle: number): void;
  setInterval(callback: () => void, delay: number): number;
  clearInterval(handle: number): void;
}
export interface KioskCarouselPort {
  state(): KioskCarouselState;
  pause(until: number): void;
  fitAll(): void;
  advance(): void;
}
const browserClock: KioskCarouselClock = {
  now: () => Date.now(),
  setTimeout: (callback, delay) => window.setTimeout(callback, delay),
  clearTimeout: (handle) => window.clearTimeout(handle),
  setInterval: (callback, delay) => window.setInterval(callback, delay),
  clearInterval: (handle) => window.clearInterval(handle),
};

export class KioskCarousel {
  private interval: number | undefined;
  private deadline: number | undefined;
  private intervalMs = 0;
  private deadlineUntil = 0;
  private handledUntil = 0;
  private surfaceHeld = false;
  private generation = 0;
  private intervalGeneration = 0;

  constructor(private readonly port: KioskCarouselPort,
    private readonly clock: KioskCarouselClock = browserClock) {}

  /** Also mirrors the existing #462 pause when there is no active carousel. */
  interact(): void {
    this.port.pause(Math.max(this.port.state().pausedUntil,
      this.clock.now() + KIOSK_INTERACTION_PAUSE_MS));
    this.sync();
  }

  sync(): void {
    let state = this.port.state();
    const closed = this.surfaceHeld && state.surfacesIdle;
    this.surfaceHeld = !state.surfacesIdle;
    if (closed && state.connected && state.intervalMs > 0) {
      this.port.pause(this.clock.now() + KIOSK_INTERACTION_PAUSE_MS);
      state = this.port.state();
    }
    const ms = state.connected ? state.intervalMs : 0;
    if (ms !== this.intervalMs) {
      this.clearTimers();
      this.intervalMs = ms;
      if (ms > 0) {
        const generation = this.intervalGeneration;
        this.interval = this.clock.setInterval(() => {
          if (generation === this.intervalGeneration) this.tick();
        }, ms);
      }
    }
    if (ms <= 0) { this.clearDeadline(); return; }
    if (state.pausedUntil <= this.handledUntil) return;
    if (this.deadline !== undefined && this.deadlineUntil === state.pausedUntil) return;
    this.clearDeadline();
    const delay = Math.max(0, state.pausedUntil - this.clock.now());
    // A held, expired deadline waits for an observed state change, not a 0ms loop.
    if (delay === 0 && (!state.gesturesIdle || !state.surfacesIdle)) return;
    this.deadlineUntil = state.pausedUntil;
    const generation = this.generation;
    this.deadline = this.clock.setTimeout(() => {
      this.deadline = undefined;
      const current = this.port.state();
      if (generation !== this.generation || !current.connected || current.intervalMs <= 0
        || this.clock.now() < current.pausedUntil || !current.gesturesIdle
        || !current.surfacesIdle) return;
      this.handledUntil = current.pausedUntil;
      this.port.fitAll();
    }, delay);
  }

  tick(): void {
    this.sync();
    let state = this.port.state();
    if (!state.connected || state.intervalMs <= 0 || !state.gesturesIdle
      || !state.surfacesIdle || this.clock.now() < state.pausedUntil) return;
    // Deadline and tick can share an instant. Fit owns the first camera write;
    // its normal transition then holds the next floor until the next tick.
    if (state.pausedUntil > this.handledUntil) {
      this.clearDeadline(); this.handledUntil = state.pausedUntil;
      this.port.fitAll(); state = this.port.state();
      if (!state.gesturesIdle || !state.surfacesIdle) return;
    }
    this.port.advance(); // one change, no elapsed-tick catch-up
  }

  canAdvance(): boolean {
    const state = this.port.state();
    return state.connected && state.intervalMs > 0 && state.gesturesIdle
      && state.surfacesIdle && this.clock.now() >= state.pausedUntil;
  }

  dispose(): void {
    this.clearTimers();
    this.intervalMs = 0;
  }

  private clearDeadline(): void {
    if (this.deadline !== undefined) this.clock.clearTimeout(this.deadline);
    this.deadline = undefined;
    this.generation++;
  }
  private clearTimers(): void {
    this.intervalGeneration++;
    if (this.interval !== undefined) this.clock.clearInterval(this.interval);
    this.interval = undefined;
    this.clearDeadline();
  }
}
