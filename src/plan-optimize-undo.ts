import type { GatedAdoptionInput, GatedAdoptionResult, LayoutResponse } from './config-adoption';
import type { I18nKey } from './i18n';
import type { PlanOptimizeWriteHost } from './plan-optimize-write';
import type { AuthoritativeConfigResponse } from './version-recovery-card';

export interface UndoHass {
  callWS<T>(message: Record<string, unknown>): Promise<T>;
}

interface UndoHost extends Pick<PlanOptimizeWriteHost,
  '_cfgRev' | '_layoutRev' | '_geometryHistory' | '_devicePositionHistory' | '_cancelDeviceDrag'
  | '_canOptimizeUndo' | '_undoKind' | '_cfgEpoch' | '_modelCache' | '_frame' | '_regSignature'
  | '_maybeRebuildDevices' | '_cacheSnapshot' | 'requestUpdate'> {
  readonly hass: UndoHass;
  readonly isConnected: boolean;
  _optimizeUndoBusy: boolean;
  _configWriteGuard(): () => boolean;
  _getAuthoritativeConfig(hass?: UndoHass, isCurrent?: () => boolean): Promise<AuthoritativeConfigResponse>;
  _adoptAuthoritative(input: GatedAdoptionInput): Promise<GatedAdoptionResult>;
  _showToast(message: string): void;
  _t(key: I18nKey, vars?: Record<string, string | number>): string;
  _errText(error: unknown): string;
}

/** Shared Optimize/full-import Undo; retirement never cancels an already sent server write. */
export class PlanOptimizationUndo {
  private lifecycle = {};

  constructor(private readonly host: UndoHost, private readonly clearGesture: () => void) {}

  retire(): void {
    this.lifecycle = {};
    this.host._optimizeUndoBusy = false;
    this.host._canOptimizeUndo = false;
    this.host._undoKind = null;
  }

  async run(): Promise<void> {
    const host = this.host;
    if (!host._canOptimizeUndo || host._optimizeUndoBusy) return;
    const lifecycle = this.lifecycle;
    const authorityCurrent = host._configWriteGuard();
    const isCurrent = () => lifecycle === this.lifecycle && host.isConnected && authorityCurrent();
    if (!isCurrent()) return;
    const hass = host.hass;
    const undoKind = host._undoKind;
    this.clearGesture();
    host._optimizeUndoBusy = true;
    host.requestUpdate();
    try {
      await hass.callWS({
        type: 'houseplan/plan/optimize_undo',
        expected_config_rev: host._cfgRev,
        expected_layout_rev: host._layoutRev,
      });
      if (!isCurrent()) return;
      const [cfgResp, layResp] = await Promise.all([
        host._getAuthoritativeConfig(hass, isCurrent),
        hass.callWS<LayoutResponse>({ type: 'houseplan/layout/get' }),
      ]);
      if (!isCurrent()) return;
      // The adopter checks this same owner around its own backdrop await.
      const adopted = await host._adoptAuthoritative({
        cfgResp, layResp, reason: 'optimize-undo', profile: 'post-write', isCurrent,
      });
      if (!isCurrent() || adopted.status !== 'adopted') return;
      host._geometryHistory.clear();
      host._cancelDeviceDrag();
      host._devicePositionHistory.clear();
      host._canOptimizeUndo = false;
      host._undoKind = null;
      host._cfgEpoch++;
      host._modelCache = null;
      host._frame = null;
      host._regSignature = '';
      host._maybeRebuildDevices();
      host._cacheSnapshot();
      host.requestUpdate();
      host._showToast(host._t(undoKind === 'import' ? 'backup.import_undone' : 'gs.optimize_undone'));
    } catch (error) {
      if (!isCurrent()) return;
      host._canOptimizeUndo = false;
      host._undoKind = null;
      host._showToast(host._t('toast.error', { err: host._errText(error) }));
    } finally {
      if (isCurrent()) {
        host._optimizeUndoBusy = false;
        host.requestUpdate();
      }
    }
  }
}
