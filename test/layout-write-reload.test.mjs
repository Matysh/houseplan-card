import test from 'node:test';
import assert from 'node:assert/strict';
import { LayoutWriteReload } from '../test-build/layout-write-reload.js';
import { CardReadLifecycle } from '../test-build/card-read-lifecycle.js';
import { ConfigReloadAuthority } from '../test-build/config-reload-authority.js';
import { ConfigWriteContext } from '../test-build/config-write-context.js';
import { createConfigAdoption, adoptAuthoritativeGated, adoptStructuralResponses } from '../test-build/config-adoption.js';
import { CommandStack } from '../test-build/command-stack.js';
import { PropertiesCommandLane } from '../test-build/editors/properties/controller.js';

globalThis.window ??= {};
window.setTimeout = setTimeout;
globalThis.location ??= { pathname: '/dashboard/home' };
const { HouseplanCard } = await import('../test-build/houseplan-card.js');
const proto = HouseplanCard.prototype;
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const tick = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const config = label => ({ model_version: 10, spaces: [{ id: 'f1', title: label, rooms: [] }], markers: [], settings: {} });
const pos = x => ({ x, y: .2, s: 'f1' });

/** Ordinary fake host ports, but real exported card read/write/release/history methods. */
function harness() {
  const events = [], messages = [], reads = [], writes = [], assets = [];
  const adoption = createConfigAdoption(), context = new ConfigWriteContext();
  const visualCommands = new PropertiesCommandLane();
  let holdRead = false, holdWrite = true, holdAsset = false;
  const store = { config: config('A'), layout: { point: pos(.1) }, cfgRev: 1, rev: 1 };
  const transport = (saved, connection = {}, user = 'a') => ({ connection, user: { id: user }, callWS: async message => {
    messages.push(message.type);
    if (message.type === 'houseplan/config/get') return { config: structuredClone(saved.config), rev: saved.cfgRev, can_write: true };
    if (message.type === 'houseplan/layout/get') {
      const reply = { layout: structuredClone(saved.layout), rev: saved.rev };
      if (holdRead) { const gate = deferred(); reads.push({ gate, reply }); await gate.promise; }
      return reply;
    }
    if (message.type === 'houseplan/layout/update' || message.type === 'houseplan/layout/delete') {
      const gate = deferred(); writes.push({ gate, message });
      if (holdWrite) await gate.promise;
      if (message.type.endsWith('/delete')) delete saved.layout[message.device_id];
      else saved.layout[message.device_id] = structuredClone(message.pos);
      return { ok: true, rev: ++saved.rev };
    }
    return {};
  } });
  const noop = () => {};
  const event = name => () => events.push(name);
  const host = {
    hass: transport(store), isConnected: true, _adoption: adoption,
    _configWriteContext: context, _configReloadAuthority: new ConfigReloadAuthority(),
    _read: new CardReadLifecycle(), _layoutIO: new LayoutWriteReload(pending => host._configWriteGuard(pending)),
    get _cfgRev() { return adoption.configRev; }, get _layoutRev() { return adoption.layoutRev; },
    get _serverCfg() { return adoption.config; },
    get _layout() { return adoption.layout; }, set _layout(value) { adoption.stageLocalLayout(value); },
    _cfgWriting: false, _saveConfigDebounced: { pending: () => false },
    _loading: false, _loadOk: true, _loadTries: 0, _serverStorage: true,
    _space: 'f1', _view: {}, _warmVpArmed: false, _model: [], _mode: 'devices',
    _devicePositionBusy: false, _devicePositionHistory: new CommandStack(), _sentPos: new Map(),
    _geometryHistory: { clear: event('geometry.clear') }, _pendingPhysicalWrites: { clear: noop },
    _continuity: { hasCompleteFrame: false, state: 'steady', note: noop },
    _virtualLights: null, _capturedSnapshotVirtual: '',
    _signer: { prepareImage: async () => {
      if (holdAsset) { const gate = deferred(); assets.push(gate); return gate.promise; }
      return true;
    } },
    _candidateBackdrop: () => '', _beginContinuityCandidate: noop, _scheduleLoadRetry: event('retry'),
    _clearRoomFocus: noop, _cancelCameraTransition: noop, _clearGeometryGesture: noop,
    _seedDecorStyle: noop, _adoptConfigCapabilities: noop, _syncDecorAssets: async () => {},
    _adoptInitialSpace: noop, _resumePendingNavMode: noop, _restoreZoom: noop, _restoreKioskViewport: () => false,
    _cacheSnapshot: event('cache'), _maybeRebuildDevices: event('devices'), _ensureLiveSyncSubscriptions: noop,
    requestUpdate: event('update'), _showToast: message => events.push(message),
    _t: key => key, _errText: error => error.message,
    _devicePositionStateValid: () => true, _commitSpace: noop,
    _cancelDeviceDrag: () => false, _deviceForPointerEvent: (_event, device) => device,
    _deviceHits: { release: noop, cancel: noop }, _viewHold: { cancel: noop },
    _editorRuntimeOrThrow: () => ({ _flushPointerMove: noop, _visualCommand: run => visualCommands.run(run),
      properties: { beforeIntent: () => true } }),
    _previewDevicePlacement(id, placement) {
      const next = { ...adoption.layout };
      if (placement === null) delete next[id]; else next[id] = placement;
      adoption.stageLocalLayout(next);
    },
    _configWriteGuard(pendingOnly) { return proto._configWriteGuard.call(host, pendingOnly); },
    _getAuthoritativeConfig: (hass = host.hass) => hass.callWS({ type: 'houseplan/config/get' }),
    _adoptAuthoritative: input => adoptAuthoritativeGated(host, input),
    _persistDevicePlacement: (...args) => proto._persistDevicePlacement.call(host, ...args),
    _applyDevicePositionHistory: direction => proto._applyDevicePositionHistory.call(host, direction),
    _loadFromServer: () => proto._loadFromServer.call(host),
  };
  context.observe(host.hass);
  adoptStructuralResponses(host, { config: structuredClone(store.config), rev: 1 }, { layout: structuredClone(store.layout), rev: 1 });
  events.length = 0;
  const releaseDrag = (x = .4) => {
    const before = structuredClone(adoption.layout.point);
    host._deviceDrag = { id: 'point', pointerId: 7, moved: true, start: before, before, spaceId: 'f1', displayName: 'Point' };
    host._previewDevicePlacement('point', pos(x));
    proto._pointerUp.call(host, { pointerId: 7 }, { id: 'point' });
  };
  const change = mode => {
    visualCommands.retire();
    host._layoutIO.retire(); host._read.invalidate(); host._configReloadAuthority.invalidateLifecycle();
    host._devicePositionBusy = false; host._sentPos.clear();
    if (mode === 'detach') { host.isConnected = false; return; }
    host._devicePositionHistory.clear();
    const old = host.hass;
    const next = { config: config('B'), layout: { point: pos(.8) }, cfgRev: 30, rev: 40 };
    host.hass = transport(next, mode === 'user' ? old.connection : {}, 'b'); context.observe(host.hass);
    if (mode === 'aba') { host.hass = old; context.observe(old); }
    adoptStructuralResponses(host, { config: next.config, rev: next.cfgRev }, { layout: next.layout, rev: next.rev });
  };
  const snapshot = () => ({ config: structuredClone(adoption.config), layout: structuredClone(adoption.layout),
    rev: adoption.layoutRev, busy: host._devicePositionBusy, history: host._devicePositionHistory.commands(),
    events: [...events], sent: [...host._sentPos] });
  return { host, store, reads, writes, assets, messages, events, releaseDrag, change, snapshot,
    holdRead: value => { holdRead = value; }, holdWrite: value => { holdWrite = value; }, holdAsset: value => { holdAsset = value; } };
}

