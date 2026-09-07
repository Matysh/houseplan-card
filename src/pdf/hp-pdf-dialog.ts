import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import '../hp-dialog';
import type { ServerConfig, SpaceModel } from '../types';
import type { PdfExportOptions, PdfRawSpace, PdfSharedWallGeometry } from './pdf-scene';

export interface PdfAssetReference { url: string; mime: string; }
export interface PdfDialogHass { localize?: (key: string) => string | undefined; }

export interface PdfDialogContext {
  config: ServerConfig;
  rawSpace: PdfRawSpace;
  space: SpaceModel;
  layout: Record<string, { s?: string; x: number; y: number } | undefined>;
  imperial: boolean;
  cardTitle: string;
  version: string;
  hass: PdfDialogHass;
  backdropUrl: string;
  decorAssets: ReadonlyMap<string, PdfAssetReference>;
  sharedWallGeometry?: PdfSharedWallGeometry | null;
  resolveInnerContour?: (roomId: string) => number[][] | null | undefined;
  t: (key: string, vars?: Record<string, string | number>) => string;
  toast: (message: string) => void;
  close: () => void;
  save: (options: PdfExportOptions) => Promise<void>;
  /** Deterministic harness seam; production leaves this unset. */
  now?: Date;
}

const STORAGE_KEY = 'hp.pdf.options';
const defaults = (): PdfExportOptions => ({
  dimensions: true, roomNames: true, decor: false, backdrop: true,
});

function loadOptions(): PdfExportOptions {
  const fallback = defaults();
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return value?.v === 1 ? {
      dimensions: value.dimensions !== false,
      roomNames: value.roomNames !== false,
      decor: value.decor === true,
      // Preserve this preference while visiting a space without a backdrop:
      // the hidden checkbox must not silently turn it off for the next space.
      backdrop: value.backdrop !== false,
    } : fallback;
  } catch { return fallback; }
}

export class HpPdfDialog extends LitElement {
  static properties = { context: { attribute: false } };
  static styles = css`
    :host { display: contents; }
    .body { display:grid; gap:12px; padding:16px 20px; min-width:min(310px,82vw); }
    label { display:flex; min-height:44px; align-items:center; gap:12px; cursor:pointer; }
    input { width:20px; height:20px; accent-color:var(--hp-accent,#d89300); }
    .row { display:flex; align-items:center; gap:8px; padding:12px 16px; width:100%; box-sizing:border-box; }
    .spacer { flex:1; }
    button { min-height:44px; border:1px solid var(--hp-line,rgb(127 127 127/.3)); border-radius:12px;
      padding:0 18px; background:transparent; color:inherit; font:inherit; cursor:pointer; }
    button.primary { background:var(--hp-accent,#d89300); color:var(--hp-on-accent,#111); border-color:transparent; }
    button:disabled { opacity:.55; cursor:default; }
    ha-icon { margin-right:6px; }
  `;
  context!: PdfDialogContext;
  private options: PdfExportOptions | null = null;
  private busy = false;

  protected willUpdate(): void {
    if (!this.options && this.context?.space) this.options = loadOptions();
  }

  private setOption(key: keyof PdfExportOptions, value: boolean): void {
    this.options = { ...(this.options || defaults()), [key]: value };
    this.requestUpdate();
  }

  private async save(): Promise<void> {
    if (this.busy || !this.options) return;
    this.busy = true;
    this.requestUpdate();
    try {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, ...this.options })); } catch { /* optional */ }
      await this.context.save(this.options);
      this.context.close();
    } catch (error) {
      const code = error instanceof Error ? error.message : 'pdf.failed';
      const key = code === 'pdf.too_large' || code === 'pdf.asset_failed' ? code : 'pdf.failed';
      this.context.toast(this.context.t(key));
    } finally {
      this.busy = false;
      this.requestUpdate();
    }
  }

  protected render(): TemplateResult | typeof nothing {
    if (!this.context?.space) return nothing;
    const o = this.options || defaults();
    const option = (key: keyof PdfExportOptions, label: string) => html`<label>
      <input type="checkbox" .checked=${o[key]} ?disabled=${this.busy}
        @change=${(event: Event) => this.setOption(key, (event.target as HTMLInputElement).checked)}>
      <span>${label}</span>
    </label>`;
    return html`<hp-dialog .hass=${this.context.hass} title=${this.context.t('pdf.title')}
      icon="mdi:printer-outline" dismiss-on-scrim @hp-close=${this.context.close}>
      <div class="body">
        ${option('dimensions', this.context.t('pdf.dimensions'))}
        ${option('decor', this.context.t('pdf.decor'))}
        ${option('roomNames', this.context.t('pdf.room_names'))}
        ${this.context.space.bg ? option('backdrop', this.context.t('pdf.backdrop')) : nothing}
      </div>
      <div class="row" slot="footer">
        <button ?disabled=${this.busy} @click=${this.context.close}>${this.context.t('btn.cancel')}</button>
        <span class="spacer"></span>
        <button class="primary" ?disabled=${this.busy} @click=${() => void this.save()}>
          <ha-icon icon=${this.busy ? 'mdi:progress-clock' : 'mdi:download'}></ha-icon>
          ${this.context.t(this.busy ? 'pdf.saving' : 'pdf.save')}
        </button>
      </div>
    </hp-dialog>`;
  }
}

if (!customElements.get('hp-pdf-dialog')) customElements.define('hp-pdf-dialog', HpPdfDialog);
