import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { langOf } from './i18n';
import { hasTopologyTranslation, topologyT, type TopologyI18nKey } from './i18n/topology';
import './hp-help';
import { ensureFormKitStyles } from './editors/form-kit';
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
    // #600 §5.1: внутри карточки «Zigbee links» заголовок и «?» рисует карточка,
    // а блок раскладывается контролами набора: строка-тумблер, callout,
    // подзаголовки ZHA / Zigbee2MQTT, поле тем и строки действий.
    embedded: { type: Boolean, reflect: true },
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
  public embedded = false;

  private _t(key: TopologyI18nKey, vars?: Record<string, string | number>): string {
    return topologyT(langOf(this.hass), key, vars);
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
  private _help(): TemplateResult | typeof nothing {
    const lang = langOf(this.hass);
    if (!hasTopologyTranslation(lang, 'help')
        || !hasTopologyTranslation(lang, 'help_aria')) return nothing;
    return html`<hp-help .text=${this._t('help')}
      .ariaLabel=${this._t('help_aria')}></hp-help>`;
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

  /**
   * Раскладка внутри карточки общего набора (#600, §5.1 SPEC.md). Лист набора
   * вносится в свой теневой корень: селекторы примитивов не привязаны к форме,
   * а токены `--hpf-*` наследуются с хоста через границу тени. Заголовок и «?»
   * функции здесь не рисуются — их даёт карточка (`topology.title` /
   * `topology.help`), иначе заголовок удваивался (дефект 1 из #600).
   */
  private _renderEmbedded(): TemplateResult {
    ensureFormKitStyles(this);
    const admin = this._admin;
    const enabled = this.value.enabled;
    const mayLoad = admin && this.savedEnabled;
    const topics = this._topics();
    return html`
      <label class="hpf-toggle">
        <span class="hpf-toggle-icon" aria-hidden="true"><ha-icon icon="mdi:zigbee"></ha-icon></span>
        <span class="hpf-toggle-title"><span>${this._t('toggle')}</span></span>
        <span class="hpf-toggle-caption">${this._t('hint')}</span>
        <input type="checkbox" .checked=${enabled} ?disabled=${!admin} aria-label=${this._t('toggle')}
          @change=${(event: Event) => this._emit({ ...this.value,
            enabled: (event.target as HTMLInputElement).checked })} />
      </label>
      ${!admin ? html`<p class="hpf-hint">${this._t('admin_only')}</p>` : nothing}
      ${enabled ? html`
        ${!this.savedEnabled ? html`<div class="hpf-callout"><ha-icon icon="mdi:information-outline"></ha-icon><p>${this._t('save_first')}</p></div>` : nothing}
        <div class="hpf-sub"><h4>${this._t('zha')}</h4></div>
        <p class="hpf-hint">${this._t('zha_hint')}</p>
        <div class="hpf-actions">
          <button class="btn ghost" ?disabled=${!mayLoad || this._busy('zha')} @click=${this._readZha}>
            <ha-icon icon="mdi:access-point-network"></ha-icon>${this._t('zha_read')}
          </button>
          <span class="hpf-hint">${this._status('zha')}</span>
        </div>
        <div class="hpf-sub"><h4>${this._t('z2m')}</h4></div>
        <div class="hpf-field">
          <span class="hpf-label hpf-labelrow"><label for="z2m-topics">${this._t('z2m_topics')}</label></span>
          <textarea id="z2m-topics" class="hpf-input" rows="2" spellcheck="false" ?disabled=${!admin}
            aria-invalid=${this._invalidTopic ? 'true' : nothing}
            .value=${this._topicText} @input=${(event: Event) =>
              this._editTopics((event.target as HTMLTextAreaElement).value)}></textarea>
          ${this._invalidTopic ? html`<p class="hpf-error" role="alert">${this._t('error_invalid_topic')}</p>` : nothing}
        </div>
        <div class="hpf-callout hpf-warning"><ha-icon icon="mdi:alert-outline"></ha-icon><p>${this._t('z2m_warning')}</p></div>
        ${topics.map((topic) => html`<div class="hpf-actions">
          <button class="btn ghost" ?disabled=${!mayLoad || this._invalidTopic || this._busy(`z2m:${topic}`)}
            @click=${() => this._refreshZ2m(topic)}>
            <ha-icon icon="mdi:refresh"></ha-icon>${this._t('z2m_update')} · ${topic}
          </button>
          <span class="hpf-hint">${this._status(`z2m:${topic}`)}</span>
        </div>`)}` : nothing}
    `;
  }
}

if (!customElements.get('hp-zigbee-topology-settings')) {
  customElements.define('hp-zigbee-topology-settings', HpZigbeeTopologySettings);
}