for (const order of ['ack-before-pair', 'pair-before-ack', 'write-starts-during-read']) {
  test(`#902 AC1/AC2 exported card full read preserves ${order} and real history steps`, async () => {
    const h = harness(); h.holdRead(true);
    if (order !== 'write-starts-during-read') h.releaseDrag();
    const load = h.host._loadFromServer(); await tick();
    if (order === 'write-starts-during-read') h.releaseDrag();
    if (order !== 'pair-before-ack') { h.writes[0].gate.resolve(); await tick(); }
    h.holdRead(false); h.reads[0].gate.resolve(); await tick();
    if (order === 'pair-before-ack') {
      assert.equal(h.host._devicePositionHistory.canUndo, false, 'no invented ACK/history');
      h.writes[0].gate.resolve();
    }
    await load; await tick();
    assert.deepEqual(h.host._layout.point, pos(.4));
    assert.deepEqual(h.store.layout.point, pos(.4));
    assert.equal(h.host._devicePositionHistory.size, 1);
    assert.equal(h.messages.filter(type => type === 'houseplan/config/get').length, 2);
    assert.equal(h.messages.filter(type => type === 'houseplan/layout/get').length, 2);
    h.holdWrite(false);
    await proto._runDevicePositionHistory.call(h.host, 'undo');
    assert.deepEqual(h.host._layout.point, pos(.1));
    assert.deepEqual(h.store.layout.point, pos(.1));
    await proto._runDevicePositionHistory.call(h.host, 'redo');
    assert.deepEqual(h.host._layout.point, pos(.4));
    assert.equal(h.writes.length, 3, 'one drag, one Undo, one Redo');
  });
}

