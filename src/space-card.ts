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
import {
  VisualContinuityController,
  contentFingerprint,
  subscribePageVisibility,
  visualFrameFingerprint,
  type PageVisibilitySignal,
} from './visual-continuity';
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
  private _reloadQueued = false;
  private _forceReloadQueued = false;
  private _reloadRetryTimer = 0;
  private _unsub?: () => void;
  private _stageWidth = 0;
  private _pendingStageWidth = 0;
  private _stageWidthRaf = 0;
  private _stageObserver?: ResizeObserver;
  private _observedStage?: HTMLElement;
  private _haRegistryRelease?: () => void;
  private _haRegistryConnection: any = null;
  private _haRegistryRevision = -1;
  private _devices: DevItem[] = [];
  private _continuity = this._newContinuityController();
  private _continuityUnsub?: () => void;
  private _continuityEpoch = 0;
  private _continuityDataReady = true;
  private _continuityPaintToken = -1;
  private _continuityDisposed = false;
  private _renderSnapshotAt = Date.now();
  private _hassSequence = 0;
  private _connHooked: any = null;
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
    _continuityEpoch: { state: true },
  };

  private _newContinuityController(): VisualContinuityController {
    return new VisualContinuityController(() => {
      this._continuityEpoch++;
      if (this.isConnected) this.requestUpdate();
    });
  }

  private _pageVisibility = (signal: PageVisibilitySignal): void => {
    const token = this._continuity.visibility(signal);
    if (signal.kind === 'hidden' || !signal.long) return;
    if (Date.now() - this._renderSnapshotAt > 1000) this._continuity.note('device-snapshot-stale');
    this._continuityDataReady = false;
    this._continuityPaintToken = -1;
    if (token === this._continuity.token) void this._load(true);
  };

  private _onConnLost = (): void => {
    this._continuityDataReady = false;
    this._continuityPaintToken = -1;
    this._continuity.connectionLost();
  };

  private _onConnReady = (): void => {
    this._beginContinuityCandidate('connection-ready', false, 'connection');
    void this._load(true);
  };

  private _hookConnection(): void {
    const connection = this.hass?.connection;
    if (!connection || connection === this._connHooked) return;
    this._connHooked?.removeEventListener?.('ready', this._onConnReady);
    this._connHooked?.removeEventListener?.('disconnected', this._onConnLost);
    this._connHooked?.removeEventListener?.('reconnect-error', this._onConnLost);
    connection.addEventListener?.('ready', this._onConnReady);
    connection.addEventListener?.('disconnected', this._onConnLost);
    connection.addEventListener?.('reconnect-error', this._onConnLost);
    this._connHooked = connection;
  }

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
    if (this._continuityDisposed) {
      this._continuity = this._newContinuityController();
      this._continuityDisposed = false;
      this._continuityPaintToken = -1;
    }
    super.connectedCallback();
    if (this.hass) this._ensureHaRegistryAuthority();
    this._continuityUnsub?.();
    this._continuityUnsub = subscribePageVisibility(this.ownerDocument, this._pageVisibility);
    this._unsub = onConfigChange(() => {
      this._beginContinuityCandidate('config-event', false);
      this._reloadQueued = true;
      void this._load();
    });
    // a dashboard on a wall tablet outlives a 24 h signature
    this._signer.start(() => this.hass, () => this._referenced());
  }

  public disconnectedCallback(): void {
    this._continuityUnsub?.();
    this._continuityUnsub = undefined;
    this._unsub?.();
    this._unsub = undefined;
    window.clearTimeout(this._reloadRetryTimer);
    this._reloadRetryTimer = 0;
    this._stageObserver?.disconnect();
    this._stageObserver = undefined;
    this._observedStage = undefined;
    if (this._stageWidthRaf) cancelAnimationFrame(this._stageWidthRaf);
    this._stageWidthRaf = 0;
    this._pendingStageWidth = 0;
    this._signer.dispose();
    this._haRegistryRelease?.();
    this._haRegistryRelease = undefined;
    this._haRegistryConnection = null;
    this._connHooked?.removeEventListener?.('ready', this._onConnReady);
    this._connHooked?.removeEventListener?.('disconnected', this._onConnLost);
    this._connHooked?.removeEventListener?.('reconnect-error', this._onConnLost);
    this._connHooked = null;
    for (const runtime of this._activityRuntime.values()) window.clearTimeout(runtime.timer);
    this._activityRuntime.clear();
    this._continuity.dispose();
    this._continuityDisposed = true;
    super.disconnectedCallback();
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('hass') && this.hass) {
      this._hassSequence++;
      this._renderSnapshotAt = Date.now();
      this._continuity.note('hass-snapshot');
      this._ensureHaRegistryAuthority();
      this._hookConnection();
    }
    if (this.hass && !this._loading && (!this._snap || changed.has('hass'))) {
      if (!this._snap || !this._loadedOnce) this._load();
    }
    this._refreshDevices();
    if (this._continuity.hasCompleteFrame && this._continuity.state === 'steady') {
      this._continuity.refreshCompleteFrame(this._frameFingerprint());
    }
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

  private _beginContinuityCandidate(
    reason: string,
    dataReady: boolean,
    recoveryReason: 'plan' | 'connection' | 'stage-size' | 'asset' = 'plan',
  ): number {
    this._continuityDataReady = dataReady;
    this._continuityPaintToken = -1;
    return this._continuity.beginCandidate(reason, recoveryReason);
  }

  private _backdropRaw(): string {
    if (!this._snap?.config || !this._config) return '';
    return spaceModels(this._snap.config).find((space) => space.id === this._config!.space)?.bg?.href || '';
  }

  private _candidateBackdrop(config: any): string {
    if (!config || !this._config) return '';
    return spaceModels(config).find((space) => space.id === this._config!.space)?.bg?.href || '';
  }

  private _assetsReady(): boolean {
    const raw = this._backdropRaw();
    return !raw || this._signer.isReady(this.hass, raw);
  }

  private _frameFingerprint(): string {
    const snap = this._snap;
    return visualFrameFingerprint([
      snap?.rev || 0,
      snap?.configFingerprint || contentFingerprint(snap?.config),
      snap?.layoutRev || 0,
      snap?.layoutFingerprint || contentFingerprint(snap?.layout),
      this._config?.space || '',
      this._stageWidth,
      this._hassSequence,
      this.hass?.themes?.darkMode ?? this.hass?.themes?.default_theme ?? '',
    ]);
  }

  private _stageValid(): boolean {
    const stage = this._observedStage;
    return !!stage && stage.clientWidth > 0 && stage.clientHeight > 0;
  }

  private _settleContinuityFrame(): void {
    if (!this._stageValid()) return;
    if (!this._continuity.hasCompleteFrame && this._continuity.state === 'steady') {
      if (!this._assetsReady()) {
        this._beginContinuityCandidate('asset-wait', true, 'asset');
        return;
      }
      this._renderSnapshotAt = Date.now();
      this._continuity.markCompleteFrame(this._frameFingerprint());
      return;
    }
    if (!this._continuityDataReady || !this._assetsReady()) return;
    if (!['holding', 'offline-stale', 'overlay-pending', 'overlay-visible', 'candidate-ready']
      .includes(this._continuity.state)) return;
    const token = this._continuity.token;
    if (this._continuityPaintToken === token) return;
    this._continuityPaintToken = token;
    if (!this._continuity.candidateReady(token)) return;
    void this._continuity.commitAfterPaint(token, {
      updateComplete: () => this.updateComplete,
      stageValid: () => this.isConnected && this._stageValid(),
      assetsReady: () => this._assetsReady(),
      frameFingerprint: () => this._frameFingerprint(),
    }).then((committed) => {
      if (!committed || token !== this._continuity.token) {
        if (token === this._continuity.token) this._continuityPaintToken = -1;
        return;
      }
      this._renderSnapshotAt = Date.now();
    });
  }

  private _onAssetLoaded = (raw: string): void => {
    this._signer.markLoaded(this.hass, raw);
    this._continuity.note('asset-ready');
    this._continuityPaintToken = -1;
    if (this._continuity.state !== 'steady') this.requestUpdate();
  };

  protected updated(): void {
    const stage = this.renderRoot.querySelector<HTMLElement>('.hp-static-stage') || undefined;
    if (stage !== this._observedStage) {
      this._stageObserver?.disconnect();
      this._observedStage = stage;
      if (!stage) {
        this._stageObserver = undefined;
      } else {
        const measure = () => {
          const width = stage.clientWidth;
          if (width <= 0 || Math.abs(width - this._stageWidth) <= 0.5) return;
          if (this._stageWidth <= 0) {
            this._stageWidth = width;
            this.requestUpdate();
            return;
          }
          this._pendingStageWidth = width;
          if (this._stageWidthRaf) return;
          this._stageWidthRaf = requestAnimationFrame(() => {
            this._stageWidthRaf = 0;
            const target = this._pendingStageWidth;
            this._pendingStageWidth = 0;
            if (!target || !this._observedStage || this._observedStage.clientWidth <= 0) return;
            if (Math.abs(this._observedStage.clientWidth - target) > 0.5) {
              measure();
              return;
            }
            if (Math.abs(target - this._stageWidth) <= 0.5) return;
            if (this._continuity.hasCompleteFrame) {
              this._beginContinuityCandidate('stage-resize', true, 'stage-size');
            }
            this._stageWidth = target;
            this.requestUpdate();
          });
        };
        this._stageObserver = new ResizeObserver(measure);
        this._stageObserver.observe(stage);
        measure();
      }
    }
    this._settleContinuityFrame();
  }

  private _loadedOnce = false;
  private async _load(force = false): Promise<void> {
    if (!this.hass) return;
    if (this._loading) {
      this._reloadQueued = true;
      this._forceReloadQueued ||= force;
      return;
    }
    this._loading = true;
    this._reloadQueued = false;
    let loaded = false;
    try {
      const snap = await getConfig(this.hass, force);
      const configChanged = !this._snap
        || this._snap.configFingerprint !== snap.configFingerprint;
      const layoutChanged = !this._snap
        || this._snap.layoutFingerprint !== snap.layoutFingerprint;
      if (configChanged && !await this._signer.prepareImage(
        this.hass, this._candidateBackdrop(snap.config),
      )) {
        this._continuity.note('asset-failed');
        window.clearTimeout(this._reloadRetryTimer);
        this._reloadRetryTimer = window.setTimeout(() => void this._load(true), 1000);
        return;
      }
      window.clearTimeout(this._reloadRetryTimer);
      this._reloadRetryTimer = 0;
      if ((configChanged || layoutChanged) && this._continuity.hasCompleteFrame
          && this._continuity.state === 'steady') {
        this._beginContinuityCandidate('structural-response', true);
      }
      if (configChanged || layoutChanged) {
        this._snap = snap;
      } else if (this._snap) {
        // Revision-only echoes are metadata, not a new visual candidate.
        this._snap.rev = snap.rev;
        this._snap.layoutRev = snap.layoutRev;
      }
      if (configChanged) this._continuity.note('config-candidate', { configRev: snap.rev });
      if (layoutChanged) this._continuity.note('layout-candidate', { layoutRev: snap.layoutRev });
      this._loadedOnce = true;
      loaded = true;
      this._continuityDataReady = true;
      this._refreshDevices();
    } catch {
      /* keep any localStorage snapshot */
    } finally {
      this._loading = false;
      if (!loaded && !this._continuity.hasCompleteFrame) this._continuityDataReady = true;
      this.requestUpdate();
      if (this._reloadQueued) {
        const forceAgain = this._forceReloadQueued;
        this._reloadQueued = false;
        this._forceReloadQueued = false;
        void this._load(forceAgain);
      }
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
    return html`<ha-card
      data-continuity-state=${this._continuity.state}
      data-continuity-token=${this._continuity.token}
      data-frame-fingerprint=${this._continuity.frameFingerprint || nothing}
      data-recovery-reason=${(this._continuity.overlayVisible || this._continuity.state === 'recovery-error')
        ? this._continuity.recoveryReason || nothing : nothing}>
        <div class="hp-static-error">${msg}</div>
      </ha-card>`;
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

  private _retryContinuity = (): void => {
    this._continuityDataReady = false;
    this._continuityPaintToken = -1;
    this._continuity.retry(this._continuity.recoveryReason || 'plan');
    void this._load(true);
  };

  private _renderRecoveryOverlay(): TemplateResult | typeof nothing {
    if (!this._continuity.overlayVisible && this._continuity.state !== 'recovery-error') return nothing;
    const connection = this._continuity.recoveryReason === 'connection';
    return html`<div class="recoveryoverlay phase-${this._continuity.overlayPhase}"
      role="status" aria-live="polite" aria-atomic="true">
        <ha-icon icon="mdi:home-sync-outline"></ha-icon>
        <span>${t(this._lang, connection
          ? 'continuity.restore_connection' : 'continuity.restore_plan')}</span>
        ${this._continuity.state === 'recovery-error'
          ? html`<button class="btn on" @click=${this._retryContinuity}>${t(this._lang, 'continuity.retry')}</button>`
          : nothing}
      </div>`;
  }

  /** Redacted lifecycle diagnostics shared with the full card's sampler. */
  public houseplanContinuityTrace(): readonly import('./visual-continuity').ContinuityTraceEvent[] {
    return this._continuity.trace;
  }

  protected render(): TemplateResult | typeof nothing {
    if (!this._config) return nothing;
    const cfg = this._snap?.config;
    if (!cfg) {
      // still loading and no snapshot yet
      return this._errorCard(t(this._lang, 'space_card.loading'));
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
      assetLoaded: this._onAssetLoaded,
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
    const recoveryReason = (this._continuity.overlayVisible || this._continuity.state === 'recovery-error')
      ? this._continuity.recoveryReason : null;
    return html`
      <ha-card
        data-continuity-state=${this._continuity.state}
        data-continuity-token=${this._continuity.token}
        data-frame-fingerprint=${this._continuity.frameFingerprint || nothing}
        data-recovery-reason=${recoveryReason || nothing}>
        ${title ? html`<div class="hp-static-title">${title}</div>` : nothing}
        <div class="hp-static-body">
          ${stage}
          ${this._renderRecoveryOverlay()}
        </div>
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
      .hp-static-body {
        position: relative;
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
