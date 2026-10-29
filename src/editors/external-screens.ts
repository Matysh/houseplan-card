/** Outer General settings draft owns persistence; this controller owns one child. */
import { html, nothing, type ReactiveController, type ReactiveControllerHost } from 'lit';
import type { HouseplanEditorRuntime } from '../houseplan-editor-runtime';
import { langOf } from '../i18n';
import { settingsT, type SettingsI18nKey } from '../i18n/settings';
import { emptyExternalScreens, externalScreensOf, defaultExternalScreen, upsertExternalScreen,
  type ExternalScreen } from '../external-screens';
import { dialogSession } from './dialog-baseline';
import { dialogPresence } from '../dialog-presence';
import { externalScreenPath } from '../route-kiosk';
import { field, formCard } from './form-kit';

interface ScreenDraft { row: ExternalScreen; session: object; authority: object; instance: object }
export class ExternalScreensEditor implements ReactiveController {
  private draft: ScreenDraft | null = null;
  constructor(private readonly runtime: HouseplanEditorRuntime) {
    (this.host as unknown as ReactiveControllerHost).addController(this);
  }
  private get host() { return this.runtime.host; }
  private t(key: string, vars?: Record<string, string | number>) {
    return settingsT(langOf(this.host.hass, this.host._config?.language), `screens.${key}` as SettingsI18nKey, vars);
  }
  private rows() { const raw = this.host._settingsDialog?.externalScreens; return raw === undefined ? emptyExternalScreens() : externalScreensOf(raw); }
  private current(d: Pick<ScreenDraft, 'session' | 'authority'>): boolean {
    return this.host.isConnected && this.host._canEdit && !this.host._kiosk && !this.host._connectionWasLost
      && !!this.host._settingsDialog && !this.host._settingsDialog.busy
      && dialogSession(this.host, 'settings') === d.session
      && this.host._configWriteContext.current(d.authority, this.host.hass);
  }
  hostUpdate(): void { if (this.draft && !this.current(this.draft)) this.draft = null; }
  hostDisconnected(): void { this.draft = null; }
  close(): void { this.draft = null; }
  private open(row?: ExternalScreen): void {
    const session = dialogSession(this.host, 'settings'), rows = this.rows();
    if (!session || this.host._haExternalScreensApi !== 1 || !rows || !row && rows.screens.length >= 20
      || row && !rows.screens.includes(row)) return;
    const draft = { row: { ...(row ?? defaultExternalScreen(rows.next_id)), controls: false }, session,
      authority: this.host._configWriteContext.claim(), instance: {} };
    if (this.current(draft)) { this.draft = draft; this.host.requestUpdate(); }
  }
  private cancel(instance: object): void {
    if (this.draft?.instance === instance) { this.draft = null; this.host.requestUpdate(); }
  }
  private change(patch: Partial<ExternalScreen>, instance: object): void {
    if (this.draft?.instance === instance && this.current(this.draft)) {
      this.draft = { ...this.draft, row: { ...this.draft.row, ...patch } }; this.host.requestUpdate();
    }
  }
  private save(instance: object): void {
    const d = this.draft, rows = this.rows(), outer = this.host._settingsDialog;
    if (!d || d.instance !== instance || !this.current(d) || !rows || !outer) return;
    this.host._settingsDialog = { ...outer, externalScreens: upsertExternalScreen(rows, { ...d.row, controls: false }) };
    this.cancel(instance);
  }
  private path(id: number): string {
    return externalScreenPath(location.pathname, this.host.panelHost, id);
  }
  private time(n: number): string { return n === 0 ? this.t('off') : n < 60
    ? this.t('seconds', { n }) : this.t('minutes', { n: n / 60 }); }
  renderSection() {
    const raw = this.host._settingsDialog?.externalScreens, rows = this.rows() ?? emptyExternalScreens();
    const unsupported = raw !== undefined && !externalScreensOf(raw), backend = this.host._haExternalScreensApi !== 1;
    const spaces = this.host._serverCfg?.spaces ?? [];
    const session = dialogSession(this.host, 'settings');
    const owner = session ? { session, authority: this.host._configWriteContext.claim() } : null;
    return html`<style>
      .hp-screen-icon{min-width:44px!important;min-height:44px!important;justify-content:center;padding:10px!important}
      .hp-screen-intro{margin:0 0 18px!important}.hp-screen-empty{display:flex;flex-direction:column;align-items:center;gap:18px;padding:38px 16px 44px;color:var(--secondary-text-color)}
      .hp-screen-empty>ha-icon{--mdc-icon-size:38px;opacity:.65}.hp-screen-list{display:grid;gap:12px;margin-bottom:16px}
      .hp-screen-row{display:grid;grid-template-columns:minmax(0,1fr) 44px;gap:6px 12px;padding:12px;border:1px solid var(--hpf-line,var(--divider-color));border-radius:10px}
      .hp-screen-edit{display:grid;gap:7px;text-align:left;min-height:44px;border:0;background:transparent;color:var(--primary-text-color);font:inherit;cursor:pointer;padding:6px;border-radius:7px;transition:background 160ms}
      .hp-screen-edit:hover{background:var(--hpf-tint,#8882)}.hp-screen-edit:focus-visible{outline:2px solid var(--primary-color)}.hp-screen-edit span{font-size:13px;color:var(--secondary-text-color);line-height:1.5}
      .hp-screen-link{grid-column:1/-1;display:flex;align-items:center;gap:8px}.hp-screen-link input{flex:1;min-width:0;font-size:13px}
      .hp-screen-fields{align-items:start;gap:20px 24px}.hp-screen-fields .hpf-label{min-height:22px}.hp-screen-note{margin:24px 0 0!important}
      hp-dialog[data-kind="external-screen-constructor"] .hpf-form.hp-screen-constructor{padding:20px!important}
      .hp-screen-row .hpf-error{grid-column:1/-1}
      @media(max-width:550px){.hp-screen-fields{grid-template-columns:1fr}.hp-screen-row{padding:8px}}
    </style>${formCard({ id: 'external-screens', title: this.t('title'), body: html`
      <p class="hpf-hint hp-screen-intro">${this.t('intro')}</p>
      ${unsupported || backend ? html`<p class="hpf-hint" role="status">${this.t(unsupported ? 'future' : 'backend')}</p>` : rows.screens.length ? html`
      <div class="hp-screen-list" role="list" aria-label=${this.t('title')}>${rows.screens.map(row => {
        const space = spaces.find(space => space.id === row.space), missing = row.space !== null && !space;
        return html`<div class="hp-screen-row" role="listitem">
          <button type="button" class="hp-screen-edit" data-hp="external-screen-edit" aria-label=${this.t('edit', { name: this.t('screen', { n: row.id }) })} @click=${() => this.open(row)}>
            <strong>${this.t('screen', { n: row.id })}</strong><span>${row.space === null ? this.t('all') : space ? space.title || space.id : this.t('missing')} · ${row.rotation}° · ${row.space === null && row.cycle > 0 ? this.t('cycling', { time: this.time(row.cycle) }) : this.t('no_cycle')}</span>
          </button><button type="button" class="btn ghost hp-screen-icon" data-hp="external-screen-delete" title=${this.host._t('btn.delete')} aria-label=${this.t('delete')}
            @click=${() => { const outer = this.host._settingsDialog; if (outer && owner && this.current(owner) && this.rows() === rows && this.host._haExternalScreensApi === 1) this.host._settingsDialog = { ...outer, externalScreens: { ...rows, screens: rows.screens.filter(item => item.id !== row.id) } }; }}><ha-icon icon="mdi:delete-outline"></ha-icon></button>
          <div class="hp-screen-link"><input class="hpf-input" readonly .value=${this.path(row.id)} aria-label=${this.t('link', { n: row.id })}
            @click=${(e: Event) => (e.currentTarget as HTMLInputElement).select()}>
            <button type="button" class="btn ghost hp-screen-icon" data-hp="external-screen-copy" title=${this.t('copy')} aria-label=${this.t('copy')}
              @click=${async (e: Event) => {
                const button = e.currentTarget as HTMLElement, full = new URL(this.path(row.id), location.origin).href;
                let copied = false;
                try { await navigator.clipboard.writeText(full); copied = true; }
                catch {
                  // HTTP WebViews may lack Clipboard API. Keep the complete URL selectable.
                  if (!button.isConnected) return;
                  const input = button.closest('.hp-screen-row')?.querySelector('input');
                  if (input) { input.value = full; input.select(); try { copied = document.execCommand('copy'); } catch { /* Manual copy remains available. */ } }
                }
                if (copied && button.isConnected) { button.setAttribute('aria-label', this.t('copied')); button.querySelector('ha-icon')?.setAttribute('icon', 'mdi:check'); }
              }}><ha-icon icon="mdi:content-copy"></ha-icon></button></div>
          ${missing ? html`<p class="hpf-error">${this.t('missing_warning')}</p>` : nothing}
        </div>`;
      })}</div><button type="button" class="btn ghost" data-hp="external-screen-add" ?disabled=${rows.screens.length >= 20} @click=${() => this.open()}><ha-icon icon="mdi:plus"></ha-icon>${this.t('add')}</button>
      ${rows.screens.length >= 20 ? html`<p class="hpf-hint">${this.t('limit')}</p>` : nothing}` : html`
      <div class="hp-screen-empty"><ha-icon icon="mdi:monitor-dashboard"></ha-icon><span>${this.t('empty')}</span>
        <button type="button" class="btn on" data-hp="external-screen-create" @click=${() => this.open()}>${this.t('create')}</button></div>`}` })}`;
  }
  renderConstructor() {
    return dialogPresence(this.renderDraft());
  }
  private renderDraft() {
    const d = this.draft; if (!d || !this.current(d)) return nothing;
    const row = d.row, cycling = row.space === null && row.cycle > 0;
    const select = (key: keyof ExternalScreen, label: string, options: [string, string][], disabled = false, hint = '', help = '') => {
      const value = row[key] === null ? '' : String(row[key]);
      if (!options.some(([n]) => n === value)) options.push([value, key === 'space' ? this.t('missing') : key === 'cycle' || key === 'idle' ? this.time(Number(value)) : `${Number(value) * 100} %`]);
      return field({ label, htmlFor: `screen-${key}`, hint, help: help ? html`<hp-help instant .text=${help} .ariaLabel=${label}></hp-help>` : nothing,
        control: html`<hp-settings-select><select class="hpf-select" id=${`screen-${key}`} data-hp="field" data-field=${`external-screen-${key}`} aria-label=${label} ?disabled=${disabled}
          @change=${(e: Event) => { const value = (e.target as HTMLSelectElement).value;
            const next = key === 'space' ? value || null : key === 'summary' || key === 'hidden_devices' ? value : value === '' ? null : Number(value);
            this.change({ [key]: next }, d.instance); }}>
          ${options.map(([n, text]) => html`<option value=${n} ?selected=${n === value}>${text}</option>`)}</select></hp-settings-select>` });
    };
    const local: [string, string][] = [['local', this.t('local')], ['show', this.t('show')], ['hide', this.t('hide')]];
    const sizes: [string, string][] = [['', this.t('local')], ...[.5,.75,1,1.25,1.5,1.75,2,2.5,3].map(n => [String(n), `${n * 100} %`] as [string, string])];
    const times = (values: number[]): [string, string][] => values.map(n => [String(n), this.time(n)]);
    return html`<hp-dialog .hass=${this.host.hass} data-kind="external-screen-constructor" form-shell settings-layout compact wide lang=${langOf(this.host.hass, this.host._config?.language)}
      .title=${this.rows()?.screens.some(item => item.id === row.id) ? this.t('screen', { n: row.id }) : this.t('new')}
      .subtitle=${this.t('subtitle')} icon="mdi:monitor" @hp-close=${(e: Event) => { e.stopPropagation(); this.cancel(d.instance); }}>
      <div class="body hpf-form hpf-settings-form hp-screen-constructor"><div class="hpf-grid hp-screen-fields">
        ${select('space', this.t('space'), [['',this.t('all')], ...(this.host._serverCfg?.spaces ?? []).map(space => [space.id, space.title || space.id] as [string,string])])}
        ${select('rotation', this.t('rotation'), [0,90,180,270].map(n => [String(n), `${n}°`]))}
        ${select('cycle', this.t('cycle'), times([0,10,30,60,120,300,600]), row.space !== null, row.space !== null ? this.t('cycle_hint') : '')}
        ${select('idle', this.t('idle'), times([0,30,60,120,300,600]), cycling, cycling ? this.t('idle_hint') : '', this.t('idle_help'))}
        ${select('summary', this.t('summary'), [...local])}${select('hidden_devices', this.t('hidden_devices'), local.map(([value,label]) => [value, value === 'hide' ? this.t('dont_show') : label]))}
        ${select('icon_scale', this.t('icon_scale'), [...sizes])}${select('font_scale', this.t('font_scale'), [...sizes])}
      </div><p class="hpf-note hpf-hint hp-screen-note">${this.t('note')}</p></div>
      <div slot="footer" class="row dialog-action-footer hpf-footer"><span class="spacer"></span><div class="dialog-action-group dialog-action-commit">
        <button type="button" class="btn ghost" data-hp="dialog-cancel" @click=${() => this.cancel(d.instance)}>${this.host._t('btn.cancel')}</button>
        <button type="button" class="btn on" data-hp="external-screen-ok" @click=${() => this.save(d.instance)}>${this.t('ok')}</button>
      </div></div>
    </hp-dialog>`;
  }
}
