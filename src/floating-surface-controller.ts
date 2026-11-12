import { html, nothing, render as litRender, type TemplateResult } from 'lit';
import { popoverSupported } from './floating-surface';
import type { HpDialog } from './hp-dialog';

/** Shared portal/fallback lifecycle for small dialog-owned floating surfaces. */
export class FloatingSurfaceController {
  private host: HTMLElement | null = null;
  private root: ShadowRoot | null = null;
  private anchorBounds: DOMRectReadOnly | null = null;
  private followCleanup?: () => void;

  constructor(
    private readonly owner: HTMLElement,
    private readonly name: string,
    private readonly keydown?: (event: KeyboardEvent) => void,
  ) {}

  public window(): Window | null {
    return this.owner.ownerDocument.defaultView;
  }

  public dialog(): HpDialog | null {
    return this.owner.closest('hp-dialog') as HpDialog | null;
  }

  public usesPopover(forceFallback = false): boolean {
    const win = this.window();
    return !forceFallback && !!win && popoverSupported(win);
  }

  public get hasFallback(): boolean {
    return !!this.host;
  }

  public recordAnchor(bounds: DOMRectReadOnly): void { this.anchorBounds = bounds; }

  /** A queued scroll may describe the position already used for placement. */
  public anchorMoved(bounds: DOMRectReadOnly): boolean {
    const prior = this.anchorBounds;
    return !prior || bounds.left !== prior.left || bounds.top !== prior.top
      || bounds.right !== prior.right || bounds.bottom !== prior.bottom;
  }

  /** Follow composed scrolling ancestors once per frame, never poll an idle menu. */
  public followAnchor(reposition: () => void, hidden: () => void,
    anchor: () => DOMRectReadOnly | undefined = () => this.owner.getBoundingClientRect()): void {
    this.stopFollowing();
    const win = this.window();
    if (!win) return;
    const events = new AbortController(), roots = new Set<EventTarget>([win, this.owner.ownerDocument]);
    const clips: { element: HTMLElement; x: boolean; y: boolean }[] = [];
    const seen = new Set<Node>();
    let node: Node | null = this.owner;
    while (node && !seen.has(node)) {
      seen.add(node); roots.add(node.getRootNode());
      if (node instanceof HTMLElement && node !== this.owner) {
        const style = win.getComputedStyle(node);
        const x = /^(auto|scroll|hidden|clip)$/.test(style.overflowX);
        const y = /^(auto|scroll|hidden|clip)$/.test(style.overflowY);
        if (style.display !== 'contents' && (x || y)) clips.push({ element: node, x, y });
      }
      node = node instanceof Element && node.assignedSlot ? node.assignedSlot
        : node instanceof ShadowRoot ? node.host : node.parentNode;
    }
    let frame = 0;
    const scroll = (event: Event) => {
      if (this.containsPath(event.composedPath()) || frame) return;
      frame = win.requestAnimationFrame(() => {
        frame = 0;
        const bounds = anchor();
        if (!this.owner.isConnected || !bounds) { hidden(); return; }
        if (!this.anchorMoved(bounds)) return;
        const outside = bounds.bottom <= 0 || bounds.top >= win.innerHeight
          || bounds.right <= 0 || bounds.left >= win.innerWidth
          || clips.some(({ element, x, y }) => {
            const clip = element.getBoundingClientRect();
            return x && (bounds.right <= clip.left || bounds.left >= clip.right)
              || y && (bounds.bottom <= clip.top || bounds.top >= clip.bottom);
          });
        if (outside) hidden(); else reposition();
      });
    };
    for (const root of roots) root.addEventListener('scroll', scroll, { capture: true, passive: true, signal: events.signal });
    this.followCleanup = () => { events.abort(); if (frame) win.cancelAnimationFrame(frame); };
  }

  public stopFollowing(): void {
    this.followCleanup?.(); this.followCleanup = undefined;
  }

  public containsPath(path: EventTarget[]): boolean {
    return path.includes(this.owner) || (!!this.host && path.includes(this.host));
  }

  public ownsActiveElement(): boolean {
    let active = this.owner.ownerDocument.activeElement as HTMLElement | null;
    while (active?.shadowRoot?.activeElement) {
      active = active.shadowRoot.activeElement as HTMLElement;
    }
    return !!active && (
      active === this.owner
      || !!this.owner.shadowRoot?.contains(active)
      || !!this.root?.contains(active)
    );
  }

  public renderFallback(template: TemplateResult, styleText: string): ShadowRoot | null {
    const root = this.ensureFallback();
    if (!root) return null;
    litRender(html`<style>${styleText}</style>${template}`, root);
    return root;
  }

  public surface(selector: string, usePopover: boolean): HTMLElement | null {
    return usePopover
      ? this.owner.shadowRoot?.querySelector<HTMLElement>(selector) || null
      : this.root?.querySelector<HTMLElement>(selector) || null;
  }

  public destroy(): void {
    this.stopFollowing();
    this.anchorBounds = null;
    if (this.root) litRender(nothing, this.root);
    this.host?.remove();
    this.host = null;
    this.root = null;
  }

  private ensureFallback(): ShadowRoot | null {
    if (this.root?.isConnected) return this.root;
    const parent = this.dialog()?.overlayPortal() || this.owner.ownerDocument.body;
    if (!parent) return null;
    const host = this.owner.ownerDocument.createElement('div');
    host.dataset.hpOverlay = this.name;
    host.style.display = 'contents';
    if (this.keydown) host.addEventListener('keydown', this.keydown, true);
    parent.append(host);
    this.host = host;
    this.root = host.attachShadow({ mode: 'open' });
    return this.root;
  }
}
