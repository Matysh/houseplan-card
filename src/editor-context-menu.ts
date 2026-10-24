import { html, nothing, type TemplateResult } from 'lit';
import { ref } from 'lit/directives/ref.js';
import { floatingViewport, placeFloatingSurface, type FloatingViewport, type RectLike } from './floating-surface';

export interface EditorMenuItem {
  key: string; label: string | TemplateResult; disabled?: boolean;
  hp?: 'action' | 'device-copy'; action?: string; value?: string; title?: string;
  invoke(): void;
}
export interface EditorMenuModel {
  /** A new opening always gets a new owner token, even for the same object. */
  token: object; hp: 'device-context-menu' | 'decor-context-menu' | 'catalog-context-menu' | 'node-context-menu'; items: EditorMenuItem[];
  anchor: RectLike | (() => RectLike); gap?: number; minWidth?: number; viewport?: () => FloatingViewport;
  localTo?: HTMLElement;
  returnFocus?: Element | null;
  current(): boolean;
  close(focus: boolean): void;
  outside?(event: PointerEvent): void;
}

/** Shared presentation only. Commands, revisions and write authority stay with
 * the caller. Retiring a menu revokes all callbacks before the exit can paint. */
export class EditorContextMenu {
  private model: EditorMenuModel | null = null;
  private element: HTMLElement | null = null;
  private view: TemplateResult | typeof nothing = nothing;
  private active = false;
  private invoked = false;
  private animation: Animation | null = null;
  private exiting = false;
  private listening = false;
  constructor(private readonly changed: () => void) {}

