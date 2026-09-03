import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyCalibrationProposal,
  saveAutomaticCalibration,
  saveManualCalibration,
  saveVacuumMatrix,
} from '../test-build/vacuum-calibration-write.js';

const fingerprint = (value) => JSON.stringify(value);

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function fixture({ marker = true, save } = {}) {
  const accepted = {
    spaces: [{ id: 'ground', title: 'Ground', rooms: [] }],
    markers: marker ? [{
      id: 'vac', binding: 'entity:vacuum.demo', space: 'ground',
      vacuum: {
        calibration: { old: [1, 0, 10, 0, 1, 20] },
        map_routes: [{
          id: 'upstairs', source: 'camera.map', map_id: 'new', space: 'ground',
          calibration: [1, 0, 10, 0, 1, 20],
        }],
      },
    }] : [],
  };
  const toasts = [];
  let rebuilds = 0;
  const host = {
    _serverCfg: accepted,
    _devices: [{
      id: 'vac', bindingKind: 'entity', bindingRef: 'vacuum.demo',
      space: 'ground', area: null, hidden: false,
    }],
    _cfgContentFingerprint: fingerprint(accepted),
    _cfgRev: 7,
    _saveConfigDebounced: { pending: () => true, cancel: () => {} },
    _regSignature: 'accepted',
    _markerDialog: { busy: false, name: 'Vacuum draft' },
    _vacCalConfirm: null,
    _vacFit: null,
    _space: 'ground',
    _commitSpace: () => true,
    _maybeRebuildDevices: () => { rebuilds += 1; },
    _showToast: (message) => { toasts.push(message); },
    _t: (key, vars) => `${key}${vars ? `:${JSON.stringify(vars)}` : ''}`,
    _errText: (error) => String(error?.message || error),
    requestUpdate: () => {},
  };
  const runtime = {
    host,
    _prepareConfigCandidate: (config) => config,
    _saveConfigNow: save || (async () => {
      host._cfgContentFingerprint = fingerprint(host._serverCfg);
    }),
  };
  return { accepted, host, runtime, toasts, rebuilds: () => rebuilds };
}

test('rejected matrix restores the accepted marker and a retry can persist (#442)', async () => {
  let reject = true;
  const f = fixture({ save: async () => {
    if (reject) throw new Error('semantic reject');
    f.host._cfgContentFingerprint = fingerprint(f.host._serverCfg);
  } });

  assert.equal(await saveVacuumMatrix(
    f.runtime, 'vac', 'camera.map', 'new', [2, 0, 30, 0, 2, 40], 'upstairs',
  ), false);
  assert.deepEqual(f.host._serverCfg, f.accepted);
  assert.notEqual(f.host._serverCfg, f.accepted, 'rollback uses an isolated accepted snapshot');
  assert.match(f.toasts.at(-1), /^toast\.cfg_save_failed/);

  reject = false;
  assert.equal(await saveVacuumMatrix(
    f.runtime, 'vac', 'camera.map', 'new', [2, 0, 30, 0, 2, 40], 'upstairs',
  ), true);
  const route = f.host._serverCfg.markers[0].vacuum.map_routes
    .find((item) => item.id === 'upstairs');
  assert.deepEqual(route.calibration, [2, 0, 30, 0, 2, 40]);
});

test('rejected first-use calibration leaves no synthetic marker (#442)', async () => {
  const f = fixture({ marker: false, save: async () => { throw new Error('offline'); } });

  assert.equal(await saveVacuumMatrix(
    f.runtime, 'vac', 'camera.map', 'default', [1, 0, 0, 0, 1, 0],
  ), false);
  assert.deepEqual(f.host._serverCfg.markers, []);
});

test('automatic calibration stays busy and has no early success (#442)', async () => {
  const gate = deferred();
  const f = fixture({ save: () => gate.promise });
  const pending = saveAutomaticCalibration(f.runtime, {
    markerId: 'vac', source: 'camera.map', mapId: 'default', space: 'ground',
    matrix: [1, 0, 0, 0, 1, 0], rooms: 3,
  });

  assert.equal(f.host._markerDialog.busy, true);
  assert.equal(f.toasts.some((toast) => toast.startsWith('vac.autocal_done')), false);
  const duplicate = saveAutomaticCalibration(f.runtime, {
    markerId: 'vac', source: 'camera.map', mapId: 'default', space: 'ground',
    matrix: [1, 0, 0, 0, 1, 0], rooms: 3,
  });
  await duplicate;
  gate.resolve();
  await pending;
  assert.equal(f.host._markerDialog.busy, false);
  assert.equal(f.toasts.filter((toast) => toast.startsWith('vac.autocal_done')).length, 1);
});

test('rejected proposal and manual fit preserve their exact retry drafts (#442)', async () => {
  let reject = true;
  const f = fixture({ save: async () => {
    if (reject) throw new Error('invalid calibration');
  } });
  const matrix = [1, 0, 11, 0, 1, 22];
  const proposal = {
    markerId: 'vac', source: 'camera.map', mapId: 'default', routeId: 'ground',
    space: 'ground', matrix, rooms: 4, error: '42 cm',
  };
  f.host._vacCalConfirm = proposal;
  await applyCalibrationProposal(f.runtime, false);
  assert.deepEqual(f.host._vacCalConfirm, { ...proposal, busy: false });

  const fit = {
    markerId: 'vac', source: 'camera.map', mapId: 'default', routeId: 'ground',
    p: { s: 1.25, rot: 90, mir: true, ox: 12, oy: 34 }, drag: null,
  };
  f.host._vacCalConfirm = null;
  f.host._vacFit = fit;
  await saveManualCalibration(f.runtime, () => matrix);
  assert.deepEqual(f.host._vacFit, { ...fit, busy: false, drag: null });

  reject = false;
  await saveManualCalibration(f.runtime, () => matrix);
  assert.equal(f.host._vacFit, null);
  assert.equal(f.toasts.at(-1), 'vac.cal_done');
});
