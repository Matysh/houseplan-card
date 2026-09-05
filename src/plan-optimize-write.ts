import type { DeviceLayout } from './device-position-history';
import type { ServerConfig } from './types';
import { contentFingerprint } from './visual-continuity';

interface Clearable { clear(): void }
interface Flushable { pending(): boolean; flush(): void }

export interface PlanOptimizeWriteHost {
  hass: { callWS(message: Record<string, unknown>): Promise<Record<string, unknown>> };
  _saveConfigDebounced: Flushable;
  _writeChain: Promise<void>;
  _cfgRev: number;
  _cfgContentFingerprint: string;
  _layoutRev: number;
  _serverCfg: ServerConfig | null;
  _layout: DeviceLayout;
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

const finiteRevision = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** The one adoption path shared by the Optimize dialog and Copy space. */
export async function commitPlanOptimization(
  host: PlanOptimizeWriteHost,
  config: ServerConfig,
  layout: DeviceLayout,
): Promise<void> {
  if (host._saveConfigDebounced.pending()) host._saveConfigDebounced.flush();
  await host._writeChain;
  const response = await host.hass.callWS({
    type: 'houseplan/plan/optimize',
    config,
    layout,
    expected_config_rev: host._cfgRev,
    expected_layout_rev: host._layoutRev,
  });
  host._serverCfg = config;
  host._cfgContentFingerprint = contentFingerprint(config);
  host._layout = layout;
  host._geometryHistory.clear();
  host._cancelDeviceDrag();
  host._devicePositionHistory.clear();
  host._cfgRev = finiteRevision(response.config_rev, host._cfgRev + 1);
  host._layoutRev = finiteRevision(response.layout_rev, host._layoutRev + 1);
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
