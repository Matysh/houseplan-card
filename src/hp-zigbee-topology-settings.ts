import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { langOf } from './i18n';
import { topologyT, type TopologyI18nKey } from './i18n/topology';
import {
  normalizeZ2mBaseTopic, type ZigbeeTopologySettings,
} from './zigbee-topology-settings';
import { mapTopologyNodes, TOPOLOGY_STALE_MS } from './zigbee-topology';
import type { DevItem } from './types';
import type { HaRegistrySnapshot } from './ha-binding-status';
import type {
  ZigbeeProviderState, ZigbeeTopologyHass, ZigbeeTopologyRuntimeSnapshot,
} from './zigbee-topology-runtime';

const EMPTY_RUNTIME: ZigbeeTopologyRuntimeSnapshot = { revision: 0, topologies: [], states: {} };

export class HpZigbeeTopologySettings extends LitElement {
  static properties = {
    hass: { attribute: false },
    value: { attribute: false },
    savedEnabled: { type: Boolean, attribute: 'saved-enabled' },
    devices: { attribute: false },
    registry: { attribute: false },
  };

  hass!: ZigbeeTopologyHass;
  value: ZigbeeTopologySettings = { enabled: false, z2mBaseTopics: [] };
  savedEnabled = false;
  devices: readonly DevItem[] = [];
  registry?: HaRegistrySnapshot;
  private _runtime: typeof import('./zigbee-topology-runtime') | null = null;
  private _snapshot = EMPTY_RUNTIME;
  private _release?: () => void;
  private _topicText = 'zigbee2mqtt';
  private _invalidTopic = false;

  static styles = css`
    :host { display: block; color: inherit; font: inherit; }
    .section { margin-top: 18px; font-weight: 700; }
    .toggle { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
    .hint, .status { color: var(--secondary-text-color, #9aa0aa); font-size: 12px; line-height: 1.45; }
    .hint { margin-top: 6px; }
    .providers { display: grid; gap: 14px; margin-top: 12px; padding-left: 34px; }
    .provider { display: grid; gap: 7px; }
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
  `;

  disconnectedCallback(): void {
    this._release?.();
    this._release = undefined;
    super.disconnectedCallback();
  }

  protected updated(changed: PropertyValues<this>): void {
    if (changed.has('hass')) {
      this._release?.();
      this._release = undefined;
      this._runtime = null;
      this._snapshot = EMPTY_RUNTIME;
    }
    if (this.savedEnabled && this._admin) void this._ensureRuntime();
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('value')) {
      this._topicText = (this.value.z2mBaseTopics.length ? this.value.z2mBaseTopics : ['zigbee2mqtt']).join('\n');
      this._invalidTopic = false;
    }
  }

  private get _admin(): boolean { return this.hass?.user?.is_admin === true; }
  private _t(key: TopologyI18nKey, vars?: Record<string, string | number>): string {
    return topologyT(langOf(this.hass), key, vars);
  }

  private async _ensureRuntime(): Promise<typeof import('./zigbee-topology-runtime')> {
    if (!this._runtime) {
      this._runtime = await import('./zigbee-topology-runtime');
      this._snapshot = this._runtime.zigbeeTopologyRuntimeSnapshot(this.hass);
      this._release = this._runtime.subscribeZigbeeTopology(this.hass, () => {
        this._snapshot = this._runtime!.zigbeeTopologyRuntimeSnapshot(this.hass);
        this.requestUpdate();
      });
      this.requestUpdate();
    }
    return this._runtime;
  }

  private _emit(value: ZigbeeTopologySettings): void {
    if (!this._admin) return;
    this.dispatchEvent(new CustomEvent('hp-topology-settings-change', {
      detail: value, bubbles: true, composed: true,
    }));
  }

  private _topics(): string[] {
    return this.value.z2mBaseTopics.length ? this.value.z2mBaseTopics : ['zigbee2mqtt'];
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
    const current = this._snapshot.states[key];
    if (!current) return this._t('status_idle');
    if (current.phase === 'loading') return this._t('status_loading');
    if (current.phase === 'error') return this._t((`error_${current.error || 'provider'}`) as TopologyI18nKey);
    if (current.phase !== 'ready' || !current.obtainedAt) return this._t('status_idle');
    const time = new Date(current.obtainedAt).toLocaleTimeString(langOf(this.hass), {
      hour: '2-digit', minute: '2-digit',
    });
    const topology = this._snapshot.topologies.find((item) =>
      (key === 'zha' ? item.provider === 'zha' : `z2m:${item.instanceId}` === key));
    const mappingPartial = !!topology && !!this.registry
      && mapTopologyNodes(topology, this.devices, this.registry).warnings.length > 0;
    if (current.partial || mappingPartial) return this._t('status_partial', { time });
    if (topology && !topology.links.length) return this._t('status_no_links', { time });
    return this._t(Date.now() - current.obtainedAt > TOPOLOGY_STALE_MS ? 'status_stale' : 'status_ready', { time });
  }

  private _busy(key: string): boolean {
    return this._snapshot.states[key]?.phase === 'loading';
  }

  private async _readZha(): Promise<void> {
    if (!this.savedEnabled || !this._admin) return;
    (await this._ensureRuntime()).readZhaTopology(this.hass);
  }

  private async _refreshZ2m(topic: string): Promise<void> {
    if (!this.savedEnabled || !this._admin) return;
    (await this._ensureRuntime()).refreshZ2mTopology(this.hass, topic);
  }

  protected render() {
    const admin = this._admin;
    const enabled = this.value.enabled;
    const mayLoad = admin && this.savedEnabled;
    const topics = this._topics();
    return html`
      <div class="section">${this._t('title')}</div>
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
          ${topics.map((topic) => html`<div class="actions">
            <button ?disabled=${!mayLoad || this._invalidTopic || this._busy(`z2m:${topic}`)}
              @click=${() => this._refreshZ2m(topic)}>
              <ha-icon icon="mdi:refresh"></ha-icon>${this._t('z2m_update')} · ${topic}
            </button>
            <span class="status">${this._status(`z2m:${topic}`)}</span>
          </div>`)}
        </div>
      </div>` : nothing}
    `;
  }
}

if (!customElements.get('hp-zigbee-topology-settings')) {
  customElements.define('hp-zigbee-topology-settings', HpZigbeeTopologySettings);
}
