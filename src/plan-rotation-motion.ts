/** One owner for the accepted 280ms quarter-turn presentation. */
export interface PlanRotationMotionPort {
  current(): () => boolean;
  stage(): HTMLElement | null;
  changed(direction: -1 | 1): void;
  updated(): Promise<unknown>;
  reduced(): boolean;
  blocked(): boolean;
  requestFrame(callback: FrameRequestCallback): number;
  cancelFrame(id: number): void;
  now(): number;
}
const pixelScale = (stage: HTMLElement): number => {
  const box = stage.querySelector<SVGSVGElement>('svg.plan-svg')?.viewBox.baseVal;
  return box?.width && box.height ? Math.min(stage.clientWidth / box.width, stage.clientHeight / box.height) : 1;
};
export class PlanRotationMotion {
  private queue: { direction: -1 | 1; current: () => boolean }[] = [];
  private epoch = 0;
  private frame: number | null = null;
  private restore: (() => void) | null = null;
  private active = false;
  constructor(private readonly port: PlanRotationMotionPort) {}
  rotate(direction: -1 | 1): void {
    this.queue.push({ direction, current: this.port.current() });
    if (!this.active) void this.next();
  }
  cancel(): void {
    this.epoch++; this.queue = [];
    if (this.frame !== null) this.port.cancelFrame(this.frame);
    this.frame = null; this.restore?.(); this.restore = null; this.active = false;
  }
  private async next(): Promise<void> {
    const request = this.queue.shift();
    if (!request) { this.active = false; return; }
    if (!request.current()) { void this.next(); return; }
    this.active = true;
    const epoch = this.epoch, before = this.port.stage(), scale = before ? pixelScale(before) : 1;
    this.port.changed(request.direction);
    await this.port.updated();
    if (epoch !== this.epoch) return;
    const stage = this.port.stage(), wrap = stage?.querySelector<HTMLElement>('.zoomwrap');
    if (!request.current() || !stage || !wrap || this.port.reduced()) { this.active = false; void this.next(); return; }
    const ratio = scale / pixelScale(stage), overflow = stage.style.overflow, inert = stage.inert;
    const origin = wrap.style.transformOrigin, willChange = wrap.style.willChange, transform = wrap.style.transform;
    this.restore = () => {
      stage.style.overflow = overflow; stage.inert = inert || this.port.blocked();
      wrap.style.transformOrigin = origin; wrap.style.willChange = willChange; wrap.style.transform = transform;
    };
    stage.style.overflow = 'hidden'; stage.inert = true;
    wrap.style.transformOrigin = '50% 50%'; wrap.style.willChange = 'transform';
    const start = this.port.now();
    const finish = () => {
      this.frame = null; this.restore?.(); this.restore = null; this.active = false; void this.next();
    };
    const frame = (now: number) => {
      if (epoch !== this.epoch) return;
      if (!request.current() || !stage.isConnected || !wrap.isConnected) { finish(); return; }
      const progress = Math.min(1, Math.max(0, (now - start) / 280));
      const eased = 1 - (1 - progress) ** 3;
      wrap.style.transform = `rotate(${-request.direction * 90 * (1 - eased)}deg) scale(${ratio + (1 - ratio) * eased})`;
      if (progress < 1) this.frame = this.port.requestFrame(frame);
      else finish();
    };
    frame(start);
  }
}
