/** Full-card adapter for the pure runtime-version controller (#462). */
import { html, nothing, type TemplateResult } from 'lit';
import type { I18nKey } from './i18n';
import type { ServerConfig } from './types';
import {
  fetchAuthoritativeConfig,
  normalizeRuntimeVersion,
  VersionRecoveryController,
  type VersionBannerNotice,
  type VersionReloadSafetySnapshot,
  type VersionRecoveryStorage,
} from './version-recovery';
import { DECOR_ASSETS_API_VERSION } from './decor-assets';

interface PendingCollection { readonly size: number }
interface PendingDebounce { pending(): boolean }
interface VersionRecoveryContinuity {
  readonly hasCompleteFrame: boolean;
  readonly state: string;
  readonly overlayBlocksInteraction: boolean;
}

export interface ConfigCapabilitiesCardPort {
  readonly hass: { callWS<T>(message: { type: string }): Promise<T> };
  _haIntegrationVersion: string | null;
  _haSupportApi: number | null;
  _haDecorAssetsApi: number | null;
  _syncVersionRecovery(): void;
}

/** Fields returned by houseplan/config/get and consumed by full-card flows. */
export interface AuthoritativeConfigResponse {
  readonly config?: ServerConfig | null;
  readonly rev?: number;
  readonly can_write?: boolean;
  readonly can_optimize_undo?: boolean;
  readonly undo_kind?: string | null;
  readonly integration_version?: unknown;
  readonly support_api?: unknown;
  readonly decor_assets_api?: unknown;
  readonly virtual_lights?: unknown;
}

export function adoptCardConfigCapabilities(
  host: ConfigCapabilitiesCardPort,
  response: unknown,
): void {
  const capabilities = response && typeof response === 'object'
    ? response as Partial<Record<
        'integration_version' | 'support_api' | 'decor_assets_api', unknown
      >> : {};
  host._haIntegrationVersion = normalizeRuntimeVersion(capabilities.integration_version);
  const supportApi = capabilities.support_api;
  host._haSupportApi = typeof supportApi === 'number' && Number.isSafeInteger(supportApi)
    ? supportApi : null;
  host._haDecorAssetsApi = capabilities.decor_assets_api === DECOR_ASSETS_API_VERSION
    ? DECOR_ASSETS_API_VERSION : null;
  host._syncVersionRecovery();
}

export function getAuthoritativeCardConfig(
  host: ConfigCapabilitiesCardPort,
): Promise<AuthoritativeConfigResponse> {
  return fetchAuthoritativeConfig(
    () => host.hass.callWS<AuthoritativeConfigResponse>({ type: 'houseplan/config/get' }),
    (response) => adoptCardConfigCapabilities(host, response),
  );
}

/** Runtime-shaped port: types stay here instead of growing the card core. */
export interface VersionRecoveryCardPort {
  readonly ownerDocument: Document;
  readonly isConnected: boolean;
  readonly _config: { kiosk?: boolean } | null;
  readonly _mode: string;
  readonly _editing: boolean;
  readonly _loadOk: boolean;
  readonly _loading: boolean;
  readonly _continuityDataReady: boolean;
  readonly _resumeSettling: boolean;
  readonly _connectionWasLost: boolean;
  readonly _booting: boolean;
  readonly _bootFading: boolean;
  readonly _bootSettling: boolean;
  readonly _bootSoft: boolean;
  readonly _continuity: VersionRecoveryContinuity;
  readonly _stageEl: { readonly clientWidth: number; readonly clientHeight: number } | null;
  readonly _pointers: PendingCollection;
  readonly _touchContacts: PendingCollection;
  readonly _touchSequenceMultitouch: boolean;
  readonly _roomPointer: unknown;
  readonly _panStart: unknown;
  readonly _panLock: unknown;
  readonly _pinchStart: unknown;
  readonly _swipeStart: unknown;
  readonly _tabDrag: unknown;
  readonly _tabDragRelease: unknown;
  readonly _drag: unknown;
  readonly _deviceDrag: unknown;
  readonly _rlResize: unknown;
  readonly _resize: { readonly dragging?: boolean } | null;
  readonly _physicalDrag: unknown;
  readonly _physicalRotate: unknown;
  readonly _opDrag: unknown;
  readonly _decorDraft: unknown;
  readonly _decorMove: unknown;
  readonly _dtDrag: unknown;
  readonly _bdDrag: unknown;
  readonly _furnTouchPending: unknown;
  readonly _compassDrag: unknown;
  readonly _viewportGestureDirty: boolean;
  readonly _devicePositionBusy: boolean;
  readonly _modeTransitionBusy: boolean;
  readonly _cameraTransition: { readonly active: boolean };
  readonly _slide: string;
  readonly _warmModeRequest: number;
  readonly _writesPending: number;
  readonly _saveConfigDebounced: PendingDebounce;
  readonly _pendingPhysicalWrites: PendingCollection;
  readonly _persistLayout: PendingDebounce;
  readonly _dirtyPos: PendingCollection;
  readonly _sentPos: PendingCollection;
  readonly _cyclePausedUntil: number;
  readonly _zoom: number;
  readonly _editorSecondaryDialogBlocked: boolean;
  readonly _partitionDeleteDialog: unknown;
  readonly _roomDeleteDialog: unknown;
  readonly _backdropGuard: unknown;
  readonly _vacFit: unknown;
  readonly _editorSecondary: { readonly hasOpenGroup?: boolean } | null;
  readonly _furnPalette: unknown;
  readonly _decorImagePalette: unknown;
  _reloadDocument(): void;
  requestUpdate(): unknown;
  _t(key: I18nKey): string;
}

