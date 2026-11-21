/** Retain one complete geometry layer while the next light field is painted. */
export class IsoLightTransition<T> {
  private field?: { scope: string; signature: string; value: T };
  private snapshot: SVGSVGElement | null = null;
  private effects: Animation[] = [];
  private pending = false;
  private frame = 0;
  private revision = 0;

  public constructor(private readonly onPending: () => void, private readonly onRetire: () => void) {}

  public choose(scope: string, signature: string, value: T, scene: SVGSVGElement | null, animate: boolean): T {
    const previous = this.field;
    if (!previous || previous.scope !== scope || !animate || !scene) {
      this.clear();
      this.field = { scope, signature, value };
      return value;
    }
    if (previous.signature === signature) {
      this.pending = false;
      return this.snapshot ? previous.value : value;
    }
    if (this.snapshot) {
      this.pending = true;
      return previous.value;
    }
    this.field = { scope, signature, value };
    const clone = scene.cloneNode(true) as SVGSVGElement;
    const prefix = `hp-iso-retained-${++this.revision}-`;
    const ids = new Map([...clone.querySelectorAll('[id]')].map(el => [el.id, prefix + el.id]));
    for (const el of [clone, ...clone.querySelectorAll('*')]) {
      if (ids.has(el.id)) el.id = ids.get(el.id)!;
      for (const attr of [...el.attributes]) {
        const value = attr.value.replace(/url\((['"]?)#([^'")]+)\1\)/g, (match, quote, id) =>
          ids.has(id) ? `url(${quote}#${ids.get(id)}${quote})` : match);
        if (value !== attr.value) el.setAttribute(attr.name, value);
        if (attr.localName === 'href' && attr.value.startsWith('#') && ids.has(attr.value.slice(1))) {
          el.setAttributeNS(attr.namespaceURI, attr.name, '#' + ids.get(attr.value.slice(1)));
        }
        if (attr.name.startsWith('data-hp-live-') && el !== clone) el.removeAttribute(attr.name);
      }
    }
    clone.setAttribute('inert', '');
    clone.setAttribute('aria-hidden', 'true');
    clone.setAttribute('data-hp-retained-light', '');
    clone.removeAttribute('data-hp');
    clone.style.opacity = '1';
    this.snapshot = clone;
    scene.after(clone);
    // A cloned CSS animation starts at zero when attached. Sunlight belongs
    // to the solar timeline, not this lamp crossfade: retain both settled
    // light and an in-flight threshold fade at the live layer's exact phase.
    const liveSun = [...scene.querySelectorAll('.sunlayer')];
    [...clone.querySelectorAll('.sunlayer')].forEach((sun, index) => {
      const originals = liveSun[index].getAnimations();
      sun.getAnimations().forEach((animation, i) => {
        const original = originals[i];
        if (!original) return;
        animation.playbackRate = original.playbackRate;
        if (original.playState === 'paused') {
          animation.pause();
          animation.currentTime = original.currentTime;
        } else if (original.startTime !== null) animation.startTime = original.startTime;
      });
    });
    return value;
  }

  public present(scene: SVGSVGElement | null): void {
    const old = this.snapshot;
    if (!old || !scene || this.frame || this.effects.length) return;
    const win = scene.ownerDocument.defaultView;
    if (!win) { this.clear(); return; }
    const parent = scene.parentElement;
    if (!parent || old.parentElement !== parent) { this.clear(); return; }
    parent.setAttribute('data-hp-light-mixing', '');
    scene.style.opacity = '0';
    // Both animations start together after the new SVG has had a paint.
    this.frame = win.requestAnimationFrame(() => {
      this.frame = win.requestAnimationFrame(() => {
        this.frame = 0;
        if (old !== this.snapshot) return;
        const timing: KeyframeAnimationOptions = { duration: 500, easing: 'linear', fill: 'both' };
        const retiring = old.animate([{ opacity: 1 }, { opacity: 0 }], timing);
        const incoming = scene.animate([{ opacity: 0 }, { opacity: 1 }], timing);
        this.effects = [retiring, incoming];
        void incoming.finished.then(() => {
          if (old !== this.snapshot) return;
          const pending = this.pending;
          this.release();
          if (pending) this.onPending();
        }, () => {});
      });
    });
  }

  private release(): void {
    const old = this.snapshot;
    const parent = old?.parentElement;
    const win = old?.ownerDocument.defaultView;
    if (this.frame) win?.cancelAnimationFrame(this.frame);
    this.frame = 0;
    const current = parent?.querySelector<SVGSVGElement>('svg:not([data-hp-retained-light])');
    current?.style.removeProperty('opacity');
    parent?.removeAttribute('data-hp-light-mixing');
    for (const effect of this.effects) effect.cancel();
    this.effects = [];
    old?.remove();
    this.snapshot = null;
    this.pending = false;
    if (old) this.onRetire();
  }

  public clear(): void {
    this.release();
    this.field = undefined;
  }
}
