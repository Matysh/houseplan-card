import { LitElement, css, html, nothing } from 'lit';
import { safeStoredColor } from './color';

/**
 * Compact colour + opacity picker used by decor defaults and object dialogs.
 *
 * Only the swatch lives in the parent toolbar/form. The alpha controls are in
 * the picker itself, so every consumer gets the same compact layout without
 * relying on the still-inconsistent native `input[type=color][alpha]` support.
 */
export class HpColorOpacity extends LitElement {
  public label = '';
  public opacityLabel = 'Opacity';
  public color = '#607d8b';
  public opacity = 1;
  public disabled = false;

  private _open = false;
  private _pickerRaf = 0;

  static properties = {
    label: { type: String },
    opacityLabel: { type: String, attribute: 'opacity-label' },
    color: { type: String },
    opacity: { type: Number },
    disabled: { type: Boolean, reflect: true },
    _open: { state: true },
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
      width: 34px;
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
      cursor: pointer;
    }
    .trigger:hover,
    .trigger:focus-visible,
    .trigger[aria-expanded='true'] {
      border-color: var(--primary-color, #03a9f4);
      outline: none;
      box-shadow: 0 0 0 1px var(--primary-color, #03a9f4);
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
      width: min(226px, calc(100vw - 16px));
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
    .row {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
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
    input[type='color'] {
      width: 76px;
      height: 34px;
      flex: none;
      padding: 2px;
      border: 1px solid var(--divider-color, #666);
      border-radius: 7px;
      background: transparent;
      cursor: pointer;
    }
    input[type='range'] {
      width: auto;
      min-width: 0;
      flex: 1;
      accent-color: var(--primary-color, #03a9f4);
    }
    input[type='number'] {
      width: 50px;
      flex: none;
      box-sizing: border-box;
      border: 1px solid var(--divider-color, #666);
      border-radius: 6px;
      padding: 4px 5px;
      color: var(--primary-text-color, #fff);
      background: var(--input-fill-color, transparent);
      font: inherit;
    }
    .pct {
      color: var(--secondary-text-color, #9aa4ad);
      font-size: 12px;
    }
    :host([disabled]) {
      opacity: .5;
      pointer-events: none;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('pointerdown', this._outsidePointerDown, true);
    document.addEventListener('scroll', this._queuePickerPosition, true);
    window.addEventListener('resize', this._queuePickerPosition);
    this.addEventListener('keydown', this._keyDown, true);
  }

  disconnectedCallback(): void {
    document.removeEventListener('pointerdown', this._outsidePointerDown, true);
    document.removeEventListener('scroll', this._queuePickerPosition, true);
    window.removeEventListener('resize', this._queuePickerPosition);
    this.removeEventListener('keydown', this._keyDown, true);
    if (this._pickerRaf) cancelAnimationFrame(this._pickerRaf);
    this._pickerRaf = 0;
    super.disconnectedCallback();
  }

  private _outsidePointerDown = (event: PointerEvent): void => {
    if (this._open && !event.composedPath().includes(this)) this._closePicker();
  };

  private _keyDown = (event: KeyboardEvent): void => {
    if (!this._open || event.key !== 'Escape') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this._closePicker(true);
  };

  private _toggle(): void {
    if (this.disabled) return;
    if (this._open) {
      this._closePicker();
      return;
    }
    this._open = true;
    this.updateComplete.then(() => this._positionPicker());
  }

  private _closePicker(refocus = false): void {
    const popup = this.renderRoot.querySelector<HTMLElement>('.picker') as any;
    if (popup?.hidePopover) {
      try {
        if (popup.matches(':popover-open')) popup.hidePopover();
      } catch {
        /* older engines simply remove the fallback surface on the next render */
      }
    }
    this._open = false;
    if (refocus) {
      this.updateComplete.then(() => this.renderRoot.querySelector<HTMLButtonElement>('.trigger')?.focus());
    }
  }

  private _queuePickerPosition = (): void => {
    if (!this._open) return;
    if (this._pickerRaf) cancelAnimationFrame(this._pickerRaf);
    this._pickerRaf = requestAnimationFrame(() => {
      this._pickerRaf = 0;
      this._positionPicker();
    });
  };

  private _positionPicker(): void {
    if (!this._open) return;
    const trigger = this.renderRoot.querySelector<HTMLElement>('.trigger');
    const popup = this.renderRoot.querySelector<HTMLElement>('.picker') as any;
    if (!trigger || !popup) return;
    popup.style.visibility = 'hidden';
    if (popup.showPopover) {
      try {
        if (!popup.matches(':popover-open')) popup.showPopover();
      } catch {
        /* fixed-position fallback remains usable without the Popover API */
      }
    }
    const anchor = trigger.getBoundingClientRect();
    const box = popup.getBoundingClientRect();
    const gap = 7;
    const edge = 8;
    const maxLeft = Math.max(edge, window.innerWidth - box.width - edge);
    let left = anchor.left;
    if (left + box.width > window.innerWidth - edge) left = anchor.right - box.width;
    left = Math.min(maxLeft, Math.max(edge, left));
    const below = anchor.bottom + gap;
    const above = anchor.top - gap - box.height;
    let top = below;
    if (below + box.height > window.innerHeight - edge && above >= edge) top = above;
    else top = Math.min(Math.max(edge, top), Math.max(edge, window.innerHeight - box.height - edge));
    popup.style.left = `${Math.round(left)}px`;
    popup.style.top = `${Math.round(top)}px`;
    popup.style.visibility = '';
  }

  private _emit(color: string, opacity: number): void {
    const value = Number.isFinite(opacity) ? opacity : Number(this.opacity) || 0;
    const clamped = Math.min(1, Math.max(0, value));
    // Keep the open picker responsive even before its parent has completed the
    // reactive round-trip and passed the new pair back as properties.
    this.color = color;
    this.opacity = clamped;
    this.dispatchEvent(new CustomEvent('hp-color-opacity-change', {
      detail: { color, opacity: clamped },
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    const pct = Math.round(Math.min(1, Math.max(0, Number(this.opacity) || 0)) * 100);
    const color = safeStoredColor(this.color, '#607d8b');
    const title = `${this.label || 'Color'}: ${color}, ${pct}%`;
    return html`
      ${this.label ? html`<span class="label">${this.label}</span>` : nothing}
      <button class="trigger" type="button" .disabled=${this.disabled}
        aria-label=${title} aria-haspopup="dialog" aria-expanded=${this._open ? 'true' : 'false'}
        title=${title} @click=${this._toggle}>
        <span class="swatch" style=${`background:${color};opacity:${pct / 100}`}></span>
      </button>
      ${this._open && !this.disabled ? html`
        <div class="picker" popover="manual" role="dialog" aria-label=${this.label || 'Color'}>
          <div class="row">
            <span class="caption">${this.label || 'Color'}</span>
            <input type="color" .value=${color} aria-label=${this.label || 'Color'}
              @input=${(e: Event) => this._emit((e.target as HTMLInputElement).value, this.opacity)} />
          </div>
          <div class="row">
            <span class="caption">${this.opacityLabel}</span>
            <input type="range" min="0" max="100" step="1" .value=${String(pct)}
              aria-label=${this.opacityLabel}
              @input=${(e: Event) => this._emit(color, Number((e.target as HTMLInputElement).value) / 100)} />
            <input type="number" min="0" max="100" step="1" .value=${String(pct)}
              aria-label=${`${this.opacityLabel}, %`}
              @change=${(e: Event) => this._emit(color, Number((e.target as HTMLInputElement).value) / 100)} />
            <span class="pct">%</span>
          </div>
        </div>` : nothing}
    `;
  }
}

if (!customElements.get('hp-color-opacity')) customElements.define('hp-color-opacity', HpColorOpacity);

declare global {
  interface HTMLElementTagNameMap { 'hp-color-opacity': HpColorOpacity; }
}
