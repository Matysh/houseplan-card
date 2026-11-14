import type { ConfigAdoption } from './config-adoption';
import { sendHouseplanWrite } from './large-write-transport';
import { captureWriteAuthority } from './config-write-context';
import { planHostOf, type PlanHostProvider } from './ha-plan-host';
import type { DeviceLayout } from './device-position-history';
import type { ServerConfig } from './types';
import { OptimizePreviewChangedError, sameOptimizeSource, type OptimizeWriteGuard } from './optimize-source';
import { optimizeReceipt, OptimizeWriteFailure, type OptimizeReceipt, type OptimizeWriteStage } from './optimize-feedback';

interface Clearable { clear(): void }
interface Flushable { pending(): boolean; flush(): void }

export interface PlanOptimizeWriteHost extends PlanHostProvider {
  _configWriteGuard?: () => () => boolean;
  _saveConfigDebounced: Flushable;
  _writeChain: Promise<void>;
  readonly _cfgRev: number;
  readonly _layoutRev: number;
  readonly _haPlanGraphApi?: number | null;
  readonly _haGraphChangeApi?: number | null;
  readonly _haOpeningFeaturesApi?: number | null;
  /** #500: identity owner — bodies and revisions of the pair land through it. */
  readonly _adoption: ConfigAdoption;
  _geometryHistory: Clearable;
  _devicePositionHistory: Clearable;
  _cancelDeviceDrag(): boolean;
  _canOptimizeUndo: boolean;
  _undoKind: 'optimize' | 'import' | 'space_delete' | null;
  _dirtyPos: Set<string>;
  _sentPos: Map<string, DeviceLayout[string] | null>;
  _cfgEpoch: number;
  _modelCache: unknown;
  _frame: unknown;
  _regSignature: string;
  _maybeRebuildDevices(): void;
  _cacheSnapshot(): void;
  requestUpdate(): void;
}

/** The one adoption path shared by the Optimize dialog and Copy space. */
export async function commitPlanOptimization(
  host: PlanOptimizeWriteHost,
  config: ServerConfig,
  layout: DeviceLayout,
  guard?: OptimizeWriteGuard,
): Promise<OptimizeReceipt> {
  let stage: OptimizeWriteStage = 'before-dispatch';
  let receipt: OptimizeReceipt | undefined;
  try {
  if (host._saveConfigDebounced.pending()) host._saveConfigDebounced.flush();
  await host._writeChain;
  if (Number(config.model_version || 0) >= 11 && host._haPlanGraphApi === null)
    throw Object.assign(new Error('wall_model_client_outdated'), { code: 'wall_model_client_outdated' });
  if (guard && (!guard.canWrite() || !sameOptimizeSource(guard.source, guard.current()))) {
    throw new OptimizePreviewChangedError();
  }
  const writeHost = planHostOf(host), authorityCurrent = captureWriteAuthority(host);
  const expectedConfigRev = guard?.source.configRev ?? host._cfgRev;
  const expectedLayoutRev = guard?.source.layoutRev ?? host._layoutRev;
  const accepted = host._adoption.snapshot(null)?.config;
  const graph_change = Number(config.model_version) === 11 && Number(accepted?.model_version || 0) < 11
    ? (await import('./graph-write-change')).legacyGraphWriteChange(accepted, config, host._haGraphChangeApi===2?2:1) : undefined;
  const response = await sendHouseplanWrite<Record<string, unknown>>(writeHost, {
    type: 'houseplan/plan/optimize',
    ...(host._haOpeningFeaturesApi === 1 ? { opening_features_api: 1 } : {}),
    config,
    layout,
    expected_config_rev: expectedConfigRev,
    expected_layout_rev: expectedLayoutRev,
    ...(graph_change ? {graph_change} : {}),
  }, { isCurrent: () => authorityCurrent()
    && (!guard || guard.source.authorityCurrent?.() !== false
      && guard.current().connection === guard.source.connection),
    canDispatch: () => !guard || guard.canWrite() && sameOptimizeSource(guard.source, guard.current()),
    onDispatch: () => { stage = 'dispatched'; },
  });
  if (guard && (guard.source.authorityCurrent?.() === false
      || guard.current().connection !== guard.source.connection)) {
    throw new OptimizePreviewChangedError();
  }
  receipt = optimizeReceipt(response, config, layout, expectedConfigRev, expectedLayoutRev);
  stage = 'acknowledged';
  // A newer accepted pair must never be replaced by this older response.
  if (host._cfgRev > receipt.configRev || host._layoutRev > receipt.layoutRev)
    throw new OptimizePreviewChangedError();
  // Both bodies with both revisions from the reply that accepted them (#500 I2).
  host._adoption.acceptPairWrite(config, layout, response);
  host._geometryHistory.clear();
  host._cancelDeviceDrag();
  host._devicePositionHistory.clear();
  host._canOptimizeUndo = response.can_undo === true;
  host._undoKind = response.can_undo === true ? 'optimize' : null;
  host._dirtyPos.clear();
  host._sentPos.clear();
  host._cfgEpoch++;
  host._modelCache = null;
  host._frame = null;
  host._regSignature = '';
  host._maybeRebuildDevices();
  host._cacheSnapshot();
  host.requestUpdate();
  return receipt;
  } catch (error) {
    throw new OptimizeWriteFailure(error, stage, receipt);
  }
}
