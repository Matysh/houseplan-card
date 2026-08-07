import { LitElement, css, html } from 'lit';

/** Shared colour + opacity field used by decor defaults and object dialogs. */
export class HpColorOpacity extends LitElement {
  public label = '';
  public color = '#607d8b';
  public opacity = 1;
  public disabled = false;

  static properties = {
    label: { type: String },
    color: { type: String },
    opacity: { type: Number },
    disabled: { type: Boolean, reflect: true },
  };

  static styles = css`
    :host { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
    label { display: inline-flex; align-items: center; gap: 6px; min-width: 0; }
    .label { font-size: 12px; color: var(--secondary-text-color, #9aa4ad); white-space: nowrap; }
    input[type="color"] { width: 30px; height: 28px; padding: 0; border: 0; background: none; cursor: pointer; }
    input[type="range"] { width: 78px; min-width: 48px; accent-color: var(--primary-color, #03a9f4); }
    input[type="number"] {
      width: 48px; box-sizing: border-box; border-radius: 6px; padding: 4px 5px;
      color: var(--primary-text-color, #fff); background: var(--input-fill-color, transparent);
      border: 1px solid var(--divider-color, #666); font: inherit;
    }
    .pct { font-size: 12px; color: var(--secondary-text-color, #9aa4ad); }
    :host([disabled]) { opacity: .5; pointer-events: none; }
  `;

  private _emit(color: string, opacity: number): void {
    const value = Number.isFinite(opacity) ? opacity : Number(this.opacity) || 0;
    this.dispatchEvent(new CustomEvent('hp-color-opacity-change', {
      detail: { color, opacity: Math.min(1, Math.max(0, value)) },
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    const pct = Math.round(Math.min(1, Math.max(0, Number(this.opacity) || 0)) * 100);
    return html`<label>
      ${this.label ? html`<span class="label">${this.label}</span>` : ''}
      <input type="color" .value=${this.color} .disabled=${this.disabled}
        aria-label=${this.label || 'Color'}
        @input=${(e: Event) => this._emit((e.target as HTMLInputElement).value, pct / 100)} />
      <input type="range" min="0" max="100" step="1" .value=${String(pct)} .disabled=${this.disabled}
        aria-label=${`${this.label || 'Color'} opacity`}
        @input=${(e: Event) => this._emit(this.color, Number((e.target as HTMLInputElement).value) / 100)} />
      <input type="number" min="0" max="100" step="1" .value=${String(pct)} .disabled=${this.disabled}
        aria-label=${`${this.label || 'Color'} opacity percent`}
        @change=${(e: Event) => this._emit(this.color, Number((e.target as HTMLInputElement).value) / 100)} />
      <span class="pct">%</span>
    </label>`;
  }
}

if (!customElements.get('hp-color-opacity')) customElements.define('hp-color-opacity', HpColorOpacity);

declare global {
  interface HTMLElementTagNameMap { 'hp-color-opacity': HpColorOpacity; }
}
