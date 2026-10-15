import test from 'node:test';
import assert from 'node:assert/strict';
import { ConfigWriteContext } from '../test-build/config-write-context.js';
import { vacuumTrailRefresh } from '../test-build/vacuum-trail-refresh.js';
import { PlanOptimizationUndo } from '../test-build/plan-optimize-undo.js';
import { createConfigAdoption, adoptAuthoritativeGated, adoptStructuralResponses } from '../test-build/config-adoption.js';
import { getAuthoritativeCardConfig } from '../test-build/version-recovery-card.js';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const config = title => ({ model_version: 10, spaces: [{ id: 'floor', title, rooms: [] }], markers: [], settings: {} });

function trailHarness() {
  const owner = new ConfigWriteContext(), connection = {};
  const a = { connection, user: { id: 'a' }, callWS() {} };
  let hass = a, connected = true, lifecycle = 0;
  owner.observe(a);
  const claim = owner.claim(), generation = lifecycle, pending = [];
  const state = { trails: 'new-owner', format: 2, updates: 0 };
  const refresh = vacuumTrailRefresh(() => { const reply = deferred(); pending.push(reply); return reply.promise; },
    () => connected && lifecycle === generation && owner.current(claim, hass),
    response => { state.trails = response.trails; state.format = response.trail_format; state.updates++; });
  const change = mode => {
    if (mode === 'detach') { connected = false; lifecycle++; return; }
    hass = mode === 'user' ? { ...a, user: { id: 'b' } } : { ...a, connection: {} };
    owner.observe(hass);
    if (mode === 'aba') { hass = a; owner.observe(hass); }
  };
  return { refresh, pending, state, change };
}

for (const mode of ['connection', 'user', 'aba', 'detach']) {
  for (const outcome of ['resolve', 'reject']) test(`#901 AC1: late trail ${outcome} after ${mode} preserves new trail/format/UI`, async () => {
    const h = trailHarness(), task = h.refresh();
    h.change(mode);
    const before = { ...h.state };
    h.pending[0][outcome](outcome === 'resolve' ? { trails: 'old-owner', trail_format: 1 } : new Error('old transport'));
    await task;
    assert.deepEqual(h.state, before);
    await h.refresh();
    assert.equal(h.pending.length, 1, 'retired callback cannot read a new owner');
  });
}
test('#901 AC1: fresh same-owner trail works; a replaced request and current reject retain last-good', async () => {
  const h = trailHarness();
  const first = h.refresh(), second = h.refresh();
  h.pending[1].resolve({ trails: 'latest', trail_format: 2 }); await second;
  h.pending[0].resolve({ trails: 'superseded', trail_format: 1 }); await first;
  assert.deepEqual(h.state, { trails: 'latest', format: 2, updates: 1 });
  const rejected = h.refresh(); h.pending[2].reject(new Error('current hiccup')); await rejected;
  assert.deepEqual(h.state, { trails: 'latest', format: 2, updates: 1 });
  const fresh = h.refresh(); h.pending[3].resolve({ trails: 'fresh', trail_format: 1 }); await fresh;
  assert.deepEqual(h.state, { trails: 'fresh', format: 1, updates: 2 });
});