export function createCardVersionRecovery(host: VersionRecoveryCardPort): VersionRecoveryController {
  return new VersionRecoveryController({
    clock: {
      setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
      clearTimeout: (handle) => window.clearTimeout(handle),
    },
    storage: (): VersionRecoveryStorage | null => host.ownerDocument.defaultView?.sessionStorage ?? null,
    safety: () => cardVersionReloadSafetySnapshot(host),
    reload: () => host._reloadDocument(),
    changed: () => { host.requestUpdate(); },
  });
}

export function cardVersionReloadSafetySnapshot(
  host: VersionRecoveryCardPort,
): VersionReloadSafetySnapshot {
  const stage = host._stageEl;
  const initialFrameSettled = host._loadOk && !host._loading
    && host._continuityDataReady && !host._resumeSettling && !host._connectionWasLost
    && !host._booting && !host._bootFading && !host._bootSettling && !host._bootSoft
    && host._continuity.hasCompleteFrame && host._continuity.state === 'steady'
    && !host._continuity.overlayBlocksInteraction
    && !!stage && stage.clientWidth > 0 && stage.clientHeight > 0;
  const gesturesIdle = host._pointers.size === 0 && host._touchContacts.size === 0
    && !host._touchSequenceMultitouch && !host._roomPointer && !host._panStart && !host._panLock
    && !host._pinchStart && !host._swipeStart && !host._tabDrag && !host._tabDragRelease
    && !host._drag && !host._deviceDrag && !host._rlResize && !host._resize?.dragging
    && !host._physicalDrag && !host._physicalRotate && !host._opDrag && !host._decorDraft
    && !host._decorMove && !host._dtDrag && !host._bdDrag && !host._furnTouchPending
    && !host._compassDrag && !host._viewportGestureDirty && !host._devicePositionBusy
    && !host._modeTransitionBusy && !host._cameraTransition.active && !host._slide
    && host._warmModeRequest === 0;
  const surfacesIdle = !host._editorSecondaryDialogBlocked && !host._partitionDeleteDialog
    && !host._roomDeleteDialog && !host._backdropGuard && !host._vacFit
    && !host._editorSecondary?.hasOpenGroup && !host._furnPalette && !host._decorImagePalette;
  return {
    connected: host.isConnected,
    initialFrameSettled,
    viewOnly: host._config?.kiosk === true && host._mode === 'view' && !host._editing,
    surfacesIdle,
    configWritesIdle: host._writesPending === 0 && !host._saveConfigDebounced.pending(),
    physicalWritesIdle: host._pendingPhysicalWrites.size === 0,
    layoutWritesIdle: !host._persistLayout.pending() && host._dirtyPos.size === 0
      && host._sentPos.size === 0 && !host._devicePositionBusy,
    gesturesIdle,
    interactionPauseElapsed: Date.now() >= host._cyclePausedUntil,
    baseZoom: host._zoom <= 1.001,
  };
}

export function renderVersionBanner(
  host: VersionRecoveryCardPort,
  controller: VersionRecoveryController,
  notice: VersionBannerNotice | null = controller.banner,
): TemplateResult | typeof nothing {
  if (!notice) return nothing;
  const leaving = notice.phase === 'leaving';
  const reload = (event: MouseEvent) => {
    event.stopPropagation();
    if (event.isTrusted && controller.hasCurrentMismatchNotice) host._reloadDocument();
  };
  const finish = (event: AnimationEvent) => {
    if (event.target === event.currentTarget && event.animationName === 'hp-version-recovery-out') {
      controller.finishBannerExit(notice.token);
    }
  };
  return html`<div class="version-recovery phase-${notice.phase}"
      data-version-recovery-target=${notice.backend} role="status"
      aria-live="polite" aria-atomic="true" aria-hidden=${leaving ? 'true' : nothing}
      ?inert=${leaving} @animationend=${finish}>
    <div class="version-recovery-card">
      <ha-icon icon="mdi:update" aria-hidden="true"></ha-icon>
      <div class="version-recovery-copy">
        <strong>${host._t('version_mismatch.title')}</strong>
        <span>${host._t('version_mismatch.body')}</span>
        <span class="version-recovery-versions">
          <span>${host._t('version_mismatch.frontend')}: <b>${notice.frontend}</b></span>
          <span>${host._t('version_mismatch.backend')}: <b>${notice.backend}</b></span>
        </span>
      </div>
      <button class="btn on version-recovery-reload" type="button" @click=${reload}>
        ${host._t('version_mismatch.reload')}
      </button>
    </div>
  </div>`;
}
