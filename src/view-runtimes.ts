/** Per-card optional View boundaries. No editor chunk or second reload budget. */
import { html, nothing, type TemplateResult } from 'lit';
import { ref } from 'lit/directives/ref.js';
import { ControlSurfacePresentation } from './control-surface-presentation';
import type { I18nKey } from './i18n';
import type { ServerConfig } from './types';
import type { ConfigWriteContext } from './config-write-context';
import type { VersionRecoveryController } from './version-recovery';
import type { LiveRuntime } from './live-interaction-runtime';
import type { LoadedSummaryPanelRuntime } from './summary-panel-runtime-loaded';
import type { ZigbeeTopologyHass } from './zigbee-topology-runtime';
import { liveRuntimeCode, zigbeeOverlayCode, converterInfoCode, deviceMenuCode, markerAlertCode } from './view-runtime-code';
import type { ViewDeviceMenu, ViewDeviceMenuRequest } from './view-device-menu';
import type { MarkerAlertViewRuntime } from './marker-alert-view-runtime';
import type { Marker, DevItem } from './types';
import { summaryRuntimeLoader } from './summary-runtime-loader';
import { ViewRuntimeBoundary, guardedViewRuntimeReload } from './view-runtime-boundary';
import { zigbeeTopologyOverlayRequested } from './zigbee-topology-overlay-bridge';
import { effectiveSummaryVisible, parseSummaryLocal, summaryPanelOf } from './summary-panel';
import { summaryPreferenceKey, type SummaryPreferenceHost } from './summary-panel-identity';

export interface ViewRuntimeHost extends SummaryPreferenceHost {
  readonly isConnected: boolean;
  readonly _configWriteContext: ConfigWriteContext;
  readonly _versionRecovery: VersionRecoveryController;
  readonly _settings: ServerConfig['settings'];
  readonly _mode: string;
  readonly _kiosk: boolean;
  readonly narrow: boolean | null;
  readonly hass: ZigbeeTopologyHass & { callWS?: unknown; connection?: unknown };
  readonly _serverCfg?: Pick<ServerConfig, 'spaces'> | null;
  readonly _serverStorage?: boolean;
  readonly _booting?: boolean;
  readonly _model?: readonly unknown[];
  readonly _importDialog?: unknown;
  _liveRt: LiveRuntime | null;
  _summary?: LoadedSummaryPanelRuntime;
  _capturedSeq: number;
  readonly _markers: readonly Marker[];
  readonly _space?: string;
  readonly _showAll?: boolean;
  readonly _devices?: readonly DevItem[];
  readonly _displayDevices?: readonly DevItem[];
  _alerts?: MarkerAlertViewRuntime;
  readonly _editorRuntime?: { _guardDraftNavigation(resume: () => void): boolean } | null;
  _reloadDocument(automatic?: boolean): void;
  _t(key: I18nKey): string;
  requestUpdate(): unknown;
}

export function summaryRecoveryRequested(host: ViewRuntimeHost): boolean {
  if (host._mode !== 'view') return false;
  const key = summaryPreferenceKey(host);
  if (!key) return false;
  try {
    const raw = JSON.parse(host.ownerDocument.defaultView?.localStorage.getItem(key) || 'null');
    const config = summaryPanelOf(host._settings, key => key).config;
    return !!config && effectiveSummaryVisible({ view: true, localShow: parseSummaryLocal(raw, null).show,
      showOnMobile: config.show_on_mobile, narrow: host.narrow, fits: true });
  } catch { return false; }
}

interface FailedViewRuntime {
  name: I18nKey;
  boundary: { readonly canRetry: boolean; readonly terminalFailure: boolean; retry(): Promise<boolean> };
}

export class ViewRuntimes {
  private active = false;
  private readonly notice = new ControlSurfacePresentation(() => this.host.requestUpdate());
  private noticeFailures: FailedViewRuntime[] = [];
  readonly live: ViewRuntimeBoundary<object, LiveRuntime>;
  readonly summary: ViewRuntimeBoundary<unknown, LoadedSummaryPanelRuntime>;
  readonly zigbee: ViewRuntimeBoundary<object, true>;
  readonly converter: ViewRuntimeBoundary<object, true>;
  readonly deviceMenu: ViewRuntimeBoundary<object, ViewDeviceMenu>;
  private menu: ViewDeviceMenu | null = null;
  readonly alerts: ViewRuntimeBoundary<object, MarkerAlertViewRuntime>;