function undoHarness(kind = 'optimize', seam = 'write') {
  const authority = new ConfigWriteContext(), adoption = createConfigAdoption();
  const pending = [], messages = [], events = [], toasts = [];
  let blocked = seam, label = 'A', assetBlocked = seam === 'adoption';
  const response = () => ({ config: config(`${label} restored`), rev: 11, can_write: true,
    integration_version: `${label}-version`, can_optimize_undo: false });
  function transport(connection = {}, user = 'a') {
    return { connection, user: { id: user }, callWS: async message => {
      messages.push({ label, transport: connection, user, message });
      const stage = message.type === 'houseplan/plan/optimize_undo' ? 'write'
        : message.type === 'houseplan/config/get' ? 'config' : 'layout';
      if (stage === blocked) {
        const reply = deferred(); pending.push({ stage, ...reply }); return reply.promise;
      }
      return stage === 'config' ? response() : stage === 'layout' ? { layout: { point: { x: .4, y: .5 } }, rev: 12 }
        : { config_rev: 9, layout_rev: 10 };
    } };
  }
  const a = transport();
  const rec = name => () => { events.push(name); };
  const host = {
    hass: a, isConnected: true, _canEdit: true, _kiosk: false, _adoption: adoption, _space: 'floor', _model: [],
    get _cfgRev() { return adoption.configRev; }, get _layoutRev() { return adoption.layoutRev; },
    _cfgEpoch: 1, _modelCache: 'model', _frame: 'frame', _regSignature: 'registry',
    _geometryHistory: { clear: rec('geometry.clear') }, _devicePositionHistory: { clear: rec('positions.clear') },
    _pendingPhysicalWrites: { clear: rec('physical.clear') },
    _canOptimizeUndo: true, _undoKind: kind, _optimizeUndoBusy: false, _serverCanWrite: true,
    _virtualLights: null, _capturedSnapshotVirtual: '',
    _continuity: { hasCompleteFrame: false, state: 'steady', note: rec('continuity') },
    _signer: { prepareImage: async () => {
      if (assetBlocked) { const reply = deferred(); pending.push({ stage: 'adoption', ...reply }); return reply.promise; }
      return true;
    } },
    _candidateBackdrop: () => '', _scheduleLoadRetry: rec('retry'), _beginContinuityCandidate: rec('begin'),
    _cancelDeviceDrag: rec('cancelDrag'), _clearRoomFocus: rec('clearRoom'),
    _cancelCameraTransition: rec('cancelCamera'), _clearGeometryGesture: rec('clearGesture'),
    _seedDecorStyle: rec('seedDecor'), _adoptConfigCapabilities: rec('adoptCapabilities'),
    _syncVersionRecovery: rec('version'), _maybeRebuildDevices: rec('rebuild'), _cacheSnapshot: rec('cache'),
    requestUpdate: rec('update'), _showToast: message => toasts.push(message),
    _t: (key, vars) => vars ? `${key}:${vars.err}` : key, _errText: error => error.message,
    _configWriteGuard: (pendingOnly = false) => { const claim = authority.claim();
      return () => pendingOnly ? authority.owns(claim) : authority.current(claim, host.hass); },
    _getAuthoritativeConfig: (hass, isCurrent) => getAuthoritativeCardConfig(host, hass, isCurrent),
    _adoptAuthoritative: input => adoptAuthoritativeGated(host, input),
  };
  authority.observe(a);
  adoptStructuralResponses(host, { config: config('A accepted'), rev: 7, can_optimize_undo: true, undo_kind: kind }, { layout: {}, rev: 8 });
  const undo = new PlanOptimizationUndo(host, rec('clearGesture'));
  const snapshot = () => JSON.stringify({ config: adoption.config, layout: adoption.layout, cfg: host._cfgRev,
    lay: host._layoutRev, epoch: host._cfgEpoch, model: host._modelCache, frame: host._frame,
    registry: host._regSignature, canUndo: host._canOptimizeUndo, kind: host._undoKind,
    busy: host._optimizeUndoBusy, version: host._haIntegrationVersion, events, toasts });
  const change = mode => {
    // Same lifecycle calls as the card's HA-assignment/detach adapters; all
    // structural state enters through the real adopter, never private writes.
    undo.retire(); label = 'B';
    if (mode === 'detach') { host.isConnected = false; return; }
    host.hass = mode === 'user' ? transport(a.connection, 'b') : transport(); authority.observe(host.hass);
    if (mode === 'aba') { host.hass = a; authority.observe(a); }
    adoptStructuralResponses(host, { config: config('B accepted'), rev: 21,
      can_optimize_undo: true, undo_kind: kind }, { layout: { fresh: { x: .1, y: .2 } }, rev: 22 });
  };
  return { host, undo, pending, messages, events, toasts, response, snapshot, change,
    unblock: () => { blocked = null; assetBlocked = false; },
    blockWrite: () => { blocked = 'write'; assetBlocked = false; } };
}

// The optional immutable material path is for a baseline diagnostic only. The
// ordinary gate always executes this checkout's compiled exported classes.
globalThis.window ??= {};
const material = file => process.env.HP_CONTEXT_BASELINE_BUILD
  ? pathToFileURL(resolve(process.env.HP_CONTEXT_BASELINE_BUILD, file)).href
  : new URL(`../test-build/${file}`, import.meta.url).href;
const { HouseplanCard } = await import(material('houseplan-card.js'));
const { HouseplanEditorRuntime } = await import(material('houseplan-editor-runtime.js'));

for (const seam of ['write', 'adoption']) test(`#901 wiring: public Undo method fences user-only ${seam}`, async () => {
  const h = undoHarness('import', seam);
  const runtime = { host: h.host, optimizationUndo: h.undo, _clearGeometryGesture() {} };
  const old = HouseplanEditorRuntime.prototype._undoPlanOptimization.call(runtime);
  await tick();
  assert.equal(h.pending[0]?.stage, seam);
  h.change('user');
  const before = h.snapshot();
  h.unblock(); h.pending[0].resolve(seam === 'adoption' ? true : {});
  await old;
  assert.equal(h.snapshot(), before, 'the exported production Undo method must preserve the new user state');
});

for (const mode of ['connection', 'aba', 'detach']) test(`#901 wiring: public HA trail event fences ${mode}`, async () => {
  const context = new ConfigWriteContext(), handlers = new Map(), reply = deferred();
  const hass = { connection: { subscribeEvents: async (handler, event) => { handlers.set(event, handler); return () => {}; } },
    user: { id: 'a' }, callWS: () => reply.promise };
  context.observe(hass);
  const host = { hass, isConnected: true, _configWriteContext: context,
    _liveSyncConnection: null, _liveSyncGeneration: 0, _liveSyncAttempt: null,
    _vacSrvTrails: { fresh: { current: { points: [[1, 2]] } } }, _vacTrailFormat: 2,
    updates: 0, requestUpdate() { this.updates++; } };
  HouseplanCard.prototype._ensureLiveSyncSubscriptions.call(host);
  await tick();
  assert.ok(handlers.has('houseplan_trail_updated'), 'entered through the ordinary public HA subscription');
  const old = handlers.get('houseplan_trail_updated')({ data: {} });
  if (mode === 'detach') { host.isConnected = false; host._liveSyncGeneration++; }
  else {
    host.hass = { ...hass, connection: {} }; context.observe(host.hass);
    if (mode === 'aba') { host.hass = hass; context.observe(hass); }
  }
  const before = JSON.stringify([host._vacSrvTrails, host._vacTrailFormat, host.updates]);
  reply.resolve({ trails: { old: { current: { points: [[9, 9]] } } }, trail_format: 1 });
  await old;
  assert.equal(JSON.stringify([host._vacSrvTrails, host._vacTrailFormat, host.updates]), before);
});