test('#902 AC3 current write rejection rolls back accepted position, wakes reload and creates no command', async () => {
  const h = harness(); h.releaseDrag(); h.holdRead(true);
  const load = h.host._loadFromServer(); await tick();
  h.holdRead(false); h.reads[0].gate.resolve(); await tick();
  h.writes[0].gate.reject(new Error('refused')); await load; await tick();
  assert.deepEqual(h.host._layout.point, pos(.1));
  assert.deepEqual(h.store.layout.point, pos(.1));
  assert.equal(h.host._devicePositionHistory.size, 0);
  assert.equal(h.host._devicePositionBusy, false);
  assert.equal(h.host._sentPos.size, 0);
  assert.ok(h.events.includes('toast.pos_save_failed'));
});

test('#902 AC3 real newer external revision is accepted and invalidates conflicting own history', async () => {
  const h = harness(); h.releaseDrag(); h.writes[0].gate.resolve(); await tick();
  assert.equal(h.host._devicePositionHistory.size, 1);
  h.store.layout = { point: pos(.9) }; h.store.rev = 100;
  await h.host._loadFromServer();
  assert.deepEqual(h.host._layout.point, pos(.9));
  assert.equal(h.host._layoutRev, 100);
  assert.equal(h.host._devicePositionHistory.canUndo, false);
  assert.equal(h.messages.filter(type => type === 'houseplan/layout/get').length, 1, 'no obsolete receipt or retry');
});

test('#902 write beginning inside the real backdrop await invalidates the old pair before adoption', async () => {
  const h = harness(); h.store.layout = { point: pos(.7) }; h.store.rev = 3; h.holdAsset(true);
  const load = h.host._loadFromServer(); await tick();
  assert.equal(h.assets.length, 1);
  h.releaseDrag(); h.writes[0].gate.resolve(); await tick();
  assert.equal(h.host._devicePositionHistory.size, 1);
  h.holdAsset(false); h.assets[0].resolve(true); await load;
  assert.deepEqual(h.host._layout.point, pos(.4));
  assert.equal(h.host._devicePositionHistory.size, 1);
  assert.equal(h.messages.filter(type => type === 'houseplan/layout/get').length, 2);
});

