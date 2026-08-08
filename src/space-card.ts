/**
 * houseplan-space-card — a READ-ONLY, static schematic of a single houseplan space,
 * embeddable on any dashboard. Renders exactly what is configured (plan + configured
 * room borders/names + live device markers at their saved positions) with NO marker interactivity
 * (no clicks/hover/tooltips/drag/more-info). A footer button opens
 * the space in the full component via a deep-link (`#space=<id>`).
 */
import { LitElement, html, nothing, css, type TemplateResult, type PropertyValues } from 'lit';
import { cardStyles } from './styles';
import { buildSpaceDevices, renderSpaceStatic, spaceModels } from './space-render';
import { getConfig, onConfigChange, cachedSnapshot, type HpConfigSnapshot } from './config-store';
import { t, langOf, type Lang } from './i18n';
import { ContentSigner } from './signing';
import { normalizeDeviceDisplay, referencedContentUrls } from './logic';
import { acquireHaRegistries, activeRegistryHass, haRegistrySnapshot } from './ha-binding-status';
import { edgeActivity } from './device-visual';
import {
  presentationSourceSignature, resolvePresentationSources,
  type PresentationActivityRuntime,
} from './device-presentation';
import type { DevItem } from './types';
import './space-editor';

const fireEvent = (node: EventTarget, type: string, detail?: unknown) => {
  const ev = new Event(type, { bubbles: true, composed: true }) as any;
  ev.detail = detail ?? {};
  node.dispatchEvent(ev);
};
const navigate = (path: string) => {
  history.pushState(null, '', path);
  fireEvent(window, 'location-changed', { replace: false });
};

interface SpaceCardConfig {
  type: string;
  space: string;
  title?: string;
  show_button?: boolean;
  button_label?: string;
  button_target?: string;
  icon_size?: number;
  show_temperature?: boolean;
  live_states?: boolean;
  show_signal?: boolean;
  language?: string;
}

interface StaticActivityRuntime extends PresentationActivityRuntime {
  last: Record<string, string>;
  timer: number;
}

class HouseplanSpaceCard extends LitElement {
  public hass?: any;
  private _config?: SpaceCardConfig;
  private _snap: HpConfigSnapshot | null = null;
  private _loading = false;
  private _unsub?: () => void;
  private _stageWidth = 0;
  private _stageObserver?: ResizeObserver;
  private _observedStage?: HTMLElement;
  private _haRegistryRelease?: () => void;
  private _haRegistryConnection: any = null;
  private _haRegistryRevision = -1;
  private _devices: DevItem[] = [];
  private _activityRuntime = new Map<string, StaticActivityRuntime>();
  private _onHaRegistryUpdate = () => {
    const revision = haRegistrySnapshot(this.hass).revision;
    if (revision === this._haRegistryRevision) return;
    this._haRegistryRevision = revision;
    this.requestUpdate();
  };

  private _ensureHaRegistryAuthority(): void {
    const connection = this.hass?.connection || null;
    if (!connection || connection === this._haRegistryConnection) return;
    this._haRegistryRelease?.();
    this._haRegistryConnection = connection;
    this._haRegistryRevision = -1;
    this._haRegistryRelease = acquireHaRegistries(this.hass, this._onHaRegistryUpdate);
    this._onHaRegistryUpdate();
  }

  static properties = {
    hass: { attribute: false },
    _config: { state: true },
    _snap: { state: true },
  };

  public static getConfigElement() {
    return document.createElement('houseplan-space-card-editor');
  }

  public static getStubConfig(hass: any): Partial<SpaceCardConfig> {
    const snap = cachedSnapshot();
    const first = spaceModels(snap?.config || null)[0]?.id || '';
    return {
      type: 'custom:houseplan-space-card', space: first, show_button: true,
      live_states: true, show_temperature: true, show_signal: true,
    };
  }

  public setConfig(config: SpaceCardConfig): void {
    if (!config || !config.space) {
      throw new Error('houseplan-space-card: "space" is required');
    }
    this._config = {
      show_button: true, button_target: '/plan-doma',
      live_states: true, show_temperature: true, show_signal: true,
      ...config,
    };
    // instant paint from the full card's localStorage snapshot, refresh in the background
    this._snap = this._snap || cachedSnapshot();
  }

  public connectedCallback(): void {
    super.connectedCallback();
    if (this.hass) this._ensureHaRegistryAuthority();
    this._unsub = onConfigChange(() => {
      this._loading = false;
      this._snap = null;
      this.requestUpdate();
    });
    // a dashboard on a wall tablet outlives a 24 h signature
    this._signer.start(() => this.hass, () => this._referenced());
  }

