/** Local nested form, outer marker draft and the actual preview share the pure producer. */
import { html, nothing, type ReactiveController, type ReactiveControllerHost } from 'lit';
import type { HouseplanEditorRuntime } from '../houseplan-editor-runtime';
import type { DevItem } from '../types';
import { langOf } from '../i18n';
import { settingsCopy } from './settings-copy';
import { dialogSession } from './dialog-baseline';
import { field, fieldGrid, formCard, formSections } from './form-kit';
import { alertOperand, normalizeMarkerAlert, normalizeMarkerAlerts, MAX_MARKER_ALERTS,
  type AlertLevel, type AlertOperator, type MarkerThresholdAlert } from '../marker-alert';
import { ConfirmedMarkerAlerts, type AlertObservation } from '../marker-alert-runtime';
import { markerAlertFields, readMarkerAlertSource, type MarkerAlertField } from '../marker-alert-source';
import { ALERT_OPERATOR_LABELS, alertOperandText, thresholdIssues } from '../marker-alert-presentation';
import { displayIsNeutral, normalizeDeviceDisplay } from '../logic';

interface AlertEditOwner { session: object; authority: object; binding: string }
interface ConstructorDraft extends AlertEditOwner {
  instance: object; id: string; editing: boolean;
  source: string; operator: AlertOperator; value: string; original: number | string | null;
  edited: boolean; level: AlertLevel;
}
const fieldKey = (rule: Pick<MarkerThresholdAlert, 'entity_id' | 'attribute'>) => JSON.stringify([rule.entity_id, rule.attribute ?? null]);
const operators = Object.keys(ALERT_OPERATOR_LABELS) as AlertOperator[];

export class MarkerAlertsEditor implements ReactiveController {
  private constructorDraft: ConstructorDraft | null = null;
  private previewSession?: object;
  private previewOwner: object | null = null;
  private readonly confirmations: ConfirmedMarkerAlerts;