test('#902 current failed Undo keeps its accepted command and position without success', async () => {
  const h = harness(); h.releaseDrag(); h.writes[0].gate.resolve(); await tick();
  const undo = proto._runDevicePositionHistory.call(h.host, 'undo'); await tick();
  h.writes[1].gate.reject(new Error('Undo refused')); await undo;
  assert.deepEqual(h.host._layout.point, pos(.4)); assert.deepEqual(h.store.layout.point, pos(.4));
  assert.equal(h.host._devicePositionHistory.canUndo, true);
  assert.equal(h.host._devicePositionHistory.canRedo, false);
  assert.equal(h.host._devicePositionBusy, false);
  assert.ok(h.events.includes('toast.pos_save_failed'));
  assert.ok(!h.events.includes('history.undone'));
});

for (const mode of ['view', 'kiosk']) test(`#902 AC3 passive ${mode} accepts one fresh pair without own bookkeeping`, async () => {
  const h = harness(); h.host._mode = 'view'; h.host._kiosk = mode === 'kiosk';
  h.store.config = config('fresh'); h.store.cfgRev = 4; h.store.layout = { point: pos(.7) }; h.store.rev = 6;
  await h.host._loadFromServer();
  assert.deepEqual(h.host._serverCfg, h.store.config);
  assert.deepEqual(h.host._layout, h.store.layout);
  assert.deepEqual(h.messages, ['houseplan/config/get', 'houseplan/layout/get', 'houseplan/trail/get']);
});

for (const mode of ['connection', 'user', 'aba', 'detach']) for (const outcome of ['resolve', 'reject']) {
  test(`#902 AC3 retired ${mode} old released-write ${outcome} preserves fresh owner including busy`, async () => {
    const h = harness(); h.releaseDrag(); await tick(); h.change(mode);
    if (mode === 'detach') h.host.isConnected = true;
    h.releaseDrag(.6);
    const before = h.snapshot();
    h.writes[0].gate[outcome](outcome === 'reject' ? new Error('old write') : undefined);
    await tick();
    assert.deepEqual(h.snapshot(), before, 'old success/error/finally cannot change the new UI or pending map');
    h.writes[1].gate.resolve(); await tick(); assert.equal(h.host._devicePositionHistory.size, 1);
  });
  for (const seam of ['read', 'adoption']) test(`#902 AC3 retired ${mode} old full ${seam} ${outcome} has no adoption/tail`, async () => {
    const h = harness();
    if (seam === 'read') h.holdRead(true);
    else { h.store.layout = { point: pos(.7) }; h.store.rev++; h.holdAsset(true); }
    const load = h.host._loadFromServer(); await tick();
    h.change(mode); const before = h.snapshot();
    const gate = seam === 'read' ? h.reads[0].gate : h.assets[0];
    gate[outcome](outcome === 'reject' ? new Error('old read') : true);
    await load; await tick();
    assert.deepEqual(h.snapshot(), before);
  });
}

test('#902 AC3 held drag still cancels its preview without a write or command', () => {
  const h = harness();
  h.host._deviceDrag = { id: 'point', pointerId: 7, before: pos(.1) };
  h.host._previewDevicePlacement('point', pos(.5));
  let keyboardRetired=0;
  h.host._deviceDragRetirement = { retire() {} }; h.host._editorRuntime = { keyboardNudge:{retire(){keyboardRetired++;}},_cancelPointerMove() {}, _commitLiveEditor() {} };
  assert.equal(proto._cancelDeviceDrag.call(h.host), true);
  assert.deepEqual(h.host._layout.point, pos(.1));
  assert.equal(h.host._devicePositionHistory.size, 0);
  assert.equal(h.writes.length, 0);
  assert.equal(keyboardRetired,1);
});

