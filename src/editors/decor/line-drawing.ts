import { snapSegment45 } from '../../logic';
import { SANE_LIMIT } from '../../space-geometry';

/** Only a cursor on the common geometry command, never a second history stack. */
export interface DecorLineSession { token: number; anchor: number[] }
export interface DecorLinePort {
  context(): string | null;
  current(): () => boolean;
  blocked(): boolean;
  point(event: MouseEvent): number[];
  snap(raw: number[], pointerType: string): number[];
  pitch(): number;
  preview(a: number[] | null, b?: number[]): void;
  commit(a: number[], b: number[], before: DecorLineSession, after: DecorLineSession): void;
  queue(run: () => void): void;
  cancelQueue(): void;
  events: EventTarget;
}

/** A position magnet may refine Shift only if it stays on the exact selected ray. */
export function decorLineEnd(anchor: number[], raw: number[], pitch: number,
  shift: boolean, magnet: number[]): number[] {
  if (!shift) return magnet;
  const ray = snapSegment45(anchor, raw, pitch, SANE_LIMIT);
  const dx = ray[0] - anchor[0], dy = ray[1] - anchor[1];
  const mx = magnet[0] - anchor[0], my = magnet[1] - anchor[1];
  const sameRay = Math.abs(dx * my - dy * mx) <= 1e-8
    && dx * mx + dy * my > 0 && magnet.every(Number.isFinite)
    && magnet.every(value => Math.abs(value) <= SANE_LIMIT);
  return sameRay ? magnet : ray;
}

let sessionSequence = 0;
/** Clean clicks share the stage's pan/pinch navigation; only the click commits. */
export class DecorLineDrawing {
  private session: DecorLineSession | null = null;
  private owner: string | null = null;
  private authority: (() => boolean) | null = null;
  private listening = false;
  private raw: number[] | null = null;
  private pointerType = 'mouse';
  private shift = false;
  private contacts = new Set<number>();
  private press: { id: number; x: number; y: number } | null = null;
  private ready: { x: number; y: number; type: string } | null = null;
  private readonly modifier = (event: Event): void => {
    const key = event as KeyboardEvent;
    if (key.key !== 'Shift' || !this.sync()) return;
    this.shift = key.type === 'keydown'; this.paint();
  };
  private readonly interrupt = (): void => { this.reset(); };
  constructor(private readonly port: DecorLinePort) {}
  get active(): boolean { return !!this.session; }
  owns(pointerId: number): boolean { return this.contacts.has(pointerId); }
  get snapshot(): DecorLineSession | undefined {
    return this.session ? { token: this.session.token, anchor: [...this.session.anchor] } : undefined;
  }
  sync(): boolean {
    const context = this.port.context();
    if (!context || this.owner && context !== this.owner || this.authority && !this.authority()) {
      this.reset(); return false;
    }
    return !!context;
  }
  reset(): void {
    this.port.cancelQueue(); this.port.preview(null);
    this.session = null; this.owner = null; this.authority = null; this.raw = null;
    this.press = null; this.ready = null; this.contacts.clear();
    if (this.listening) {
      this.port.events.removeEventListener('keydown', this.modifier);
      this.port.events.removeEventListener('keyup', this.modifier);
      this.port.events.removeEventListener('blur', this.interrupt);
      this.port.events.removeEventListener('pagehide', this.interrupt);
      this.listening = false;
    }
  }
  private begin(anchor: number[], token = ++sessionSequence): void {
    this.session = { token, anchor: [...anchor] }; this.owner = this.port.context();
    this.authority = this.port.current();
    this.port.events.addEventListener('keydown', this.modifier);
    this.port.events.addEventListener('keyup', this.modifier);
    this.port.events.addEventListener('blur', this.interrupt);
    this.port.events.addEventListener('pagehide', this.interrupt);
    this.listening = true;
  }
  /** Called only after an accepted common-stack step, while its old owner was active. */
  restore(target: DecorLineSession | undefined, activeToken: number | undefined): void {
    if (!target || target.token !== activeToken || !this.sync()) return;
    this.begin(target.anchor, target.token); this.raw = [...target.anchor]; this.paint();
  }
  pointerDown(event: PointerEvent): void {
    this.ready = null;
    this.port.cancelQueue();
    if (!this.sync() || this.port.blocked() || event.button !== 0) return;
    this.contacts.add(event.pointerId);
    this.press = this.contacts.size === 1
      ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null;
    if (this.contacts.size > 1) this.port.preview(null);
    this.owner = this.port.context();
  }
  pointerMove(event: PointerEvent): void {
    if (!this.sync()) return;
    if (this.press && Math.abs(event.clientX - this.press.x) + Math.abs(event.clientY - this.press.y) > 4) {
      this.press = null; this.port.preview(null);
    }
    if (!this.session || this.contacts.size || this.port.blocked()) return;
    this.raw = this.port.point(event); this.pointerType = event.pointerType || 'mouse'; this.shift = event.shiftKey;
    this.port.queue(() => this.paint());
  }
  pointerUp(event: PointerEvent): void {
    const clean = this.press?.id === event.pointerId && this.contacts.size === 1
      && Math.abs(event.clientX - this.press.x) + Math.abs(event.clientY - this.press.y) <= 4;
    this.contacts.delete(event.pointerId); this.press = null;
    this.ready = clean ? { x: event.clientX, y: event.clientY, type: event.pointerType || 'mouse' } : null;
  }
  cancel(event: PointerEvent): void {
    this.contacts.delete(event.pointerId); this.press = null; this.ready = null;
    this.port.cancelQueue(); this.port.preview(null);
  }
  click(event: MouseEvent, suppressed: boolean): void {
    const ready = this.ready; this.ready = null;
    if (!ready || suppressed || !this.sync() || this.port.blocked()
        || Math.abs(event.clientX - ready.x) + Math.abs(event.clientY - ready.y) > 4) return;
    this.raw = this.port.point(event); this.pointerType = ready.type;
    this.shift = event.shiftKey;
    if (!this.session) {
      this.begin(this.port.snap(this.raw, this.pointerType)); this.paint(); return;
    }
    const before = this.snapshot!, end = this.end();
    if (!end.every(Number.isFinite)
        || Math.hypot(end[0] - before.anchor[0], end[1] - before.anchor[1]) < this.port.pitch() * .5) return;
    const after = { token: before.token, anchor: [...end] };
    this.session = after;
    this.port.commit(before.anchor, end, before, after);
    this.raw = [...end]; this.paint();
  }
  private end(): number[] {
    return decorLineEnd(this.session!.anchor, this.raw!, this.port.pitch(), this.shift,
      this.port.snap(this.raw!, this.pointerType));
  }
  private paint(): void {
    if (!this.sync() || !this.session || !this.raw || this.port.blocked()) return;
    this.port.preview(this.session.anchor, this.end());
  }
}
