import { html, nothing, render as litRender, type TemplateResult } from 'lit';
import { popoverSupported } from './floating-surface';
import type { HpDialog } from './hp-dialog';

/** Shared portal/fallback lifecycle for small dialog-owned floating surfaces. */
export class FloatingSurfaceController {
  private host: HTMLElement | null = null;
  private root: ShadowRoot | null = null;

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
