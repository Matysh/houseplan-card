import assert from 'node:assert/strict';
import test from 'node:test';

import {
  closeSpaceCopyDialog, openSpaceCopyDialog, saveSpaceCopy,
} from '../test-build/space-copy-runtime.js';
import { installAdoption } from './helpers/adoption-host.mjs';

const configFixture = () => ({
  model_version: 9,
  spaces: [{
    id: 'source', title: 'Floor', view_box: [0, 0, 1, 1], rooms: [], wall_segments: [],
  }],
  markers: [],
  settings: {},
});

function runtimeHarness(overrides = {}) {
  const config = configFixture();
  const events = [];
  const toasts = [];
  const host = {
    _spaceDialog: {
      mode: 'edit', spaceId: 'source', title: 'unsaved settings title', busy: false,
      copy: { title: 'Floor (2)', furniture: false, decor: false, busy: false, token: 0 },
    },
    _saveConfigDebounced: { pending: () => false, flush: () => events.push('flush-config') },
    _writeChain: Promise.resolve(),
    _geometryHistory: { clear: () => events.push('clear-geometry-history') },
    _devicePositionHistory: { clear: () => events.push('clear-device-history') },
    _cancelDeviceDrag: () => false,
    _canOptimizeUndo: false,
    _undoKind: null,
    _dirtyPos: new Set(),
    _sentPos: new Map(),
    _cfgEpoch: 0,
    _modelCache: {},
    _frame: {},
    _regSignature: 'old',
    _maybeRebuildDevices: () => events.push('rebuild'),
    _cacheSnapshot: () => events.push('snapshot'),
    requestUpdate: () => events.push('render'),
    hass: {
      callWS: async (message) => {
        events.push(message.type);
        if (message.type !== 'houseplan/plan/optimize') throw new Error('unexpected WS');
        return { config_rev: 6, layout_rev: 9, can_undo: true };
      },
    },
    _checkOptimizeGeometry: () => ({ fingerprint: 'safe', spaces: [], failures: [], ok: true }),
    _checkSpacePhysicalGeometry: () => ({ ok: true }),
    _junctionLimitViolations: () => [],
    _confirmDanger: async () => { events.push('confirm'); return true; },
    _reloadConfigOnly: async () => { events.push('reload-config'); },
    _reloadLayoutOnly: async () => { events.push('reload-layout'); },
    _showToast: (message) => toasts.push(message),
    _t: (key, vars) => vars?.name ? `${key}:${vars.name}` : key,
    _errText: (error) => error instanceof Error ? error.message : String(error),
    _selId: 'selected-device',
    _physicalSel: { kind: 'partition', id: 'selected-wall' },
    _space: 'source',
    _commitSpace: (id) => { events.push(`space:${id}`); host._space = id; return true; },
    _tool: 'select',
    _path: [[0, 0]],
    _cursorPt: [0.5, 0.5],
    _activeWallChainId: 'chain',
    _activeWallChainPartitionIds: ['partition'],
    _primeDrawWallField: () => events.push('prime-draw'),
    _saveNav: () => events.push('save-nav'),
  };
  installAdoption(host, { config, layout: {}, configRev: 5, layoutRev: 8 });
  Object.assign(host, overrides);
  const services = {
    clearGeometryGesture: () => {
      events.push('clear-gesture');
      host._activeWallChainId = null;
      host._activeWallChainPartitionIds = [];
      host._path = [];
    },
    optimizeReferenceContext: () => ({}),
    reportPreflightFailure: () => events.push('report-preflight'),
    saveConfigNow: async () => {
      events.push('config-write');
      host._adoption.acceptConfigWrite(host._serverCfg, { rev: host._cfgRev + 1 });
    },
    setMode: () => events.push('mode:plan'),
    showWallModelMigrationBlocked: () => events.push('migration-blocked'),
    optimize: (currentConfig, currentLayout) => ({
      config: structuredClone(currentConfig), layout: structuredClone(currentLayout),
      changed: false, report: {},
    }),
    newSeed: () => 'seed',
  };
  return { host, services, events, toasts };
}

test('#456 opens a numbered name dialog and Cancel restores the settings dialog', () => {
  const { host } = runtimeHarness();
  host._spaceDialog.copy = undefined;
  host._serverCfg.spaces.push({
    id: 'copy-2', title: 'Floor (2)', view_box: [0, 0, 1, 1], rooms: [], wall_segments: [],
  });
  openSpaceCopyDialog(host);
  assert.equal(host._spaceDialog.copy.title, 'Floor (3)');
  assert.equal(host._spaceDialog.copy.furniture, false);
  assert.equal(host._spaceDialog.copy.decor, false);
  host._spaceDialog.copy.furniture = true;
  host._spaceDialog.copy.decor = true;
  closeSpaceCopyDialog(host);
  assert.equal(host._spaceDialog.copy, undefined);
  assert.equal(host._serverCfg.spaces.length, 2, 'opening and cancelling are read-only');
  openSpaceCopyDialog(host);
  assert.equal(host._spaceDialog.copy.furniture, false);
  assert.equal(host._spaceDialog.copy.decor, false);
});

