import type { ConfigAdoption } from './config-adoption';
import type { DeviceLayout } from './device-position-history';
import type { ServerConfig } from './types';
import { OptimizePreviewChangedError, sameOptimizeSource, type OptimizeWriteGuard } from './optimize-source';

interface Clearable { clear(): void }
interface Flushable { pending(): boolean; flush(): void }

export interface PlanOptimizeWriteHost {
  hass: { callWS(message: Record<string, unknown>): Promise<Record<string, unknown>> };
  _saveConfigDebounced: Flushable;
  _writeChain: Promise<void>;
  readonly _cfgRev: number;
  readonly _layoutRev: number;
  /** #500: identity owner — bodies and revisions of the pair land through it. */
  readonly _adoption: ConfigAdoption;
  _geometryHistory: Clearable;
  _devicePositionHistory: Clearable;
  _cancelDeviceDrag(): boolean;
  _canOptimizeUndo: boolean;
  _undoKind: 'optimize' | 'import' | null;
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
): Promise<void> {
  if (host._saveConfigDebounced.pending()) host._saveConfigDebounced.flush();
  await host._writeChain;
  if (guard && (!guard.canWrite() || !sameOptimizeSource(guard.source, guard.current()))) {
    throw new OptimizePreviewChangedError();
  }
  const response = await host.hass.callWS({
    type: 'houseplan/plan/optimize',
    config,
    layout,
    expected_config_rev: guard?.source.configRev ?? host._cfgRev,
    expected_layout_rev: guard?.source.layoutRev ?? host._layoutRev,
  });
  if (guard && (guard.source.authorityCurrent?.() === false
      || guard.current().connection !== guard.source.connection)) {
    throw new OptimizePreviewChangedError();
  }
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
}
