/** One instance-local 600 ms View-marker hold; the card owns hit testing. */
export const VIEW_HOLD_MS = 600;

export interface ViewHoldClock {
  setTimeout(callback: () => void, delay: number): number;
  clearTimeout(id: number): void;
}

const browserClock: ViewHoldClock = {
  setTimeout: (callback, delay) => window.setTimeout(callback, delay),
  clearTimeout: (id) => window.clearTimeout(id),
};

export class ViewHoldGesture {
  private timer = 0;
  private owner: number | null = null;
  private generation = 0;

  constructor(private readonly clock: ViewHoldClock = browserClock) {}

  get pointerId(): number | null { return this.owner; }

  arm(pointerId: number, onHold: () => void): void {
    this.cancel();
    this.owner = pointerId;
    const generation = this.generation;
    this.timer = this.clock.setTimeout(() => {
      if (this.generation !== generation || this.owner !== pointerId) return;
      this.timer = 0;
      this.owner = null;
      ++this.generation;
      onHold();
    }, VIEW_HOLD_MS);
  }

  /** A foreign pointer cannot retire the current press. No id means lifecycle exit. */
  cancel(pointerId?: number): void {
    if (pointerId !== undefined && this.owner !== pointerId) return;
    if (this.timer) this.clock.clearTimeout(this.timer);
    this.timer = 0;
    this.owner = null;
    ++this.generation;
  }
}