test('#456 clean input performs one config write with no extra confirmation', async () => {
  const { host, services, events, toasts } = runtimeHarness();
  await saveSpaceCopy(host, services);

  assert.equal(events.includes('confirm'), false);
  assert.equal(events.includes('houseplan/plan/optimize'), false);
  assert.equal(events.filter((event) => event === 'config-write').length, 1);
  assert.deepEqual(host._serverCfg.spaces.map((space) => space.id), ['source', 'sseed']);
  assert.equal(host._space, 'sseed');
  assert.equal(host._spaceDialog, null);
  assert.equal(host._tool, 'draw');
  assert.deepEqual(host._path, []);
  assert.equal(host._activeWallChainId, null);
  assert.deepEqual(host._activeWallChainPartitionIds, []);
  assert.equal(host._selId, null);
  assert.equal(host._physicalSel, null);
  assert.equal(toasts.at(-1), 'toast.space_copied:Floor (2)');
});

test('#456 a manually entered duplicate title is accepted but an empty title is inert', async () => {
  const duplicate = runtimeHarness();
  duplicate.host._spaceDialog.copy.title = '  Floor  ';
  await saveSpaceCopy(duplicate.host, duplicate.services);
  assert.deepEqual(duplicate.host._serverCfg.spaces.map((space) => space.title), ['Floor', 'Floor']);

  const empty = runtimeHarness();
  empty.host._spaceDialog.copy.title = '   ';
  await saveSpaceCopy(empty.host, empty.services);
  assert.equal(empty.events.includes('config-write'), false);
  assert.equal(empty.host._serverCfg.spaces.length, 1);
});

test('#1156 category choices are captured before awaiting writes and copy busy prevents duplicate submission', async () => {
  const { host, services, events } = runtimeHarness();
  host._serverCfg.spaces[0].decor = [
    { id: 'chair', kind: 'furniture', symbol: 'chair', x: .1, y: .1, w: .2, h: .2 },
    { id: 'text', kind: 'text', x: .5, y: .5, text: 'Original' },
  ];
  host._spaceDialog.copy.furniture = true;
  let release;
  host._writeChain = new Promise(resolve => { release = resolve; });
  const saving = saveSpaceCopy(host, services);
  assert.equal(host._spaceDialog.copy.busy, true);
  await saveSpaceCopy(host, services);
  // Even a programmatic draft replacement during the await cannot change this operation's snapshot.
  host._spaceDialog.copy = { ...host._spaceDialog.copy, furniture: false, decor: true };
  release();
  await saving;
  assert.deepEqual(host._serverCfg.spaces[1].decor.map(item => item.kind), ['furniture']);
  assert.deepEqual(host._serverCfg.spaces[0].decor.map(item => item.kind), ['furniture', 'text']);
  assert.equal(events.filter(event => event === 'config-write').length, 1);
});

test('#1227 copies unchanged accepted geometry without Optimize or geometry preflight', async () => {
  const { host, services, events } = runtimeHarness({
    _checkSpacePhysicalGeometry: () => { throw new Error('copy must not preflight geometry'); },
    _junctionLimitViolations: () => { throw new Error('copy must not judge junctions'); },
    _checkOptimizeGeometry: () => { throw new Error('copy must not optimize'); },
  });
  services.optimize = () => { throw new Error('copy must not import or run Optimize'); };
  host._serverCfg.spaces[0].partitions = [{ id: 'near-end', a: [0, 0], b: [1, 0], cm: 40 }];
  host._serverCfg.spaces[0].openings = [{ id: 'door', type: 'door', length: .2,
    x: .11, y: 0, angle: 0, host: { kind: 'partition', id: 'near-end', t: .11 } }];
  const original = structuredClone(host._serverCfg.spaces[0]);
  await saveSpaceCopy(host, services);
  assert.equal(events.filter(event => event === 'config-write').length, 1);
  assert.equal(events.includes('confirm'), false);
  assert.deepEqual(host._serverCfg.spaces[0], original);
  assert.equal(host._serverCfg.spaces[1].openings[0].host.t, .11);
  assert.equal(host._serverCfg.spaces[1].openings[0].length, .2);
});

test('#1227 rejected copy restores its source and retains the dialog choices', async () => {
  const { host, services, events } = runtimeHarness();
  const original = structuredClone(host._serverCfg);
  host._spaceDialog.copy.furniture = true;
  host._spaceDialog.copy.decor = true;
  services.saveConfigNow = async () => { throw new Error('offline'); };
  await saveSpaceCopy(host, services);
  assert.deepEqual(host._serverCfg, original);
  assert.equal(host._spaceDialog.copy.busy, false);
  assert.equal(host._spaceDialog.copy.furniture, true);
  assert.equal(host._spaceDialog.copy.decor, true);
  assert.equal(host._space, 'source');
  assert.equal(events.includes('reload-config'), true);
});

test('#1227 a retired dialog while queued performs no copy', async () => {
  const { host, services, events } = runtimeHarness();
  let release;
  host._writeChain = new Promise(resolve => { release = resolve; });
  const pending = saveSpaceCopy(host, services);
  host._spaceDialog = null;
  release();
  await pending;
  assert.equal(events.includes('config-write'), false);
  assert.equal(host._serverCfg.spaces.length, 1);
});
