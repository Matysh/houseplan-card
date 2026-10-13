// #842: the production editor write path — the real runtime `_writeConfig`,
// `_saveConfigNow`, `_saveConfig`, `_saveMarker` and `_prepareConfigCandidate`,
// a real `ConfigAdoption` and a real `HpConfirmController` — over a recorded
// `config/set` transport and a deferred write with the card's semantics
// (`debounce(…, 500)` + its background failure policy). Only the transport,
// the timer and post-save UI teardown are substituted.
import { installAdoption } from './adoption-host.mjs';
import { HpConfirmController } from '../../test-build/danger-confirm.js';
import { canonicalizeConfigGeometry } from '../../test-build/coordinate-canonicalization.js';

globalThis.window ??= { customCards: [] };
globalThis.window.customCards ??= [];
const { HouseplanEditorRuntime } = await import('../../test-build/houseplan-editor-runtime.js');

export const clone = (value) => JSON.parse(JSON.stringify(value));
// The card's literal, not an import: the same harness also runs against the
// pre-#842 build to show its witnesses red there.
const isGeometryCleanupRefusal = (error) => error?.code === 'geometry-cleanup-required';

/** The card's `debounce(fn, 500)`: re-arming restarts the timer; flush runs a pending call now. */
export function deferredWrite(fn, ms = 500) {
  let timer;
  let armed = false;
  const write = () => {
    clearTimeout(timer);
    armed = true;
    write.arms += 1;
    timer = setTimeout(() => { armed = false; fn(); }, ms);
  };
  write.arms = 0;
  write.pending = () => armed;
  write.cancel = () => { clearTimeout(timer); armed = false; };
  write.flush = () => {
    if (!armed) return;
    clearTimeout(timer);
    armed = false;
    fn();
  };
  return write;
}

/** Let every queued write and its follow-ups settle (no timers involved). */
export async function settle(rounds = 20) {
  for (let index = 0; index < rounds; index++) await Promise.resolve();
}

/**
 * A marker-capable editor host. `reject(canonicalConfig, count)` may return an
 * error to reject that `config/set`; `server` records every sent document.
 */
export function editorWriteHarness({ config, rev = 1, reject = null, marker = null } = {}) {
  const server = { config: clone(config), rev, sets: [], reject };
  const toasts = [];
  const confirms = [];
  const rollbacks = [];
  const host = {
    isConnected: true,
    _writesPending: 0,
    _writeChain: Promise.resolve(),
    _cfgEpoch: 0,
    _pendingPhysicalWrites: new Map(),
    _geometryHistory: { clear() {} },
    _devicePositionHistory: { clear() {} },
    _regSignature: '',
    _layout: {},
    _defPos: {},
    _space: 'f1',
    _devices: [],
    _markerDialog: null,
    _ledEditor: null,
    _checkSpacePhysicalGeometry: () => ({ ok: true }),
    _showToast: (message) => toasts.push(message),
    _t: (key, vars) => (vars ? `${key}:${JSON.stringify(vars)}` : key),
    _errText: (error) => String(error?.message || error),
    _maybeRebuildDevices() {},
    requestUpdate() {},
    _cancelDeviceDrag() {},
    _noteLayoutRev() {},
    _bindingEntities: () => [],
    _spaceModelById: (id) => ({ id, vb: [0, 0, 1000, 1000], rooms: [] }),
    _spaceModel: () => ({ id: host._space, vb: [0, 0, 1000, 1000], rooms: [] }),
    hass: { callWS: async () => ({ rev: 1 }) },
    async _sendConfigCandidate(candidate) {
      const canonical = canonicalizeConfigGeometry(candidate);
      server.sets.push(clone(canonical));
      const error = server.reject?.(canonical, server.sets.length);
      if (error) throw error;
      server.config = clone(canonical);
      server.rev += 1;
      host._adoption.acceptConfigWrite(canonical, { rev: server.rev });
    },
    async _reloadConfigOnly() {
      host._adoption.adoptResponses({ config: clone(server.config), rev: server.rev }, undefined, () => {}, () => {});
    },
  };
  const adoption = installAdoption(host, { config: clone(config), configRev: rev });
  const rollback = adoption.rollbackOptimistic.bind(adoption);
  adoption.rollbackOptimistic = (attempt) => {
    const rolledBack = rollback(attempt);
    rollbacks.push(rolledBack);
    return rolledBack;
  };
  Object.defineProperty(host, '_markers', { get: () => host._serverCfg?.markers || [] });
  const controller = new HpConfirmController((state) => { if (state) confirms.push(state); });
  host._confirmDanger = (request) => controller.confirm(request);

  const runtime = Object.create(HouseplanEditorRuntime.prototype);
  runtime.host = host;
  // The card's deferred writer and its background failure policy.
  host._saveConfigDebounced = deferredWrite(() => {
    if (!host._serverCfg) return;
    runtime._writeConfig().catch((error) => {
      if (error?.code === 'geometry-unsafe' || isGeometryCleanupRefusal(error)) return;
      if (error?.code === 'conflict') host._showToast('toast.conflict');
      else host._showToast(host._t('toast.cfg_save_failed', { err: host._errText(error) }));
    });
  });

  if (marker) {
    host._devices = [{ id: marker.id, space: marker.space || 'f1', marker }];
    host._layout = { [marker.id]: { s: marker.space || 'f1', x: 0.1, y: 0.1 } };
    Object.assign(runtime, {
      _effectiveMarkerTapAction: () => 'info',
      _effectiveStoredTapAction: () => 'info',
      _closeMarkerDialog: () => { host._markerDialog = null; },
    });
  }

  /** The K3 dialog currently shown, if any. */
  const activeConfirm = () => controller.state;
  /** Answer the K3 dialog as the person would: true = «Delete and save». */
  const answer = (accepted) => controller.resolve(controller.state.token, accepted);
  return { host, runtime, server, toasts, confirms, rollbacks, activeConfirm, answer };
}

/** The marker dialog draft for an existing virtual marker, as `_openMarkerDialog` builds it. */
export function markerDraft(marker, patch = {}) {
  return {
    devId: marker.id, binding: 'virtual', bindingMode: 'virtual', room: '',
    name: marker.name, icon: '', display: 'badge', rippleColor: '', rippleSize: 1.5,
    size: 1, angle: 0, tapAction: 'info', controls: [], pdfs: [], glowRadius: '',
    model: '', link: '', description: '', busy: false, ...patch,
  };
}
