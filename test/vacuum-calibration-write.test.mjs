import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyCalibrationProposal,
  saveAutomaticCalibration,
  saveManualCalibration,
  saveVacuumMatrix,
} from '../test-build/vacuum-calibration-write.js';
import { installAdoption } from './helpers/adoption-host.mjs';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function fixture({ marker = true, save, pending = true } = {}) {
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
  // The card's deferred config write: callable (re-arm), pending, cancel.
  const deferredWrite = Object.assign(() => { deferredWrite.armed = true; deferredWrite.arms += 1; }, {
    armed: pending, arms: 0,
    pending: () => deferredWrite.armed,
    cancel: () => { deferredWrite.armed = false; },
  });
  const host = {
    _devices: [{
      id: 'vac', bindingKind: 'entity', bindingRef: 'vacuum.demo',
      space: 'ground', area: null, hidden: false,
    }],
    _saveConfigDebounced: deferredWrite,
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
  installAdoption(host, { config: accepted, configRev: 7 });
  const runtime = {
    host,
    _prepareConfigCandidate: (config) => config,
    _saveConfigNow: save || (async () => {
      host._adoption.refreshConfigFingerprint();
    }),
  };
  return { accepted, host, runtime, toasts, rebuilds: () => rebuilds, deferredWrite };
}

test('rejected matrix restores the accepted marker and a retry can persist (#442)', async () => {
  let reject = true;
  const f = fixture({ save: async () => {
    if (reject) throw new Error('semantic reject');
    f.host._adoption.refreshConfigFingerprint();
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

// #842 К4: the calibration candidate carries the pending deferred edit, so the
// write cancels its timer; only a rolled-back rejection re-arms it, once.
test('#842 AC4 vacuum calibration: a rejected matrix re-arms the cancelled pending write once', async () => {
  const f = fixture({ save: async () => { throw new Error('semantic reject'); } });
  assert.equal(await saveVacuumMatrix(f.runtime, 'vac', 'camera.map', 'new', [2, 0, 30, 0, 2, 40], 'upstairs'), false);
  assert.equal(f.deferredWrite.armed, true);
  assert.equal(f.deferredWrite.arms, 1);
});

test('#842 AC4 vacuum calibration: success, nothing pending or a conflict reload arm nothing', async () => {
  const ok = fixture();
  assert.equal(await saveVacuumMatrix(ok.runtime, 'vac', 'camera.map', 'new', [2, 0, 30, 0, 2, 40], 'upstairs'), true);
  assert.equal(ok.deferredWrite.armed, false, 'the accepted matrix write carried it');
  assert.equal(ok.deferredWrite.arms, 0);
  const idle = fixture({ pending: false, save: async () => { throw new Error('offline'); } });
  await saveVacuumMatrix(idle.runtime, 'vac', 'camera.map', 'new', [2, 0, 30, 0, 2, 40], 'upstairs');
  assert.equal(idle.deferredWrite.arms, 0);
  const conflict = fixture({ save: async () => {
    // `_saveConfigNow` adopts the newer server revision before rethrowing.
    conflict.host._adoption.adoptResponses({ config: { ...conflict.accepted, settings: { theirs: true } }, rev: 8 },
      undefined, () => {}, () => {});
    throw Object.assign(new Error('changed elsewhere'), { code: 'conflict' });
  } });
  await saveVacuumMatrix(conflict.runtime, 'vac', 'camera.map', 'new', [2, 0, 30, 0, 2, 40], 'upstairs');
  assert.equal(conflict.deferredWrite.arms, 0);
  assert.deepEqual(conflict.host._serverCfg.settings, { theirs: true });
});

test('#842 К2 vacuum calibration: a refusal to delete plan objects shows no save-failed toast', async () => {
  const f = fixture({ save: async () => {
    throw Object.assign(new Error('saving would delete plan objects'), { code: 'geometry-cleanup-required' });
  } });
  assert.equal(await saveVacuumMatrix(f.runtime, 'vac', 'camera.map', 'new', [2, 0, 30, 0, 2, 40], 'upstairs'), false);
  assert.deepEqual(f.host._serverCfg, f.accepted);
  assert.deepEqual(f.toasts, []);
});