  public disconnectedCallback(): void {
    this._unsub?.();
    this._unsub = undefined;
    this._stageObserver?.disconnect();
    this._stageObserver = undefined;
    this._observedStage = undefined;
    this._signer.dispose();
    this._haRegistryRelease?.();
    this._haRegistryRelease = undefined;
    this._haRegistryConnection = null;
    for (const runtime of this._activityRuntime.values()) window.clearTimeout(runtime.timer);
    this._activityRuntime.clear();
    super.disconnectedCallback();
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('hass') && this.hass) this._ensureHaRegistryAuthority();
    if (this.hass && !this._loading && (!this._snap || changed.has('hass'))) {
      if (!this._snap || !this._loadedOnce) this._load();
    }
    this._refreshDevices();
  }

  private _stampActivity(runtime: StaticActivityRuntime, kind: 'event' | 'transition'): void {
    if (runtime.flashTs && Date.now() - runtime.flashTs < 3300
        && runtime.flashKind === 'event' && kind === 'transition') return;
    runtime.flashTs = Date.now();
    runtime.flashKind = kind;
    runtime.gen++;
    window.clearTimeout(runtime.timer);
    runtime.timer = window.setTimeout(() => this.requestUpdate(), 3360);
  }

  /** Track witnessed edges for the read-only card without inventing activity on first load. */
  private _syncActivity(devices: DevItem[], planHass: any): void {
    if (this._config?.live_states === false) {
      for (const runtime of this._activityRuntime.values()) window.clearTimeout(runtime.timer);
      this._activityRuntime.clear();
      return;
    }
    const live = new Set<string>();
    for (const device of devices) {
      if (device.hidden) continue;
      if (normalizeDeviceDisplay(device.marker?.display) === 'static_icon') continue;
      live.add(device.id);
      const sources = resolvePresentationSources(planHass, device);
      const samples = sources.samples;
      const signature = presentationSourceSignature(
        planHass, device, this._config?.show_temperature !== false, sources,
      );
      let runtime = this._activityRuntime.get(device.id);
      if (!runtime || runtime.sources !== signature) {
        if (runtime) window.clearTimeout(runtime.timer);
        runtime = {
          sources: signature,
          last: Object.fromEntries(samples.map((sample) => [sample.eid, sample.state])),
          flashTs: 0,
          flashKind: null,
          timer: 0,
          gen: 0,
        };
        this._activityRuntime.set(device.id, runtime);
        continue;
      }
      if (runtime.flashKind === 'transition'
          && samples.some((sample) => sample.activity === 'transition')) {
        window.clearTimeout(runtime.timer);
        runtime.flashTs = 0;
        runtime.flashKind = null;
      }
      let edge: 'event' | 'transition' | null = null;
      for (const sample of samples) {
        const found = edgeActivity(runtime.last[sample.eid], sample);
        if (found === 'event' || (!edge && found)) edge = found;
        runtime.last[sample.eid] = sample.state;
      }
      if (edge) this._stampActivity(runtime, edge);
    }
    for (const [id, runtime] of this._activityRuntime) {
      if (live.has(id)) continue;
      window.clearTimeout(runtime.timer);
      this._activityRuntime.delete(id);
    }
  }

  private _refreshDevices(): void {
    if (!this.hass || !this._snap?.config || !this._config) return;
    const registry = haRegistrySnapshot(this.hass);
    const devices = buildSpaceDevices({
      hass: this.hass,
      registry,
      cfg: this._snap.config,
      lang: this._lang,
    });
    this._syncActivity(devices, activeRegistryHass(this.hass, registry));
    this._devices = devices;
  }

  protected updated(): void {
    const stage = this.renderRoot.querySelector<HTMLElement>('.hp-static-stage') || undefined;
    if (stage === this._observedStage) return;
    this._stageObserver?.disconnect();
    this._observedStage = stage;
    if (!stage) {
      this._stageObserver = undefined;
      return;
    }
    const measure = () => {
      const width = stage.clientWidth;
      if (width > 0 && Math.abs(width - this._stageWidth) > 0.5) {
        this._stageWidth = width;
        this.requestUpdate();
      }
    };
    this._stageObserver = new ResizeObserver(measure);
    this._stageObserver.observe(stage);
    measure();
  }

  private _loadedOnce = false;
  private async _load(): Promise<void> {
    if (!this.hass || this._loading) return;
    this._loading = true;
    try {
      const snap = await getConfig(this.hass);
      this._snap = snap;
      this._loadedOnce = true;
    } catch {
      /* keep any localStorage snapshot */
    } finally {
      this._loading = false;
      this.requestUpdate();
    }
  }

  private get _lang(): Lang {
    return langOf(this.hass, this._config?.language);
  }

  public getCardSize(): number {
    const models = spaceModels(this._snap?.config || null);
    const sp = models.find((s) => s.id === this._config?.space);
    if (sp) {
      const ratio = sp.vb[3] / sp.vb[2]; // h/w
      return Math.max(3, Math.round(ratio * 8)) + (this._config?.show_button === false ? 0 : 1);
    }
    return 6;
  }

  private _errorCard(msg: string): TemplateResult {
    return html`<ha-card><div class="hp-static-error">${msg}</div></ha-card>`;
  }

  /**
   * Same signer as the main card (review R3-2). The previous copy here signed
   * the url and then threw it away: `getCardSize()` mutated a throwaway model
   * while `render()` rebuilt its own from the config, so the <image> kept
   * asking for the raw protected path and got a 401 on every render.
   */
  private _signer = new ContentSigner(() => this.requestUpdate());

  private _referenced(): Set<string> {
    return referencedContentUrls(this._snap?.config);
  }

  protected render(): TemplateResult | typeof nothing {
    if (!this._config) return nothing;
    const cfg = this._snap?.config;
    if (!cfg) {
      // still loading and no snapshot yet
      return html`<ha-card><div class="hp-static-error">${t(this._lang, 'space_card.loading')}</div></ha-card>`;
    }
    const spaceId = this._config.space;
    const stage = renderSpaceStatic({
      hass: this.hass,
      cfg,
      layout: this._snap?.layout || {},
      spaceId,
      iconSize: this._config.icon_size,
      stageWidth: this._stageWidth,
      lang: this._lang,
      // resolved at render time: a url baked in earlier would be the unsigned one
      displayUrl: (raw) => this._signer.display(this.hass, raw),
      registry: haRegistrySnapshot(this.hass),
      devices: this._devices,
      activityRuntime: this._activityRuntime,
      liveStates: this._config.live_states !== false,
      showTemperature: this._config.show_temperature !== false,
      showSignal: this._config.show_signal !== false,
    });
    if (!stage) {
      return this._errorCard(t(this._lang, 'space_card.not_found', { id: spaceId }));
    }
    const sp = spaceModels(cfg).find((s) => s.id === spaceId);
    const title = this._config.title !== undefined ? this._config.title : sp?.title || '';
    const showButton = this._config.show_button !== false;
    const label = this._config.button_label || t(this._lang, 'space_card.button');
    return html`
      <ha-card>
        ${title ? html`<div class="hp-static-title">${title}</div>` : nothing}
        ${stage}
        ${showButton
          ? html`<div class="hp-static-foot">
              <button class="hp-static-btn" @click=${this._goToSpace}>${label}</button>
            </div>`
          : nothing}
      </ha-card>
    `;
  }

  private _goToSpace = (): void => {
    const base = (this._config?.button_target || '/plan-doma').replace(/#.*$/, '');
    navigate(`${base}#space=${encodeURIComponent(this._config!.space)}`);
  };

  static styles = [
    cardStyles,
    css`
      .hp-static-title {
        font-weight: 700;
        padding: 10px 14px 6px;
        font-size: 16px;
        color: var(--primary-text-color);
      }
      .hp-static-stage {
        position: relative;
        width: 100%;
        container-type: inline-size;
        overflow: hidden;
        pointer-events: none; /* kill ALL interaction on the schematic (§4) */
        background: var(--ha-card-background, var(--card-background-color, #111));
      }
      .hp-static-stage svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        display: block;
      }
      /* Opaque plan paper — the scene bg_color/daynight sky shows only AROUND
         the plan (owner 2026-08-03). The static card keeps its historical
         canvas colour: the theme card background. Drawn plans paper the room
         contours (per-room shapes, fill only, no stroke) — same contract as
         the full card. */
      .hp-paper {
        fill: var(--ha-card-background, var(--card-background-color, #111));
        stroke: none;
      }
      .wallbody-fill {
        fill: var(--wall-fill, #ffffff);
        fill-opacity: var(--wall-fill-op, 1);
        fill-rule: evenodd;
        stroke: none;
        pointer-events: none;
      }
      .wallbody {
        fill: url(#hp-wall-hatch);
        fill-rule: evenodd;
        stroke: var(--room-stroke, var(--hp-muted, #607d8b));
        stroke-width: 0.6;
        pointer-events: none;
      }
      .wallbody.solid {
        fill: none;
      }
      .hp-static-stage .devlayer {
        position: absolute;
        inset: 0;
      }
      .hp-static-foot {
        padding: 8px 12px 12px;
        pointer-events: auto; /* the button stays clickable */
      }
      .hp-static-btn {
        width: 100%;
        padding: 9px 14px;
        border: none;
        border-radius: 10px;
        background: var(--primary-color, #3ea6ff);
        color: var(--text-primary-color, #fff);
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
      }
      .hp-static-btn:hover {
        filter: brightness(1.08);
      }
      .hp-static-error {
        padding: 24px;
        text-align: center;
        color: var(--secondary-text-color, #9aa4ad);
      }
    `,
  ];
}

if (!customElements.get('houseplan-space-card')) {
  customElements.define('houseplan-space-card', HouseplanSpaceCard);
}

(window as any).customCards = (window as any).customCards || [];
if (!(window as any).customCards.find((c: any) => c.type === 'houseplan-space-card')) {
  (window as any).customCards.push({
    type: 'houseplan-space-card',
    name: 'House Plan — Space (static)',
    description: 'Read-only live schematic of a single houseplan space, with a deep-link button.',
    preview: false,
    documentation: 'https://github.com/Matysh/houseplan-card',
  });
}

export { HouseplanSpaceCard };