test('#902 same-element short detach retains already accepted history, unlike a retired pending completion', async () => {
  const h = harness(); h.releaseDrag(); h.writes[0].gate.resolve(); await tick();
  assert.equal(h.host._devicePositionHistory.size, 1);
  h.change('detach'); h.host.isConnected = true;
  await h.host._loadFromServer();
  assert.equal(h.host._devicePositionHistory.size, 1);
  h.holdWrite(false); h.releaseDrag(.5); await tick();
  assert.equal(h.host._devicePositionHistory.size, 2);
  assert.equal(h.writes.length, 2);
});

test('#902 r1 M1 actual card re-arms once after both reads overlap real released writes', async () => {
  const h = harness(); h.holdRead(true);
  const load = h.host._loadFromServer(); await tick();
  assert.equal(h.reads.length, 1);
  h.releaseDrag(.4); h.writes[0].gate.resolve(); await tick();
  h.reads[0].gate.resolve(); await tick();
  assert.equal(h.reads.length, 2, 'the first overlap consumes the one paired retry');
  h.releaseDrag(.6); h.writes[1].gate.resolve(); await tick();
  assert.equal(h.host._devicePositionHistory.size, 2, 'both genuine ACKs made commands before old adoption');
  h.holdRead(false); h.reads[1].gate.resolve();
  await load; await tick();
  assert.equal(h.messages.filter(type => type === 'houseplan/config/get').length, 3);
  assert.equal(h.messages.filter(type => type === 'houseplan/layout/get').length, 3,
    'layout-raced must reach the real card queueMicrotask re-arm, not stop after two reads');
  assert.equal(h.messages.filter(type => type === 'houseplan/trail/get').length, 1,
    'only the re-armed fresh pair reaches the full-load adoption tail');
  assert.deepEqual(h.host._layout.point, pos(.6));
  assert.deepEqual(h.store.layout.point, pos(.6));
  assert.equal(h.host._layoutRev, h.store.rev);
  assert.equal(h.host._devicePositionHistory.size, 2);
  assert.equal(h.host._devicePositionHistory.canUndo, true);
  assert.equal(h.host._devicePositionBusy, false);
  assert.equal(h.host._loading, false);
  assert.equal(h.host._loadOk, true);
  assert.equal(h.host._sentPos.size, 0);
  const settled = h.snapshot(), messageCount = h.messages.length;
  await tick();
  assert.deepEqual(h.snapshot(), settled);
  assert.equal(h.messages.length, messageCount, 'settled re-arm does not poll or create another load');
});

test('#902 bounded retry: a second actual overlap re-arms once; idle/retire release only their own waiters', async () => {
  const owner = new LayoutWriteReload(() => () => true); let reads = 0, adopts = 0;
  const finishes = [];
  const run = owner.reconcile(async () => { reads++; finishes.push(owner.begin()); return {}; },
    async () => { adopts++; return { status: 'adopted', spaceChanged: false }; }, () => true);
  await tick(); finishes[0](); await tick(); finishes[1]();
  assert.deepEqual(await run, { status: 'layout-raced' });
  assert.equal(reads, 2); assert.equal(adopts, 0);
  const old = owner.begin(); let retiredDone = false;
  const retired = owner.reconcile(async () => ({}), async () => ({ status: 'adopted', spaceChanged: false }),
    owner.guard()).then(result => { retiredDone = true; return result; });
  await tick(); owner.retire();
  assert.deepEqual(await retired, { status: 'superseded' }); assert.equal(retiredDone, true);
  const fresh = owner.begin(); let freshDone = false;
  const next = owner.reconcile(async () => ({}), async () => ({ status: 'adopted', spaceChanged: false }), () => true)
    .then(result => { freshDone = true; return result; });
  await tick(); old(); await tick(); assert.equal(freshDone, false, 'retired finally cannot release fresh pending');
  fresh(); assert.equal((await next).status, 'adopted');
  let stableReads = 0;
  await owner.reconcile(async () => { stableReads++; return {}; }, async () => ({ status: 'adopted', spaceChanged: false }), () => true);
  assert.equal(stableReads, 1, 'settled bookkeeping leaves no receipt or additional read');
});
