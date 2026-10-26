import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { FloatingSurfaceController } from './floating-surface-controller';
import { floatingViewport, placeFloatingSurface } from './floating-surface';

let sequence = 0;

/** Enhances an existing select without changing its value/change contract.
 * The native control remains the single source of options and saved values.
 * Loaded only by settings; first-run onboarding keeps its native control. */
export class HpSettingsSelect extends LitElement {
  static properties = {
    _version: { state: true }, _open: { state: true }, _active: { state: true },
    pointerHover: { type: Boolean, attribute: 'data-pointer-hover', reflect: true },
  };
  static styles = css`
    :host { display:block; min-width:0; font:inherit; }
    ::slotted(select) { position:absolute!important; width:1px!important; height:1px!important;
      min-width:0!important; min-height:0!important; padding:0!important; margin:0!important;
      border:0!important; overflow:hidden!important; contain:strict;
      clip-path:inset(50%); opacity:0; pointer-events:none; }
    button { box-sizing:border-box; width:100%; min-height:44px; padding:10px 14px;
      display:flex; align-items:center; gap:14px; text-align:start; border:1px solid var(--hpf-line,var(--divider-color,#7776));
      border-radius:8px; background:var(--hpf-control-surface,var(--hpf-canvas,var(--secondary-background-color,color-mix(in srgb,var(--card-background-color,#202126) 90%,var(--primary-text-color,#e6e7eb)))));
      color:var(--primary-text-color,#e6e7eb); font:inherit; cursor:pointer;
      transition:background 160ms,border-color 160ms; }
    button span { flex:1; min-width:0; overflow-wrap:anywhere; }
    button svg { width:18px; height:18px; flex:none; fill:currentColor; transition:transform 160ms; }
    button[aria-expanded=true] svg { transform:rotate(180deg); }
    :host([data-pointer-hover]) button:hover { border-color:var(--hpf-accent,var(--primary-color,#03a9f4)); background:var(--hpf-tint,color-mix(in srgb,var(--primary-color,#03a9f4) 10%,var(--card-background-color,#202126))); }
    button:focus-visible,.menu:focus-visible { outline:2px solid var(--hpf-accent,var(--primary-color,#03a9f4)); outline-offset:2px; }
    button:disabled { opacity:.45; cursor:not-allowed; }
    .menu { position:fixed; inset:auto; margin:0; box-sizing:border-box; z-index:10000;
      max-height:320px; overflow:auto; overscroll-behavior:contain; padding:5px; border-radius:10px;
      border:1px solid var(--hpf-line,var(--divider-color,#7776));
      background:var(--hpf-surface,var(--card-background-color,#202126)); color:var(--primary-text-color,#e6e7eb);
      box-shadow:0 8px 28px #0003; font:inherit; opacity:0; transform:translateY(-5px) scale(.985);
      transition:opacity 160ms,transform 160ms; transform-origin:top; }
    .menu.visible { opacity:1; transform:none; }
    .menu:not(.visible) { pointer-events:none; }
    [role=option] { display:flex; gap:12px; align-items:center; min-height:44px; box-sizing:border-box;
      padding:10px 12px; border-radius:6px; cursor:pointer; overflow-wrap:anywhere; transition:background-color 160ms,color 160ms; }
    [role=option] span { flex:1; min-width:0; }
    [role=option][aria-selected=true] { color:var(--hpf-accent,var(--primary-color,#03a9f4)); }
    [role=option].active,[role=option]:hover { background:var(--hpf-tint,color-mix(in srgb,var(--primary-color,#03a9f4) 12%,transparent)); }
    [role=option][aria-disabled=true] { opacity:.45; cursor:not-allowed; background:transparent; }
    @media(max-width:550px) { button { font-size:16px; } }
    @media(prefers-reduced-motion:reduce) { button,button svg,.menu,[role=option] { transition:none; } }
  `;
  declare private _version: number;
  private _open = false;
  private _active = -1;
  pointerHover = false;
  private readonly uid = `hp-select-${++sequence}`;
  private readonly floating = new FloatingSurfaceController(this, 'select', (e) => this.keydown(e));
  private observer?: MutationObserver;
  private dispose?: () => void;
  private closeTimer?: number;
  private fallback = false;
  private typeahead = '';
  private lastType = 0;
  private get native(): HTMLSelectElement | null { return this.querySelector('select'); }
  private get label(): string {
    return this.native?.getAttribute('aria-label') || this.native?.labels?.[0]?.textContent?.trim()
      || this.closest('.hpf-field')?.querySelector('.hpf-label')?.textContent?.trim()
      || (this.previousElementSibling?.tagName === 'LABEL' ? this.previousElementSibling.textContent?.trim() : '')
      || this.native?.name || '';
  }
  private get options(): HTMLOptionElement[] { return Array.from(this.native?.options || []).filter(o => !o.hidden); }
  private disabled(option: HTMLOptionElement): boolean { return option.disabled || (option.parentElement instanceof HTMLOptGroupElement && option.parentElement.disabled); }
  private sync = (): void => {
    const select = this.native;
    if (select) { select.tabIndex = -1; select.setAttribute('aria-hidden', 'true'); }
    if (select?.disabled) this.close();
    this._version = (this._version || 0) + 1;
  };
  connectedCallback(): void {
    super.connectedCallback();
    this.observer = new MutationObserver(this.sync);
    this.observer.observe(this, { subtree:true, childList:true, characterData:true, attributes:true,
      attributeFilter:['selected','disabled','label','value','aria-label'] });
    this.addEventListener('change', this.sync);
    this.sync();
  }
  disconnectedCallback(): void {
    this.close(false, true); this.observer?.disconnect(); this.removeEventListener('change', this.sync);
    super.disconnectedCallback();
  }
  private surface(): HTMLElement | null { return this.floating.surface('.menu', !this.fallback); }
  private menu(popover: boolean): TemplateResult {
    const options = this.options;
    return html`<div class="menu" role="listbox" id=${this.uid} data-hp="select-menu" tabindex="-1" popover=${popover ? 'manual' : nothing}
      aria-label=${this.label}
      aria-activedescendant=${this._active >= 0 ? `${this.uid}-${this._active}` : nothing}
      @keydown=${(e: KeyboardEvent) => this.keydown(e)}>
      ${options.map((option, i) => html`<div role="option" id=${`${this.uid}-${i}`} data-hp="select-option" data-id=${option.value}
        class=${i === this._active ? 'active' : ''} aria-selected=${String(option.selected)}
        aria-disabled=${String(this.disabled(option))} @click=${() => this.choose(i)}>
        <span>${option.label}</span><b aria-hidden="true">${option.selected ? '✓' : ''}</b>
      </div>`)}
    </div>`;
  }
  private renderFallback(): void { this.floating.renderFallback(this.menu(false), HpSettingsSelect.styles.cssText); }
  private position = (): void => {
    if (!this._open) return;
    const win = this.floating.window(), button = this.renderRoot.querySelector('button'), surface = this.surface();
    if (!win || !button || !surface) return;
    const anchor = button.getBoundingClientRect(), viewport = floatingViewport(win);
    surface.style.width = `${Math.min(Math.max(anchor.width, 180), viewport.width - 16)}px`;
    surface.style.maxHeight = `${Math.min(320, viewport.height - 16)}px`;
    const place = placeFloatingSurface(anchor, surface.getBoundingClientRect(), viewport);
    surface.style.left = `${place.left}px`; surface.style.top = `${place.top}px`;
  };
  private outside = (e: PointerEvent): void => { if (!this.floating.containsPath(e.composedPath())) this.close(); };
  private dismissScroll = (e: Event): void => { if (!this.floating.containsPath(e.composedPath())) this.close(); };
  private focusout = (): void => { queueMicrotask(() => { if (this._open && !this.floating.ownsActiveElement()) this.close(); }); };
  private async open(): Promise<void> {
    if (this._open || !this.native || this.native.disabled) return;
    const win = this.floating.window(); if (!win) return;
    if (this.closeTimer) win.clearTimeout(this.closeTimer);
    this.closeTimer = undefined; this.floating.destroy();
    this._open = true; this._active = this.options.findIndex(o => o.selected && !this.disabled(o));
    if (this._active < 0) this._active = this.options.findIndex(o => !this.disabled(o));
    this.fallback = !this.floating.usesPopover();
    await this.updateComplete;
    if (!this._open) return;
    if (!this.fallback) {
      try { this.surface()?.showPopover(); } catch { this.fallback = true; }
    }
    if (this.fallback) this.renderFallback();
    this.position();
    this.dispose = this.floating.dialog()?.registerOverlay({ owner:this, group:'transient',
      close: reason => this.close(reason === 'escape') });
    this.ownerDocument.addEventListener('pointerdown', this.outside, true);
    this.ownerDocument.addEventListener('focusout', this.focusout);
    this.floating.dialog()?.addEventListener('scroll', this.dismissScroll, true);
    win.addEventListener('resize', this.position); win.visualViewport?.addEventListener('resize', this.position);
    win.visualViewport?.addEventListener('scroll', this.position);
    this.surface()?.focus({preventScroll:true});
    win.requestAnimationFrame(() => { if (this._open) this.surface()?.classList.add('visible'); });
  }
  private close(refocus = false, immediate = false): void {
    this._open = false; this.dispose?.(); this.dispose = undefined;
    this.ownerDocument.removeEventListener('pointerdown', this.outside, true);
    this.ownerDocument.removeEventListener('focusout', this.focusout);
    this.floating.dialog()?.removeEventListener('scroll', this.dismissScroll, true);
    const win = this.floating.window();
    win?.removeEventListener('resize', this.position); win?.visualViewport?.removeEventListener('resize', this.position);
    win?.visualViewport?.removeEventListener('scroll', this.position);
    const surface = this.surface(); surface?.classList.remove('visible');
    const finish = () => {
      if (!this.fallback) { try { surface?.hidePopover(); } catch { /* detached native surface */ } }
      this.floating.destroy(); this.closeTimer = undefined;
    };
    if (this.closeTimer) win?.clearTimeout(this.closeTimer);
    if (immediate || !win || win.matchMedia('(prefers-reduced-motion:reduce)').matches) finish();
    else this.closeTimer = win.setTimeout(finish, 160);
    if (refocus) this.renderRoot.querySelector<HTMLButtonElement>('button')?.focus();
  }
  private choose(index: number): void {
    const option = this.options[index], select = this.native;
    if (!option || !select || this.disabled(option)) return;
    select.value = option.value;
    select.dispatchEvent(new Event('change', {bubbles:true, composed:true}));
    this.sync(); this.close(true);
  }
  private keydown(e: KeyboardEvent): void {
    if (e.defaultPrevented) return;
    if (!this._open) {
      if (['ArrowDown','ArrowUp','Enter',' '].includes(e.key)) { e.preventDefault(); void this.open(); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); this.close(true); return; }
    if (e.key === 'Tab') { this.close(true); return; }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.choose(this._active); return; }
    const available = this.options.map((o,i) => this.disabled(o) ? -1 : i).filter(i => i >= 0);
    let next = this._active;
    if (e.key === 'Home') next = available[0];
    else if (e.key === 'End') next = available[available.length - 1];
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const step = e.key === 'ArrowDown' ? 1 : -1;
      next = available[(available.indexOf(this._active) + step + available.length) % available.length];
    } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const now = Date.now(); this.typeahead = now - this.lastType > 700 ? e.key : this.typeahead + e.key; this.lastType = now;
      next = available.find(i => this.options[i].label.toLocaleLowerCase().startsWith(this.typeahead.toLocaleLowerCase())) ?? this._active;
    } else return;
    e.preventDefault(); e.stopPropagation(); this._active = next ?? -1;
    void this.updateComplete.then(() => {
      const surface = this.surface(), visible = surface?.classList.contains('visible');
      if (this.fallback) { this.renderFallback(); if (visible) this.surface()?.classList.add('visible'); }
      this.surface()?.querySelector(`#${this.uid}-${this._active}`)?.scrollIntoView({block:'nearest'});
    });
  }
  render(): TemplateResult {
    return html`<slot @slotchange=${this.sync}></slot><button part="control" type="button" data-hp="select-trigger" aria-controls=${this.uid} ?disabled=${this.native?.disabled}
      aria-label=${this.label ? `${this.label}: ${this.native?.selectedOptions[0]?.label || ''}` : nothing} aria-haspopup="listbox" aria-expanded=${String(this._open)}
      @keydown=${(e: KeyboardEvent) => this.keydown(e)} @click=${() => this._open ? this.close(true) : void this.open()}>
      <span part="label">${this.native?.selectedOptions[0]?.label || ''}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5z"/></svg>
    </button>${!this.fallback ? this.menu(true) : nothing}`;
  }
}
if (typeof customElements !== 'undefined' && !customElements.get('hp-settings-select')) customElements.define('hp-settings-select', HpSettingsSelect);
