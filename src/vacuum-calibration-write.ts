/** Atomic persistence and retry state for vacuum calibration (#442). */
import type { I18nKey } from './i18n';
import type { DevItem, Marker, ServerConfig } from './types';
import { fitFromMatrix, type Affine, type FitParams } from './vacuum';
import { writeVacuumMatrix } from './vacuum-route-edit';
import {
  optimisticAttempt, rollbackOptimistic, type OptimisticAttempt,
} from './serialized-write-queue';
import { contentFingerprint } from './visual-continuity';

export type CalibrationProposal = {
  markerId: string;
  source: string;
  mapId: string;
  routeId?: string;
  space?: string;
  matrix: Affine;
  rooms: number;
  error: string;
  busy?: boolean;
};

export type VacuumFit = {
  markerId: string;
  source: string;
  mapId: string;
  routeId?: string;
  p: FitParams;
  busy?: boolean;
  drag: null | {
    kind: 'move' | 'scale';
    sx: number;
    sy: number;
    p0: FitParams;
    fx: number;
    fy: number;
  };
};

export interface VacuumCalibrationWriteHost {
  _serverCfg: ServerConfig | null;
  _devices: DevItem[];
  _cfgContentFingerprint: string;
  _cfgRev: number;
  _saveConfigDebounced: { pending: () => boolean; cancel: () => void };
  _regSignature: string;
  _markerDialog: any;
  _vacCalConfirm: CalibrationProposal | null;
  _vacFit: VacuumFit | null;
  _space: string;
  _commitSpace: (spaceId: string) => boolean;
  _maybeRebuildDevices: () => void;
  _showToast: (message: string) => void;
  _t: (key: I18nKey, vars?: Record<string, string | number>) => string;
  _errText: (error: unknown) => string;
  requestUpdate: () => unknown;
}

export interface VacuumCalibrationWriteRuntime {
  host: VacuumCalibrationWriteHost;
  _prepareConfigCandidate: (config: ServerConfig) => ServerConfig;
  _saveConfigNow: (attempt?: OptimisticAttempt<ServerConfig>) => Promise<void>;
}

const automaticWrites = new WeakSet<VacuumCalibrationWriteRuntime>();

const rebuild = (host: VacuumCalibrationWriteHost): void => {
  host._regSignature = '';
  host._maybeRebuildDevices();
  host.requestUpdate();
};

/** Persist one exact route matrix without ever mutating the accepted config. */
export async function saveVacuumMatrix(
  runtime: VacuumCalibrationWriteRuntime,
  markerId: string,
  source: string,
  mapId: string,
  matrix: Affine,
  routeId = '',
): Promise<boolean> {
  const host = runtime.host;
  const previous = host._serverCfg;
  if (!previous) return false;
  let candidate = JSON.parse(JSON.stringify(previous)) as ServerConfig;
  candidate.markers = candidate.markers || [];
  let marker = candidate.markers.find((item) => item.id === markerId);
  if (!marker) {
    const device = host._devices.find((item) => item.id === markerId);
    if (!device || (device.bindingKind !== 'device' && device.bindingKind !== 'entity')
        || !device.bindingRef) return false;
    marker = {
      id: device.id,
      binding: `${device.bindingKind}:${device.bindingRef}`,
      space: device.space || null,
      area: device.area || null,
      hidden: device.hidden ? true : false,
    } as Marker;
    candidate.markers.push(marker);
  }
  marker.vacuum = writeVacuumMatrix(marker.vacuum || {}, {
    source, mapId, routeId, matrix,
  });
  candidate = runtime._prepareConfigCandidate(candidate);
  const attempt = optimisticAttempt(
    previous, candidate, host._cfgContentFingerprint, host._cfgRev, contentFingerprint,
  );
  host._serverCfg = candidate;
  rebuild(host);
  if (host._saveConfigDebounced.pending()) host._saveConfigDebounced.cancel();
  try {
    await runtime._saveConfigNow(attempt);
    return true;
  } catch (error) {
    rollbackOptimistic(host, attempt, contentFingerprint);
    rebuild(host);
    host._showToast(host._t('toast.cfg_save_failed', { err: host._errText(error) }));
    return false;
  }
}

/** Low-residual auto calibration: keep its source dialog and suppress doubles. */
export async function saveAutomaticCalibration(
  runtime: VacuumCalibrationWriteRuntime,
  request: Omit<CalibrationProposal, 'error' | 'busy'>,
): Promise<void> {
  if (automaticWrites.has(runtime)) return;
  automaticWrites.add(runtime);
  const host = runtime.host;
  const dialog = host._markerDialog;
  const busyDialog = dialog ? { ...dialog, busy: true } : null;
  if (busyDialog) {
    host._markerDialog = busyDialog;
    host.requestUpdate();
  }
  try {
    const saved = await saveVacuumMatrix(
      runtime, request.markerId, request.source, request.mapId, request.matrix, request.routeId,
    );
    if (saved) host._showToast(host._t('vac.autocal_done', { rooms: String(request.rooms) }));
  } finally {
    automaticWrites.delete(runtime);
    if (busyDialog && host._markerDialog === busyDialog) {
      host._markerDialog = { ...busyDialog, busy: false };
      host.requestUpdate();
    }
  }
}

/** Apply a high-residual proposal, or transfer it unchanged into manual fit. */
export async function applyCalibrationProposal(
  runtime: VacuumCalibrationWriteRuntime,
  manual: boolean,
): Promise<void> {
  const host = runtime.host;
  const proposal = host._vacCalConfirm;
  if (!proposal || proposal.busy) return;
  if (manual) {
    const device = host._devices.find((item) => item.id === proposal.markerId);
    const fit = fitFromMatrix(proposal.matrix);
    if (!device || !fit) return;
    const space = proposal.space || device.space;
    if (space !== host._space && !host._commitSpace(space)) return;
    host._vacCalConfirm = null;
    host._markerDialog = null;
    host._vacFit = {
      markerId: proposal.markerId,
      source: proposal.source,
      routeId: proposal.routeId,
      mapId: proposal.mapId,
      p: fit,
      drag: null,
    };
    return;
  }
  const busyProposal = { ...proposal, busy: true };
  host._vacCalConfirm = busyProposal;
  host.requestUpdate();
  const saved = await saveVacuumMatrix(
    runtime, proposal.markerId, proposal.source, proposal.mapId, proposal.matrix, proposal.routeId,
  );
  if (host._vacCalConfirm === busyProposal) {
    host._vacCalConfirm = saved ? null : { ...proposal, busy: false };
    host.requestUpdate();
  }
  if (saved) host._showToast(host._t('vac.autocal_done', { rooms: String(proposal.rooms) }));
}

/** Save manual-fit parameters, retaining the exact overlay draft on rejection. */
export async function saveManualCalibration(
  runtime: VacuumCalibrationWriteRuntime,
  matrixOf: (params: FitParams) => Affine,
): Promise<void> {
  const host = runtime.host;
  const fit = host._vacFit;
  if (!fit || fit.busy) return;
  const busyFit = { ...fit, busy: true, drag: null };
  host._vacFit = busyFit;
  host.requestUpdate();
  const saved = await saveVacuumMatrix(
    runtime, fit.markerId, fit.source, fit.mapId, matrixOf(fit.p), fit.routeId,
  );
  if (host._vacFit === busyFit) {
    host._vacFit = saved ? null : { ...fit, busy: false, drag: null };
    host.requestUpdate();
  }
  if (saved) host._showToast(host._t('vac.cal_done'));
}