  retire(): void {
    this.active = false;
    if (this.element) { this.element.inert = true; this.element.setAttribute('aria-hidden', 'true'); }
    this.unlisten();
  }
  private close(focus: boolean): void {
    const model = this.model;
    if (!this.active || !model) return;
    this.retire();
    model.close(focus);
    if (focus && model.returnFocus?.isConnected && 'focus' in model.returnFocus) {
      (model.returnFocus as HTMLElement).focus({ preventScroll: true });
    }
  }
  private readonly outside = (event: PointerEvent): void => {
    const path = event.composedPath();
    if (this.element && path.includes(this.element) || this.model?.localTo && path.includes(this.model.localTo)) return;
    const model = this.model;
    this.close(false); model?.outside?.(event);
  };
  private readonly focus = (event: FocusEvent): void => {
    const path = event.composedPath();
    if (this.element && !path.includes(this.element) && (!this.model?.localTo || !path.includes(this.model.localTo))) this.close(false);
  };
  private readonly key = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); this.close(true); }
    else if (event.key === 'Tab') this.close(false);
    else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) && this.element) {
      const items = [...this.element.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
      if (!items.length) return;
      event.preventDefault();
      const index = items.indexOf(this.element.getRootNode() instanceof ShadowRoot
        ? (this.element.getRootNode() as ShadowRoot).activeElement as HTMLButtonElement : document.activeElement as HTMLButtonElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
        : (index + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
      items[next].focus();
    }
  };
  private readonly reposition = (): void => {
    if (!this.active || !this.model || !this.element) return;
    if (!this.model.current()) { this.close(false); return; }
    this.place();
  };
  private unlisten(): void {
    if (!this.listening) return;
    window.removeEventListener('pointerdown', this.outside, true);
    window.removeEventListener('keydown', this.key, true);
    window.removeEventListener('focusin', this.focus, true);
    window.removeEventListener('scroll', this.reposition, true);
    window.removeEventListener('resize', this.reposition);
    window.visualViewport?.removeEventListener('resize', this.reposition);
    window.visualViewport?.removeEventListener('scroll', this.reposition);
    this.listening = false;
  }
  private mount(element: Element | undefined, token: object): void {
    if (!(element instanceof HTMLElement) || this.model?.token !== token || !this.active) return;
    const fresh = this.element !== element;
    this.element = element;
    element.inert = false; element.removeAttribute('aria-hidden');
    this.place();
    if (!this.listening) {
      window.addEventListener('pointerdown', this.outside, true);
      window.addEventListener('keydown', this.key, true);
      window.addEventListener('focusin', this.focus, true);
      window.addEventListener('scroll', this.reposition, true);
      window.addEventListener('resize', this.reposition);
      window.visualViewport?.addEventListener('resize', this.reposition);
      window.visualViewport?.addEventListener('scroll', this.reposition);
      this.listening = true;
    }
    if (fresh) {
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.animation = element.animate([{ opacity: 0, transform: 'translateY(-10px)' }, { opacity: 1, transform: 'translateY(0)' }],
          { duration: 180, easing: 'ease-out' });
      }
      queueMicrotask(() => {
        if (this.active && this.model?.token === token && element.isConnected) {
          this.place(); element.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
        }
      });
    }
  }
  private place(): void {
    const model = this.model, element = this.element;
    if (!model || !element) return;
    const viewport = model.viewport?.() ?? floatingViewport(window);
    element.style.maxWidth = `${Math.max(0, viewport.width - 16)}px`;
    element.style.minWidth = `${Math.min(model.minWidth ?? 0, Math.max(0, viewport.width - 16))}px`;
    element.style.maxHeight = `${Math.max(0, viewport.height - 16)}px`;
    const place = placeFloatingSurface(typeof model.anchor === 'function' ? model.anchor() : model.anchor,
      element.getBoundingClientRect(), viewport, model.gap ?? 0);
    const local = model.localTo, box = local?.getBoundingClientRect();
    const sx = local && box ? box.width / local.offsetWidth || 1 : 1;
    const sy = local && box ? box.height / local.offsetHeight || 1 : 1;
    element.style.position = local ? 'absolute' : 'fixed';
    element.style.left = `${(place.left - (box?.left ?? 0)) / sx}px`;
    element.style.top = `${(place.top - (box?.top ?? 0)) / sy}px`;
  }
  render(model: EditorMenuModel | null): TemplateResult | typeof nothing {
    if (!model) {
      this.retire();
      if (this.view === nothing || this.exiting) return this.view;
      const element = this.element;
      if (!element?.isConnected || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.dispose(); return nothing;
      }
      const opacity = getComputedStyle(element).opacity;
      this.exiting = true; this.animation?.cancel();
      const animation = element.animate([{ opacity }, { opacity: 0 }], { duration: 140, easing: 'ease-out', fill: 'both' });
      this.animation = animation;
      void animation.finished.then(() => {
        if (this.animation !== animation) return;
        this.dispose(); this.changed();
      }).catch(() => undefined);
      return this.view;
    }
    if (this.model?.token !== model.token) {
      this.retire(); this.animation?.cancel(); this.animation = null;
      this.element = null; this.exiting = false; this.active = true; this.invoked = false;
    }
    this.model = model;
    const token = model.token;
    this.view = html`<div class="hpf-context-menu" data-hp=${model.hp === 'device-context-menu' ? 'device-context-menu' : model.hp === 'decor-context-menu' ? 'decor-context-menu' : model.hp === 'node-context-menu' ? 'node-context-menu' : 'catalog-context-menu'} role="menu"
      ${ref(element => this.mount(element, token))}
      @pointerdown=${(event: Event) => event.stopPropagation()} @click=${(event: Event) => event.stopPropagation()}
      @contextmenu=${(event: Event) => event.preventDefault()}>
      ${model.items.map(item => html`<button type="button" role="menuitem" data-hp=${item.hp === 'device-copy' ? 'device-copy' : 'action'} data-action=${item.action ?? nothing}
        data-value=${item.value ?? nothing} title=${item.title ?? nothing} ?disabled=${!!item.disabled}
        @click=${() => {
          if (!this.active || this.invoked || this.model?.token !== token || item.disabled) return;
          if (!this.model.current()) { this.close(false); return; }
          this.invoked = true;
          item.invoke();
          this.close(false);
        }}>${item.label}</button>`)}
    </div>`;
    return this.view;
  }
  dispose(): void {
    this.retire(); this.animation?.cancel(); this.animation = null;
    this.model = null; this.element = null; this.view = nothing; this.exiting = false;
  }
}

export function menuPoint(x: number, y: number): RectLike {
  return { left: x, right: x, top: y, bottom: y, width: 0, height: 0 };
}
