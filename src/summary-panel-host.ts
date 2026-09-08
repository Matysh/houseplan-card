import type { HaRegistrySnapshot } from './ha-binding-status';
import type { I18nKey } from './i18n';
import type { CardConfig, Marker, ServerConfig, SpaceModel } from './types';
import type { AuthoritativeConfigResponse } from './version-recovery-card';

export interface SummaryHassState {
  state?: string;
  attributes?: {
    friendly_name?: string;
    unit_of_measurement?: string;
    [key: string]: unknown;
  };
}

export interface SummaryHass {
  states?: Record<string, SummaryHassState>;
  user?: { id?: string; name?: string; is_admin?: boolean };
  config?: {
    time_zone?: string;
    unit_system?: { length?: string };
  };
  [key: string]: unknown;
}

/**
 * Narrow structural boundary between the card and the lazy #437 runtime.
 * The card predates a public host interface; keeping the cast at construction
 * prevents the lazy modules from spreading that legacy untyped boundary.
 */
export interface SummaryPanelHost extends Node {
  hass?: SummaryHass;
  panelHost: boolean;
  narrow: boolean | null;
  renderRoot: ShadowRoot;
  ownerDocument: Document;
  isConnected: boolean;
  updateComplete: Promise<unknown>;
  requestUpdate(): void;

  _mode: 'view' | 'plan' | 'devices' | 'decor';
  _space: string;
  _settings: ServerConfig['settings'];
  _config?: CardConfig;
  _model: SpaceModel[];
  _markers: Marker[];
  _serverCfg: ServerConfig | null;
  _cfgRev: number;
  _cfgEpoch: number;
  _layoutRev: number;
  _cfgContentFingerprint: string;
  _regSignature: string;
  _signer: {
    prepareImage(hass: SummaryHass | undefined, href: string): Promise<boolean>;
  };
  _continuity: {
    readonly hasCompleteFrame: boolean;
    readonly state: string;
    note(event: string): void;
  };
  _writesPending: number;
  _writeChain: Promise<void>;
  _kiosk: boolean;
  _kioskScale: { icon: number; font: number };
  _haSummaryPanelApi: number | null;
  _canManageConfiguration: boolean;
  _haRegistry: HaRegistrySnapshot;
  _areaToSpace: Record<string, { space: string }>;
  _stageEl: HTMLElement | null;

  _t(key: I18nKey): string;
  _errText(error: unknown): string;
  _showToast?(message: string): void;
  _confirmDanger(request: {
    key: string;
    kind: 'warning';
    title: string;
    message: string;
    objectName: string;
    confirmLabel: string;
    cancelLabel: string;
  }): Promise<boolean>;
  _sendConfigCandidate(candidate: ServerConfig): Promise<void>;
  _getAuthoritativeConfig(): Promise<AuthoritativeConfigResponse>;
  _candidateBackdrop(config: ServerConfig | null): string;
  _scheduleLoadRetry(force?: boolean): void;
  _beginContinuityCandidate(reason: string, dataReady: boolean): number;
  _adoptStructuralResponses(response: AuthoritativeConfigResponse): { configChanged: boolean };
  _syncDecorAssets(config: ServerConfig | null): Promise<void>;
  _adoptInitialSpace(models: SpaceModel[], authoritative?: boolean): unknown;
  _maybeRebuildDevices(): void;
  _resumePendingNavMode(): boolean;
  _restoreZoom(): void;
  _reloadConfigOnly(force?: boolean): Promise<void>;
  _cacheSnapshot(): void;
}
