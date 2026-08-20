import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { safeStoredColor } from './color';
import { hexToRgb, hsvToHex, normalizeHexColor, rgbToHsv } from './color-picker';
import { floatingViewport, placeFloatingSurface } from './floating-surface';
import { FloatingSurfaceController } from './floating-surface-controller';
import type { HpDialog, HpOverlayCloseReason } from './hp-dialog';

export type ColorPickerLabels = {
  title: string;
  hue: string;
  saturation: string;
  value: string;
  hex: string;
  invalidHex: string;
};

const DEFAULT_LABELS: ColorPickerLabels = {
  title: 'Color picker',
  hue: 'Hue',
  saturation: 'Saturation',
  value: 'Brightness',
  hex: 'Hex color',
  invalidHex: 'Enter a 3- or 6-digit hex color',
};

/**
 * Compact colour + opacity picker used by decor defaults and object dialogs.
 *
 * Only the swatch lives in the parent toolbar/form. Alpha controls are in the
 * picker when `showOpacity` is enabled; colour-only consumers reuse the same
 * compact surface without exposing a meaningless opacity value.
 */
export class HpColorOpacity extends LitElement {
  public label = '';
  public opacityLabel = 'Opacity';
  public color = '#607d8b';
  public opacity = 1;
  public disabled = false;
  public showOpacity = true;
  public pickerLabels: ColorPickerLabels = DEFAULT_LABELS;

  private _open = false;
  private _pickerRaf = 0;
  private _emitRaf = 0;
  private _forceFallback = false;
  private _overlayDispose: (() => void) | null = null;
  private _hue = 0;
  private _saturation = 0;
  private _value = 0;
  private _hexDraft = '#607d8b';
  private _hexInvalid = false;
  private _lastValidColor = '#607d8b';
  private _activePointerId: number | null = null;

  static properties = {
    label: { type: String },
    opacityLabel: { type: String, attribute: 'opacity-label' },
    color: { type: String },
    opacity: { type: Number },
    disabled: { type: Boolean, reflect: true },
    showOpacity: { type: Boolean, attribute: 'show-opacity' },
    pickerLabels: { attribute: false },
    _open: { state: true },
    _hue: { state: true },
    _saturation: { state: true },
    _value: { state: true },
    _hexDraft: { state: true },
    _hexInvalid: { state: true },
  };