for (const kind of ['optimize', 'import']) {
  test(`#901 AC2: ${kind} Undo releases only its own busy across a temporary HA gap`, async () => {
    const h = undoHarness(kind), task = h.undo.run(), original = h.host.hass;
    await tick();
    h.host.hass = null;
    h.pending[0].resolve({}); await task;
    assert.equal(h.host._optimizeUndoBusy, false, 'a transport gap must not strand the same owner busy');
    assert.equal(h.host._cfgRev, 7); assert.equal(h.host._layoutRev, 8);
    assert.deepEqual(h.toasts, []);
    h.host.hass = { ...original }; h.unblock(); await h.undo.run();
    assert.equal(h.host._cfgRev, 11); assert.equal(h.host._layoutRev, 12);
    assert.equal(h.host._optimizeUndoBusy, false);
    assert.equal(h.toasts.at(-1), kind === 'import' ? 'backup.import_undone' : 'gs.optimize_undone');
  });
  for (const seam of ['write', 'config', 'layout', 'adoption']) {
    for (const mode of ['connection', 'user', 'aba', 'detach']) {
      for (const outcome of ['resolve', 'reject']) test(`#901 AC2: ${kind} Undo ${seam} ${outcome} after ${mode} cannot own new state`, async () => {
        const h = undoHarness(kind, seam), old = h.undo.run();
        await tick();
        assert.equal(h.pending[0]?.stage, seam, 'the production path reached the requested await');
        const oldReply = h.pending[0];
        h.change(mode);
        h.blockWrite();
        const fresh = mode !== 'detach' ? h.undo.run() : null;
        await tick();
        const before = h.snapshot(), messageCount = h.messages.length;
        oldReply[outcome](outcome === 'reject' ? new Error('old transport')
          : seam === 'adoption' ? true : seam === 'config' ? h.response()
            : seam === 'layout' ? { layout: { old: { x: .9, y: .9 } }, rev: 12 } : {});
        await old;
        assert.equal(h.snapshot(), before, 'old success/error/finally cannot change new config/layout, histories, busy or toast');
        assert.equal(h.messages.length, messageCount, 'the old continuation cannot read from the fresh transport');
        if (fresh) {
          const freshReply = h.pending.at(-1);
          assert.equal(h.host._optimizeUndoBusy, true, 'old finally leaves the fresh operation busy');
          h.unblock(); freshReply.resolve({}); await fresh;
          assert.equal(h.host._optimizeUndoBusy, false);
          assert.equal(h.host._canOptimizeUndo, false);
          assert.equal(h.toasts.at(-1), kind === 'import' ? 'backup.import_undone' : 'gs.optimize_undone');
        }
      });
    }
  }
  test(`#901 AC2/3: same-owner ${kind} Undo adopts re-read revisions and succeeds`, async () => {
    const h = undoHarness(kind), task = h.undo.run(); await tick();
    assert.deepEqual(h.messages[0].message, { type: 'houseplan/plan/optimize_undo', expected_config_rev: 7, expected_layout_rev: 8 });
    h.unblock(); h.pending[0].resolve({ config_rev: 500, layout_rev: 600 }); await task;
    assert.equal(h.host._cfgRev, 11); assert.equal(h.host._layoutRev, 12);
    assert.equal(h.host._optimizeUndoBusy, false); assert.equal(h.host._canOptimizeUndo, false);
    assert.ok(h.events.includes('geometry.clear')); assert.ok(h.events.includes('positions.clear'));
    assert.equal(h.toasts.at(-1), kind === 'import' ? 'backup.import_undone' : 'gs.optimize_undone');
    assert.equal(new Set(h.messages.map(item => item.transport)).size, 1, 'all transport calls belong to the captured HA');
  });
  test(`#901 AC2: current ${kind} Undo rejection keeps its existing error/terminal behavior`, async () => {
    const h = undoHarness(kind), task = h.undo.run(); await tick();
    h.pending[0].reject(new Error('current refusal')); await task;
    assert.equal(h.host._canOptimizeUndo, false); assert.equal(h.host._undoKind, null);
    assert.equal(h.host._optimizeUndoBusy, false);
    assert.deepEqual(h.toasts, ['toast.error:current refusal']);
    assert.equal(h.host._cfgRev, 7); assert.equal(h.host._layoutRev, 8);
  });
}
