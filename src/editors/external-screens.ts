/** Outer General settings draft owns persistence; this controller owns one child. */
import { html, nothing, type ReactiveController, type ReactiveControllerHost } from 'lit';
import type { HouseplanEditorRuntime } from '../houseplan-editor-runtime';
import { langOf } from '../i18n';
import { settingsT, type SettingsI18nKey } from '../i18n/settings';
import { emptyExternalScreens, externalScreensForEdit, defaultExternalScreen, upsertExternalScreen,
  externalScreenView, validScreenZoom, type ExternalScreen, type ExternalScreenView } from '../external-screens';
import { dialogSession } from './dialog-baseline';
import { dialogPresence } from '../dialog-presence';
import { externalScreenPath } from '../route-kiosk';
import { field, formCard, formSections, sectionHeading, unitInput } from './form-kit';

interface ScreenDraft {
  row: ExternalScreen; space: string | null; zooms: Record<string, string>;
  session: object; authority: object; instance: object;
}
export class ExternalScreensEditor implements ReactiveController {
  private draft: ScreenDraft | null = null;
  constructor(private readonly runtime: HouseplanEditorRuntime) {
    (this.host as unknown as ReactiveControllerHost).addController(this);
  }
  private get host() { return this.runtime.host; }
  private t(key: string, vars?: Record<string, string | number>) {
    return settingsT(langOf(this.host.hass, this.host._config?.language), `screens.${key}` as SettingsI18nKey, vars);
  }
  private rows() { const raw = this.host._settingsDialog?.externalScreens; return raw === undefined ? emptyExternalScreens() : externalScreensForEdit(raw); }
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
    if (!session || this.host._haExternalScreensApi !== 2 || !rows || !row && rows.screens.length >= 20
      || row && !rows.screens.includes(row)) return;
    const spaces = this.host._serverCfg?.spaces ?? [];
    const draft = { row: structuredClone(row ?? defaultExternalScreen(rows.next_id)),
      space: spaces.some(space => space.id === this.host._space) ? this.host._space : spaces[0]?.id ?? null,
      zooms: Object.create(null) as Record<string, string>, session,
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
  private activeSpace(d: ScreenDraft): string | null {
    const spaces = this.host._serverCfg?.spaces ?? [];
    return d.row.space ?? (spaces.some(space => space.id === d.space) ? d.space : spaces[0]?.id ?? null);
  }
  private changeView(patch: Partial<ExternalScreenView>, instance: object, space: string): void {
    const d = this.draft;
    if (!d || d.instance !== instance || !this.current(d) || this.activeSpace(d) !== space
      || !this.host._serverCfg?.spaces.some(item => item.id === space)) return;
    this.draft = { ...d, row: { ...d.row, space_views: { ...d.row.space_views,
      [space]: { ...externalScreenView(d.row, space), ...patch } } },
      zooms: patch.zoom === undefined ? d.zooms : { ...d.zooms, [space]: String(Math.round(patch.zoom * 100)) } };
    this.host.requestUpdate();
  }
  private zoom(raw: string, instance: object, space: string): void {
    if (!this.draft || this.draft.instance !== instance || !this.current(this.draft) || this.activeSpace(this.draft) !== space) return;
    if (raw.trim() && validScreenZoom(Number(raw) / 100)) this.changeView({ zoom: Number(raw) / 100 }, instance, space);
    this.draft = { ...this.draft!, zooms: { ...this.draft!.zooms, [space]: raw } };
    this.host.requestUpdate();
  }
  private invalidSpaces(d: ScreenDraft): string[] {
    return Object.entries(d.zooms).filter(([id, raw]) => this.host._serverCfg?.spaces.some(space => space.id === id)
      && (!raw.trim() || !validScreenZoom(Number(raw) / 100))).map(([id]) => id);
  }
  private save(instance: object): void {
    const d = this.draft, rows = this.rows(), outer = this.host._settingsDialog;
    if (!d || d.instance !== instance || !this.current(d) || !rows || !outer || this.invalidSpaces(d).length) return;
    this.host._settingsDialog = { ...outer, externalScreens: upsertExternalScreen(rows, structuredClone(d.row)) };
    this.cancel(instance);
  }
  private path(id: number): string {
    return externalScreenPath(location.pathname, this.host.panelHost, id);
  }
  private time(n: number): string { return n === 0 ? this.t('off') : n < 60
    ? this.t('seconds', { n }) : this.t('minutes', { n: n / 60 }); }
  renderSection() {
    const raw = this.host._settingsDialog?.externalScreens, rows = this.rows() ?? emptyExternalScreens();
    const unsupported = raw !== undefined && !externalScreensForEdit(raw), backend = this.host._haExternalScreensApi !== 2;
    const spaces = this.host._serverCfg?.spaces ?? [];
    const session = dialogSession(this.host, 'settings');
    const owner = session ? { session, authority: this.host._configWriteContext.claim() } : null;
    return html`${formCard({ id: 'external-screens', title: this.t('title'), body: html`
      <p class="hpf-hint hp-screen-intro">${this.t('intro')}</p>
      ${unsupported || backend ? html`<p class="hpf-hint" role="status">${this.t(unsupported ? 'future' : 'backend')}</p>` : rows.screens.length ? html`
      <div class="hp-screen-list" role="list" aria-label=${this.t('title')}>${rows.screens.map(row => {
        const space = spaces.find(space => space.id === row.space), missing = row.space !== null && !space;
        return html`<div class="hp-screen-row hpf-reading-block hpf-reading-padded" role="listitem">
          <button type="button" class="hp-screen-edit btn hpf-action-option" data-hp="external-screen-edit" aria-label=${this.t('edit', { name: this.t('screen', { n: row.id }) })} @click=${() => this.open(row)}>
            <strong>${this.t('screen', { n: row.id })}</strong><span>${row.space === null ? this.t('all') : space ? space.title || space.id : this.t('missing')} · ${row.space === null && spaces.length > 1 && row.cycle > 0 ? this.t('cycling', { time: this.time(row.cycle) }) : this.t('no_cycle')}</span>
          </button><button type="button" class="btn ghost hpf-action-icon hp-screen-icon" data-hp="external-screen-delete" title=${this.host._t('btn.delete')} aria-label=${this.t('delete')}
            @click=${() => { const outer = this.host._settingsDialog; if (outer && owner && this.current(owner) && this.rows() === rows && this.host._haExternalScreensApi === 2) this.host._settingsDialog = { ...outer, externalScreens: { ...rows, screens: rows.screens.filter(item => item.id !== row.id) } }; }}><ha-icon icon="mdi:delete-outline"></ha-icon></button>
          <div class="hp-screen-link"><input class="hpf-input" readonly .value=${this.path(row.id)} aria-label=${this.t('link', { n: row.id })}
            @click=${(e: Event) => (e.currentTarget as HTMLInputElement).select()}>
            <button type="button" class="btn ghost hpf-action-icon hp-screen-icon" data-hp="external-screen-copy" title=${this.t('copy')} aria-label=${this.t('copy')}
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
      <div class="hp-screen-empty hpf-empty-state"><ha-icon class="big" icon="mdi:monitor-dashboard"></ha-icon><span>${this.t('empty')}</span>
        <button type="button" class="btn on" data-hp="external-screen-create" @click=${() => this.open()}>${this.t('create')}</button></div>`}` })}`;
  }
  renderConstructor() {
    return dialogPresence(this.renderDraft());
  }
  private renderDraft() {
    const d = this.draft; if (!d || !this.current(d)) return nothing;
    const row = d.row, spaces = this.host._serverCfg?.spaces ?? [], single = spaces.length === 1;
    const cycling = spaces.length > 1 && row.space === null && row.cycle > 0;
    const space = this.activeSpace(d), exists = spaces.some(item => item.id === space);
    const view = externalScreenView(row, space), errors = this.invalidSpaces(d);
    const select = (key: string, label: string, value: string, options: [string, string][], pick: (value: string) => void,
      disabled = false, hint = '', help = '') => {
      if (!options.some(([n]) => n === value)) options.push([value, key === 'space' || key === 'edited-space' ? this.t('missing') : key === 'cycle' || key === 'idle' ? this.time(Number(value)) : `${Number(value) * 100} %`]);
      return field({ label, htmlFor: `screen-${key}`, hint, help: help ? html`<hp-help instant .text=${help} .ariaLabel=${label}></hp-help>` : nothing,
        control: html`<hp-settings-select><select class="hpf-select" id=${`screen-${key}`} data-hp="field" data-field=${`external-screen-${key}`} aria-label=${label} ?disabled=${disabled}
          @change=${(e: Event) => pick((e.target as HTMLSelectElement).value)}>
          ${options.map(([n, text]) => html`<option value=${n} ?selected=${n === value}>${text}</option>`)}</select></hp-settings-select>` });
    };
    const local: [string, string][] = [['local', this.t('local')], ['show', this.t('show')], ['hide', this.t('hide')]];
    const sizes: [string, string][] = [['', this.t('local')], ...[.5,.75,1,1.25,1.5,1.75,2,2.5,3].map(n => [String(n), `${n * 100} %`] as [string, string])];
    const times = (values: number[]): [string, string][] => values.map(n => [String(n), this.time(n)]);
    const updateView = (patch: Partial<ExternalScreenView>) => { if (space) this.changeView(patch, d.instance, space); };
    const idle = () => select('idle', this.t('idle'), String(row.idle), times([0,30,60,120,300,600]),
      value => this.change({ idle: Number(value) }, d.instance), cycling, cycling ? this.t('idle_hint') : this.t('idle_description'), this.t('idle_help'));
    const rawZoom = space && Object.prototype.hasOwnProperty.call(d.zooms, space) ? d.zooms[space] : String(Math.round(view.zoom * 100));
    const individual = () => html`<div class="hpf-grid hp-screen-fields">
      ${select('rotation', this.t('rotation'), String(view.rotation), [0,90,180,270].map(n => [String(n), `${n}°`]), value => updateView({rotation:Number(value) as ExternalScreenView['rotation']}), !exists)}
      ${field({ label: this.t('zoom'), htmlFor:'screen-zoom', help:html`<hp-help instant .text=${this.t('zoom_help')} .ariaLabel=${this.t('zoom')}></hp-help>`, hint:this.t('zoom_hint'),
        error:space && errors.includes(space) ? this.t('zoom_error') : undefined,
        control:html`<div class="hp-screen-zoom">${unitInput({id:'screen-zoom',fieldId:'external-screen-zoom',value:rawZoom,unit:'%',min:10,max:1000,step:1,
          ariaLabel:this.t('zoom'),disabled:!exists,invalid:!!space&&errors.includes(space),onInput:raw=>{if(space)this.zoom(raw,d.instance,space);}})}
          <button type="button" class="btn ghost" data-hp="field-action" data-field="external-screen-reset" ?disabled=${!exists} @click=${()=>updateView({zoom:1})}>${this.t('reset')}</button></div>`})}
      ${select('summary', this.t('summary'), view.summary, [...local], value => updateView({summary:value as ExternalScreenView['summary']}), !exists)}
      ${field({label:this.t('centering'),htmlFor:'screen-center-summary',control:html`<label class="hpf-check hpf-check-wrap hp-screen-center">
        <input id="screen-center-summary" data-hp="field" data-field="external-screen-center-summary" type="checkbox"
          .checked=${view.center_summary} ?disabled=${!exists||view.summary==='hide'}
          @change=${(event:Event)=>updateView({center_summary:(event.target as HTMLInputElement).checked})}>
        <span>${this.t('center_summary')}</span></label>`})}
      ${select('icon_scale',this.t('icon_scale'),view.icon_scale===null?'':String(view.icon_scale),[...sizes],value=>updateView({icon_scale:value===''?null:Number(value)}),!exists)}
      ${select('font_scale',this.t('font_scale'),view.font_scale===null?'':String(view.font_scale),[...sizes],value=>updateView({font_scale:value===''?null:Number(value)}),!exists,'',this.t('font_help'))}
    </div>`;
    return html`<hp-dialog class="ui-dialog" .hass=${this.host.hass} data-kind="external-screen-constructor" form-shell settings-layout compact wide lang=${langOf(this.host.hass, this.host._config?.language)}
      .title=${this.rows()?.screens.some(item => item.id === row.id) ? this.t('screen', { n: row.id }) : this.t('new')}
      .subtitle=${this.t(single?'single_subtitle':'subtitle')} icon="mdi:monitor" @hp-close=${(e: Event) => { e.stopPropagation(); this.cancel(d.instance); }}>
      <div class="body hpf-form hpf-settings-form hp-screen-constructor">
        ${single ? html`${individual()}<div class="hp-screen-single-return">${idle()}</div>` : formSections([
          html`${sectionHeading(this.t('general'))}<div class="hpf-grid hp-screen-general">
            ${select('space',this.t('space'),row.space??'',[['',this.t('all')],...spaces.map(item=>[item.id,item.title||item.id] as [string,string])],value=>this.change({space:value||null},d.instance))}
            ${select('cycle',this.t('cycle'),String(row.cycle),times([0,10,30,60,120,300,600]),value=>this.change({cycle:Number(value)},d.instance),row.space!==null||spaces.length<2,row.space!==null?this.t('cycle_hint'):'')}
            ${idle()}</div>`,
          html`${sectionHeading(this.t(row.space===null?'individual':'individual_named',{name:spaces.find(item=>item.id===space)?.title||this.t('missing')}))}
            ${spaces.length && row.space===null ? select('edited-space',this.t('edited_space'),space??'',spaces.map(item=>[item.id,`${item.title||item.id}${errors.includes(item.id)?' ⚠':''}`] as [string,string]),value=>{
              if(this.draft?.instance===d.instance&&this.current(this.draft)){this.draft={...this.draft,space:value};this.host.requestUpdate();}},row.space!==null) : nothing}
            ${space&&exists?html`<p class="hpf-hint hp-screen-space-hint">${this.t('space_hint',{name:spaces.find(item=>item.id===space)?.title||space})}</p>`:nothing}
            ${individual()}`])}
        ${!exists ? html`<p class="hpf-hint" role="status">${this.t(spaces.length?'missing_warning':'no_spaces')}</p>
          ${single ? html`<button class="btn ghost" type="button" data-hp="field-action" data-field="external-screen-use-available" @click=${()=>this.change({space:spaces[0].id},d.instance)}>${this.t('use_available')}</button>`:nothing}`:nothing}
        <p class="hpf-note hpf-callout hpf-hint hp-screen-note">${this.t('note')}</p></div>
      <div slot="footer" class="row dialog-action-footer hpf-footer"><span class="spacer"></span><div class="dialog-action-group dialog-action-commit">
        ${errors.length?html`<span class="hpf-error" role="alert">${this.t('space_errors',{names:errors.map(id=>spaces.find(item=>item.id===id)?.title||id).join(', ')})}</span>`:nothing}
        <button type="button" class="btn ghost" data-hp="dialog-cancel" @click=${() => this.cancel(d.instance)}>${this.host._t('btn.cancel')}</button>
        <button type="button" class="btn on" data-hp="external-screen-ok" ?disabled=${!!errors.length} @click=${() => this.save(d.instance)}>${this.t('ok')}</button>
      </div></div>
    </hp-dialog>`;
  }
}
