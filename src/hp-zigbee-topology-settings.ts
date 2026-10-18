import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { langOf } from './i18n';
import { hasTopologyTranslation, topologyT, type TopologyI18nKey } from './i18n/topology';
import './hp-help';
import { ensureSettingsDialogStyles } from './editors/settings-styles';
import {
  normalizeZ2mBaseTopic, type ZigbeeTopologySettings,
} from './zigbee-topology-settings';
import { mapTopologyNodes, resolveProviderUplinks, TOPOLOGY_STALE_MS } from './zigbee-topology';
import type { DevItem } from './types';
import type { HaRegistrySnapshot } from './ha-binding-status';
import type { ZigbeeTopologyHass, ZigbeeTopologyRuntimeSnapshot } from './zigbee-topology-runtime';
import { acquireIntegrationMetadata, integrationMetadataSnapshot } from './integration-provider';
import { zigbeeIntegrationPresence } from './zigbee-integration-presence';

const EMPTY_RUNTIME: ZigbeeTopologyRuntimeSnapshot = { revision: 0, topologies: [], states: {} };

export class HpZigbeeTopologySettings extends LitElement {
  static properties = {
    hass: { attribute: false },
    language: { type: String },
    value: { attribute: false },
    // One outer card heading; contextual help belongs to the toggle/topics.
    embedded: { type: Boolean, reflect: true },
    savedEnabled: { type: Boolean, attribute: 'saved-enabled' },
    devices: { attribute: false },
    registry: { attribute: false },
    active: { type: Boolean },
  };

  hass!: ZigbeeTopologyHass;
  language?: string;
  value: ZigbeeTopologySettings = { enabled: false, z2mBaseTopics: [] };
  savedEnabled = false;
  devices: readonly DevItem[] = [];
  registry?: HaRegistrySnapshot;
  active = true;
  private _metadataRelease?: () => void;
  private _metadataOwner?: object;
  private _metadataIdentity = '';
  private _runtime: typeof import('./zigbee-topology-runtime') | null = null;
  private _snapshot = EMPTY_RUNTIME;
  private _staleTimer?: ReturnType<typeof setTimeout>;
  private _release?: () => void;
  private _owner?: object;
  private _userIdentity = '';
  private _generation = 0;
  private _runtimePending?: Promise<typeof import('./zigbee-topology-runtime')>;
  private _topicText = 'zigbee2mqtt';
  private _invalidTopic = false;

