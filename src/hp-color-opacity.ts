import { LitElement, css, html, nothing, unsafeCSS, type PropertyValues, type TemplateResult } from 'lit';
import { settingsActionTransition, settingsPrimaryActionHover } from './styles/settings-action.styles';
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
  confirm: string;
};
export type ColorHexDraft = { raw: string; needsValidInput: boolean; touched?: { color: boolean; opacity: boolean };
  opacityDraft?: { raw: string | null; invalid: boolean } };

const DEFAULT_LABELS: ColorPickerLabels = {
  title: 'Color picker',
  hue: 'Hue',
  saturation: 'Saturation',
  value: 'Brightness',
  hex: 'Hex color',
  invalidHex: 'Enter a 3- or 6-digit hex color',
  confirm: 'OK',
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
  /** Optional action label for a swatch with its readout outside the control. */
  public triggerLabel = '';
  public nativeTooltip = true;
  public chromeTooltip = false;
  public readout = '';
  public pointerHover = false;
  public opacityLabel = 'Opacity';
  public color = '#607d8b';
  public opacity = 1;
  /** Group fields expose mixed channels without treating a picker seed as an edit. */
  public mixedColor = false;
  public mixedOpacity = false;
  public mixedLabel = 'Different values';
  public alphaOnly = false;
  public reportTouched = false;
  private touched = { color: false, opacity: false };
  private opacityRaw: string | null = null;
  private opacityInvalid = false;
  public get invalidOpacity(): boolean { return this.opacityInvalid || !!this.resumedHex?.opacityDraft?.invalid; }
  public disabled = false;
  public showOpacity = true;
  public hideLabel = false;
  /** Settings form-kit uses a solid swatch instead of the alpha checkerboard. */
  public flatSwatch = false;
  /** A tiny swatch-only host in Properties; independent of solid/alpha paint. */
  public compactSwatch = false;
  /**
   * Let the existing trigger cover an entire settings colour tile. #615: the
   * tile is the one flat-swatch surface that still shows alpha — checkerboard
   * under the colour, colour at its opacity — so the picture matches the `%`.
   */
  public coverSwatch = false;
  /** Optional fill semantics; alpha zero remains a real colour, not "no fill". */
  public allowNoFill = false;
  public noFill = false;
  public noFillLabel = 'No fill';
  public pickerLabels: ColorPickerLabels = DEFAULT_LABELS;

  private _open = false;
  private _closing = false;
  private _motion: Animation | null = null;
  private _motionEpoch = 0;
  private _restoredFocus = false;
  /** Consumers may hold live-derived properties steady while HEX is edited. */
  public get pickerOpen(): boolean { return this._open; }
  private resumedHex: ColorHexDraft | null = null;
  /** Session-only owner handoff when a responsive surface is temporarily unmounted. */
  public captureHexDraft(): ColorHexDraft | null {
    return this._open ? {raw:this._hexDraft,needsValidInput:this._hexNeedsValidInput,
      ...(this.reportTouched ? { touched: { ...this.touched }, opacityDraft: { raw: this.opacityRaw, invalid: this.opacityInvalid } } : {})} : this.resumedHex;
  }
  public resumeHexDraft(value: ColorHexDraft): void { this.resumedHex = {...value}; }
  /** A compound-field owner may finish on navigation without bypassing an invalid HEX draft. */
  public prepareCompletion(): boolean {
    if (!this._open) {
      if (!this.resumedHex) return true;
      if (!this.invalidOpacity && (!this.resumedHex.needsValidInput && normalizeHexColor(this.resumedHex.raw)
        || this.reportTouched && (this.alphaOnly || !this.resumedHex.touched?.color))) return true;
      void this.togglePicker(); return false;
    }
    if (this._emitRaf) { this._cancelQueuedEmit(); this._emitHsv(); }
    if (this.opacityInvalid) {
      void this.updateComplete.then(()=>this._surface()?.querySelector<HTMLInputElement>('input[data-value="number"]')?.focus());
      return false;
    }
    if (!this.alphaOnly && (!this.reportTouched || this.touched.color)) this._commitHex();
    if (!this._hexInvalid && !this._hexNeedsValidInput) return true;
    void this.updateComplete.then(()=>this._surface()?.querySelector<HTMLInputElement>('input[type="text"]')?.focus());
    return false;
  }
  public closePicker(): void { this._closePicker(); }
  /** A settings colour plate delegates to the same trigger and overlay owner. */
  public async togglePicker(): Promise<void> {
    if (this.disabled) return;
    this.renderRoot.querySelector<HTMLButtonElement>('.trigger')?.focus();
    await this._toggle();
  }
  private _pickerRaf = 0;
  private _emitRaf = 0;
  private _forceFallback = false;
  private _overlayDispose: (() => void) | null = null;
  private _hue = 0;
  private _saturation = 0;
  private _value = 0;
  private _hexDraft = '#607d8b';
  private _hexInvalid = false;
  /** An invalid commit may normalize the visible draft back to a valid value.
   * Keep the error latched until the user actually types a new valid HEX so a
   * repeated confirmation cannot mistake that normalization for a correction. */
  private _hexNeedsValidInput = false;
  private _lastValidColor = '#607d8b';
  private _activePointerId: number | null = null;

  static properties = {
    label: { type: String },
    triggerLabel: { type: String, attribute: 'trigger-label' },
    nativeTooltip: { type: Boolean, attribute: 'native-tooltip' },
    chromeTooltip: { type: Boolean, attribute: 'chrome-tooltip' },
    readout: { type: String },
    pointerHover: { type: Boolean, attribute: 'data-pointer-hover', reflect: true },
    opacityLabel: { type: String, attribute: 'opacity-label' },
    color: { type: String },
    opacity: { type: Number },
    mixedColor: { type: Boolean, attribute: false },
    mixedOpacity: { type: Boolean, attribute: false },
    mixedLabel: { type: String, attribute: false },
    alphaOnly: { type: Boolean, attribute: false },
    reportTouched: { type: Boolean, attribute: false },
    disabled: { type: Boolean, reflect: true },
    showOpacity: { type: Boolean, attribute: 'show-opacity' },
    // #600 Q5: компактная плашка набора рисует подпись сама; `label` при этом
    // остаётся источником title/aria триггера и заголовка панели.
    hideLabel: { type: Boolean, attribute: 'hide-label' },
    flatSwatch: { type: Boolean, attribute: 'flat-swatch' },
    compactSwatch: { type: Boolean, attribute: 'compact-swatch' },
    coverSwatch: { type: Boolean, attribute: 'cover-swatch' },
    allowNoFill: { type: Boolean, attribute: 'allow-no-fill' },
    noFill: { type: Boolean, attribute: 'no-fill' },
    noFillLabel: { type: String, attribute: 'no-fill-label' },
    pickerLabels: { attribute: false },
    _open: { state: true },
    _closing: { state: true },
    _restoredFocus: { state: true },
    _hue: { state: true },
    _saturation: { state: true },
    _value: { state: true },
    _hexDraft: { state: true },
    _hexInvalid: { state: true },
  };

  static styles = [css`
    :host {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }
    .label {
      font-size: var(--hp-color-label-size,12px);
      color: var(--hp-color-label-color,var(--secondary-text-color, #9aa4ad));
      font-weight:var(--hp-color-label-weight,inherit);
      line-height:var(--hp-color-label-line-height,inherit);
      white-space: nowrap;
    }
    .readout { font:inherit; color:var(--hp-color-readout-color,var(--primary-text-color)); line-height:var(--hp-color-readout-line-height,inherit); font-variant-numeric:tabular-nums; overflow-wrap:anywhere; }
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
    .trigger.solid { background: none; }
    :host([cover-swatch]), :host([compact-swatch]) { display: block; width: 100%; height: 100%; }
    :host([cover-swatch]) .trigger, :host([compact-swatch]) .trigger {
      width: 100%; height: 100%; padding: 0; border: 0; border-radius: 6px;
    }
    :host([cover-swatch]) .swatch, :host([compact-swatch]) .swatch { border-radius: 6px; box-shadow: none; }
    :host([compact-swatch]:not([cover-swatch])) .trigger,
    :host([compact-swatch]:not([cover-swatch])) .swatch { border-radius: 3px; }
    :host([compact-swatch]:not([cover-swatch])) .swatch { box-shadow: inset 0 0 0 1px #00000010; }
    :host([cover-swatch]) .trigger:focus-visible, :host([compact-swatch]) .trigger:focus-visible { outline-offset: -2px; }
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
    .trigger[data-restored-focus]:focus-visible {
      outline: none;
      box-shadow: none;
      border-color: var(--divider-color, #666);
    }
    .picker[inert] { pointer-events: none; }
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
    .row > .caption { flex: none; }
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
    input.hsv-range {
      appearance: none;
      -webkit-appearance: none;
      width: 100%;
      height: 32px;
      min-height: 32px;
      margin: -1px 0;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      cursor: pointer;
      outline: none;
      --hp-picker-thumb-shadow: 0 0 0 1px rgb(0 0 0 / .8), 0 1px 3px rgb(0 0 0 / .35);
    }
    .hue-range {
      --hp-picker-track: linear-gradient(to right,
        #f00 0%, #ff0 16.667%, #0f0 33.333%, #0ff 50%,
        #00f 66.667%, #f0f 83.333%, #f00 100%);
    }
    .hsv-range::-webkit-slider-runnable-track {
      height: 10px;
      box-sizing: border-box;
      border: 0;
      border-radius: 999px;
      background: var(--hp-picker-track);
      box-shadow: inset 0 0 0 1px rgb(0 0 0 / .28);
    }
    .hsv-range::-moz-range-track {
      height: 10px;
      box-sizing: border-box;
      border: 0;
      border-radius: 999px;
      background: var(--hp-picker-track);
      box-shadow: inset 0 0 0 1px rgb(0 0 0 / .28);
    }
    .hsv-range::-moz-range-progress {
      height: 10px;
      border: 0;
      border-radius: 999px;
      background: transparent;
    }
    .hsv-range::-webkit-slider-thumb {
      appearance: none;
      -webkit-appearance: none;
      box-sizing: border-box;
      width: 20px;
      height: 20px;
      margin-top: -5px;
      border: 2px solid #fff;
      border-radius: 50%;
      background: var(--hp-picker-color);
      box-shadow: var(--hp-picker-thumb-shadow);
      transition: box-shadow 120ms ease;
    }
    .hsv-range::-moz-range-thumb {
      box-sizing: border-box;
      width: 20px;
      height: 20px;
      border: 2px solid #fff;
      border-radius: 50%;
      background: var(--hp-picker-color);
      box-shadow: var(--hp-picker-thumb-shadow);
      transition: box-shadow 120ms ease;
    }
    :host([data-pointer-hover]) .hsv-range:hover, .hsv-range:focus-visible {
      outline: none;
      --hp-picker-thumb-shadow: 0 0 0 1px rgb(0 0 0 / .8), 0 0 0 4px color-mix(in srgb, var(--primary-color, #03a9f4) 42%, transparent);
    }
    :host([data-pointer-hover]) .hsv-range:active, .hsv-range:active {
      cursor: grabbing;
      --hp-picker-thumb-shadow: 0 0 0 1px rgb(0 0 0 / .8), 0 0 0 4px color-mix(in srgb, var(--primary-color, #03a9f4) 65%, transparent);
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
      /* Three digits, padding and the native stepper must fit together. */
      width: 5.5em;
      min-width: 5.5em;
      flex: none;
    }
    input:not(.hsv-range):focus-visible,
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
    .confirm {
      width: 100%;
      min-height: 40px;
      box-sizing: border-box;
      border: 1px solid var(--primary-color, #03a9f4);
      border-radius: 6px;
      padding: 8px 12px;
      color: var(--text-primary-color, #fff);
      background: var(--primary-color, #03a9f4);
      cursor: pointer;
      font: inherit;
      font-weight: 600;
    }
    .confirm:focus-visible {
      outline: 2px solid var(--primary-text-color, #fff);
      outline-offset: -4px;
    }
    :host([disabled]) {
      opacity: .5;
      pointer-events: none;
    }
    @media (prefers-reduced-motion: reduce) {
      .picker,.confirm { transition: none !important; }
      .hsv-range::-webkit-slider-thumb { transition: none; }
      .hsv-range::-moz-range-thumb { transition: none; }
    }
    @media (forced-colors: active) {
      .hsv-range::-webkit-slider-runnable-track {
        border: 1px solid ButtonText;
        background: Canvas;
      }
      .hsv-range::-moz-range-track {
        border: 1px solid ButtonText;
        background: Canvas;
      }
      .hsv-range::-webkit-slider-thumb {
        box-shadow: none;
        border-color: Canvas;
        outline: 1px solid CanvasText;
        forced-color-adjust: none;
        margin-top: -6px;
      }
      .hsv-range::-moz-range-thumb {
        box-shadow: none;
        border-color: Canvas;
        outline: 1px solid CanvasText;
        forced-color-adjust: none;
      }
      :host([data-pointer-hover]) .hsv-range:focus-visible, .hsv-range:focus-visible {
        outline: 2px solid Highlight;
        outline-offset: 1px;
      }
      .confirm {
        border-color: ButtonText;
        color: HighlightText;
        background: Highlight;
        forced-color-adjust: none;
      }
    }
  `, unsafeCSS(`.confirm { ${settingsActionTransition} } :host([data-pointer-hover]) .confirm:hover, .confirm:focus-visible { ${settingsPrimaryActionHover} }`)];

  connectedCallback(): void {
    super.connectedCallback();
    this._syncFromColor(this.color, false);
    this.ownerDocument.addEventListener('pointerdown', this._outsidePointerDown, true);
    this.ownerDocument.addEventListener('keydown', this._tabIntent, true);
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
    this.ownerDocument.removeEventListener('keydown', this._tabIntent, true);
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
    if (this.disabled && (this._open || this._closing)) {
      this._closePicker(false, 'disconnect');
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
      if (this.reportTouched && !this.prepareCompletion()) {
        event.preventDefault(); event.stopImmediatePropagation(); return;
      }
      this._closePicker(false, 'outside');
    }
  };

  private _keyDown = (event: KeyboardEvent): void => {
    if (!this._open || event.key !== 'Escape') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this._closePicker(this._floating.ownsActiveElement(), 'escape');
  };

  private _tabIntent = (event: KeyboardEvent): void => {
    if (event.key === 'Tab') this._restoredFocus = false;
  };

  private readonly _floating = new FloatingSurfaceController(this, 'color-opacity', this._keyDown);

  private async _toggle(): Promise<void> {
    if (this.disabled) return;
    if (this._open) {
      this._closePicker();
      return;
    }
    if (this._closing) this._finishPickerClose();
    this._forceFallback = false;
    const resumed = this.resumedHex; this.resumedHex = null;
    this._syncFromColor(this.color, false);
    this.touched = resumed?.touched ? { ...resumed.touched } : { color: false, opacity: false };
    this.opacityRaw = resumed?.opacityDraft?.raw ?? null;
    this.opacityInvalid = resumed?.opacityDraft?.invalid ?? false;
    this._hexInvalid = resumed?.needsValidInput ?? false;
    this._hexNeedsValidInput = resumed?.needsValidInput ?? false;
    if (resumed) this._hexDraft = resumed.raw;
    this._activePointerId = null;
    this._open = true;
    this.dispatchEvent(new CustomEvent('hp-color-opacity-open', { bubbles: true, composed: true }));
    await this.updateComplete;
    if (!this._open) return;
    if (!this._supportsPopover()) this._renderFallback();
    if (!this._positionPicker()) {
      this._closePicker();
      return;
    }
    this._animatePicker(false);
    this._overlayDispose = this._dialog()?.registerOverlay({
      owner: this,
      group: 'transient',
      close: (reason) => this._closePicker(
        reason === 'escape' && this._floating.ownsActiveElement(), reason,
      ),
    }) || null;
  }

  private _closePicker(refocus = false, reason: HpOverlayCloseReason = 'exclusive'): void {
    if (!this._open && !this._closing && !this._floating.hasFallback) return;
    const wasOpen = this._open;
    const dispose = this._overlayDispose;
    this._overlayDispose = null;
    dispose?.();
    this._open = false;
    this._cancelQueuedEmit();
    this._activePointerId = null;
    this._restoredFocus = true;
    if (wasOpen) this.dispatchEvent(new CustomEvent('hp-color-opacity-close', { bubbles: true, composed: true }));
    if (reason === 'disconnect' || !this.isConnected || this.disabled) this._finishPickerClose();
    else if (!this._closing) { this._closing = true; this._animatePicker(true); }
    if (refocus) {
      this.updateComplete.then(() => {
        if (!this._open && this.isConnected) this.renderRoot.querySelector<HTMLButtonElement>('.trigger')?.focus({ preventScroll: true });
      });
    }
  }

  private _finishPickerClose(): void {
    this._motionEpoch++;
    this._motion?.cancel(); this._motion = null;
    const popup = this._surface() as (HTMLElement & { hidePopover?: () => void }) | null;
    if (popup?.hidePopover) {
      try {
        if (popup.matches(':popover-open')) popup.hidePopover();
      } catch {
        /* older engines simply remove the fallback surface on the next render */
      }
    }
    this._floating.destroy();
    this._closing = false;
  }

  private _animatePicker(closing: boolean): void {
    const popup = this._surface(), win = this._window();
    const epoch = ++this._motionEpoch;
    const current = popup && win?.getComputedStyle(popup);
    const opacity = current?.opacity || '1', transform = current?.transform || 'none';
    this._motion?.cancel(); this._motion = null;
    if (!popup || !win || win.matchMedia('(prefers-reduced-motion: reduce)').matches || !popup.animate) {
      if (closing) this._finishPickerClose();
      return;
    }
    popup.inert = closing;
    const offset = popup.dataset.side === 'top' ? 'translateY(4px)' : 'translateY(-4px)';
    const motion = popup.animate(closing
      ? [{ opacity, transform }, { opacity: 0, transform: offset }]
      : [{ opacity: 0, transform: offset }, { opacity: 1, transform: 'none' }],
    { duration: closing ? 120 : 160, easing: closing ? 'ease-in' : 'cubic-bezier(.2,.7,.2,1)', fill: 'both' });
    this._motion = motion;
    void motion.finished.then(() => {
      if (epoch !== this._motionEpoch) return;
      if (closing) this._finishPickerClose();
      else { motion.cancel(); this._motion = null; }
    }, () => { /* Retired by reopen, detach or a replacement animation. */ });
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
    const styleText = HpColorOpacity.styles.map(style => style.cssText).join('\n');
    const root = this._floating.renderFallback(this._pickerTemplate(false), styleText);
    root?.host.toggleAttribute('data-pointer-hover', this.pointerHover);
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
      confirm: labels.confirm || DEFAULT_LABELS.confirm,
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
    this._hexNeedsValidInput = false;
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
    this.touched.color = true;
    if (this.reportTouched) this._hexNeedsValidInput = false;
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
    this.touched.opacity = true;
    this.opacityRaw = String(Math.round(value * 100)); this.opacityInvalid = false;
    this._emit(this._lastValidColor, value, this.reportTouched);
  }

  private _opacityInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    if (!this.reportTouched) { this._setOpacity(Number(raw) / 100); return; }
    this.touched.opacity = true; this.opacityRaw = raw;
    const value = Number(raw);
    this.opacityInvalid = !raw.trim() || !Number.isFinite(value) || value < 0 || value > 100;
    if (!this.opacityInvalid) this._emit(this._lastValidColor, value / 100, true);
    this.requestUpdate();
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
    this.touched.color = true;
    const value = (event.target as HTMLInputElement).value;
    this._hexDraft = value;
    const normalized = normalizeHexColor(value);
    const rgb = normalized ? hexToRgb(normalized) : null;
    if (!normalized || !rgb) {
      this._hexInvalid = this.reportTouched || this._hexNeedsValidInput;
      return;
    }
    this._hexNeedsValidInput = false;
    this._hexInvalid = false;
    const hsv = rgbToHsv(rgb);
    if (hsv.s > 0.0001) this._hue = hsv.h;
    this._saturation = hsv.s;
    this._value = hsv.v;
    this._emit(normalized, this.opacity, true);
  }

  private _commitHex(): void {
    const normalized = normalizeHexColor(this._hexDraft);
    if (!normalized) {
      if (!this.reportTouched) this._hexDraft = this._lastValidColor;
      this._hexInvalid = true;
      this._hexNeedsValidInput = true;
      return;
    }
    this._hexDraft = normalized;
    if (this._hexNeedsValidInput) {
      this._hexInvalid = true;
      return;
    }
    this._hexInvalid = false;
    if (normalized !== this._lastValidColor) this._emit(normalized, this.opacity);
  }

  private _confirm(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.prepareCompletion()) return;
    this.dispatchEvent(new CustomEvent('hp-color-opacity-commit', {
      detail: { color: this.color, opacity: this.opacity, ...(this.allowNoFill ? { noFill: this.noFill } : {}),
        ...(this.reportTouched ? { touched: { ...this.touched } } : {}) }, bubbles: true, composed: true,
    }));
    this._closePicker(true);
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
    this._hexInvalid = this._hexNeedsValidInput || this.reportTouched && this.touched.color && !normalizeHexColor(this._hexDraft);
    // An invalid raw alpha belongs to this compound draft; another control may
    // change its local colour, but cannot publish a stale/seed alpha meanwhile.
    if (this.reportTouched && (this.opacityInvalid || this._hexInvalid)) return;
    this.dispatchEvent(new CustomEvent('hp-color-opacity-change', {
      detail: { color: normalized, opacity: clamped, ...(this.allowNoFill ? { noFill: this.noFill } : {}),
        ...(this.reportTouched ? { touched: { ...this.touched } } : {}) },
      bubbles: true,
      composed: true,
    }));
  }

  private _pickerTemplate(usePopover: boolean): TemplateResult {
    const pct = Math.round(Math.min(1, Math.max(0, Number(this.opacity) || 0)) * 100);
    const color = hsvToHex({ h: this._hue, s: this._saturation, v: this._value });
    const hueColor = hsvToHex({ h: this._hue, s: 100, v: 100 });
    const saturationStart = hsvToHex({ h: this._hue, s: 0, v: this._value });
    const saturationEnd = hsvToHex({ h: this._hue, s: 100, v: this._value });
    const valueEnd = hsvToHex({ h: this._hue, s: this._saturation, v: 100 });
    const labels = this._labels();
    const hue = Math.round(this._hue);
    const saturation = Math.round(this._saturation);
    const value = Math.round(this._value);
    return html`
      <div class="picker" popover=${usePopover ? 'manual' : nothing} role="dialog" aria-label=${labels.title}>
        <div class="picker-head">
          <span class="caption">${this.label || labels.title}</span>
          ${this.alphaOnly || this.mixedColor && !this.touched.color ? html`<span class="caption">${this.alphaOnly ? this.opacityLabel : this.mixedLabel}</span>`
            : html`<span class="preview" aria-hidden="true"><span style=${`background:${color};opacity:${pct / 100}`}></span></span>`}
        </div>
        ${this.alphaOnly ? nothing : html`<div class="sv-field" aria-hidden="true" data-hp="field" data-field="colour-sv"
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
          <input data-hp="field" data-field="colour-hue" class="hsv-range hue-range" type="range" min="0" max="359" step="1" .value=${String(hue)}
            aria-label=${labels.hue} aria-valuetext=${`${hue}°`}
            style=${`--hp-picker-color:${color}`}
            @input=${(e: Event) => this._setHue(Number((e.target as HTMLInputElement).value))}
            @keydown=${(e: KeyboardEvent) => this._shiftRangeKey(e, hue, 0, 359, (next) => this._setHue(next))} />
        </label>
        <label class="control">
          <span class="control-head"><span class="caption">${labels.saturation}</span><span class="control-value">${saturation}%</span></span>
          <input data-hp="field" data-field="colour-saturation" class="hsv-range" type="range" min="0" max="100" step="1" .value=${String(saturation)}
            aria-label=${labels.saturation} aria-valuetext=${`${saturation}%`}
            style=${`--hp-picker-track:linear-gradient(to right,${saturationStart},${saturationEnd});--hp-picker-color:${color}`}
            @input=${(e: Event) => this._setSaturation(Number((e.target as HTMLInputElement).value))}
            @keydown=${(e: KeyboardEvent) => this._shiftRangeKey(e, saturation, 0, 100, (next) => this._setSaturation(next))} />
        </label>
        <label class="control">
          <span class="control-head"><span class="caption">${labels.value}</span><span class="control-value">${value}%</span></span>
          <input data-hp="field" data-field="colour-brightness" class="hsv-range" type="range" min="0" max="100" step="1" .value=${String(value)}
            aria-label=${labels.value} aria-valuetext=${`${value}%`}
            style=${`--hp-picker-track:linear-gradient(to right,#000,${valueEnd});--hp-picker-color:${color}`}
            @input=${(e: Event) => this._setValue(Number((e.target as HTMLInputElement).value))}
            @keydown=${(e: KeyboardEvent) => this._shiftRangeKey(e, value, 0, 100, (next) => this._setValue(next))} />
        </label>
        <label class="control">
          <span class="caption">${labels.hex}</span>
          <input data-hp="field" data-field="colour-hex" type="text" inputmode="text" autocomplete="off" spellcheck="false"
            .value=${this.mixedColor && !this.touched.color ? '' : this._hexDraft} placeholder=${this.mixedLabel} aria-label=${labels.hex}
            aria-invalid=${this._hexInvalid ? 'true' : 'false'}
            aria-describedby=${this._hexInvalid ? 'hex-error' : nothing}
            @input=${(e: Event) => this._hexInput(e)}
            @blur=${() => { if (!this.reportTouched || this.touched.color) this._commitHex(); }}
            @keydown=${(e: KeyboardEvent) => this._hexKeyDown(e)} />
          ${this._hexInvalid ? html`<span id="hex-error" class="error">${labels.invalidHex}</span>` : nothing}
        </label>`}
        ${this.showOpacity ? html`<div class="row">
          <span class="caption">${this.opacityLabel}</span>
          <input data-hp="field" data-field="colour-opacity" data-value="range" type="range" min="0" max="100" step="1" .value=${String(pct)}
            aria-label=${this.opacityLabel} aria-valuetext=${this.mixedOpacity && !this.touched.opacity ? this.mixedLabel : `${pct}%`}
            @input=${(e: Event) => this._setOpacity(Number((e.target as HTMLInputElement).value) / 100)}
            @keydown=${(e: KeyboardEvent) => this._shiftRangeKey(e, pct, 0, 100, (next) => this._setOpacity(next / 100))} />
          <input data-hp="field" data-field="colour-opacity" data-value="number" type="number" min="0" max="100" step="1" .value=${this.reportTouched && this.opacityRaw !== null ? this.opacityRaw : this.mixedOpacity && !this.touched.opacity ? '' : String(pct)} placeholder=${this.mixedLabel}
            aria-label=${`${this.opacityLabel}, %`} aria-invalid=${String(this.opacityInvalid)}
            @input=${(e: Event) => { if (this.reportTouched) this._opacityInput(e); }}
            @change=${(e: Event) => this._opacityInput(e)} />
          <span class="pct">%</span>
        </div>` : nothing}
        ${this.allowNoFill ? html`<label class="row"><input data-hp="field" data-field="colour-none" type="checkbox" .checked=${this.noFill}
          @change=${(e: Event) => { this.noFill = (e.target as HTMLInputElement).checked; this._emit(this.color, this.opacity); }} />${this.noFillLabel}</label>` : nothing}
        <button class="confirm" type="button" data-hp="action" data-action="colour-confirm" @click=${(e: Event) => this._confirm(e)}>${labels.confirm}</button>
      </div>`;
  }

  /**
   * Solid plate (#600/#605): flat-swatch without cover-swatch paints the colour
   * opaque with no checkerboard. Colour tiles (cover-swatch) keep the alpha
   * checkerboard (#615). One condition for both the background and the opacity.
   */
  private get _solidSwatch(): boolean {
    return this.flatSwatch && !this.coverSwatch;
  }

  render() {
    const pct = Math.round(Math.min(1, Math.max(0, Number(this.opacity) || 0)) * 100);
    const solid = this._solidSwatch;
    const color = safeStoredColor(this.color, '#607d8b');
    const title = this.alphaOnly ? `${this.opacityLabel}: ${this.mixedOpacity ? this.mixedLabel : pct + '%'}` : this.mixedColor ? this.mixedLabel : this.showOpacity
      ? `${this.label || 'Color'}: ${color}, ${pct}%`
      : `${this.label || 'Color'}: ${color}`;
    return html`
      ${this.label && !this.hideLabel ? html`<span class="label">${this.label}</span>` : nothing}
      <button data-hp="field" data-field="colour-open" class=${solid ? 'trigger solid' : 'trigger'} type="button" .disabled=${this.disabled}
        ?data-restored-focus=${this._restoredFocus}
        aria-label=${this.triggerLabel || title} aria-haspopup="dialog" aria-expanded=${this._open ? 'true' : 'false'}
        data-hp-tooltip=${this.chromeTooltip ? title : nothing}
        title=${this.nativeTooltip && !this.chromeTooltip ? title : nothing} @click=${this._toggle}>
        <span class="swatch" style=${this.alphaOnly ? 'background:currentColor;opacity:.3' : this.mixedColor ? 'background:repeating-linear-gradient(135deg,#aaa 0 3px,#fff 3px 6px)' : this.allowNoFill && this.noFill
          ? 'background:linear-gradient(135deg,transparent 45%,currentColor 46%,currentColor 53%,transparent 54%)'
          : `background:${color};opacity:${solid ? 1 : this.showOpacity ? pct / 100 : 1}`}></span>
      </button>
      ${this.readout ? html`<span class="readout" aria-live="polite">${this.readout}</span>` : nothing}
      ${(this._open || this._closing) && !this.disabled && this._supportsPopover() ? this._pickerTemplate(true) : nothing}
    `;
  }
}

if (!customElements.get('hp-color-opacity')) customElements.define('hp-color-opacity', HpColorOpacity);

declare global {
  interface HTMLElementTagNameMap { 'hp-color-opacity': HpColorOpacity; }
}