  constructor(private readonly runtime: HouseplanEditorRuntime) {
    this.confirmations = new ConfirmedMarkerAlerts(() => this.host.requestUpdate());
    (this.host as unknown as ReactiveControllerHost).addController(this);
  }
  private get host() { return this.runtime.host; }
  private copy() { return settingsCopy(this.host); }
  private rows() {
    const raw = this.host._markerDialog?.alertSources;
    return raw === undefined ? [] : normalizeMarkerAlerts(raw);
  }
  private device(): DevItem | null {
    return this.host._markerDialog ? this.runtime._markerPreviewDevice(this.host._markerDialog) : null;
  }
  private fields(): readonly MarkerAlertField[] {
    const device = this.device();
    return device ? markerAlertFields(this.host._planHass, this.host._fullRegistryHass, device) : [];
  }
  private editOwner(): AlertEditOwner | null {
    const session = dialogSession(this.host, 'marker'), draft = this.host._markerDialog;
    return session && draft ? { session, binding: draft.binding, authority: this.host._configWriteContext.claim() } : null;
  }
  private current(draft: AlertEditOwner): boolean {
    return this.host.isConnected && this.host._canEdit && !this.host._kiosk && !this.host._connectionWasLost && !this.host._markerDialog?.busy
      && this.host._markerDialog?.binding === draft.binding && dialogSession(this.host, 'marker') === draft.session
      && this.host._configWriteContext.current(draft.authority, this.host.hass);
  }
  close(): void { this.constructorDraft = null; this.previewSession = undefined; this.previewOwner = null;
    this.confirmations.update(this.host._configWriteContext.claim(), [], false); }
  hostDisconnected(): void { this.close(); }
  hostUpdate(): void {
    if (this.constructorDraft && !this.current(this.constructorDraft)) this.constructorDraft = null;
    this.syncPreview();
  }
  private syncPreview(): void {
    const host = this.host, device = this.device(), session = dialogSession(host, 'marker');
    const claim = host._configWriteContext.claim();
    if (this.previewSession !== session || this.previewOwner !== claim) {
      this.confirmations.update(claim, [], false); this.previewSession = session; this.previewOwner = claim;
    }
    const enabled = !!device && !!session && host.isConnected && host._canEdit && !host._kiosk
      && host._config?.live_states !== false && !host._connectionWasLost
      && !displayIsNeutral(normalizeDeviceDisplay(device.marker?.display))
      && host._configWriteContext.current(claim, host.hass);
    const inputs: AlertObservation[] = enabled ? (this.rows() || []).map(rule => {
      const signature = JSON.stringify(rule);
      return { key: JSON.stringify([device!.id, rule.id]), identity: JSON.stringify([session, device!.id, device!.marker?.binding, device!.space]), rule,
        read: () => {
          const current = this.device();
          if (!current || this.previewSession !== session || dialogSession(host, 'marker') !== session
            || !host.isConnected || !host._canEdit || host._kiosk || host._connectionWasLost
            || host._config?.live_states === false || displayIsNeutral(normalizeDeviceDisplay(current.marker?.display))
            || !host._configWriteContext.current(claim, host.hass)
            || current.id !== device!.id || current.marker?.binding !== device!.marker?.binding || current.space !== device!.space
            || !(this.rows() || []).some(candidate => candidate.id === rule.id && JSON.stringify(candidate) === signature)) return { permitted: false };
          return readMarkerAlertSource(host._planHass, host._fullRegistryHass, current, rule);
        } };
    }) : [];
    this.confirmations.update(claim, inputs, enabled);
  }
  previewIssues() {
    this.syncPreview();
    const device = this.device(), saved = this.host._markers.find(marker => marker.id === device?.id);
    const rows = new Map(this.confirmations.snapshot().map(row => [row.rule.id, row]));
    // Opening unchanged settings projects the already-confirmed accepted frame
    // immediately. Only edited/new definitions need their own draft confirmation.
    if (device && saved && saved.binding === device.marker?.binding && saved.space === device.marker?.space
      && saved.area === device.marker?.area && saved.room_id === device.marker?.room_id) {
      for (const row of this.host._alerts?.forDevice(device.id) || []) {
        if ((this.rows() || []).some(rule => JSON.stringify(rule) === JSON.stringify(row.rule))) rows.set(row.rule.id, row);
      }
    }
    return thresholdIssues([...rows.values()], langOf(this.host.hass, this.host._config?.language));
  }
  private open(rule?: MarkerThresholdAlert): void {
    const owner = this.editOwner(), rows = this.rows();
    if (!owner || !this.current(owner) || !rows || !rule && rows.length >= MAX_MARKER_ALERTS
      || rule && !rows.some(row => JSON.stringify(row) === JSON.stringify(rule))) return;
    this.constructorDraft = { ...owner, instance: {},
      id: rule?.id || `r_${globalThis.crypto?.randomUUID?.().replaceAll('-', '') || `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`}`, editing: !!rule,
      source: rule ? fieldKey(rule) : this.fields()[0]?.key || '', operator: rule?.operator || 'eq',
      value: rule ? String(rule.value) : '', original: rule?.value ?? null, edited: false, level: rule?.level || 'attention' };
    this.host.requestUpdate();
  }
  private cancel(instance: object): void { if (this.constructorDraft?.instance !== instance) return; this.constructorDraft = null; this.host.requestUpdate(); }
  private change(patch: Partial<ConstructorDraft>, instance: object): void {
    if (this.constructorDraft?.instance === instance && this.current(this.constructorDraft)) {
      this.constructorDraft = { ...this.constructorDraft, ...patch }; this.host.requestUpdate();
    }
  }
  private value(draft: ConstructorDraft, source?: MarkerAlertField): number | string | null {
    if (!source || source.control.kind === 'unsupported') return null;
    const raw = draft.edited ? alertOperand(draft.value, draft.operator, source.control.kind === 'enum') : draft.original;
    if (raw === null) return null;
    if (source.control.kind === 'enum') return typeof raw === 'string'
      && source.control.options.some(option => option.value === raw)
      && (draft.operator === 'eq' || draft.operator === 'ne') ? raw : null;
    if (source.control.kind === 'text' && draft.operator !== 'eq' && draft.operator !== 'ne') return null;
    if (source.control.kind === 'number' && typeof raw !== 'number') return null;
    return raw;
  }
  private save(instance: object): void {
    const d = this.constructorDraft, outer = this.host._markerDialog, rows = this.rows();
    if (!d || d.instance !== instance || !outer || !rows || !this.current(d) || !d.editing && rows.length >= MAX_MARKER_ALERTS) return;
    const source = this.fields().find(field => field.key === d.source), value = this.value(d, source);
    if (!source || value === null) return;
    const rule = normalizeMarkerAlert({ id: d.id, type: 'threshold', level: d.level, entity_id: source.entityId,
      ...(source.attribute === undefined ? {} : { attribute: source.attribute }), operator: d.operator, value });
    if (!rule || d.editing && !rows.some(row => row.id === d.id)) return;
    this.host._markerDialog = { ...outer, alertSources: d.editing ? rows.map(row => row.id === d.id ? rule : row) : [...rows, rule] };
    this.cancel(instance);
  }
  renderSection() {
    const { st } = this.copy(), rows = this.rows();
    const owner = this.editOwner(), raw = this.host._markerDialog?.alertSources;
    const current = () => !!owner && this.current(owner);
    const fields = this.fields(), disabled = !current() || !rows || rows.length >= MAX_MARKER_ALERTS || !fields.length;
    return html`<section class="hpf-card"><div class="hpf-head alarm-heading"><h3>${st('marker.alerts.section')}</h3>
      <button type="button" class="alarm-add" data-hp="alarm-add" ?disabled=${disabled}
        title=${st('marker.alerts.add')} aria-label=${st('marker.alerts.add')} @click=${() => { if (current()) this.open(); }}><ha-icon icon="mdi:plus"></ha-icon></button></div><div class="hpf-body">
      ${!rows ? html`<p class="hpf-error" role="alert">${st('marker.alerts.invalid_rules')}</p><button type="button" class="btn ghost" @click=${() => {
        if (current() && this.host._markerDialog && this.host._markerDialog.alertSources === raw) this.host._markerDialog = { ...this.host._markerDialog, alertSources: undefined };
      }}>${st('marker.alerts.clear')}</button>` : html`<table class="alarm-table"><thead><tr><th>${st('marker.alerts.condition')}</th><th>${st('marker.alerts.action')}</th><th style="width:36px"></th></tr></thead>
      <tbody>${rows.length ? rows.map(rule => html`<tr data-alert-rule=${rule.id}><td><button type="button" class="alarm-condition-edit" data-hp="alarm-edit"
        aria-label=${st('marker.alerts.edit')} @click=${() => { if (current()) this.open(rule); }}><span class="alarm-condition"><span>${rule.attribute || st('marker.alerts.state')} <strong>${ALERT_OPERATOR_LABELS[rule.operator]}</strong> ${alertOperandText(rule.value)}</span>
        <small>${rule.entity_id}${rule.attribute ? ` · ${rule.attribute}` : ''}</small></span></button>
        ${!fields.some(field => field.key === fieldKey(rule)) ? html`<p class="hpf-error" role="status">${st('marker.alerts.invalid_source')}</p>` : nothing}</td><td>${st(`marker.alerts.${rule.level}`)}</td>
        <td><button type="button" class="alarm-remove" data-hp="alarm-remove" title=${st('marker.alerts.remove')} aria-label=${st('marker.alerts.remove')}
          @click=${() => { const draft = this.host._markerDialog; if (!current() || !draft || !(this.rows() || []).some(row => JSON.stringify(row) === JSON.stringify(rule))) return; const next = (this.rows() || []).filter(item => item.id !== rule.id);
            this.host._markerDialog = { ...draft, alertSources: next.length ? next : undefined }; }}><ha-icon icon="mdi:delete-outline"></ha-icon></button></td></tr>`)
        : html`<tr><td colspan="3" class="alarm-empty"><div class="alarm-empty-content"><span>${st('marker.alerts.empty')}</span><button type="button" class="btn on alarm-create" data-hp="alarm-create"
          ?disabled=${disabled} @click=${() => { if (current()) this.open(); }}>${st('marker.alerts.create')}</button></div></td></tr>`}</tbody></table>`}
      ${!fields.length ? html`<p class="hpf-hint">${st('marker.alerts.no_sources')}</p>` : rows && rows.length >= MAX_MARKER_ALERTS ? html`<p class="hpf-hint">${st('marker.alerts.limit')}</p>` : nothing}</div></section>`;
  }
  renderConstructor() {
    const d = this.constructorDraft;
    if (!d || !this.current(d)) return nothing;
    const { st, shelp } = this.copy(), fields = this.fields(), source = fields.find(field => field.key === d.source);
    const value = this.value(d, source), comparable = source?.control.kind === 'number' || source?.control.kind === 'unknown';
    const select = (id: string, label: string, value: string, choices: readonly { value: string; label: string }[], change: (value: string) => void, placeholder: boolean | string = false) => html`
      <hp-settings-select><select class="hpf-select" id=${id} data-hp="field" data-field=${id} aria-label=${label}
        @change=${(event: Event) => change((event.target as HTMLSelectElement).value)}>
        ${placeholder ? html`<option value="" ?selected=${!choices.some(row => row.value === value)} disabled>${typeof placeholder === 'string' ? placeholder : st('marker.alerts.placeholder')}</option>` : nothing}
        ${choices.map(row => html`<option value=${row.value} ?selected=${row.value === value}>${row.label}</option>`)}</select></hp-settings-select>`;
    const current = source?.value == null || typeof source.value !== 'string' && typeof source.value !== 'number'
      ? st('marker.alerts.unavailable') : `${source.value}${source.unit ? ` ${source.unit}` : ''}`;
    return html`<hp-dialog .hass=${this.host.hass} data-kind="alarm-constructor" class="ui-dialog" form-shell settings-layout compact wide
      lang=${langOf(this.host.hass, this.host._config?.language)} .title=${st(d.editing ? 'marker.alerts.edit' : 'marker.alerts.new')}
      .subtitle=${this.host._markerDialog?.name || this.device()?.name || ''} icon="mdi:bell-alert-outline"
      @hp-close=${(event: Event) => { event.stopPropagation(); this.cancel(d.instance); }}>
      <div class="body hpf-form hpf-settings-form">${formSections([
        formCard({ title: st('marker.alerts.if'), body: fieldGrid([
          html`<div class="alarm-source-field">${field({ label: st('marker.alerts.source'), htmlFor: 'alarm-source',
            control: select('alarm-source', st('marker.alerts.source'), d.source, fields.map(field => ({ value: field.key,
              label: `${field.name} · ${field.attribute || st('marker.alerts.state')}` })), value => this.change({ source: value }, d.instance), !source && d.source ? `${d.source} — ${st('marker.alerts.unavailable')}` : true),
            hint: st('marker.alerts.current', { value: current }) })}</div>`,
          field({ label: st('marker.alerts.operator'), htmlFor: 'alarm-operator', help: shelp('marker.alerts.help'),
            control: select('alarm-operator', st('marker.alerts.operator'), d.operator, operators.filter(operator => comparable || operator === 'eq' || operator === 'ne').map(operator => ({ value: operator,
              label: `${ALERT_OPERATOR_LABELS[operator]} ${st(`marker.alerts.${operator}`)}` })), value => this.change({ operator: value as AlertOperator }, d.instance), true) }),
          field({ label: st('marker.alerts.value'), htmlFor: 'alarm-value', control: source?.control.kind === 'enum'
            ? select('alarm-value', st('marker.alerts.value'), typeof (d.edited ? d.value : d.original) === 'string' ? d.value : '', source.control.options, value => this.change({ value, edited: true }, d.instance), d.value ? `${d.value} — ${st('marker.alerts.unavailable')}` : true)
            : html`<input class="hpf-input" id="alarm-value" data-hp="field" data-field="alarm-value" type="text" autocomplete="off" inputmode=${source?.control.kind === 'number' ? 'decimal' : 'text'}
                aria-label=${st('marker.alerts.value')} placeholder=${st('marker.alerts.placeholder')} .value=${d.value}
                @input=${(event: Event) => this.change({ value: (event.target as HTMLInputElement).value, edited: true }, d.instance)}>` }),
          field({ label: st('marker.alerts.level'), htmlFor: 'alarm-level', control: select('alarm-level', st('marker.alerts.level'), d.level,
            (['attention', 'alarm'] as const).map(value => ({ value, label: st(`marker.alerts.${value}`) })), value => this.change({ level: value as AlertLevel }, d.instance)) }),
        ]) }),
        html`${!source ? html`<p class="hpf-error" role="alert">${st('marker.alerts.invalid_source')}</p>` : value === null && (d.edited || d.editing) ? html`<p class="hpf-error" role="alert">${st('marker.alerts.invalid_value')}</p>` : nothing}
          <div class="hpf-callout alarm-outcome"><div><div class="alarm-outcome-heading"><ha-icon icon="mdi:bell-alert-outline"></ha-icon><span>${st(`marker.alerts.outcome_${d.level}`)}</span></div><p class="hpf-hint">${st(`marker.alerts.outcome_${d.level}_text`)}</p></div></div>`,
      ], { dividers: false })}</div>
      <div slot="footer" class="row dialog-action-footer hpf-footer"><span class="spacer"></span><div class="dialog-action-group dialog-action-commit">
        <button type="button" class="btn ghost" data-hp="alarm-cancel" @click=${() => this.cancel(d.instance)}>${this.host._t('btn.cancel')}</button>
        <button type="button" class="btn on" data-hp="alarm-ok" ?disabled=${value === null || !source} @click=${() => this.save(d.instance)}>OK</button>
      </div></div>
    </hp-dialog>`;
  }
}
