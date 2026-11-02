import { html, type TemplateResult } from 'lit';

export const KIOSK_NAV_IDLE_MS = 5000;
interface NavigationClock {
  setTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout>;
  clearTimeout(timer: ReturnType<typeof setTimeout>): void;
}
const defaultClock: NavigationClock = {
  setTimeout: (callback, delay) => setTimeout(callback, delay),
  clearTimeout: timer => clearTimeout(timer),
};

/** Activity belongs to the field, not to floor changes or HA state updates. */
export class KioskSpaceNavigation {
  public visible = false;
  private enabled = false;
  private pointers = new Set<number>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;

  public constructor(private readonly repaint: () => void, private readonly clock: NavigationClock = defaultClock) {}

  public sync(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.reset(false);
  }

  public ownsPointer(id: number): boolean { return this.pointers.has(id); }

  public interact(event: { type: string; button?: number; pointerId?: number }): void {
    if (!this.enabled) return;
    if (event.type === 'pointerdown') {
      if (event.button !== 0 || event.pointerId === undefined) return;
      this.pointers.add(event.pointerId);
    } else if (event.type === 'pointermove') {
      if (event.pointerId === undefined || !this.pointers.has(event.pointerId)) return;
    } else if (event.type !== 'click' && !this.visible) return;
    this.cancelTimer();
    if (!this.visible) { this.visible = true; this.repaint(); }
    this.arm();
  }

  /** Window capture also releases a pointer ending outside the card. */
  public release(pointerId: number): void {
    if (this.pointers.delete(pointerId) && !this.pointers.size && this.visible) this.arm();
  }

  public reset(notify = true): void {
    this.cancelTimer(); this.pointers.clear();
    const visible = this.visible; this.visible = false;
    if (notify && visible) this.repaint();
  }

  private cancelTimer(): void {
    this.generation++;
    if (this.timer !== null) this.clock.clearTimeout(this.timer);
    this.timer = null;
  }

  private arm(): void {
    if (this.pointers.size) return;
    this.cancelTimer();
    const generation = this.generation;
    this.timer = this.clock.setTimeout(() => {
      if (generation !== this.generation) return;
      this.timer = null; this.visible = false; this.repaint();
    }, KIOSK_NAV_IDLE_MS);
  }
}

const stopFieldGesture = (event: Event): void => event.stopPropagation();
/** The owner places this outside the transformed plan; no camera geometry. */
export function renderKioskSpaceNavigation(options: {
  spaces: readonly { id: string; title: string }[]; current: string;
  visible: boolean; label: string; select(id: string): void;
}): TemplateResult {
  return html`<nav class="hp-kiosk-spaces hpf-navigation hpf-nav-compact hpf-nav-floating hpf-nav-vertical hpf-nav-flush-left hpf-fade ${options.visible ? 'is-visible' : ''}"
    data-hp="kiosk-spaces" aria-label=${options.label} aria-hidden=${String(!options.visible)} .inert=${!options.visible}
    @pointerdown=${stopFieldGesture} @pointermove=${stopFieldGesture} @pointerup=${stopFieldGesture}
    @pointercancel=${stopFieldGesture} @click=${stopFieldGesture} @wheel=${stopFieldGesture} @keydown=${stopFieldGesture}>
    ${options.spaces.map((space, index) => html`<button type="button" class="hpf-nav-item ${space.id === options.current ? 'active' : ''}"
      data-space=${space.id} aria-label=${space.title} aria-current=${space.id === options.current ? 'page' : 'false'}
      data-hp-tooltip=${space.title} @click=${() => options.select(space.id)}>${index + 1}</button>`)}
  </nav>`;
}
