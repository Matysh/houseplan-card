/** Styles belong to a single mode presentation, never to Lit's idle state. */
interface OwnedStyle {
  text: string | null;
  values: Map<string, { value: string; priority: string }>;
  owned: Set<string>;
  last: Map<string, { value: string; priority: string; input: string }>;
}
export class ModePresentation {
  private readonly styles = new Map<HTMLElement | SVGElement, OwnedStyle>();
  private readonly inert = new Map<HTMLElement, boolean>();
  private readonly opacityAnimations = new Map<HTMLElement | SVGElement, Animation>();
  private opacityPool = new WeakMap<HTMLElement | SVGElement, Animation>();

  /** A paused compositor effect has no independent clock: the controller
   * samples its exact opacity in its own RAF. CSS important keeps its native
   * cascade path. Terminal/cancel uses direct styles and cancels our effect. */
  public opacity(element: HTMLElement | SVGElement | null, value: string, compositor = false, priority = '', underlying?: string): void {
    if (!element) return;
    const previous = this.styles.get(element)?.last.get('opacity');
    let animation = this.opacityAnimations.get(element);
    if (!compositor || priority || typeof element.animate !== 'function'
        || (!animation && (!previous || Number(previous.input) === Number(value)))) {
      this.set(element, 'opacity', value, priority); return;
    }
    if (!animation) {
      animation = this.opacityPool.get(element);
      if (!animation) {
        animation = element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1, fill: 'both' });
        this.opacityPool.set(element, animation);
      }
      animation.pause();
      // The paused effect masks the ordinary base. Prepare it once while
      // entering, so cancelling at to need not rewrite every marker style.
      if (underlying !== undefined) this.set(element, 'opacity', underlying, priority);
      this.opacityAnimations.set(element, animation);
    }
    animation.currentTime = Math.max(0, Math.min(1, Number(value)));
  }

  public dispose(): void { this.clear(); this.opacityPool = new WeakMap(); }

  public stopOpacity(element: HTMLElement | SVGElement): void {
    this.opacityAnimations.get(element)?.cancel();
    this.opacityAnimations.delete(element);
  }

  public set(element: HTMLElement | SVGElement | null, name: string, value: string, priority = ''): void {
    if (!element) return;
    if (name === 'opacity') this.stopOpacity(element);
    let record = this.styles.get(element);
    if (!record) {
      record = { text: element.getAttribute('style'), values: new Map(), owned: new Set(), last: new Map() };
      for (let index = 0; index < element.style.length; index++) {
        const key = element.style.item(index);
        record.values.set(key, { value: element.style.getPropertyValue(key), priority: element.style.getPropertyPriority(key) });
      }
      this.styles.set(element, record);
    }
    record.owned.add(name);
    const previous = record.last.get(name);
    // CSSOM rounds serialized numbers. 1279.9999999998px can serialize as
    // 1280px while LayoutUnit is still one subpixel short of the endpoint.
    if (previous?.input === value && previous.priority === priority
        && element.style.getPropertyValue(name) === previous.value
        && element.style.getPropertyPriority(name) === previous.priority) return;
    element.style.setProperty(name, value, priority);
    record.last.set(name, { value: element.style.getPropertyValue(name), priority: element.style.getPropertyPriority(name), input: value });
  }

  /** Lit may have published new data while this presentation was retained.
   * Capture its authored declarations before reapplying the transient frame. */
  public adoptRenderedStyles(): void {
    for (const [element, record] of this.styles) {
      if (![...record.owned].some(name => element.style.getPropertyValue(name) !== record.last.get(name)?.value
          || element.style.getPropertyPriority(name) !== record.last.get(name)?.priority)) continue;
      record.text = element.getAttribute('style');
      record.values.clear();
      for (let index = 0; index < element.style.length; index++) {
        const name = element.style.item(index);
        record.values.set(name, { value: element.style.getPropertyValue(name), priority: element.style.getPropertyPriority(name) });
      }
      record.owned.clear(); record.last.clear();
    }
  }

  /** Temporarily reveal the current authored CSS before a fresh data read. */
  public restoreProperty(element: HTMLElement | SVGElement, name: string): void {
    const record = this.styles.get(element);
    if (!record?.owned.has(name)) return;
    const original = record.values.get(name);
    if (original) element.style.setProperty(name, original.value, original.priority);
    else element.style.removeProperty(name);
  }

  public setInert(element: HTMLElement | null, value: boolean): void {
    if (!element) return;
    if (!this.inert.has(element)) this.inert.set(element, element.inert);
    if (element.inert !== value) element.inert = value;
  }

  /** Retarget/cancel/disconnect all release exactly the same properties. */
  public clear(): void {
    for (const animation of this.opacityAnimations.values()) animation.cancel();
    this.opacityAnimations.clear();
    for (const [element, record] of this.styles) {
      const current = new Map<string, { value: string; priority: string }>();
      for (let index = 0; index < element.style.length; index++) {
        const key = element.style.item(index);
        if (!record.owned.has(key)) current.set(key, {
          value: element.style.getPropertyValue(key), priority: element.style.getPropertyPriority(key),
        });
      }
      const original = [...record.values].filter(([key]) => !record.owned.has(key));
      const untouched = current.size === original.length && original.every(([key, value]) =>
        current.get(key)?.value === value.value && current.get(key)?.priority === value.priority);
      if (untouched) {
        // Preserve declaration order, spelling, and absence of a style attribute.
        if (record.text === null) element.removeAttribute('style');
        else element.setAttribute('style', record.text);
      } else {
        // A real data update may have changed an unrelated style in the meantime.
        for (const key of record.owned) {
          const prior = record.values.get(key);
          if (prior) element.style.setProperty(key, prior.value, prior.priority);
          else element.style.removeProperty(key);
        }
        if (record.text === null && !element.style.length) element.removeAttribute('style');
      }
    }
    for (const [element, prior] of this.inert) if (element.inert !== prior) element.inert = prior;
    this.styles.clear();
    this.inert.clear();
  }
}
