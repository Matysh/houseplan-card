/**
 * The kiosk's 3 s hold on the empty stage that opens the per-screen scale
 * dialog (#813 F11).
 *
 * The card decides which press may arm it and wires every way a press can
 * end; this owns the one timer and the pointer that armed it. Release,
 * cancel, a lost capture, a window that loses focus, a second contact and a
 * disconnect are all the same `cancel()`. Firing hands the owning pointer to
 * the card, which must end the whole stage gesture before the modal opens:
 * a mouse has no implicit capture, so the release of that very press goes to
 * the dialog and the stage never hears of it.
 */
export const KIOSK_HOLD_MS = 3000;

export interface KioskHoldClock {
  setTimeout(callback: () => void, delay: number): number;
  clearTimeout(id: number): void;
}

const browserClock: KioskHoldClock = {
  setTimeout: (callback, delay) => window.setTimeout(callback, delay),
  clearTimeout: (id) => window.clearTimeout(id),
};

export class KioskHoldGesture {
  private timer = 0;
  private owner: number | null = null;

  constructor(
    private readonly onHold: (pointerId: number) => void,
    private readonly clock: KioskHoldClock = browserClock,
  ) {}

  /** The pointer whose hold is running, or null. */
  get pointerId(): number | null { return this.owner; }

  /** Start (or restart) the hold for one pointer. */
  arm(pointerId: number): void {
    this.cancel();
    this.owner = pointerId;
    this.timer = this.clock.setTimeout(() => {
      const owner = this.owner;
      this.timer = 0;
      this.owner = null;
      if (owner !== null) this.onHold(owner);
    }, KIOSK_HOLD_MS);
  }

  /** The press ended or stopped being a hold; never fires afterwards. */
  cancel(): void {
    if (this.timer) this.clock.clearTimeout(this.timer);
    this.timer = 0;
    this.owner = null;
  }
}
