import assert from 'node:assert/strict';
import test from 'node:test';

import {
  closeSpaceCopyDialog, openSpaceCopyDialog, saveSpaceCopy,
} from '../test-build/space-copy-runtime.js';
import { contentFingerprint } from '../test-build/visual-continuity.js';

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
      copy: { title: 'Floor (2)', busy: false, token: 0 },
    },
    _serverCfg: config,
    _layout: {},
    _cfgRev: 5,
    _layoutRev: 8,
    _cfgContentFingerprint: contentFingerprint(config),
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
    _resumeDraftBySpace: { source: 'old-draft', sseed: 'must-be-cleared' },
    _space: 'source',
    _commitSpace: (id) => { events.push(`space:${id}`); host._space = id; return true; },
    _tool: 'select',
    _path: [[0, 0]],
    _cursorPt: [0.5, 0.5],
    _activeDraftId: 'draft',
    _primeDrawWallField: () => events.push('prime-draw'),
    _saveNav: () => events.push('save-nav'),
    ...overrides,
  };
  const services = {
    clearGeometryGesture: () => {
      events.push('clear-gesture');
      host._activeDraftId = null;
      host._path = [];
    },
    optimizeReferenceContext: () => ({}),
    reportPreflightFailure: () => events.push('report-preflight'),
    saveConfigNow: async () => {
      events.push('config-write');
      host._cfgRev++;
      host._cfgContentFingerprint = contentFingerprint(host._serverCfg);
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
  closeSpaceCopyDialog(host);
  assert.equal(host._spaceDialog.copy, undefined);
  assert.equal(host._serverCfg.spaces.length, 2, 'opening and cancelling are read-only');
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
  assert.equal(host._activeDraftId, null);
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

test('#456 required Optimize is explicitly confirmed and Cancel performs zero writes', async () => {
  const { host, services, events } = runtimeHarness({
    _confirmDanger: async () => { events.push('confirm'); return false; },
  });
  services.optimize = (currentConfig, currentLayout) => ({
    config: structuredClone(currentConfig), layout: structuredClone(currentLayout),
    changed: true, report: {},
  });
  await saveSpaceCopy(host, services);

  assert.deepEqual(events.filter((event) => event === 'houseplan/plan/optimize' || event === 'config-write'), []);
  assert.equal(host._spaceDialog.copy.title, 'Floor (2)');
  assert.equal(host._spaceDialog.copy.busy, false);
  assert.equal(host._spaceDialog.busy, false);
});

test('#456 a concurrent plan change invalidates an open Optimize confirmation', async () => {
  const harness = runtimeHarness();
  harness.services.optimize = (currentConfig, currentLayout) => ({
    config: structuredClone(currentConfig), layout: structuredClone(currentLayout),
    changed: true, report: {},
  });
  harness.host._confirmDanger = async () => {
    harness.events.push('confirm');
    harness.host._cfgRev++;
    return true;
  };
  await saveSpaceCopy(harness.host, harness.services);

  assert.equal(harness.events.includes('houseplan/plan/optimize'), false);
  assert.equal(harness.events.includes('config-write'), false);
  assert.equal(harness.host._spaceDialog.copy.busy, false);
  assert.equal(harness.toasts.at(-1), 'space.copy_error_changed');
});

test('#456 accepted Optimize is durable before the copy candidate is written', async () => {
  const { host, services, events } = runtimeHarness();
  services.optimize = (currentConfig, currentLayout) => {
    const optimized = structuredClone(currentConfig);
    optimized.spaces[0].partitions = [{ id: 'optimized-wall', a: [0, 0], b: [1, 0], cm: 10 }];
    return { config: optimized, layout: structuredClone(currentLayout), changed: true, report: {} };
  };
  await saveSpaceCopy(host, services);

  assert.ok(events.indexOf('confirm') < events.indexOf('houseplan/plan/optimize'));
  assert.ok(events.indexOf('houseplan/plan/optimize') < events.indexOf('config-write'));
  assert.equal(host._serverCfg.spaces[1].partitions.length, 1);
  assert.notEqual(host._serverCfg.spaces[1].partitions[0].id, 'optimized-wall');
  assert.equal(host._canOptimizeUndo, false, 'the following config write consumes Optimize undo');
});

test('#456 unsafe Optimize reports the existing diagnostic and performs zero writes', async () => {
  const { host, services, events, toasts } = runtimeHarness({
    _checkOptimizeGeometry: () => ({
      fingerprint: 'unsafe', spaces: [], failures: [{ status: 'failed' }], ok: false,
    }),
  });
  services.optimize = (currentConfig, currentLayout) => ({
    config: structuredClone(currentConfig), layout: structuredClone(currentLayout),
    changed: true, report: {},
  });
  await saveSpaceCopy(host, services);

  assert.ok(events.includes('report-preflight'));
  assert.equal(events.includes('confirm'), false);
  assert.equal(events.includes('houseplan/plan/optimize'), false);
  assert.equal(events.includes('config-write'), false);
  assert.equal(toasts.at(-1), 'space.copy_error_optimize_geometry');
});

test('#456 a rejected copy rolls back only the copy and keeps accepted Optimize', async () => {
  const optimized = configFixture();
  optimized.spaces[0].settings = { optimized: true };
  const { host, services, events } = runtimeHarness({
    _reloadConfigOnly: async () => {
      events.push('reload-config');
      host._serverCfg = structuredClone(optimized);
      host._cfgContentFingerprint = contentFingerprint(host._serverCfg);
    },
  });
  services.optimize = (_currentConfig, currentLayout) => ({
    config: structuredClone(optimized), layout: structuredClone(currentLayout),
    changed: true, report: {},
  });
  services.saveConfigNow = async () => {
    events.push('config-write');
    throw new Error('offline');
  };
  await saveSpaceCopy(host, services);

  assert.deepEqual(host._serverCfg, optimized);
  assert.equal(host._serverCfg.spaces.length, 1, 'no partial copy remains');
  assert.equal(host._canOptimizeUndo, true, 'accepted Optimize remains undoable after a failed copy');
  assert.equal(host._space, 'source');
  assert.equal(host._spaceDialog.copy.busy, false);
  assert.ok(events.includes('reload-config'));
});
