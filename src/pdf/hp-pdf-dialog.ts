import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { ensureCompactDialogStyles } from '../compact-dialog-styles';
import { controlMotion } from '../ui-motion';
import { ensureFormKitStyles } from '../form-kit-styles';
import { PointerModalityController } from '../pointer-modality';
import '../hp-dialog';
import type { HpDialog } from '../hp-dialog';
import type { ServerConfig, SpaceModel } from '../types';
import type { PdfExportOptions, PdfRawSpace, PdfSharedWallGeometry } from './pdf-scene';
import { selectControl } from '../settings-select-control';
import '../hp-settings-select';
import '../hp-color-opacity';
import type { HpColorOpacity } from '../hp-color-opacity';
import { svgDefaults, type ExportRequest, type SvgExportOptions } from './export-options';
import type { SvgViewSource } from './svg-snapshot';
import { normalizeHexColor } from '../color-picker';
import type { PlanRotation } from '../view-frame';

export interface PdfAssetReference { url: string; mime: string; }
export interface PdfDialogHass { localize?: (key: string) => string | undefined; }

export interface PdfDialogContext {
  rotation?: PlanRotation;
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
  resolveRoomArea?: (roomId: string, contour: number[][]) => number | undefined;
  t: (key: string, vars?: Record<string, string | number>) => string;
  toast: (message: string, id?: string) => void;
  close: () => void;
  save: (request: ExportRequest) => Promise<void>;
  svgSource?: () => SvgViewSource;
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
  static styles = css`:host { display:contents; }`;
  context!: PdfDialogContext;
  private options: PdfExportOptions | null = null;
  private format: 'pdf' | 'svg' = 'pdf';
  private svgOptions = svgDefaults();
  private busy = false;
  private fade: Animation | null = null;
  private invalidHex: string | null = null;
  private readonly pointer = new PointerModalityController(this, enabled => {
    this.renderRoot?.querySelector('hp-dialog')?.toggleAttribute('data-pointer-hover', enabled);
  });
  private readonly notePointer = (event: PointerEvent): void => { this.pointer.note(event); };

  connectedCallback(): void {
    super.connectedCallback();
    ensureFormKitStyles(this);
    ensureCompactDialogStyles(this);
    this.pointer.connect(this.ownerDocument.defaultView);
    for (const type of ['pointerover', 'pointerdown', 'pointermove'] as const)
      this.addEventListener(type, this.notePointer, true);
  }

