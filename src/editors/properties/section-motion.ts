/** Intrinsic section heights belong to this mounted panel, never the selection model. */
export class PropertiesSectionMotion {
  private root: HTMLElement | null = null;
  private observer: ResizeObserver | null = null;
  private sections = new Map<HTMLElement, { height: number; animation: Animation | null }>();
  private frame: number | null = null;
  private reduced: MediaQueryList | null = null;
  private readonly motionChanged = (): void => {
    if (this.reduced?.matches) for (const state of this.sections.values()) {
      state.animation?.cancel(); state.animation = null;
    }
  };
  private readonly queue = (): void => {
    const win = this.root?.ownerDocument.defaultView;
    if (!win || this.frame !== null) return;
    this.frame = win.requestAnimationFrame(() => { this.frame = null; this.measure(); });
  };
  update(root: HTMLElement | null): void {
    if (root !== this.root) { this.dispose(); this.root = root; }
    if (!root) return;
    if (!this.reduced) {
      this.reduced = root.ownerDocument.defaultView!.matchMedia('(prefers-reduced-motion: reduce)');
      this.reduced.addEventListener('change',this.motionChanged);
    }
    this.observer ??= new ResizeObserver(this.queue);
    const sections = new Set(root.querySelectorAll<HTMLElement>('.hp-prop-group'));
    this.observer.disconnect();
    for (const section of sections) for (const child of section.children) this.observer.observe(child);
    for (const [section, state] of this.sections) if (!sections.has(section)) {
      state.animation?.cancel(); this.sections.delete(section);
    }
    this.queue();
  }
  private measure(): void {
    const root = this.root, win = root?.ownerDocument.defaultView;
    if (!root || !root.isConnected || !win) return;
    const reduced = this.reduced?.matches;
    const px = (value: string): number => parseFloat(value) || 0;
    for (const section of root.querySelectorAll<HTMLElement>('.hp-prop-group')) {
      if (!section.getClientRects().length) { this.sections.get(section)?.animation?.cancel(); this.sections.delete(section); continue; }
      const style = win.getComputedStyle(section);
      let height = px(style.paddingTop) + px(style.paddingBottom) + px(style.borderTopWidth) + px(style.borderBottomWidth), count = 0;
      for (const child of section.children) {
        const childStyle = win.getComputedStyle(child);
        if (childStyle.display === 'none') continue;
        height += child.getBoundingClientRect().height + px(childStyle.marginTop) + px(childStyle.marginBottom); count++;
      }
      height += Math.max(0, count - 1) * px(style.rowGap);
      const previous = this.sections.get(section);
      if (previous && Math.abs(previous.height - height) < .5) continue;
      const from = previous?.animation?.playState === 'running' ? section.getBoundingClientRect().height : previous?.height;
      previous?.animation?.cancel();
      const state = { height, animation: null as Animation | null }; this.sections.set(section, state);
      if (from === undefined || reduced) continue;
      state.animation = section.animate([{ height: `${from}px`, overflow: 'clip' }, { height: `${height}px`, overflow: 'clip' }], { duration: 240, easing: 'ease-in-out' });
      state.animation.onfinish = () => { state.animation = null; };
    }
  }
  dispose(): void {
    if (this.frame !== null) this.root?.ownerDocument.defaultView?.cancelAnimationFrame(this.frame);
    this.frame = null; this.observer?.disconnect(); this.observer = null;
    this.reduced?.removeEventListener('change',this.motionChanged); this.reduced = null;
    for (const state of this.sections.values()) state.animation?.cancel();
    this.sections.clear(); this.root = null;
  }
}