  constructor(private readonly host: ViewRuntimeHost) {
    const port = <Runtime>(install: (runtime: Runtime) => void, informational = false, demanded = () => true) => ({
      owner: () => informational ? host : host._configWriteContext.claim(),
      current: (owner: object) => this.active && host.isConnected && host.ownerDocument.visibilityState !== 'hidden' && demanded()
        && (informational ? owner === host : host._configWriteContext.current(owner, host.hass)),
      install,
      changed: () => {
        if (!host.isConnected) return;
        this.syncRecovery(); host.requestUpdate();
      },
    });
    this.live = new ViewRuntimeBoundary(host, liveRuntimeCode, port(runtime => { host._liveRt = runtime; }));
    this.deviceMenu = new ViewRuntimeBoundary(host, deviceMenuCode, port(runtime => {
      this.menu?.disconnect(); this.menu = runtime; runtime.connect();
    }));
    this.summary = new ViewRuntimeBoundary(host, summaryRuntimeLoader, port(runtime => {
      host._summary = runtime; host._capturedSeq = -1;
      if (host.isConnected) runtime.connect();
    }));
    this.zigbee = new ViewRuntimeBoundary(host, zigbeeOverlayCode, port(() => {}, false, () => this.wantsZigbee()));
    this.converter = new ViewRuntimeBoundary(host, converterInfoCode, port(() => {}, true, () => this.wantsConverter()));
    this.alerts = new ViewRuntimeBoundary(host, markerAlertCode, port(runtime => {
      host._alerts?.disconnect(); host._alerts = runtime; runtime.connect();
    }, false, () => this.wantsAlerts()));
  }