  private setFormat(value: 'pdf' | 'svg'): void {
    if (this.busy || this.format === value) return;
    this.format = value;
    this.requestUpdate();
    void this.updateComplete.then(() => {
      this.fade?.cancel();
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.fade = this.renderRoot.querySelector('.first-option')?.animate(
          [{ opacity: 0 }, { opacity: 1 }], { duration: controlMotion.appear.duration, easing: controlMotion.appear.easing },
        ) || null;
      }
    });
  }

  disconnectedCallback(): void {
    for (const type of ['pointerover', 'pointerdown', 'pointermove'] as const)
      this.removeEventListener(type, this.notePointer, true);
    this.pointer.disconnect();
    super.disconnectedCallback(); this.fade?.cancel();
  }

  private setSvg<K extends keyof SvgExportOptions>(key: K, value: SvgExportOptions[K]): void {
    if (this.busy) return;
    if (key === 'background' && value !== 'custom') this.invalidHex = null;
    this.svgOptions = { ...this.svgOptions, [key]: value };
    this.requestUpdate();
  }

  protected willUpdate(): void {
    if (!this.options && this.context?.space) this.options = loadOptions();
  }

  private setOption(key: keyof PdfExportOptions, value: boolean): void {
    this.options = { ...(this.options || defaults()), [key]: value };
    this.requestUpdate();
  }

  private async save(): Promise<void> {
    if (this.busy || !this.options) return;
    if (this.format === 'svg' && this.svgOptions.background === 'custom'
      && this.renderRoot.querySelector<HpColorOpacity>('hp-color-opacity')?.prepareCompletion() === false) return;
    this.busy = true;
    this.requestUpdate();
    try {
      const request: ExportRequest = this.format === 'pdf'
        ? { format: 'pdf', options: { ...this.options } }
        : { format: 'svg', options: { ...this.svgOptions } };
      if (this.format === 'pdf') {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, ...this.options })); } catch { /* optional */ }
      }
      await this.context.save(request);
      this.context.close();
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      const allowed = ['pdf.too_large', 'pdf.asset_failed', 'svg.too_large', 'svg.asset_failed', 'svg.view_required', 'svg.cancelled', 'svg.not_ready'];
      const key = allowed.includes(code) ? code : this.format === 'svg' ? 'svg.failed' : 'pdf.failed';
      this.context.toast(this.context.t(key), key);
    } finally {
      this.busy = false;
      this.requestUpdate();
    }
  }

  protected render(): TemplateResult | typeof nothing {
    if (!this.context?.space) return nothing;
    const t = this.context.t;
    const isSvg = this.format === 'svg';
    const o = isSvg ? this.svgOptions : this.options || defaults();
    const firstKey = isSvg ? 'devices' : 'dimensions';
    const option = (key: keyof PdfExportOptions | 'devices', label: string, checked: boolean, first = false) => html`<label class=${`hpf-toggle hpf-noicon hpf-compact${first ? ' first-option' : ''}`}>
      <input data-hp="field" data-field=${`${isSvg ? 'svg' : 'pdf'}-${key}`} type="checkbox" .checked=${checked} ?disabled=${this.busy}
        @change=${(event: Event) => {
          const value = (event.target as HTMLInputElement).checked;
          if (isSvg && key !== 'dimensions') this.setSvg(key, value);
          else if (key !== 'devices') this.setOption(key, value);
        }}>
      <span class="hpf-toggle-title">${label}</span>
    </label>`;
    return html`<hp-dialog class="ui-dialog hpf-stack-actions" .hass=${this.context.hass} form-shell settings-layout compact wide data-kind="pdf"
      title=${this.context.t('pdf.title')}
      icon="mdi:printer-outline" dismiss-on-scrim @hp-close=${(event: Event) => {
        if (this.busy) (event.currentTarget as HpDialog).rejectClose();
        else this.context.close();
      }}>
      <div class="body hpf-form">
        <div class="hpf-field"><label class="hpf-label" for="export-format">${t('export.format')}</label>
          ${selectControl({ name: 'export-format', value: this.format, disabled: this.busy,
            ariaLabel: t('export.format'), options: [{ value: 'pdf', label: t('export.pdf') }, { value: 'svg', label: t('export.svg') }],
            onChange: value => this.setFormat(value) })}
        </div>
        ${option(firstKey, t(isSvg ? 'export.devices' : 'pdf.dimensions'), isSvg ? this.svgOptions.devices : (this.options || defaults()).dimensions, true)}
        ${option('decor', t('pdf.decor'), o.decor)}
        ${option('roomNames', t('pdf.room_names'), o.roomNames)}
        ${this.context.space.bg ? option('backdrop', t('pdf.backdrop'), o.backdrop) : nothing}
        ${isSvg ? html`<div class="hpf-field"><label class="hpf-label" for="export-background">${t('export.background')}</label>
          ${selectControl({ name: 'export-background', value: this.svgOptions.background, disabled: this.busy,
            ariaLabel: t('export.background'), options: [
              { value: 'transparent', label: t('export.transparent') }, { value: 'current', label: t('export.current') },
              { value: 'custom', label: t('export.custom') }], onChange: value => this.setSvg('background', value) })}
          ${this.svgOptions.background === 'custom' ? html`<hp-color-opacity data-hp="field" data-field="export-color"
            .label=${t('export.custom')} .color=${this.svgOptions.color} .opacity=${this.svgOptions.opacity}
            .opacityLabel=${t('space.opacity')} .disabled=${this.busy}
            .pickerLabels=${{ title: t('color_picker.title'), hue: t('color_picker.hue'), saturation: t('color_picker.saturation'),
              value: t('color_picker.value'), hex: t('color_picker.hex'), invalidHex: t('color_picker.invalid_hex'), confirm: t('color_picker.confirm') }}
            @hp-color-opacity-change=${(event: CustomEvent<{ color: string; opacity: number }>) => {
              this.setSvg('color', event.detail.color); this.setSvg('opacity', event.detail.opacity);
            }}
            @input=${(event: Event) => {
              const input = event.composedPath().find(node => node instanceof HTMLInputElement
                && node.dataset.field === 'colour-hex') as HTMLInputElement | undefined;
              if (input) this.invalidHex = normalizeHexColor(input.value) ? null : input.value;
            }}
            @hp-color-opacity-close=${(event: Event) => {
              if (this.invalidHex !== null) (event.currentTarget as HpColorOpacity).resumeHexDraft({ raw: this.invalidHex, needsValidInput: true });
            }}></hp-color-opacity>` : nothing}
        </div>` : nothing}
      </div>
      <div class="row" slot="footer">
        <button class="btn" data-hp="dialog-cancel" ?disabled=${this.busy}
          @click=${this.context.close}>${this.context.t('btn.cancel')}</button>
        <span class="spacer"></span>
        <button class="btn on primary" data-hp="dialog-confirm"
          ?disabled=${this.busy} @click=${() => void this.save()}>
          <ha-icon icon=${this.busy ? 'mdi:progress-clock' : 'mdi:download'}></ha-icon>
          ${this.context.t(this.busy ? 'pdf.saving' : 'pdf.save')}
        </button>
      </div>
    </hp-dialog>`;
  }
}

if (!customElements.get('hp-pdf-dialog')) customElements.define('hp-pdf-dialog', HpPdfDialog);
