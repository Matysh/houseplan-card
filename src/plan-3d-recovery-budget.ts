export const PLAN_3D_RESTORE_VISIBLE_MS = 4000;

export interface RestoreClock {
  now(): number;
  setTimeout(callback: () => void, delay: number): number;
  clearTimeout(id: number): void;
}

/** A physical interruption spends visible time only. Repeated notifications
 * cannot extend the same interruption; a full paint ends it. */
export class Plan3dRestoreBudget {
  private remaining = 0;
  private since?: number;
  private timer?: number;
  private active = false;

  constructor(private readonly clock: RestoreClock, private readonly expired: () => void) {}

  begin(visible: boolean): void {
    if (this.active) return;
    this.active = true;
    this.remaining = PLAN_3D_RESTORE_VISIBLE_MS;
    this.visibility(visible);
  }

  visibility(visible: boolean): void {
    if (!this.active) return;
    if (!visible) {
      if (this.since !== undefined) this.remaining = Math.max(0, this.remaining - (this.clock.now() - this.since));
      this.cancelTimer();
      return;
    }
    if (this.timer !== undefined) return;
    this.since = this.clock.now();
    this.timer = this.clock.setTimeout(() => {
      this.finish();
      this.expired();
    }, this.remaining);
  }

  finish(): void {
    this.active = false;
    this.cancelTimer();
  }

  private cancelTimer(): void {
    if (this.timer !== undefined) this.clock.clearTimeout(this.timer);
    this.timer = this.since = undefined;
  }
}