  static styles = css`
    :host {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }
    .label {
      font-size: 12px;
      color: var(--secondary-text-color, #9aa4ad);
      white-space: nowrap;
    }
    .trigger {
      width: 40px;
      height: 40px;
      flex: none;
      box-sizing: border-box;
      padding: 3px;
      border: 1px solid var(--divider-color, #666);
      border-radius: 7px;
      background:
        linear-gradient(45deg, #b8b8b8 25%, transparent 25%) 0 0 / 10px 10px,
        linear-gradient(45deg, transparent 75%, #b8b8b8 75%) 0 0 / 10px 10px,
        linear-gradient(45deg, transparent 75%, #b8b8b8 75%) 5px -5px / 10px 10px,
        linear-gradient(45deg, #b8b8b8 25%, #eee 25%) 5px 5px / 10px 10px;
      cursor: pointer;
    }
    :host([data-pointer-hover]) .trigger:hover {
      border-color: var(--primary-color, #03a9f4);
    }
    .trigger[aria-expanded='true'] {
      border-color: var(--primary-color, #03a9f4);
      outline: none;
      box-shadow: 0 0 0 1px var(--primary-color, #03a9f4);
    }
    .trigger:focus-visible {
      border-color: var(--primary-color, #03a9f4);
      outline: 2px solid var(--primary-color, #03a9f4);
      outline-offset: 2px;
    }
    .swatch {
      display: block;
      width: 100%;
      height: 100%;
      border-radius: 3px;
      box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.18);
      pointer-events: none;
    }
    .picker {
      /* The popover attribute promotes this surface into the browser top layer, outside
         hp-dialog's scrolling/clipping body. JS supplies viewport coordinates. */
      position: fixed;
      z-index: 2147483647;
      inset: auto;
      top: 0;
      left: 0;
      width: min(292px, calc(100vw - 16px));
      max-height: calc(100vh - 16px);
      margin: 0;
      box-sizing: border-box;
      display: grid;
      gap: 10px;
      padding: 12px;
      overflow: auto;
      color: var(--primary-text-color, #fff);
      background: var(--card-background-color, #202126);
      border: 1px solid var(--primary-color, #03a9f4);
      border-radius: 10px;
      box-shadow: 0 10px 28px rgb(0 0 0 / 0.34);
    }
    .picker[popover]:not(:popover-open) {
      /* Keep the author-level display:grid from exposing the surface for one
         frame before showPopover() promotes it into the top layer. */
      display: none;
    }
    .picker-head,
    .row,
    .control-head {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .picker-head {
      justify-content: space-between;
    }
    .caption {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      color: var(--secondary-text-color, #9aa4ad);
      font-size: 12px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .preview {
      width: 52px;
      height: 30px;
      flex: none;
      box-sizing: border-box;
      padding: 3px;
      border: 1px solid var(--divider-color, #666);
      border-radius: 7px;
      background:
        linear-gradient(45deg, #b8b8b8 25%, transparent 25%) 0 0 / 10px 10px,
        linear-gradient(45deg, transparent 75%, #b8b8b8 75%) 0 0 / 10px 10px,
        linear-gradient(45deg, transparent 75%, #b8b8b8 75%) 5px -5px / 10px 10px,
        linear-gradient(45deg, #b8b8b8 25%, #eee 25%) 5px 5px / 10px 10px;
    }
    .preview > span {
      display: block;
      width: 100%;
      height: 100%;
      border-radius: 3px;
    }
    .sv-field {
      position: relative;
      width: 100%;
      height: 132px;
      overflow: hidden;
      box-sizing: border-box;
      border: 1px solid var(--divider-color, #666);
      border-radius: 8px;
      background:
        linear-gradient(to top, #000, transparent),
        linear-gradient(to right, #fff, var(--hp-picker-hue, #f00));
      cursor: crosshair;
      touch-action: none;
      user-select: none;
    }
    .sv-thumb {
      position: absolute;
      left: var(--hp-picker-saturation, 0%);
      top: var(--hp-picker-value, 100%);
      width: 14px;
      height: 14px;
      box-sizing: border-box;
      border: 2px solid #fff;
      border-radius: 50%;
      box-shadow: 0 0 0 1px rgb(0 0 0 / .65), 0 1px 3px rgb(0 0 0 / .5);
      transform: translate(-50%, -50%);
      pointer-events: none;
    }
    .control {
      display: grid;
      gap: 2px;
      min-width: 0;
    }
    .control-value {
      flex: none;
      color: var(--secondary-text-color, #9aa4ad);
      font-size: 12px;
    }
    input[type='range'] {
      width: auto;
      height: 40px;
      min-width: 0;
      flex: 1;
      margin: -5px 0;
      accent-color: var(--primary-color, #03a9f4);
      touch-action: none;
    }
    .hue-range {
      accent-color: var(--hp-picker-hue, #f00);
      --hp-picker-hue-track: linear-gradient(to right,
        #f00 0%, #ff0 16.667%, #0f0 33.333%, #0ff 50%,
        #00f 66.667%, #f0f 83.333%, #f00 100%);
      --hp-picker-hue-thumb-shadow:
        0 0 0 2px var(--card-background-color, #202126),
        0 0 0 3px var(--primary-text-color, #fff);
    }
    .hue-range::-webkit-slider-runnable-track {
      height: 10px;
      box-sizing: border-box;
      border: 1px solid var(--divider-color, #666);
      border-radius: 999px;
      background: var(--hp-picker-hue-track);
    }
    .hue-range::-moz-range-track {
      height: 10px;
      box-sizing: border-box;
      border: 1px solid var(--divider-color, #666);
      border-radius: 999px;
      background: var(--hp-picker-hue-track);
    }
    .hue-range::-moz-range-progress {
      height: 10px;
      border: 0;
      border-radius: 999px;
      background: transparent;
    }
    .hue-range::-webkit-slider-thumb {
      border-radius: 50%;
      box-shadow: var(--hp-picker-hue-thumb-shadow);
    }
    .hue-range::-moz-range-thumb {
      border-radius: 50%;
      box-shadow: var(--hp-picker-hue-thumb-shadow);
    }
    input[type='text'],
    input[type='number'] {
      min-height: 40px;
      box-sizing: border-box;
      border: 1px solid var(--divider-color, #666);
      border-radius: 6px;
      padding: 6px 8px;
      color: var(--primary-text-color, #fff);
      background: var(--input-fill-color, transparent);
      font: inherit;
    }
    input[type='text'] {
      width: 100%;
    }
    input[type='number'] {
      width: 50px;
      flex: none;
    }
    input:focus-visible,
    .sv-field:focus-visible {
      outline: 2px solid var(--primary-color, #03a9f4);
      outline-offset: 1px;
    }
    input[aria-invalid='true'] {
      border-color: var(--error-color, #db4437);
    }
    .error {
      color: var(--error-color, #db4437);
      font-size: 11px;
      line-height: 1.25;
    }
    .pct {
      color: var(--secondary-text-color, #9aa4ad);
      font-size: 12px;
    }
    :host([disabled]) {
      opacity: .5;
      pointer-events: none;
    }
    @media (prefers-reduced-motion: reduce) {
      .picker { transition: none !important; }
    }
    @media (forced-colors: active) {
      .hue-range::-webkit-slider-runnable-track {
        border-color: ButtonText;
        background: Canvas;
      }
      .hue-range::-moz-range-track {
        border-color: ButtonText;
        background: Canvas;
      }
      .hue-range::-webkit-slider-thumb {
        box-shadow: none;
      }
      .hue-range::-moz-range-thumb {
        box-shadow: none;
      }
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    this._syncFromColor(this.color, false);
    this.ownerDocument.addEventListener('pointerdown', this._outsidePointerDown, true);
    this.ownerDocument.addEventListener('scroll', this._queuePickerPosition, true);
    const win = this.ownerDocument.defaultView;
    win?.addEventListener('resize', this._queuePickerPosition);
    win?.addEventListener('orientationchange', this._queuePickerPosition);
    win?.visualViewport?.addEventListener('resize', this._queuePickerPosition);
    win?.visualViewport?.addEventListener('scroll', this._queuePickerPosition);
    this.addEventListener('keydown', this._keyDown, true);
  }

  disconnectedCallback(): void {
    this.ownerDocument.removeEventListener('pointerdown', this._outsidePointerDown, true);
    this.ownerDocument.removeEventListener('scroll', this._queuePickerPosition, true);
    const win = this.ownerDocument.defaultView;
    win?.removeEventListener('resize', this._queuePickerPosition);
    win?.removeEventListener('orientationchange', this._queuePickerPosition);
    win?.visualViewport?.removeEventListener('resize', this._queuePickerPosition);
    win?.visualViewport?.removeEventListener('scroll', this._queuePickerPosition);
    this.removeEventListener('keydown', this._keyDown, true);
    if (this._pickerRaf) cancelAnimationFrame(this._pickerRaf);
    if (this._emitRaf) cancelAnimationFrame(this._emitRaf);
    this._pickerRaf = 0;
    this._emitRaf = 0;
    this._closePicker(false, 'disconnect');
    super.disconnectedCallback();
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('color')) {
      const normalized = normalizeHexColor(this.color);
      if (normalized && normalized !== this._lastValidColor) {
        this._syncFromColor(normalized, this._open);
      }
    }
    if (this.disabled && this._open) {
      this._closePicker();
      return;
    }
    if (!this._open) return;
    if (!this._supportsPopover()) this._renderFallback();
    if (changed.has('color') || changed.has('opacity') || changed.has('showOpacity')
      || changed.has('label') || changed.has('opacityLabel') || changed.has('pickerLabels')) {
      this._queuePickerPosition();
    }
  }

  private _window(): Window | null {
    return this._floating.window();
  }

  private _supportsPopover(): boolean {
    return this._floating.usesPopover(this._forceFallback);
  }

  private _dialog(): HpDialog | null {
    return this._floating.dialog();
  }

  private _outsidePointerDown = (event: PointerEvent): void => {
    if (!this._open) return;
    const path = event.composedPath();
    if (!this._floating.containsPath(path)) {
      this._closePicker(false, 'outside');
    }
  };

  private _keyDown = (event: KeyboardEvent): void => {
    if (!this._open || event.key !== 'Escape') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this._closePicker(this._floating.ownsActiveElement(), 'escape');
  };

  private readonly _floating = new FloatingSurfaceController(this, 'color-opacity', this._keyDown);

  private async _toggle(): Promise<void> {
    if (this.disabled) return;
    if (this._open) {
      this._closePicker();
      return;
    }
    this._forceFallback = false;
    this._syncFromColor(this.color, false);
    this._hexInvalid = false;
    this._activePointerId = null;
    this._open = true;
    await this.updateComplete;
    if (!this._open) return;
    if (!this._supportsPopover()) this._renderFallback();
    if (!this._positionPicker()) {
      this._closePicker();
      return;
    }
    this._overlayDispose = this._dialog()?.registerOverlay({
      owner: this,
      group: 'transient',
      close: (reason) => this._closePicker(
        reason === 'escape' && this._floating.ownsActiveElement(), reason,
      ),
    }) || null;
  }

  private _closePicker(refocus = false, _reason: HpOverlayCloseReason = 'exclusive'): void {
    if (!this._open && !this._floating.hasFallback) return;
    const dispose = this._overlayDispose;
    this._overlayDispose = null;
    dispose?.();
    const popup = this.renderRoot.querySelector<HTMLElement>('.picker') as any;
    if (popup?.hidePopover) {
      try {
        if (popup.matches(':popover-open')) popup.hidePopover();
      } catch {
        /* older engines simply remove the fallback surface on the next render */
      }
    }
    this._open = false;
    this._cancelQueuedEmit();
    this._activePointerId = null;
    this._floating.destroy();
    if (refocus) {
      this.updateComplete.then(() => this.renderRoot.querySelector<HTMLButtonElement>('.trigger')?.focus());
    }
  }

  private _queuePickerPosition = (): void => {
    if (!this._open) return;
    if (this._pickerRaf) cancelAnimationFrame(this._pickerRaf);
    const win = this._window();
    if (!win) return;
    this._pickerRaf = win.requestAnimationFrame(() => {
      this._pickerRaf = 0;
      if (!this._positionPicker()) this._closePicker();
    });
  };

  private _surface(): HTMLElement | null {
    return this._floating.surface('.picker', this._supportsPopover());
  }

  private _renderFallback(): void {
    const styleText = (HpColorOpacity.styles as unknown as { cssText: string }).cssText;
    this._floating.renderFallback(this._pickerTemplate(false), styleText);
  }

  private _positionPicker(): boolean {
    if (!this._open) return false;
    const win = this._window();
    const trigger = this.renderRoot.querySelector<HTMLElement>('.trigger');
    let popup = this._surface() as any;
    if (!win || !trigger?.isConnected || !popup?.isConnected) return false;
    const viewport = floatingViewport(win);
    popup.style.maxWidth = `${Math.max(0, viewport.width - 16)}px`;
    popup.style.maxHeight = `${Math.max(0, viewport.height - 16)}px`;
    popup.style.visibility = 'hidden';
    if (this._supportsPopover() && popup.showPopover) {
      try {
        if (!popup.matches(':popover-open')) popup.showPopover();
      } catch {
        this._forceFallback = true;
        this._renderFallback();
        popup = this._surface();
        if (!popup?.isConnected) return false;
        popup.style.maxWidth = `${Math.max(0, viewport.width - 16)}px`;
        popup.style.maxHeight = `${Math.max(0, viewport.height - 16)}px`;
        popup.style.visibility = 'hidden';
      }
    }
    const anchor = trigger.getBoundingClientRect();
    const box = popup.getBoundingClientRect();
    if (!anchor.width || !anchor.height || !box.width || !box.height) return false;
    const placement = placeFloatingSurface(anchor, box, viewport);
    popup.style.left = `${placement.left}px`;
    popup.style.top = `${placement.top}px`;
    popup.dataset.side = placement.side;
    popup.style.visibility = '';
    return true;
  }

  private _labels(): ColorPickerLabels {
    const labels = this.pickerLabels || DEFAULT_LABELS;
    return {
      title: labels.title || DEFAULT_LABELS.title,
      hue: labels.hue || DEFAULT_LABELS.hue,
      saturation: labels.saturation || DEFAULT_LABELS.saturation,
      value: labels.value || DEFAULT_LABELS.value,
      hex: labels.hex || DEFAULT_LABELS.hex,
      invalidHex: labels.invalidHex || DEFAULT_LABELS.invalidHex,
    };
  }

  private _syncFromColor(value: unknown, preserveAchromaticHue: boolean): void {
    const normalized = normalizeHexColor(safeStoredColor(value, '#607d8b')) || '#607d8b';
    const rgb = hexToRgb(normalized);
    if (!rgb) return;
    const hsv = rgbToHsv(rgb);
    if (!preserveAchromaticHue || hsv.s > 0.0001) this._hue = hsv.h;
    this._saturation = hsv.s;
    this._value = hsv.v;
    this._hexDraft = normalized;
    this._hexInvalid = false;
    this._lastValidColor = normalized;
  }

  private _cancelQueuedEmit(revert = false): void {
    if (this._emitRaf) cancelAnimationFrame(this._emitRaf);
    this._emitRaf = 0;
    if (revert) this._syncFromColor(this._lastValidColor, true);
  }

  private _queueHsvEmit(): void {
    if (this._emitRaf) return;
    const win = this._window();
    if (!win) {
      this._emitHsv();
      return;
    }
    this._emitRaf = win.requestAnimationFrame(() => {
      this._emitRaf = 0;
      this._emitHsv();
    });
  }

  private _emitHsv(): void {
    this._emit(hsvToHex({ h: this._hue, s: this._saturation, v: this._value }), this.opacity);
  }

  private _setHue(value: number): void {
    this._hue = Math.min(359, Math.max(0, Number.isFinite(value) ? value : 0));
    this._emitHsv();
  }

  private _setSaturation(value: number): void {
    this._saturation = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
    this._emitHsv();
  }

  private _setValue(value: number): void {
    this._value = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
    this._emitHsv();
  }

  private _setOpacity(value: number): void {
    this._emit(this._lastValidColor, value);
  }

  private _shiftRangeKey(
    event: KeyboardEvent,
    current: number,
    min: number,
    max: number,
    apply: (value: number) => void,
  ): void {
    if (!event.shiftKey) return;
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowUp'
      ? 10
      : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -10 : 0;
    if (!delta) return;
    event.preventDefault();
    event.stopPropagation();
    apply(Math.min(max, Math.max(min, current + delta)));
  }

  private _setSvFromPointer(event: PointerEvent, immediate: boolean): void {
    const field = event.currentTarget as HTMLElement;
    const rect = field.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this._saturation = Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100));
    this._value = Math.min(100, Math.max(0, (1 - ((event.clientY - rect.top) / rect.height)) * 100));
    if (immediate) {
      this._cancelQueuedEmit();
      this._emitHsv();
    } else {
      this._queueHsvEmit();
    }
  }

  private _svPointerDown(event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this._activePointerId !== null) return;
    this._activePointerId = event.pointerId;
    try { (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId); } catch { /* detached */ }
    this._setSvFromPointer(event, true);
  }

  private _svPointerMove(event: PointerEvent): void {
    if (event.pointerId !== this._activePointerId) return;
    event.preventDefault();
    event.stopPropagation();
    this._setSvFromPointer(event, false);
  }

  private _svPointerUp(event: PointerEvent): void {
    if (event.pointerId !== this._activePointerId) return;
    event.preventDefault();
    event.stopPropagation();
    this._setSvFromPointer(event, true);
    this._activePointerId = null;
    try { (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId); } catch { /* detached */ }
  }

  private _svPointerCancel(event: PointerEvent): void {
    if (event.pointerId !== this._activePointerId) return;
    event.preventDefault();
    event.stopPropagation();
    this._activePointerId = null;
    this._cancelQueuedEmit(true);
  }

  private _svLostPointerCapture(event: PointerEvent): void {
    if (event.pointerId !== this._activePointerId) return;
    this._activePointerId = null;
    this._cancelQueuedEmit(true);
  }

  private _hexInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this._hexDraft = value;
    this._hexInvalid = false;
    const normalized = normalizeHexColor(value);
    const rgb = normalized ? hexToRgb(normalized) : null;
    if (!normalized || !rgb) return;
    const hsv = rgbToHsv(rgb);
    if (hsv.s > 0.0001) this._hue = hsv.h;
    this._saturation = hsv.s;
    this._value = hsv.v;
    this._emit(normalized, this.opacity, true);
  }

  private _commitHex(): void {
    const normalized = normalizeHexColor(this._hexDraft);
    if (!normalized) {
      this._hexDraft = this._lastValidColor;
      this._hexInvalid = true;
      return;
    }
    this._hexDraft = normalized;
    this._hexInvalid = false;
    if (normalized !== this._lastValidColor) this._emit(normalized, this.opacity);
  }

  private _hexKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    event.stopPropagation();
    this._commitHex();
  }

  private _emit(color: string, opacity: number, preserveHexDraft = false): void {
    const normalized = normalizeHexColor(color) || this._lastValidColor;
    const value = Number.isFinite(opacity) ? opacity : Number(this.opacity) || 0;
    const clamped = Math.min(1, Math.max(0, value));
    // Keep the open picker responsive even before its parent has completed the
    // reactive round-trip and passed the new pair back as properties.
    this.color = normalized;
    this.opacity = clamped;
    this._lastValidColor = normalized;
    if (!preserveHexDraft) this._hexDraft = normalized;
    this._hexInvalid = false;
    this.dispatchEvent(new CustomEvent('hp-color-opacity-change', {
      detail: { color: normalized, opacity: clamped },
      bubbles: true,
      composed: true,
    }));
  }

  private _pickerTemplate(usePopover: boolean): TemplateResult {
    const pct = Math.round(Math.min(1, Math.max(0, Number(this.opacity) || 0)) * 100);
    const color = hsvToHex({ h: this._hue, s: this._saturation, v: this._value });
    const hueColor = hsvToHex({ h: this._hue, s: 100, v: 100 });
    const labels = this._labels();
    const hue = Math.round(this._hue);
    const saturation = Math.round(this._saturation);
    const value = Math.round(this._value);
    return html`
      <div class="picker" popover=${usePopover ? 'manual' : nothing} role="dialog" aria-label=${labels.title}>
        <div class="picker-head">
          <span class="caption">${this.label || labels.title}</span>
          <span class="preview" aria-hidden="true"><span style=${`background:${color};opacity:${pct / 100}`}></span></span>
        </div>
        <div class="sv-field" aria-hidden="true"
          style=${`--hp-picker-hue:${hueColor};--hp-picker-saturation:${this._saturation}%;--hp-picker-value:${100 - this._value}%`}
          @pointerdown=${(e: PointerEvent) => this._svPointerDown(e)}
          @pointermove=${(e: PointerEvent) => this._svPointerMove(e)}
          @pointerup=${(e: PointerEvent) => this._svPointerUp(e)}
          @pointercancel=${(e: PointerEvent) => this._svPointerCancel(e)}
          @lostpointercapture=${(e: PointerEvent) => this._svLostPointerCapture(e)}>
          <span class="sv-thumb"></span>
        </div>
        <label class="control">
          <span class="control-head"><span class="caption">${labels.hue}</span><span class="control-value">${hue}°</span></span>
          <input class="hue-range" type="range" min="0" max="359" step="1" .value=${String(hue)}
            aria-label=${labels.hue} aria-valuetext=${`${hue}°`} style=${`--hp-picker-hue:${hueColor}`}
            @input=${(e: Event) => this._setHue(Number((e.target as HTMLInputElement).value))}
            @keydown=${(e: KeyboardEvent) => this._shiftRangeKey(e, hue, 0, 359, (next) => this._setHue(next))} />
        </label>
        <label class="control">
          <span class="control-head"><span class="caption">${labels.saturation}</span><span class="control-value">${saturation}%</span></span>
          <input type="range" min="0" max="100" step="1" .value=${String(saturation)}
            aria-label=${labels.saturation} aria-valuetext=${`${saturation}%`}
            @input=${(e: Event) => this._setSaturation(Number((e.target as HTMLInputElement).value))}
            @keydown=${(e: KeyboardEvent) => this._shiftRangeKey(e, saturation, 0, 100, (next) => this._setSaturation(next))} />
        </label>
        <label class="control">
          <span class="control-head"><span class="caption">${labels.value}</span><span class="control-value">${value}%</span></span>
          <input type="range" min="0" max="100" step="1" .value=${String(value)}
            aria-label=${labels.value} aria-valuetext=${`${value}%`}
            @input=${(e: Event) => this._setValue(Number((e.target as HTMLInputElement).value))}
            @keydown=${(e: KeyboardEvent) => this._shiftRangeKey(e, value, 0, 100, (next) => this._setValue(next))} />
        </label>
        <label class="control">
          <span class="caption">${labels.hex}</span>
          <input type="text" inputmode="text" autocomplete="off" spellcheck="false"
            .value=${this._hexDraft} aria-label=${labels.hex}
            aria-invalid=${this._hexInvalid ? 'true' : 'false'}
            aria-describedby=${this._hexInvalid ? 'hex-error' : nothing}
            @input=${(e: Event) => this._hexInput(e)}
            @blur=${() => this._commitHex()}
            @keydown=${(e: KeyboardEvent) => this._hexKeyDown(e)} />
          ${this._hexInvalid ? html`<span id="hex-error" class="error">${labels.invalidHex}</span>` : nothing}
        </label>
        ${this.showOpacity ? html`<div class="row">
          <span class="caption">${this.opacityLabel}</span>
          <input type="range" min="0" max="100" step="1" .value=${String(pct)}
            aria-label=${this.opacityLabel} aria-valuetext=${`${pct}%`}
            @input=${(e: Event) => this._setOpacity(Number((e.target as HTMLInputElement).value) / 100)}
            @keydown=${(e: KeyboardEvent) => this._shiftRangeKey(e, pct, 0, 100, (next) => this._setOpacity(next / 100))} />
          <input type="number" min="0" max="100" step="1" .value=${String(pct)}
            aria-label=${`${this.opacityLabel}, %`}
            @change=${(e: Event) => this._setOpacity(Number((e.target as HTMLInputElement).value) / 100)} />
          <span class="pct">%</span>
        </div>` : nothing}
      </div>`;
  }

  render() {
    const pct = Math.round(Math.min(1, Math.max(0, Number(this.opacity) || 0)) * 100);
    const color = safeStoredColor(this.color, '#607d8b');
    const title = this.showOpacity
      ? `${this.label || 'Color'}: ${color}, ${pct}%`
      : `${this.label || 'Color'}: ${color}`;
    return html`
      ${this.label ? html`<span class="label">${this.label}</span>` : nothing}
      <button class="trigger" type="button" .disabled=${this.disabled}
        aria-label=${title} aria-haspopup="dialog" aria-expanded=${this._open ? 'true' : 'false'}
        title=${title} @click=${this._toggle}>
        <span class="swatch" style=${`background:${color};opacity:${this.showOpacity ? pct / 100 : 1}`}></span>
      </button>
      ${this._open && !this.disabled && this._supportsPopover() ? this._pickerTemplate(true) : nothing}
    `;
  }
}

if (!customElements.get('hp-color-opacity')) customElements.define('hp-color-opacity', HpColorOpacity);

declare global {
  interface HTMLElementTagNameMap { 'hp-color-opacity': HpColorOpacity; }
}