  connect(): void {
    this.active = true;
    this.deviceMenu.connect(false); this.menu?.connect();
    this.host._summary?.connect();
    this.live.connect(false); this.summary.connect(false); this.zigbee.connect(false); this.converter.connect(false);
    this.alerts.connect(false); this.host._alerts?.connect();
    this.reconcile();
  }
  disconnect(): void {
    this.active = false;
    this.notice.reset(); this.noticeFailures = [];
    this.deviceMenu.disconnect(); this.menu?.disconnect();
    this.live.disconnect(); this.summary.disconnect(); this.zigbee.disconnect(); this.converter.disconnect();
    this.host._summary?.disconnect();
    this.alerts.disconnect(); this.host._alerts?.disconnect();
  }
  reconcile(): void {
    if (!this.active || this.host.ownerDocument.visibilityState === 'hidden') return;
    if (this.live.state !== 'ready') void this.live.ensure();
    if (this.summary.state !== 'ready') void this.summary.ensure();
    if (this.zigbee.state !== 'ready' && this.wantsZigbee()) void this.zigbee.ensure();
    if (this.converter.state !== 'ready' && this.wantsConverter()) void this.converter.ensure();
    if (this.alerts.state !== 'ready' && this.wantsAlerts()) void this.alerts.ensure();
    this.host._alerts?.reconcile();
    this.syncRecovery();
  }
  visibility(hidden: boolean): void {
    if (!this.active) return;
    const boundaries = [this.live, this.summary, this.zigbee, this.converter, this.alerts, this.deviceMenu];
    for (const boundary of boundaries) {
      if (hidden) boundary.disconnect(); else boundary.connect(false);
    }
    if (hidden) this.menu?.disconnect(); else this.menu?.connect();
    this.host._alerts?.reconcile();
    if (!hidden) this.reconcile();
  }
  withLive(run: (runtime: LiveRuntime) => void): void {
    const host = this.host, owner = host._configWriteContext.claim();
    void this.live.ensure().then(ready => {
      if (ready && this.active && host.isConnected && host.ownerDocument.visibilityState !== 'hidden'
          && host._configWriteContext.current(owner, host.hass) && host._liveRt) run(host._liveRt);
    });
  }
  openDeviceMenu(request: ViewDeviceMenuRequest): void {
    this.menu?.close();
    void this.deviceMenu.ensure().then(ready => { if (ready && request.current()) this.menu?.open(request); });
  }
  renderDeviceMenu(): TemplateResult | typeof nothing { return this.menu?.render() ?? nothing; }
  private wantsZigbee(): boolean {
    const host = this.host;
    return zigbeeTopologyOverlayRequested({ hass: host.hass, settings: host._settings,
      view: host._mode === 'view', kiosk: host._kiosk });
  }
  private wantsConverter(): boolean {
    const host = this.host;
    return !host._booting && !!(host._importDialog || host._serverCfg?.spaces.length === 0
      || host._serverStorage === false && host._model?.length === 0);
  }
  private wantsAlerts(): boolean {
    // Presence is the import boundary. The sole strict codec lives inside the
    // optional graph; unsupported input never creates a producer or a timer.
    const host = this.host, devices = host._displayDevices || host._devices;
    return host._markers.some(marker => !marker.removed && Array.isArray(marker.alert_sources) && marker.alert_sources.length > 0
      && (!devices || devices.some(device => device.id === marker.id
        && (host._space === undefined || device.space === host._space)
        && (!device.hidden || host._mode === 'devices' && host._showAll === true))));
  }
  private failures(): FailedViewRuntime[] {
    const failures: FailedViewRuntime[] = [];
    if (this.deviceMenu.unavailable) failures.push({ name: 'view.menu_title', boundary: this.deviceMenu });
    if (this.live.unavailable) failures.push({ name: 'view.runtime_live', boundary: this.live });
    if (this.summary.unavailable && summaryRecoveryRequested(this.host)) {
      failures.push({ name: 'view.runtime_summary', boundary: this.summary });
    }
    if (this.zigbee.unavailable && this.wantsZigbee()) {
      failures.push({ name: 'view.runtime_zigbee', boundary: this.zigbee });
    }
    if (this.converter.unavailable && this.wantsConverter()) failures.push({ name: 'view.runtime_converter', boundary: this.converter });
    if (this.alerts.unavailable && this.wantsAlerts()) failures.push({ name: 'device.issues.alarm_title', boundary: this.alerts });
    return failures;
  }
  private syncRecovery(): void {
    this.host._versionRecovery.setRuntimeFailure(this.failures().some(item => item.boundary.terminalFailure));
  }
  private reload(event: Event): void {
    event.stopPropagation();
    if (!event.isTrusted || !this.failures().length) return;
    const host = this.host, owner = host._configWriteContext.claim();
    guardedViewRuntimeReload({
      current: () => host.isConnected && host._configWriteContext.current(owner, host.hass),
      guard: host._editorRuntime ? resume => host._editorRuntime!._guardDraftNavigation(resume) : undefined,
      reload: () => host._reloadDocument(),
    });
  }
  render(): TemplateResult | typeof nothing {
    const failures = this.failures();
    if (failures.length) this.noticeFailures = failures;
    this.notice.sync(this.active && failures.length > 0, 'bottom');
    if (!this.notice.mounted) { this.noticeFailures = []; return nothing; }
    const shown = this.noticeFailures, interactive = this.notice.interactive;
    const retryable = shown.filter(item => item.boundary.canRetry);
    return html`<aside class="view-runtime-notice hpf-notice" data-hp="view-runtime-notice" role="status"
      .inert=${!interactive} aria-hidden=${interactive ? nothing : 'true'} aria-live=${interactive ? 'polite' : 'off'}
      ${ref(element => this.notice.updated(element instanceof HTMLElement ? element : null))}>
      <span class="hpf-notice-copy">${this.host._t('view.runtime_failed')}
        <span class="view-runtime-functions hpf-notice-muted">${shown.map(item => this.host._t(item.name)).join(' · ')}</span>
      </span>
      <div>${retryable.length ? html`<button class="btn" type="button" data-hp="view-runtime-retry"
        @click=${(event: Event) => { event.stopPropagation(); if (event.isTrusted && this.notice.interactive)
          for (const item of this.failures().filter(item => item.boundary.canRetry)) void item.boundary.retry(); }}
        >${this.host._t('view.runtime_retry')}</button>` : nothing}
      <button class="btn" type="button" data-hp="view-runtime-reload" @click=${(event: Event) => { if (this.notice.interactive) this.reload(event); }}
        >${this.host._t('view.runtime_reload')}</button></div>
    </aside>`;
  }
}
