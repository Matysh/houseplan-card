import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { mdiHelpCircleOutline } from '@mdi/js';
import { floatingViewport, placeFloatingSurface } from './floating-surface';
import { FloatingSurfaceController } from './floating-surface-controller';
import type { HpDialog, HpOverlayCloseReason } from './hp-dialog';
import { helpHasContent, helpScrollShouldDismiss } from './help-behavior';

let helpSequence = 0;

/**
 * Presentation-only contextual help affordance.
 *
 * Callers provide already-localized text and the complete accessible name.
 * The component owns trigger parity, top-layer/fallback rendering, positioning,
 * dismissal, and cooperation with hp-dialog's transient overlay registry.
 */
export class HpHelp extends LitElement {
  static properties = {
    text: { type: String },
    ariaLabel: { type: String, attribute: 'aria-label' },
    _open: { state: true },
    _forceFallback: { state: true },
  };

  static styles = css`
    :host {
      display: none;
      flex: none;
      vertical-align: middle;
    }

    :host([data-has-content]) {
      display: inline-flex;
    }

    .trigger {
      width: 32px;
      height: 32px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: none;
      box-sizing: border-box;
      padding: 0;
      color: var(--secondary-text-color, #9aa4ad);
      background: transparent;
      border: 0;
      border-radius: 50%;
      cursor: help;
      -webkit-tap-highlight-color: transparent;
    }

    .trigger svg {
      display: block;
      width: 18px;
      height: 18px;
      fill: currentColor;
    }

    .trigger:hover,
    .trigger:focus-visible,
    .trigger[aria-expanded='true'] {
      color: var(--primary-text-color, #fff);
      background: rgb(127 127 127 / 0.18);
      outline: none;
    }

    .trigger:focus-visible {
      box-shadow: 0 0 0 2px var(--primary-color, #03a9f4);
    }

    .tooltip {
      position: fixed;
      z-index: 2147483647;
      inset: auto;
      top: 0;
      left: 0;
      width: max-content;
      max-width: min(320px, calc(100vw - 16px));
      max-height: calc(100vh - 16px);
      margin: 0;
      box-sizing: border-box;
      padding: 9px 11px;
      overflow: auto;
      color: var(--primary-text-color, #fff);
      background: var(--card-background-color, #202126);
      border: 1px solid var(--divider-color, rgb(255 255 255 / 0.2));
      border-radius: 9px;
      box-shadow: 0 8px 24px rgb(0 0 0 / 0.32);
      font: 400 13px/1.4 system-ui, sans-serif;
      text-align: start;
      white-space: normal;
      overflow-wrap: anywhere;
      opacity: 1;
      transform: translateY(0);
      transition: opacity 120ms ease, transform 120ms ease;
    }

    .tooltip[data-side='top'] {
      transform-origin: bottom center;
    }

    .tooltip[data-side='bottom'] {
      transform-origin: top center;
    }

    .tooltip[popover]:not(:popover-open) {
      display: none;
    }

    @starting-style {
      .tooltip {
        opacity: 0;
        transform: translateY(3px);
      }
    }

    .sr-only {
      /* Keep the accessibility-only description outside every dialog scroll
         container's overflow geometry. Toggling the hidden attribute on the former
         absolutely-positioned node made some browsers add a vertical
         scrollbar while help was open, even though the visible tooltip was
         already in the Popover top layer / fixed fallback portal. */
      position: fixed;
      inset: 0 auto auto 0;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: 0;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      clip-path: inset(50%);
      white-space: nowrap;
      border: 0;
    }

    @media (pointer: coarse) {
      .trigger {
        width: 40px;
        height: 40px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .tooltip {
        transition: none;
      }
    }
  `;

  text = '';
  ariaLabel = '';

  private _open = false;
  private _openTimer = 0;
  private _closeTimer = 0;
  private _positionRaf = 0;
  private _forceFallback = false;
  private _overlayDispose: (() => void) | null = null;
  private _scrollDialog: HpDialog | null = null;
  private readonly _descriptionId = `hp-help-description-${++helpSequence}`;

  connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('keydown', this._keyDown, true);
  }

  protected willUpdate(): void {
    this.toggleAttribute('data-has-content', this._hasContent());
  }

  disconnectedCallback(): void {
    const win = this.ownerDocument.defaultView;
    this._unsubscribeOpenListeners();
    this.removeEventListener('keydown', this._keyDown, true);
    this._clearTimers();
    if (this._positionRaf) win?.cancelAnimationFrame(this._positionRaf);
    this._positionRaf = 0;
    this._closeHelp(false, 'disconnect');
    super.disconnectedCallback();
  }

  protected updated(changed: PropertyValues): void {
    if (!this._hasContent() && this._open) {
      this._closeHelp();
      return;
    }
    if (this._open && changed.has('text')) {
      if (!this._usesPopover()) this._renderFallback();
      this._queuePosition();
    }
  }

  private _window(): Window | null {
    return this._floating.window();
  }

  private _dialog(): HpDialog | null {
    return this._floating.dialog();
  }

  private _usesPopover(): boolean {
    return this._floating.usesPopover(this._forceFallback);
  }

  private _hasContent(): boolean {
    return helpHasContent(this.text, this.ariaLabel);
  }

  private _clearTimers(): void {
    const win = this._window();
    if (this._openTimer) win?.clearTimeout(this._openTimer);
    if (this._closeTimer) win?.clearTimeout(this._closeTimer);
    this._openTimer = 0;
    this._closeTimer = 0;
  }

  private _scheduleOpen(): void {
    const win = this._window();
    if (!win || this._open || this._openTimer) return;
    if (this._closeTimer) win.clearTimeout(this._closeTimer);
    this._closeTimer = 0;
    this._openTimer = win.setTimeout(() => {
      this._openTimer = 0;
      if (!this.isConnected) return;
      void this._openHelp();
    }, 300);
  }

  private _scheduleClose(): void {
    const win = this._window();
    const trigger = this.renderRoot.querySelector<HTMLButtonElement>('.trigger');
    if (!win || trigger?.matches(':focus-visible')) return;
    if (this._openTimer) win.clearTimeout(this._openTimer);
    if (this._closeTimer) win.clearTimeout(this._closeTimer);
    this._openTimer = 0;
    this._closeTimer = win.setTimeout(() => {
      this._closeTimer = 0;
      if (!this.isConnected) return;
      this._closeHelp();
    }, 150);
  }

  private _triggerPointerEnter(event: PointerEvent): void {
    if (event.pointerType === 'mouse') this._scheduleOpen();
  }

  private _triggerPointerLeave(event: PointerEvent): void {
    if (event.pointerType === 'mouse') this._scheduleClose();
  }

  private _surfacePointerEnter = (): void => {
    const win = this._window();
    if (this._closeTimer) win?.clearTimeout(this._closeTimer);
    this._closeTimer = 0;
  };

  private _surfacePointerLeave = (): void => {
    this._scheduleClose();
  };

  private _triggerFocus(): void {
    queueMicrotask(() => {
      const trigger = this.renderRoot.querySelector<HTMLButtonElement>('.trigger');
      if (trigger?.matches(':focus-visible')) void this._openHelp();
    });
  }

  private _triggerBlur(): void {
    this._scheduleClose();
  }

  private _triggerClick(): void {
    if (this._open) this._closeHelp();
    else void this._openHelp();
  }

  private _outsidePointerDown = (event: PointerEvent): void => {
    if (!this._open) return;
    const path = event.composedPath();
    if (!this._floating.containsPath(path)) {
      this._closeHelp(false, 'outside');
    }
  };

  private _dialogScroll = (event: Event): void => {
    const insideSurface = this._floating.containsPath(event.composedPath());
    const target = event.target;
    const dialog = this._dialog();
    const targetOwnsHelp = target instanceof Node
      && (target === dialog || (target instanceof Element && target.contains(this)));
    if (this._open && helpScrollShouldDismiss(insideSurface, targetOwnsHelp)) {
      this._closeHelp(false, 'scroll');
    }
  };

  private _keyDown = (event: KeyboardEvent): void => {
    if (!this._open || event.key !== 'Escape') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this._closeHelp(this._floating.ownsActiveElement(), 'escape');
  };

  private readonly _floating = new FloatingSurfaceController(this, 'help', this._keyDown);

  private _subscribeOpenListeners(): void {
    this.ownerDocument.addEventListener('pointerdown', this._outsidePointerDown, true);
    this.ownerDocument.addEventListener('keydown', this._keyDown, true);
    const win = this._window();
    win?.addEventListener('resize', this._queuePosition);
    win?.addEventListener('orientationchange', this._queuePosition);
    win?.visualViewport?.addEventListener('resize', this._queuePosition);
    win?.visualViewport?.addEventListener('scroll', this._queuePosition);
    this._scrollDialog = this._dialog();
    this._scrollDialog?.addEventListener('scroll', this._dialogScroll, true);
  }

  private _unsubscribeOpenListeners(): void {
    this.ownerDocument.removeEventListener('pointerdown', this._outsidePointerDown, true);
    this.ownerDocument.removeEventListener('keydown', this._keyDown, true);
    const win = this._window();
    win?.removeEventListener('resize', this._queuePosition);
    win?.removeEventListener('orientationchange', this._queuePosition);
    win?.visualViewport?.removeEventListener('resize', this._queuePosition);
    win?.visualViewport?.removeEventListener('scroll', this._queuePosition);
    this._scrollDialog?.removeEventListener('scroll', this._dialogScroll, true);
    this._scrollDialog = null;
  }

  private async _openHelp(): Promise<void> {
    if (this._open || !this._hasContent()) return;
    this._clearTimers();
    this._forceFallback = false;
    this._open = true;
    this._subscribeOpenListeners();
    await this.updateComplete;
    if (!this._open) return;
    if (!this._usesPopover()) this._renderFallback();
    if (!this._position()) {
      this._closeHelp();
      return;
    }
    this._overlayDispose = this._dialog()?.registerOverlay({
      owner: this,
      group: 'transient',
      close: (reason) => this._closeHelp(
        reason === 'escape' && this._floating.ownsActiveElement(), reason,
      ),
    }) || null;
  }

  private _closeHelp(refocus = false, _reason: HpOverlayCloseReason = 'exclusive'): void {
    if (!this._open && !this._floating.hasFallback) return;
    this._clearTimers();
    const dispose = this._overlayDispose;
    this._overlayDispose = null;
    dispose?.();
    const surface = this.renderRoot.querySelector<HTMLElement>('.tooltip') as any;
    if (surface?.hidePopover) {
      try {
        if (surface.matches(':popover-open')) surface.hidePopover();
      } catch {
        /* The real fallback below does not depend on the Popover API. */
      }
    }
    this._open = false;
    this._unsubscribeOpenListeners();
    this._floating.destroy();
    if (refocus) {
      this.updateComplete.then(() => this.renderRoot.querySelector<HTMLButtonElement>('.trigger')?.focus());
    }
  }

  private _tooltipTemplate(usePopover: boolean): TemplateResult {
    return html`<div class="tooltip" data-side="bottom" popover=${usePopover ? 'manual' : nothing}
      role="tooltip" aria-hidden="true" tabindex="-1"
      @pointerenter=${this._surfacePointerEnter} @pointerleave=${this._surfacePointerLeave}>${this.text}</div>`;
  }

  private _renderFallback(): void {
    const styleText = (HpHelp.styles as unknown as { cssText: string }).cssText;
    this._floating.renderFallback(this._tooltipTemplate(false), styleText);
  }

  private _surface(): HTMLElement | null {
    return this._floating.surface('.tooltip', this._usesPopover());
  }

  private _queuePosition = (): void => {
    if (!this._open || this._positionRaf) return;
    const win = this._window();
    if (!win) return;
    this._positionRaf = win.requestAnimationFrame(() => {
      this._positionRaf = 0;
      if (!this._position()) this._closeHelp();
    });
  };

  private _position(): boolean {
    if (!this._open) return false;
    const win = this._window();
    const trigger = this.renderRoot.querySelector<HTMLElement>('.trigger');
    let surface = this._surface() as any;
    if (!win || !trigger?.isConnected || !surface?.isConnected) return false;
    const viewport = floatingViewport(win);
    surface.style.maxWidth = `${Math.max(0, Math.min(320, viewport.width - 16))}px`;
    surface.style.maxHeight = `${Math.max(0, viewport.height - 16)}px`;
    surface.style.visibility = 'hidden';
    if (this._usesPopover() && surface.showPopover) {
      try {
        if (!surface.matches(':popover-open')) surface.showPopover();
      } catch {
        this._forceFallback = true;
        this._renderFallback();
        surface = this._surface();
        if (!surface?.isConnected) return false;
        surface.style.visibility = 'hidden';
      }
    }
    const anchor = trigger.getBoundingClientRect();
    const surfaceRect = surface.getBoundingClientRect();
    if (!anchor.width || !anchor.height || !surfaceRect.width || !surfaceRect.height) return false;
    const placement = placeFloatingSurface(
      anchor,
      surfaceRect,
      viewport,
    );
    surface.style.left = `${placement.left}px`;
    surface.style.top = `${placement.top}px`;
    surface.dataset.side = placement.side;
    surface.style.visibility = '';
    return true;
  }

  render() {
    if (!this._hasContent()) return nothing;
    const label = this.ariaLabel.trim();
    return html`
      <span id=${this._descriptionId} class="sr-only" role="tooltip"
        aria-hidden=${this._open ? 'false' : 'true'}>${this.text}</span>
      <button class="trigger" type="button" aria-label=${label}
        aria-describedby=${this._open ? this._descriptionId : nothing}
        aria-expanded=${this._open ? 'true' : 'false'}
        @pointerenter=${this._triggerPointerEnter} @pointerleave=${this._triggerPointerLeave}
        @focus=${this._triggerFocus} @blur=${this._triggerBlur} @click=${this._triggerClick}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d=${mdiHelpCircleOutline}></path>
        </svg>
      </button>
      ${this._usesPopover() ? this._tooltipTemplate(true) : nothing}
    `;
  }
}

if (!customElements.get('hp-help')) customElements.define('hp-help', HpHelp);

declare global {
  interface HTMLElementTagNameMap { 'hp-help': HpHelp; }
}