  static styles = css`
    :host { display: block; color: inherit; font: inherit; }
    .section {
      margin-top: 18px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 2px;
    }
    .toggle { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
    .hint, .status { color: var(--secondary-text-color, #9aa0aa); font-size: 12px; line-height: 1.45; }
    .hint { margin-top: 6px; }
    .providers { display: grid; gap: 14px; margin-top: 12px; padding-left: 34px; }
    .provider, .scan-row { display: grid; gap: 7px; min-width: 0; }
    .scan-row { overflow-wrap: anywhere; }
    [data-hp="zigbee-scan-cancel"] { min-width: 44px; min-height: 44px; }
    .provider-title { font-weight: 650; }
    .actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
    textarea {
      box-sizing: border-box; width: 100%; min-height: 58px; resize: vertical;
      border: 1px solid var(--divider-color, #666); border-radius: 8px; padding: 8px;
      color: var(--primary-text-color, inherit); background: var(--card-background-color, #202126);
      font: inherit;
    }
    button {
      display: inline-flex; align-items: center; gap: 6px; min-height: 36px;
      border: 1px solid var(--divider-color, #666); border-radius: 9px; padding: 7px 11px;
      color: inherit; background: transparent; cursor: pointer; font: inherit; font-weight: 600;
    }
    button:disabled, textarea:disabled { opacity: .5; cursor: default; }
    .warning { color: var(--warning-color, #d89300); font-size: 12px; line-height: 1.45; }
    /* #600 embedded: примитивы набора внутри карточки; правила набора, которые
       привязаны к форме диалога, здесь недоступны — они повторены точечно. */
    :host([embedded]) { display: grid; gap: 12px; }
    :host([embedded]) textarea.hpf-input { min-height: 72px; border-radius: 7px; padding: 8px 10px;
      border-color: var(--hpf-line, var(--divider-color, #666)); background: var(--hpf-surface, var(--card-background-color, #202126)); }
    :host([embedded]) textarea[aria-invalid="true"] { border-color: var(--hpf-danger, var(--error-color, #db543d)); }
    :host([embedded]) .hpf-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; }
    :host([embedded]) button { min-height: 44px; border-radius: 8px; padding: 9px 14px; font-weight: 400;
      border-color: var(--hpf-line, var(--divider-color, #666)); }
    :host([embedded]) .hpf-hint { margin: 0; }
    .hpf-provider { display:grid; gap:12px; min-width:0; }
    .provider-heading { display:flex; flex-wrap:wrap; align-items:baseline; gap:4px 8px; }
    .provider-heading h4 { margin:0; font-size:14px; }
    .provider-heading .hpf-hint { flex:1 1 220px; font-size:12px; }
    .topic-meta { display:grid; gap:7px; min-width:0; }
    .topic-head { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:12px; align-items:center; }
    .topic-head strong { overflow-wrap:anywhere; }
    .scan-row { border-top:1px solid var(--hpf-line,var(--divider-color)); padding-top:18px; margin-top:18px; }
    .scan-row .status,.scan-row .hint { grid-column:1/-1; }
    details > summary { cursor:pointer; padding:10px 0; color:var(--primary-color); }
    button:hover:not(:disabled) { background:var(--hpf-tint,color-mix(in srgb,var(--primary-color) 10%,transparent)); }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('visibilitychange', this._visibilityChanged);
    this.requestUpdate();
  }

  private _releaseRuntime(): void {
    this._generation++;
    clearTimeout(this._staleTimer);
    this._staleTimer = undefined;
    this._release?.();
    this._release = undefined;
    this._owner = undefined;
    this._snapshot = EMPTY_RUNTIME;
    this.requestUpdate();
  }

  disconnectedCallback(): void {
    document.removeEventListener('visibilitychange', this._visibilityChanged);
    this._releaseRuntime();
    this._metadataRelease?.();
    this._metadataRelease = undefined;
    super.disconnectedCallback();
  }

  protected updated(): void {
    const owner = this.hass?.connection || this.hass;
    const identity = `${this.hass?.user?.id || ''}:${this._admin}`;
    const metadataWanted = this.active && this.embedded && this._admin;
    if (this._metadataRelease && (!metadataWanted || owner !== this._metadataOwner || identity !== this._metadataIdentity)) {
      this._metadataRelease(); this._metadataRelease = undefined;
    }
    if (metadataWanted && !this._metadataRelease && owner) {
      this._metadataOwner = owner; this._metadataIdentity = identity;
      this._metadataRelease = acquireIntegrationMetadata(this.hass, () => this.requestUpdate());
    }
    if (this._owner && (this._owner !== owner || identity !== this._userIdentity || !this._observing)) this._releaseRuntime();
    if (this._observing) {
      this._scheduleStaleUpdate();
      if (!this._owner) {
        this._owner = owner;
        this._userIdentity = identity;
        const generation = this._generation;
        void this._ensureRuntime().then(runtime => {
          if (generation !== this._generation || !this._observing || this._owner !== owner) return;
          this._acceptSnapshot(runtime.zigbeeTopologyRuntimeSnapshot(this.hass));
          this._release = runtime.subscribeZigbeeTopology(this.hass, () => {
            this._acceptSnapshot(runtime.zigbeeTopologyRuntimeSnapshot(this.hass));
          });
        });
      }
    }
    else {
      clearTimeout(this._staleTimer);
      this._staleTimer = undefined;
    }
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('value')) {
      this._topicText = (this.value.z2mBaseTopics.length ? this.value.z2mBaseTopics : ['zigbee2mqtt']).join('\n');
      this._invalidTopic = false;
    }
  }

  private get _admin(): boolean { return this.hass?.user?.is_admin === true; }
  private get _observing(): boolean { return this.isConnected && this.active && this.value.enabled && this.savedEnabled && this._admin; }
  public embedded = false;

  private _t(key: TopologyI18nKey, vars?: Record<string, string | number>): string {
    return topologyT(langOf(this.hass, this.language), key, vars);
  }

  /**
   * Contextual help for the feature, not for the checkbox (#459).
   *
   * `_help()` of the editor runtime is typed against the MAIN dictionary
   * (`I18nKey`), and this component owns its own `topology` namespace — so the
   * affordance is rebuilt here rather than imported. The fail-closed rule is
   * copied deliberately: a missing text or accessible name renders nothing at
   * all, because a help circle that opens an empty surface is worse than no
   * circle. Absence is asked of the dictionaries (`hasTopologyTranslation`),
   * not of the resolved string: `topologyT` answers a missing key with the key
   * itself, and «help» is a perfectly non-empty string.
   */
  private _help(key: TopologyI18nKey = 'help', aria: TopologyI18nKey = 'help_aria'): TemplateResult | typeof nothing {
    const lang = langOf(this.hass, this.language);
    if (!hasTopologyTranslation(lang, key) || !hasTopologyTranslation(lang, aria)) return nothing;
    return html`<hp-help .instant=${this.embedded} data-help-key=${`topology.${key}`} .text=${this._t(key)}
      .ariaLabel=${this._t(aria)}></hp-help>`;
  }

  private async _ensureRuntime(): Promise<typeof import('./zigbee-topology-runtime')> {
    if (!this._runtime) {
      this._runtimePending ??= import('./zigbee-topology-runtime');
      this._runtime = await this._runtimePending;
    }
    return this._runtime;
  }

  private _acceptSnapshot(snapshot: ZigbeeTopologyRuntimeSnapshot): void {
    this._snapshot = snapshot;
    this._scheduleStaleUpdate();
    this.requestUpdate();
  }

  private _visibilityChanged = (): void => {
    this._scheduleStaleUpdate();
    if (this._observing && document.visibilityState !== 'hidden') this.requestUpdate();
  };

  // Status ages even when HA sends no events. This one-shot redraw never fetches.
  private _scheduleStaleUpdate(): void {
    clearTimeout(this._staleTimer);
    this._staleTimer = undefined;
    if (!this._observing || document.visibilityState === 'hidden') return;
    const now = Date.now();
    const expiry = Object.values(this._snapshot.states)
      .filter((current) => current.obtainedAt !== undefined && !current.stale)
      .map((current) => current.obtainedAt! + TOPOLOGY_STALE_MS + 1)
      .filter((value) => value > now);
    const ticking = Object.values(this._snapshot.states).some(current => current.phase === 'loading' && current.jobId);
    const delay = Math.min(ticking ? 1000 : Infinity, expiry.length ? Math.min(...expiry) - now : Infinity);
    if (Number.isFinite(delay)) this._staleTimer = setTimeout(() => {
      this._staleTimer = undefined;
      if (!this.isConnected) return;
      this.requestUpdate();
      this._scheduleStaleUpdate();
    }, delay);
  }

  private _emit(value: ZigbeeTopologySettings): void {
    if (!this._admin) return;
    this.dispatchEvent(new CustomEvent('hp-topology-settings-change', {
      detail: value, bubbles: true, composed: true,
    }));
  }

  private _topics(): string[] {
    const configured = this.value.z2mBaseTopics.length ? this.value.z2mBaseTopics : ['zigbee2mqtt'];
    const active = Object.entries(this._snapshot.states)
      .filter(([key, current]) => key.startsWith('z2m:') && current.phase === 'loading').map(([key]) => key.slice(4));
    return [...new Set([...configured, ...active])];
  }

  private _editTopics(raw: string): void {
    this._topicText = raw;
    const values = raw.split(/[\r\n,]+/).map((value) => value.trim()).filter(Boolean);
    const topics = values.map(normalizeZ2mBaseTopic).filter(Boolean) as string[];
    this._invalidTopic = topics.length !== values.length;
    if (this._invalidTopic) { this.requestUpdate(); return; }
    this._emit({ ...this.value, z2mBaseTopics: [...new Set(topics)].slice(0, 8) });
  }

  private _status(key: string): string {
    if (!this._admin) return this._t('status_idle');
    const current = this._snapshot.states[key];
    if (!current) return this._t('status_idle');
    const phase = current.phase === 'loading' ? (key === 'zha' ? this._t('status_loading') : '')
      : current.phase === 'cancelled' ? this._t('scan_cancelled')
      : current.phase === 'error' ? this._errorText(current.error) : '';
    if (current.obtainedAt === undefined) return phase || (current.phase === 'loading' ? '' : this._t('status_idle'));
    const time = new Date(current.obtainedAt).toLocaleString(langOf(this.hass, this.language), {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
    const topology = this._snapshot.topologies.find((item) =>
      (key === 'zha' ? item.provider === 'zha' : `z2m:${item.instanceId}` === key));
    const mappingPartial = !!topology && !!this.registry
      && mapTopologyNodes(topology, this.devices, this.registry).warnings.length > 0;
    const uplinks = topology ? [...resolveProviderUplinks(topology).values()] : [];
    const stale = current.stale || Date.now() - current.obtainedAt > TOPOLOGY_STALE_MS;
    const partial = current.partial || mappingPartial || uplinks.some((route) => route.kind === 'unknown');
    return [phase, this._t(stale ? 'status_stale' : 'status_ready', { time }),
      partial ? this._t('route_partial') : '',
      topology && !uplinks.some((route) => route.kind === 'known') ? this._t('route_unknown') : '',
      topology?.freshness === 'provider-cache' ? this._t('status_cache') : '',
      current.persistence === 'pending' ? this._t('storage_pending')
        : current.persistence === 'failed' ? this._t('storage_failed') : '',
    ].filter(Boolean).join(' · ');
  }

  private _busy(key: string): boolean {
    return this._snapshot.states[key]?.phase === 'loading';
  }

  private async _readZha(): Promise<void> {
    const generation = this._generation;
    const runtime = await this._ensureRuntime();
    if (generation === this._generation && this._observing) void runtime.readZhaTopology(this.hass);
  }

  private async _refreshZ2m(topic: string): Promise<void> {
    const generation = this._generation;
    const runtime = await this._ensureRuntime();
    if (generation === this._generation && this._observing) void runtime.refreshZ2mTopology(this.hass, topic);
  }

  private _errorText(error?: import('./zigbee-topology-runtime').ZigbeeTopologyErrorCode): string {
    return this._t(error === 'backend_required' ? 'scan_backend_required'
      : error === 'connection' ? 'scan_connection_lost' : error === 'unsupported' ? 'scan_unavailable'
      : (`error_${error || 'provider'}`) as TopologyI18nKey);
  }

  private _z2mRow(topic: string, mayLoad: boolean, embedded: boolean): TemplateResult {
    const key = `z2m:${topic}`, current = this._admin ? this._snapshot.states[key] : undefined;
    const active = current?.phase === 'loading' && !!current.jobId;
    const canCancel = active && this._runtime?.zigbeeScanCanCancel(current);
    const disconnected = this._snapshot.backendConnected === false && !this._snapshot.backendError;
    return html`<div class="scan-row" data-topic=${topic}>
      <div class="topic-head">
        <div class="topic-meta"><strong>${topic}</strong><span class="status" role="status">${this._status(key)}</span></div>
        <button class=${embedded ? 'btn ghost' : ''} ?disabled=${!mayLoad || this._invalidTopic || this._busy(key)}
          @click=${() => this._refreshZ2m(topic)}><ha-icon icon="mdi:refresh"></ha-icon>${this._t('z2m_update')}</button>
      </div>
      ${!active ? html`<span class="hint">${this._t(this._snapshot.topologies.some(item => item.provider === 'z2m' && item.instanceId === topic)
        ? 'scan_replace_hint' : this._snapshot.backendConnected === true ? 'scan_new_hint' : 'scan_unknown_hint')}</span>` : nothing}
      ${active ? html`
        <span class="status" role="status" data-hp="zigbee-scan-stage">${this._t(current.stage === 'connecting' ? 'scan_connecting' : 'scan_waiting')}</span>
        <span class="status" aria-live="off" data-hp="zigbee-scan-elapsed">${this._t('scan_elapsed', {
          time: this._runtime!.formatZigbeeScanElapsed(this._runtime!.zigbeeScanElapsedMs(current)),
        })}</span>
        <span class="hint" data-hp="zigbee-scan-background">${this._t('scan_background_hint')}</span>
        ${disconnected ? html`<span class="warning" role="status">${this._t('scan_frontend_disconnected')}</span>` : nothing}
        ${canCancel ? html`
          <span class="hint" data-hp="zigbee-scan-long-wait">${this._t('scan_long_wait')}</span>
          <div><button class=${embedded ? 'btn ghost' : ''} data-hp="zigbee-scan-cancel" ?disabled=${disconnected || !mayLoad}
            @click=${() => { if (this._observing && current.jobId) void this._runtime?.cancelZ2mTopology(this.hass, topic, current.jobId); }}>${this._t('scan_cancel')}</button></div>
          <span class="hint" data-hp="zigbee-scan-cancel-hint">${this._t('scan_cancel_hint')}</span>` : nothing}` : nothing}
      ${this._admin && this._snapshot.backendError ? html`<span class="warning" role="status">${this._errorText(this._snapshot.backendError)}</span>` : nothing}
    </div>`;
  }

  protected render() {
    if (this.embedded) return this._renderEmbedded();
    const admin = this._admin;
    const enabled = this.value.enabled;
    const mayLoad = admin && this.savedEnabled;
    const topics = this._topics();
    return html`
      <div class="section">${this._t('title')}${this._help()}</div>
      <label class="toggle">
        ${customElements.get('ha-switch')
          ? html`<ha-switch .checked=${enabled} .disabled=${!admin}
              @change=${(event: Event) => this._emit({ ...this.value,
                enabled: !!(event.target as HTMLInputElement).checked })}></ha-switch>`
          : html`<input type="checkbox" .checked=${enabled} ?disabled=${!admin}
              @change=${(event: Event) => this._emit({ ...this.value,
                enabled: (event.target as HTMLInputElement).checked })} />`}
        <span>${this._t('toggle')}</span>
      </label>
      <div class="hint">${this._t('hint')}</div>
      ${!admin ? html`<div class="hint">${this._t('admin_only')}</div>` : nothing}
      ${enabled ? html`<div class="providers">
        ${!this.savedEnabled ? html`<div class="hint">${this._t('save_first')}</div>` : nothing}
        <div class="provider">
          <div class="provider-title">${this._t('zha')}</div>
          <div class="hint">${this._t('zha_hint')}</div>
          <div class="actions">
            <button ?disabled=${!mayLoad || this._busy('zha')} @click=${this._readZha}>
              <ha-icon icon="mdi:access-point-network"></ha-icon>${this._t('zha_read')}
            </button>
            <span class="status">${this._status('zha')}</span>
          </div>
        </div>
        <div class="provider">
          <div class="provider-title">${this._t('z2m')}</div>
          <label class="hint" for="z2m-topics">${this._t('z2m_topics')}</label>
          <textarea id="z2m-topics" ?disabled=${!admin}
            .value=${this._topicText} @input=${(event: Event) =>
              this._editTopics((event.target as HTMLTextAreaElement).value)}></textarea>
          ${this._invalidTopic ? html`<div class="warning">${this._t('error_invalid_topic')}</div>` : nothing}
          <div class="warning">${this._t('z2m_warning')}</div>
          ${topics.map(topic => this._z2mRow(topic, mayLoad, false))}
        </div>
      </div>` : nothing}
    `;
  }

  /**
   * Раскладка внутри карточки общего набора (#600, §5.1 SPEC.md). Лист набора
   * вносится в свой теневой корень: селекторы примитивов не привязаны к форме,
   * а токены `--hpf-*` наследуются с хоста через границу тени. Единственный
   * заголовок даёт карточка; пояснения и «?» относятся к своим контролам.
   */
  private _renderEmbedded(): TemplateResult {
    ensureSettingsDialogStyles(this);
    const admin = this._admin, enabled = this.value.enabled;
    const mayLoad = admin && this.savedEnabled;
    const presence = zigbeeIntegrationPresence(integrationMetadataSnapshot(this.hass), this.registry);
    const storedZha = this._snapshot.topologies.some(item => item.provider === 'zha') || !!this._snapshot.states.zha;
    const storedZ2m = this.value.z2mBaseTopics.length > 0 || this._snapshot.topologies.some(item => item.provider === 'z2m');
    const zha = html`<section class="hpf-provider">
      <div class="provider-heading"><h4>${this._t('zha')}</h4><p class="hpf-hint">${this._t('zha_hint')}</p></div>
      <p class="status" role="status">${this._status('zha')}</p>
      <div class="hpf-actions">
        <button class="btn ghost" ?disabled=${!mayLoad || this._busy('zha')} @click=${this._readZha}>
          <ha-icon icon="mdi:access-point-network"></ha-icon>${this._t('zha_read')}
        </button>
      </div>
    </section>`;
    const z2m = html`<section class="hpf-provider">
      <div class="hpf-sub"><h4>${this._t('z2m')}</h4></div>
      <p class="hpf-hint">${this._t('z2m_duration')}</p>
      <div class="hpf-field">
        <span class="hpf-label hpf-labelrow"><label for="z2m-topics">${this._t('z2m_topics')}</label>${this._help('topics_help','topics_help_aria')}</span>
        <textarea id="z2m-topics" class="hpf-input" rows="2" spellcheck="false" ?disabled=${!admin}
          aria-invalid=${this._invalidTopic ? 'true' : nothing}
          .value=${this._topicText} @input=${(event: Event) => this._editTopics((event.target as HTMLTextAreaElement).value)}></textarea>
        ${this._invalidTopic ? html`<p class="hpf-error" role="alert">${this._t('error_invalid_topic')}</p>` : nothing}
      </div>
      ${this._topics().map(topic => this._z2mRow(topic, mayLoad, true))}
    </section>`;
    return html`<div class="hpf-form hpf-settings-form"><section class="hpf-settings-pane"><div class="hpf-body">
      <label class="hpf-toggle hpf-noicon">
        <span class="hpf-toggle-title"><span>${this._t('toggle')}</span>${this._help()}</span>
        <input type="checkbox" .checked=${enabled} ?disabled=${!admin} aria-label=${this._t('toggle')}
          @change=${(event: Event) => this._emit({ ...this.value, enabled: (event.target as HTMLInputElement).checked })} />
      </label>
      ${!admin ? html`<p class="hpf-hint">${this._t('admin_only')}</p>` : nothing}
      ${enabled ? html`
        ${!this.savedEnabled ? html`<div class="hpf-callout"><p>${this._t('save_first')}</p></div>` : nothing}
        ${presence.zha === 'unknown' || presence.z2m === 'unknown' ? html`<p class="hpf-hint">${this._t('discovery_unknown')}</p>` : nothing}
        ${presence.zha !== 'absent' || storedZha ? zha : html`<details><summary>${this._t('zha_manual')}</summary>${zha}</details>`}
        ${presence.z2m !== 'absent' || storedZ2m ? z2m : html`<details><summary>${this._t('z2m_manual')}</summary>${z2m}</details>`}
      ` : nothing}
    </div></section></div>`;
  }

}

if (!customElements.get('hp-zigbee-topology-settings')) {
  customElements.define('hp-zigbee-topology-settings', HpZigbeeTopologySettings);
}
