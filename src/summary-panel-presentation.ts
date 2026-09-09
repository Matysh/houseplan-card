export type SummaryPanelPhase = 'hidden' | 'entering' | 'visible' | 'exiting';
type Side = 'right' | 'bottom';

/** Transient presentation only: never writes the user's visibility intent. */
export class SummaryPanelPresentation {
  public phase: SummaryPanelPhase = 'hidden';
  private wanted = false;
  private side: Side | null = null;
  private pending = false;
  private element: HTMLElement | null = null;
  private animation: Animation | null = null;
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private media: MediaQueryList | null = null;
  private generation = 0;

  public constructor(private readonly repaint: () => void) {}

  public get mounted(): boolean { return this.phase !== 'hidden'; }
  public get interactive(): boolean { return this.wanted && this.mounted; }

  /** Called before rendering. Hard boundaries never retain an outgoing frame. */
  public sync(wanted: boolean, side: Side, immediate = false): void {
    const moved = this.side !== null && this.side !== side;
    this.side = side;
    if (immediate || moved) {
      this.settle(wanted);
      return;
    }
    if (wanted === this.wanted) return;
    this.wanted = wanted;
    this.phase = wanted ? 'entering' : this.mounted ? 'exiting' : 'hidden';
    this.pending = this.mounted;
  }

  /** Runs in Lit updated(), before paint; the same node survives reversals. */
  public updated(element: HTMLElement | null): void {
    if (!this.pending) {
      this.element = this.mounted ? element : null;
      return;
    }
    if (!element) return;
    this.pending = false;
    const view = element.ownerDocument.defaultView;
    const media = view?.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!view || media?.matches || typeof element.animate !== 'function') {
      this.element = element;
      this.settle(this.wanted);
      this.repaint();
      return;
    }
    // Snapshot a running animation BEFORE cancellation. An ordinary rerender
    // does not touch this path and cannot restart motion or reset scroll.
    const oldStyle = this.element === element ? view.getComputedStyle(element) : null;
    const offset = this.side === 'bottom' ? '0px 18px' : '18px 0px';
    const from = { opacity: oldStyle?.opacity || '0', translate: oldStyle?.translate || offset };
    this.cancel();
    this.element = element;
    const token = this.generation;
    this.media = media || null;
    this.media?.addEventListener('change', this.motionChanged);
    const animation = element.animate([
      from,
      { opacity: this.wanted ? '1' : '0', translate: this.wanted ? '0px 0px' : offset },
    ], { duration: 190, easing: 'ease', fill: 'both' });
    this.animation = animation;
    const finish = () => {
      if (token !== this.generation || animation !== this.animation) return;
      this.settle(this.wanted);
      this.repaint();
    };
    void animation.finished.then(finish, () => undefined);
    // Cancellation/background throttling must not strand an inert ghost.
    this.timeout = setTimeout(finish, 250);
  }

  public reset(): void {
    this.settle(false);
    this.side = null;
  }

  private motionChanged = (): void => {
    if (!this.media?.matches) return;
    this.settle(this.wanted);
    this.repaint();
  };

  private settle(wanted: boolean): void {
    this.cancel();
    this.wanted = wanted;
    this.pending = false;
    this.phase = wanted ? 'visible' : 'hidden';
    if (!wanted) this.element = null;
  }

  private cancel(): void {
    this.generation++;
    this.animation?.cancel();
    this.animation = null;
    if (this.timeout !== null) clearTimeout(this.timeout);
    this.timeout = null;
    this.media?.removeEventListener('change', this.motionChanged);
    this.media = null;
  }
}
