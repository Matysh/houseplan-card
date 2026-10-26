// #883: a refused ordinary Undo/Redo no longer clears the whole geometry
// history. Real HouseplanEditorRuntime (_undoGeometry/_redoGeometry/
// _stepGeometryHistory/_applyGeometryState/_recordGeometry/_writeConfig),
// CommandStack(50), ConfigAdoption, commitWallSegmentModel and the real
// geometry-history-step module. Substituted at the boundaries only: the HA
// transport (a recording config/set), the card shell (space, fixed floor,
// navigation, toasts), the deferred-write timer and the physical-geometry
// verdict. Missing-space and corrupted-snapshot cases cannot be reached from
// the UI (an own space deletion is an authoritative adoption that clears the
// history); they are unit-only protection and are named so.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';

const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const previousFrame = globalThis.requestAnimationFrame;
globalThis.window = { customCards: [] };
globalThis.requestAnimationFrame = callback => setImmediate(() => callback(0));
after(() => {
  if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else delete globalThis.window;
  globalThis.requestAnimationFrame = previousFrame;
});
const { HouseplanEditorRuntime } = await import('../test-build/houseplan-editor-runtime.js');
const { createConfigAdoption, adoptStructuralResponses } = await import('../test-build/config-adoption.js');
const { ConfigWriteContext } = await import('../test-build/config-write-context.js');
const { CommandStack } = await import('../test-build/command-stack.js');
const { canonicalizeConfigGeometry } = await import('../test-build/coordinate-canonicalization.js');
const { virtualLightSnapshot } = await import('../test-build/virtual-light-state.js');
const { commitWallSegmentModel } = await import('../test-build/wall-segment-model.js');
const { LiveRuntime } = await import('../test-build/live-interaction-runtime.js');
const { cardInteractionIdleSnapshot } = await import('../test-build/version-recovery-card.js');

const clone = value => JSON.parse(JSON.stringify(value));
const square = id => {
  const poly = [[0, 0], [2, 0], [2, 2], [0, 2]];
  const segs = poly.map((a, i) => ({ id: `${id}-w${i}`, a, b: poly[(i + 1) % 4], cm: 10 }));
  return { id, title: id, cell_cm: 1, rooms: [{ id: `${id}-room`, name: 'Room', poly, wall_ids: segs.map(w => w.id) }],
    wall_segments: segs };
};
const settle = async (rounds = 12) => { for (let i = 0; i < rounds; i++) await new Promise(r => setImmediate(r)); };
const WALL = 'Add wall', LINE = 'Add line', SEGMENT = 'Add wall segment';
const UNSAFE = () => ({ ok: false, reason: 'wall-failed-core' });

function setup({ floors = ['f', 'g'], configInput } = {}) {
  const config = commitWallSegmentModel(configInput ?? { model_version: 10, spaces: floors.map(square), markers: [], settings: {} }).config;
  const server = { config: clone(config), rev: 3, sets: 0 };
  const toasts = [], shell = [];
  const adoption = createConfigAdoption(() => {});
  const context = new ConfigWriteContext();
  const geometryHistory = new CommandStack(50), devicePositionHistory = new CommandStack(50);
  devicePositionHistory.push({ name: 'Move lamp', before: { deviceId: 'lamp' }, after: { deviceId: 'lamp' } });
  const deferred = () => { deferred.armed = true; };
  deferred.armed = false;
  deferred.pending = () => deferred.armed;
  deferred.cancel = () => { deferred.armed = false; };
  deferred.flush = () => {
    if (!deferred.armed) return; deferred.armed = false;
    runtime._writeConfig().catch(error => { if (error?.code !== 'geometry-unsafe') toasts.push('toast.cfg_save_failed'); });
  };
  const window = new EventTarget();
  window.requestAnimationFrame = callback => { setImmediate(() => callback(0)); return 1; };
  window.cancelAnimationFrame = () => {};
  const document = { defaultView: window, createElementNS: () => ({ style: {}, classList: { add() {} }, appendChild() {} }) };
  const stage = { getBoundingClientRect: () => ({ left: 0, top: 0 }), removeAttribute() {} };
  const root = { ownerDocument: document, querySelectorAll: () => [], querySelector: selector => selector === '.stage' ? stage : null };
  const host = {
    get _serverCfg() { return adoption.config; }, set _serverCfg(next) { adoption.stageLocalConfig(next); },
    get _cfgRev() { return adoption.configRev; }, _adoption: adoption,
    _configWriteContext: context,
    _configWriteGuard(pendingOnly = false) {
      const claim = context.claim();
      return () => pendingOnly ? context.owns(claim) : context.current(claim, host.hass);
    },
    // Geometry writes below retain their existing config/server boundary.
    hass: { connection: {}, user: { id: 'history-fixture-writer' }, states: {},
      async callWS(message) { throw new Error(`Unexpected direct history fixture WS: ${message.type}`); } },
    _space: floors[0], _mode: 'plan', _tool: 'draw', _canEdit: true, _kiosk: false, isConnected: true,
    _loadOk: true, _haWallNodeMoveApi: 1, _stageEl: null, renderRoot: undefined, _config: { language: 'en' },
    updateComplete: new Promise(() => {}),
    _fillColors: { wall_fill: { c: '#aaa', a: 1 } }, _openingAmt: () => 0,
    _baseVb: () => [0, 0, 1000, 1000], _viewOr: () => ({ w: 1000 }),
    _cancelCameraTransition() {}, _t: (key, params) => (params ? `${key}${JSON.stringify(params)}` : key),
    _showToast: text => toasts.push(text), requestUpdate() {},
    _geometryHistory: geometryHistory, _devicePositionHistory: devicePositionHistory,
    _writeChain: Promise.resolve(), _writesPending: 0, _cfgEpoch: 0, _cacheSnapshot() {},
    _saveConfigDebounced: deferred, _pendingPhysicalWrites: new Map(),
    _checkSpacePhysicalGeometry: () => ({ ok: true }), _maybeRebuildDevices() {},
    _modelCache: null, _frame: null, _regSignature: '', _path: [], _closingWallCm: null,
    _decorDraft: null, _decorMove: null, _dtDrag: null,
    _cellCm: 1, _gridPitch: 1, _screenToVb: (x, y) => [x, y],
    _spaceModel: () => ({ ...host._serverCfg.spaces.find(space => space.id === host._space), wall_columns: [], vb: [0, 0, 1000, 1000] }),
    _activeWallChainId: null, _activeWallChainPartitionIds: [], _wallChainSegmentCms: [], _wallChainRedo: [], _wallFaceBatch: null,
    // Card shell: `_canCommitSpace` is the card's fixed-floor boundary; `floor` is the pinned space.
    floor: null,
    _canCommitSpace: id => !host.floor || host.floor === id,
    _commitSpace(id) { shell.push(`commit:${id}`); host._space = id; return true; },
    _saveNav() { shell.push('saveNav'); }, _restoreZoom() { shell.push('restoreZoom'); },
    async _sendConfigCandidate(candidate) {
      const canonical = canonicalizeConfigGeometry(candidate);
      if (host._cfgRev !== server.rev) throw Object.assign(new Error('conflict'), { code: 'conflict' });
      server.config = clone(canonical); server.rev++; server.sets++;
      adoption.acceptConfigWrite(canonical, { ok: true, rev: server.rev });
    },
    async _reloadConfigOnly() {
      adoptStructuralResponses(host, { config: clone(server.config), rev: server.rev }, undefined);
    },
    _reloadRejectedPhysicalWrite: () => runtime._reloadRejectedPhysicalWrite(),
    // ConfigAdoptionHostPort for the authoritative (foreign) adoption sequence.
    _model: [], _virtualLights: virtualLightSnapshot(null), _capturedSnapshotVirtual: '',
    _canOptimizeUndo: false, _undoKind: null, _serverCanWrite: true,
    _continuity: { hasCompleteFrame: false, state: 'steady', note() {} },
    _cancelDeviceDrag() {}, _clearRoomFocus() {}, _clearGeometryGesture: () => runtime._clearGeometryGesture(),
    _seedDecorStyle() {}, _adoptConfigCapabilities() {},
  };
  adoption.adoptResponses({ config: clone(server.config), rev: server.rev }, undefined, () => {}, () => {});
  context.observe(host.hass);
  const runtime = new HouseplanEditorRuntime(host);
  host._editorRuntime = runtime;
  host.renderRoot = root; host.updateComplete = Promise.resolve(true);

  const spaceOf = id => host._serverCfg.spaces.find(space => space.id === id);
  /** One ordinary command through the production recorder and the deferred writer. */
  const edit = async (spaceId, name, change) => {
    const before = runtime._geometrySnapshot(spaceId);
    change(spaceOf(spaceId));
    runtime._recordGeometry(name, before);
    runtime._saveConfig(); deferred.flush(); await settle();
    return geometryHistory.peekUndo();
  };
  let wallNo = 0;
  const addWall = spaceId => edit(spaceId, WALL, space => {
    const y = 0.5 + 0.25 * wallNo++;
    (space.partitions ||= []).push({ id: `p-${spaceId}-${wallNo}`, a: [0.5, y], b: [1.5, y], cm: 10 });
  });
  const addLine = spaceId => edit(spaceId, LINE, space => {
    (space.decor ||= []).push({ id: `d-${spaceId}-${wallNo++}`, kind: 'line', x1: 0.2, y1: 0.2, x2: 0.8, y2: 0.2 });
  });
  /** Undo/Redo contents bottom → top through the public cursor, put back exactly. */
  const contents = () => {
    const undo = [], redo = [];
    while (geometryHistory.canUndo) undo.unshift(geometryHistory.undo());
    for (let i = 0; i < undo.length; i++) geometryHistory.redo();
    while (geometryHistory.canRedo) redo.unshift(geometryHistory.redo());
    for (let i = 0; i < redo.length; i++) geometryHistory.undo();
    return { undo, redo };
  };
  const same = (actual, expected, message) => {
    assert.equal(actual.length, expected.length, message);
    actual.forEach((command, index) => assert.equal(command, expected[index], message));
  };
  const expectStack = (undo, redo, message) => {
    const now = contents();
    same(now.undo, undo, `${message}: undo`); same(now.redo, redo, `${message}: redo`);
  };
  /** Flush whatever the attempt armed: a refusal must arm nothing and send nothing. */
  const writes = async () => { const armed = deferred.pending(); deferred.flush(); await settle(); return { armed, sets: server.sets }; };
  const ids = space => (spaceOf(space)?.partitions || []).map(item => item.id);
  return { host, runtime, server, toasts, shell, geometryHistory, devicePositionHistory, deferred,
    edit, addWall, addLine, contents, expectStack, writes, ids, spaceOf };
}
const undone = name => `history.undone{"name":"${name}"}`;
const redone = name => `history.redone{"name":"${name}"}`;
const removed = (direction, name, reason) => `history.removed_${direction}{"name":"${name}","reason":"history.reason_${reason}"}`;

test('#1078 actual snapshots, accepted Undo/Redo and persisted room settings keep exact sunlight values', async () => {
  const input = { model_version: 10, spaces: [square('f')], markers: [], settings: {} };
  input.spaces[0].rooms[0].settings = { sun_transparent: true, future_sun: { keep: [4, false] } };
  const s = setup({ configInput: input });
  const original = clone(s.spaceOf('f').rooms[0].settings);
  await s.edit('f', 'Room settings snapshot', space => { space.rooms[0].settings.sun_transparent = false; });
  const changed = { ...original, sun_transparent: false };
  assert.deepEqual(s.server.config.spaces[0].rooms[0].settings, changed);
  s.runtime._undoGeometry(); await s.writes();
  assert.deepEqual(s.spaceOf('f').rooms[0].settings, original);
  assert.deepEqual(s.server.config.spaces[0].rooms[0].settings, original);
  s.runtime._redoGeometry(); await s.writes();
  assert.deepEqual(s.spaceOf('f').rooms[0].settings, changed);
  assert.deepEqual(s.server.config.spaces[0].rooms[0].settings, changed);
});

test('#1061 existing off-grid faces cross the actual commit/write/history owners separately and sequentially', async () => {
  const { roomSource, graphSources, inheritedY, stableRoomReceiptIds } = await import('./helpers/room-contact-grid.mjs');
  const { buildWallFaceGraph, findWallFaceAtPoint } = await import('../test-build/wall-face-graph.js');
  const { spaceModels, GRID_PITCH, GRID_STEP_N, NORM_W } = await import('../test-build/space-geometry.js');
  const { normalizeWallIntervals, degradeWalls } = await import('../test-build/wall-thickness.js');
  const { spacePhysicalGeometryFingerprint } = await import('../test-build/plan-geometry-preflight.js');
  const receipts = [];
  for (const [clicks,height] of [[[.375],inheritedY], [[.625],inheritedY], [[.375,.625],inheritedY], [[.375],.3125]]) {
  const s = setup({ floors: ['floor'], configInput: roomSource(height) });
  Object.assign(s.host, {
    _spaceH: NORM_W, _cellCm: s.spaceOf('floor').cell_cm,
    _gridPitch: GRID_PITCH, _wallKeyPitch: GRID_STEP_N, _drawWallCm: 20,
    _spaceModel: () => spaceModels(s.host._serverCfg).find(space => space.id === 'floor'),
    // No zero-thickness passages or rendered opening projections in this Node shell;
    // persisted opening data remains real, and the native case covers its projection.
    _openCuts: () => [], _openingsR: [],
    _normalizeWalls(walls, cuts) {
      return degradeWalls(normalizeWallIntervals(this._spaceModel().rooms, walls, cuts,
        GRID_STEP_N, this._cellCm, GRID_PITCH, NORM_W), this._curSpaceCfg.rooms, GRID_STEP_N, 1,
      cuts.map(cut => cut.map(value => value / NORM_W)));
    },
  });
  // Retain the live current-space owner across adoption.
  Object.defineProperty(s.host, '_curSpaceCfg', { get: () => s.spaceOf('floor') });
  const source = clone(s.server.config), candidates = [];
  const oldRoom = clone(s.spaceOf('floor').rooms[0]);
  for (const [i, x] of clicks.entries()) {
    const space = s.spaceOf('floor');
    const graph = buildWallFaceGraph(graphSources(space), 1000 / 240 * .0002);
    const face = findWallFaceAtPoint(graph, [x * 1000, 150]);
    assert.ok(face);
    s.host._wallFaceBatch = { spaceId: 'floor',
      geometryFingerprint: spacePhysicalGeometryFingerprint(space),
      decisions: [{ candidate: { ...face, existing: true }, create: true, name: 'New', area: null, settings: null }],
      activePath: [], activeCms: [], activePartitionIds: [],
    };
    s.runtime._applyWallFaceBatch();
    assert.deepEqual(await s.writes(), { armed: true, sets: i + 1 });
    assert.deepEqual(s.spaceOf('floor').rooms[0], oldRoom);
    assert.deepEqual(s.spaceOf('floor').openings,source.spaces[0].openings);
    assert.deepEqual(s.server.config.spaces[1],source.spaces[1]);
    assert.deepEqual(s.server.config.markers,source.markers);
    for(const old of source.spaces[0].wall_segments)
      assert.deepEqual(s.spaceOf('floor').wall_segments.find(wall=>wall.id===old.id),old);
    assert.equal(s.server.config.spaces[0].rooms.length, i + 2);
    assert.ok(s.server.config.spaces[0].rooms.at(-1).poly.some(point => point[1] === height));
    candidates.push(clone(s.server.config));
  }
  assert.equal(s.geometryHistory.size, clicks.length);
  s.runtime._undoGeometry(); await s.writes();
  assert.equal(s.server.config.spaces[0].rooms.length, clicks.length);
  s.runtime._redoGeometry(); await s.writes();
  assert.equal(s.server.config.spaces[0].rooms.length, clicks.length + 1);
  assert.deepEqual(s.server.config,candidates.at(-1),'Redo restores the exact allocated identities');
  assert.equal(s.toasts.includes('toast.geometry_unsafe'), false);
  receipts.push({ clicks, source, candidates });
  }
  const { readFileSync, writeFileSync } = await import('node:fs');
  if (process.env.HP_1061_ROOM_RECEIPT) {
    writeFileSync(process.env.HP_1061_ROOM_RECEIPT, JSON.stringify(receipts, null, 2) + '\n');
  } else assert.deepEqual(stableRoomReceiptIds(receipts),stableRoomReceiptIds(JSON.parse(
    readFileSync(new URL('./fixtures/1061-room-candidates.json', import.meta.url), 'utf8'))));
});

test('#1061 a genuinely new derived off-grid scalar still refuses atomically', async () => {
  const { roomSource, inheritedY } = await import('./helpers/room-contact-grid.mjs');
  const s = setup({ floors: ['floor'], configInput: roomSource() });
  const before = s.runtime._geometrySnapshot('floor'), original = clone(s.host._serverCfg);
  s.spaceOf('floor').rooms.push({ id: 'new', name: 'New', area: null,
    poly: [[.25, 0], [.5, 0], [.5, inheritedY / 2], [.25, inheritedY]] });
  assert.equal(s.runtime._commitPhysicalGeometry('Room', before), false);
  assert.deepEqual(s.host._serverCfg, original);
  assert.deepEqual(await s.writes(), { armed: false, sets: 0 });
  assert.equal(s.geometryHistory.size, 0);
  assert.ok(s.toasts.includes('toast.geometry_unsafe'));
});

test('#891 AC2 strict pre-send refusal removes only owned physical commands and rebases independent Background snapshots', async () => {
  const s = setup();
  const older = await s.addWall('g'), background = await s.addLine('f');
  const before = s.runtime._geometrySnapshot('f');
  s.spaceOf('f').partitions = [{ id: 'refused', a: [.25, .25], b: [1, .25], cm: 10 }];
  assert.equal(s.runtime._commitPhysicalGeometry(WALL, before), true);
  const refused = s.geometryHistory.peekUndo();
  const backdropBefore = s.runtime._geometrySnapshot('f');
  s.spaceOf('f').plan_x = .125;
  s.runtime._recordGeometry(WALL, backdropBefore); // deliberately same label and floor, distinct identity
  const newer = s.geometryHistory.peekUndo();
  s.host._pendingPhysicalWrites.get('f').fingerprint = '';
  s.host._checkSpacePhysicalGeometry = UNSAFE;
  const sent = s.server.sets;
  await assert.rejects(s.runtime._writeConfig(), error => error.code === 'geometry-unsafe');
  s.expectStack([older, background, newer], [], 'independent command identities survive');
  assert.equal(s.server.sets, sent, 'preflight refusal sends no WS');
  assert.equal(s.ids('f').includes('refused'), false);
  assert.equal(s.spaceOf('f').plan_x, .125, 'independent live background survives rollback');
  assert.equal(s.geometryHistory.commands().includes(refused), false);
  s.host._checkSpacePhysicalGeometry = () => ({ ok: true });
  s.runtime._undoGeometry(); await s.writes();
  assert.equal(s.spaceOf('f').plan_x, undefined);
  assert.equal(s.ids('f').includes('refused'), false, 'Background Undo cannot resurrect refused walls');
  s.runtime._redoGeometry(); await s.writes();
  assert.equal(s.spaceOf('f').plan_x, .125);
  assert.equal(s.ids('f').includes('refused'), false, 'Background Redo cannot resurrect refused walls');
});

test('#891 AC2 delayed non-conflict physical refusal preserves newer same-floor Background command and other-floor history', async () => {
  const s = setup(); const older = await s.addWall('g');
  const before = s.runtime._geometrySnapshot('f');
  s.spaceOf('f').partitions = [{ id: 'refused', a: [.25, .25], b: [1, .25], cm: 10 }];
  assert.equal(s.runtime._commitPhysicalGeometry(WALL, before), true);
  let reject;
  s.host._sendConfigCandidate = () => new Promise((resolve, fail) => { reject = fail; });
  const write = s.runtime._writeConfig(); await settle();
  const afterStart = s.runtime._geometrySnapshot('f'); s.spaceOf('f').plan_scale = 2;
  s.runtime._recordGeometry(WALL, afterStart); const newer = s.geometryHistory.peekUndo();
  reject(Object.assign(new Error('offline'), { code: 'timeout' }));
  await assert.rejects(write, error => error.physicalGeometryRolledBack === true);
  s.expectStack([older, newer], [], 'late refusal is not a name/floor sweep');
  assert.equal(s.spaceOf('f').plan_scale, 2);
  assert.equal(s.ids('f').includes('refused'), false);
  assert.equal(newer.before.partitions?.some(p => p.id === 'refused') ?? false, false);
  assert.equal(newer.after.partitions?.some(p => p.id === 'refused') ?? false, false);
  // An already retired refusal cannot roll back a fresh transaction sharing only its floor.
  const oldEntry = { before, fingerprint: '' }, freshBefore = s.runtime._geometrySnapshot('f');
  s.host._pendingPhysicalWrites.set('f', { before: freshBefore, fingerprint: 'new' });
  const state = clone(s.host._serverCfg);
  assert.equal(s.runtime._rollbackRejectedPhysicalWrites([['f', oldEntry]]), false);
  s.expectStack([older, newer], [], 'old transaction identity owns nothing new');
  assert.deepEqual(s.host._serverCfg, state);
});

for (const direction of ['undo', 'redo']) {
  test(`#891 AC2 retryable deferred ${direction} refusal restores an accepted command identity/cursor and permits exactly one retry`, async () => {
    const s = setup();
    const older = await s.addWall('g'), accepted = await s.addWall('f');
    if (direction === 'redo') { s.runtime._undoGeometry(); await s.writes(); }
    const baseline = clone(s.spaceOf('f'));
    const send = s.host._sendConfigCandidate;
    s.host._sendConfigCandidate = async () => { throw Object.assign(new Error('offline'), { code: 'timeout' }); };
    assert.equal(s.runtime._stepGeometryHistory(direction), true);
    await assert.rejects(s.runtime._writeConfig(), error => error.physicalGeometryRolledBack === true);
    s.expectStack(direction === 'undo' ? [older, accepted] : [older],
      direction === 'redo' ? [accepted] : [], 'retryable refusal restores only the accepted cursor');
    assert.deepEqual(s.spaceOf('f'), baseline, 'accepted physical baseline is restored');
    s.host._sendConfigCandidate = send;
    const sends = s.server.sets;
    assert.equal(s.runtime._stepGeometryHistory(direction), true);
    await s.writes();
    assert.equal(s.server.sets, sends + 1, 'explicit retry sends exactly once; no automatic retry');
    s.expectStack(direction === 'redo' ? [older, accepted] : [older],
      direction === 'undo' ? [accepted] : [], 'the retry moves exactly the same object');
  });
}

test('#891 AC2 multi-step deferred Undo rollback restores accepted order below a newer independent same-floor command', async () => {
  const s = setup();
  const older = await s.addWall('g'), first = await s.addWall('f'), second = await s.addWall('f');
  const physical = clone(s.spaceOf('f').partitions);
  assert.equal(s.runtime._stepGeometryHistory('undo'), true);
  assert.equal(s.runtime._stepGeometryHistory('undo'), true);
  let reject;
  s.host._sendConfigCandidate = () => new Promise((resolve, fail) => { reject = fail; });
  const write = s.runtime._writeConfig(); await settle();
  const before = s.runtime._geometrySnapshot('f');
  s.spaceOf('f').plan_scale = 2;
  s.runtime._recordGeometry(WALL, before); // fresh same-name identity clears the optimistic redo lane
  const newer = s.geometryHistory.peekUndo();
  reject(Object.assign(new Error('temporary failure'), { code: 'node_move_backend_unavailable' }));
  await assert.rejects(write);
  s.expectStack([older, first, second, newer], [], 'both accepted identities restored below the newer branch');
  assert.deepEqual(s.spaceOf('f').partitions, physical);
  assert.equal(s.spaceOf('f').plan_scale, 2);
  assert.deepEqual(newer.before.partitions, physical, 'independent snapshots carry the restored accepted geometry');
  assert.deepEqual(newer.after.partitions, physical);
});

for (const explicit of [true, false]) {
  test(`#891 AC2 deferred preflight ${explicit ? 'proved unsafe' : 'unexpected check failure'} removes only proven unfit accepted steps`, async () => {
    const s = setup(); const older = await s.addWall('g'), accepted = await s.addWall('f');
    assert.equal(s.runtime._stepGeometryHistory('undo'), true);
    s.host._pendingPhysicalWrites.get('f').fingerprint = '';
    s.host._checkSpacePhysicalGeometry = explicit ? UNSAFE : () => { throw new TypeError('unexpected'); };
    const sent = s.server.sets;
    await assert.rejects(s.runtime._writeConfig(), error => error.code === 'geometry-unsafe');
    s.expectStack(explicit ? [older] : [older, accepted], [], 'only an explicit proof retires this accepted identity');
    assert.equal(s.server.sets, sent, 'failed preflight sends no WS');
    assert.equal(s.ids('f').length, 1, 'physical baseline is restored in either failure case');
  });
}

test('#891 AC2 accepted cursor rollback never rebases older Background snapshots into newer walls', async () => {
  const s = setup(); const background = await s.addLine('f'), accepted = await s.addWall('f');
  const originalBackground = clone(background);
  const send = s.host._sendConfigCandidate;
  s.host._sendConfigCandidate = async () => { throw Object.assign(new Error('offline'), { code: 'timeout' }); };
  s.runtime._stepGeometryHistory('undo'); await assert.rejects(s.runtime._writeConfig());
  s.expectStack([background, accepted], [], 'accepted cursor returns with its older Background neighbour');
  assert.deepEqual(background, originalBackground, 'older snapshots were not created in the refused batch');
  s.host._sendConfigCandidate = send;
  s.runtime._undoGeometry(); await s.writes();
  s.runtime._undoGeometry(); await s.writes();
  assert.equal(s.ids('f').length, 0, 'older Background Undo cannot resurrect the later accepted wall');
});

test('#891 AC2 accepting an older send promotes the rollback baseline for newer physical commands', async () => {
  const s = setup();
  const before = s.runtime._geometrySnapshot('f');
  s.spaceOf('f').partitions = [{ id: 'accepted-first', a: [.25, .25], b: [1, .25], cm: 10 }];
  assert.equal(s.runtime._commitPhysicalGeometry(WALL, before), true);
  const accepted = s.geometryHistory.peekUndo();
  let accept;
  // Recording transport preserves newer staged edits on acceptance, isolating
  // this physical journal seam from ConfigAdoption's independent queue contract.
  s.host._sendConfigCandidate = candidate => new Promise(resolve => {
    accept = () => {
      const live = clone(s.host._serverCfg);
      s.server.config = clone(candidate); s.server.rev++; s.server.sets++;
      s.host._adoption.acceptConfigWrite(candidate, { ok: true, rev: s.server.rev });
      s.host._adoption.stageLocalConfig(live);
      resolve();
    };
  });
  const firstWrite = s.runtime._writeConfig(); await settle();
  const nextBefore = s.runtime._geometrySnapshot('f');
  s.spaceOf('f').partitions.push({ id: 'refused-second', a: [.25, .5], b: [1, .5], cm: 10 });
  assert.equal(s.runtime._commitPhysicalGeometry(WALL, nextBefore), true);
  const refused = s.geometryHistory.peekUndo();
  accept(); await firstWrite;
  assert.deepEqual(s.ids('f'), ['accepted-first', 'refused-second']);
  s.host._sendConfigCandidate = async () => { throw Object.assign(new Error('offline'), { code: 'timeout' }); };
  await assert.rejects(s.runtime._writeConfig());
  assert.deepEqual(s.ids('f'), ['accepted-first'], 'second refusal cannot roll back the accepted first send');
  s.expectStack([accepted], [], 'only second provisional identity is retired');
  assert.equal(s.geometryHistory.commands().includes(refused), false);
});

// ---------------------------------------------------------------- AC1
test('#883 AC1 a floor pinned elsewhere keeps the exact Undo/Redo command, writes nothing, keeps the floor; unpinned, the retry applies exactly it', async () => {
  const s = setup();
  const onF = await s.addWall('f');
  s.host._space = 'g';
  const onG = await s.addWall('g');
  s.host.floor = 'g'; // a live setConfig({ floor: 'g' })
  s.runtime._undoGeometry();
  s.expectStack([onF], [onG], 'the pinned floor itself is allowed');
  const sent = (await s.writes()).sets;
  s.toasts.length = 0; s.shell.length = 0;
  const plan = clone(s.host._serverCfg);
  s.runtime._undoGeometry();
  s.expectStack([onF], [onG], 'Undo refused for now: nothing moved, nothing removed');
  assert.deepEqual(s.toasts, ['history.space_pinned'], 'one toast naming the card, no «Undone»');
  assert.deepEqual([clone(s.host._serverCfg), s.host._space, s.shell], [plan, 'g', []], 'plan and floor as before, no hidden switch');
  assert.deepEqual(await s.writes(), { armed: false, sets: sent }, 'the refusal arms and sends nothing');
  s.host.floor = null;
  s.toasts.length = 0;
  s.runtime._undoGeometry();
  s.expectStack([], [onG, onF], 'the retry applied exactly the refused command');
  assert.deepEqual([s.ids('f'), s.host._space, s.toasts], [[], 'f', [undone(WALL)]]);
  s.host.floor = 'g'; s.host._space = 'g'; s.toasts.length = 0;
  s.runtime._redoGeometry();
  s.expectStack([], [onG, onF], 'Redo refused for now');
  assert.deepEqual([s.toasts, s.ids('f'), s.host._space], [['history.space_pinned'], [], 'g']);
  s.host.floor = null; s.toasts.length = 0;
  s.runtime._redoGeometry();
  s.expectStack([onF], [onG], 'the Redo retry applied exactly it');
  assert.deepEqual([s.ids('f'), s.toasts], [['p-f-1'], [redone(WALL)]]);
});
test('#883 AC1 before the authoritative answer a pinned or missing floor is a retry, never a removal', async () => {
  const s = setup();
  const onF = await s.addWall('f'), onG = await s.addWall('g');
  s.host._loadOk = false;
  s.host.floor = 'f';
  s.runtime._undoGeometry();
  s.host.floor = null;
  s.host._serverCfg.spaces = s.host._serverCfg.spaces.filter(space => space.id !== 'g');
  s.runtime._undoGeometry();
  s.expectStack([onF, onG], [], 'nothing removed without authority');
  assert.deepEqual(s.toasts, ['history.unavailable', 'history.unavailable']);
});

// ---------------------------------------------------------------- AC2
test('#883 AC2 a floor missing from the authoritative baseline removes only that step (unit-only); neighbours apply next', async () => {
  const s = setup({ floors: ['f', 'g', 'h'] });
  const first = await s.addWall('f'), gone = await s.addWall('g'), line = await s.addLine('h'), top = await s.addWall('g');
  s.runtime._undoGeometry(); // the top g step
  await s.writes();
  s.host._serverCfg.spaces = s.host._serverCfg.spaces.filter(space => space.id !== 'g');
  s.toasts.length = 0;
  const plan = clone(s.host._serverCfg);
  s.runtime._redoGeometry();
  s.expectStack([first, gone, line], [], 'unfit Redo leaves only the redo branch and never enters Undo');
  assert.deepEqual([s.toasts, clone(s.host._serverCfg), s.deferred.pending()], [[removed('redo', WALL, 'space')], plan, false]);
  s.toasts.length = 0;
  s.runtime._undoGeometry(); // the Background step of another floor
  assert.deepEqual(s.toasts, [undone(LINE)]);
  s.toasts.length = 0;
  s.runtime._undoGeometry();
  s.expectStack([first], [line], 'the same-named step of another floor stays');
  assert.deepEqual(s.toasts, [removed('undo', WALL, 'space')]);
  s.toasts.length = 0;
  s.runtime._undoGeometry();
  assert.deepEqual([s.toasts, s.ids('f'), s.host._space], [[undone(WALL)], [], 'f'], 'the neighbour applies with the next press');
});
test('#883 AC2 an explicit unsafe physical verdict removes only that step: plan, pending writes and server as before', async () => {
  const s = setup();
  const first = await s.addWall('f'), unsafe = await s.addWall('f'), last = await s.addWall('f');
  s.runtime._undoGeometry();
  await s.writes();
  s.toasts.length = 0;
  const plan = clone(s.host._serverCfg), pending = clone([...s.host._pendingPhysicalWrites]), sent = s.server.sets;
  s.host._checkSpacePhysicalGeometry = UNSAFE;
  s.runtime._undoGeometry();
  s.expectStack([first], [last], 'one step left; the redo branch stays');
  assert.deepEqual(s.toasts, [removed('undo', WALL, 'geometry')], 'one toast, the unsafe toast is not added');
  assert.deepEqual([clone(s.host._serverCfg), clone([...s.host._pendingPhysicalWrites])], [plan, pending]);
  assert.deepEqual(await s.writes(), { armed: false, sets: sent });
  s.host._checkSpacePhysicalGeometry = () => ({ ok: true });
  s.toasts.length = 0;
  s.runtime._undoGeometry();
  assert.deepEqual([s.toasts, s.ids('f')], [[undone(WALL)], []], 'the neighbour with the same name applies next');
  assert.equal(unsafe.name, WALL);
});
test('#883 AC2 the repairable history boundary (wall-degraded-extra) is still restored, not removed', async () => {
  const s = setup();
  await s.addWall('f'); const step = await s.addWall('f');
  s.host._checkSpacePhysicalGeometry = () => ({ ok: false, reason: 'wall-degraded-extra' });
  s.runtime._undoGeometry();
  assert.deepEqual([s.toasts.at(-1), s.geometryHistory.peekRedo()], [undone(WALL), step]);
});
test('#883 AC2 an explicit wall-model refusal and an uncanonicalizable snapshot remove only their step (unit-only)', async () => {
  for (const [label, reason, corrupt] of [
    ['model', 'geometry', state => { state.rooms[0].poly = [[0, 0], [2, 0]]; }],
    ['canonicalization', 'state', state => { state.rooms[0].poly = [[0, 0], [2, 0]]; state.wallChainSeedIds = ['p-f-1']; }],
  ]) {
    const s = setup();
    const first = await s.addWall('f'), bad = await s.addWall('f');
    corrupt(bad.before);
    s.toasts.length = 0;
    const plan = clone(s.host._serverCfg), sent = s.server.sets;
    s.runtime._undoGeometry();
    s.expectStack([first], [], label);
    assert.deepEqual(s.toasts, [removed('undo', WALL, reason)], label);
    assert.deepEqual([clone(s.host._serverCfg), await s.writes()], [plan, { armed: false, sets: sent }], label);
  }
});

// ---------------------------------------------------------------- AC3
/** An active Walls chain one accepted point back: two segments drawn, the terminal undone. */
async function chain() {
  const s = setup();
  const older = await s.addWall('f');
  const segment = (n, from, to) => s.edit('f', SEGMENT, space => {
    (space.partitions ||= []).push({ id: `chain-${n}`, a: from, b: to, cm: 10 });
  });
  const first = await segment(1, [0.25, 1], [1, 1]), second = await segment(2, [1, 1], [1.75, 1]);
  s.runtime._undoGeometry();
  Object.assign(s.host, {
    _tool: 'draw', _activeWallChainId: 'chain-a', _path: [[250, 1000], [1000, 1000]],
    _activeWallChainPartitionIds: ['chain-1'], _wallChainSegmentCms: [10],
    _wallChainRedo: [{ id: 'chain-2', point: [1750, 1000], cm: 10 }],
  });
  s.toasts.length = 0;
  const ledger = () => clone({ id: s.host._activeWallChainId, path: s.host._path, ids: s.host._activeWallChainPartitionIds,
    cms: s.host._wallChainSegmentCms, redo: s.host._wallChainRedo, tool: s.host._tool });
  return { ...s, older, first, second, ledger };
}
test('#883 AC3 active chain Redo: a temporary refusal keeps path, IDs, thickness and the redo-point ledger', async () => {
  const s = await chain();
  const ledger = s.ledger(), plan = clone(s.host._serverCfg);
  s.host._checkSpacePhysicalGeometry = () => { throw new TypeError('checker failed'); };
  s.runtime._redoGeometry();
  assert.deepEqual([s.ledger(), clone(s.host._serverCfg), s.toasts], [ledger, plan, ['history.unavailable']]);
  s.expectStack([s.older, s.first], [s.second], 'kept');
  s.host._checkSpacePhysicalGeometry = () => ({ ok: true });
  s.runtime._redoGeometry();
  assert.deepEqual(s.ledger(), { ...ledger, path: [...ledger.path, [1750, 1000]], ids: ['chain-1', 'chain-2'], cms: [10, 10], redo: [] },
    'success keeps «one accepted point forward»');
});
test('#891 AC1 a second active-chain history reset preserves every redo point, not just the terminal one', async () => {
  const s = await chain();
  const redo = clone(s.host._wallChainRedo);
  // This is the same production reset invoked by each successful active-segment
  // Undo. The card appends the next terminal point after the reset returns.
  assert.equal(s.runtime._stepGeometryHistory('undo'), true);
  assert.deepEqual(s.host._wallChainRedo, redo, 'transient reset must not clear the session redo journal');
  s.host._activeWallChainId = 'chain-a';
  s.host._wallChainRedo.push({ id: 'chain-1', point: [1000, 1000], cm: 10 });
  assert.equal(s.runtime._stepGeometryHistory('redo'), true);
  assert.equal(s.host._wallChainRedo.length, 2, 'another successful reset retains both entries');
});
test('#883 AC3 active chain: an unfit step ends the obsolete chain without a write; the next press is an ordinary step', async () => {
  for (const direction of ['redo', 'undo']) {
    const s = await chain();
    if (direction === 'undo') s.runtime._redoGeometry(); // the chain is back at two segments, its terminal on top
    s.toasts.length = 0;
    const plan = clone(s.host._serverCfg), sent = (await s.writes()).sets;
    s.host._checkSpacePhysicalGeometry = UNSAFE;
    // Redo: the runtime chain branch; Undo: the call the card's one-point-back makes.
    if (direction === 'redo') s.runtime._redoGeometry(); else s.runtime._stepGeometryHistory('undo');
    s.host._checkSpacePhysicalGeometry = () => ({ ok: true });
    assert.deepEqual(s.ledger(), { id: null, path: [], ids: [], cms: [], redo: [], tool: 'draw' }, `${direction}: chain ended, Walls stays`);
    assert.deepEqual([clone(s.host._serverCfg), await s.writes()], [plan, { armed: false, sets: sent }], `${direction}: saved walls untouched`);
    s.expectStack([s.older, s.first], [], `${direction}: only the refused segment left`);
    assert.deepEqual(s.toasts, [removed(direction, SEGMENT, 'geometry')]);
    s.toasts.length = 0;
    s.runtime._undoGeometry();
    assert.deepEqual([s.toasts, s.ledger().path, s.ids('f')], [[undone(SEGMENT)], [], ['p-f-1']],
      `${direction}: the neighbour is undone as an ordinary step, not as the old chain terminal`);
  }
});

// ---------------------------------------------------------------- AC4
test('#883 AC4 without a refusal: one step per press, Plan and Background share it, another floor is shown with editor and tool', async () => {
  const s = setup();
  const line = await s.addLine('f');
  s.host._space = 'g'; s.host._mode = 'decor'; s.host._tool = 'draw';
  const wall = await s.addWall('g');
  s.toasts.length = 0;
  s.runtime._undoGeometry(); s.runtime._undoGeometry();
  assert.deepEqual([s.toasts, s.host._space, s.host._mode, s.host._tool], [[undone(WALL), undone(LINE)], 'f', 'decor', 'draw']);
  assert.deepEqual(s.shell, ['commit:f', 'saveNav', 'restoreZoom']);
  s.runtime._redoGeometry(); s.runtime._redoGeometry();
  s.expectStack([line, wall], [], 'both redone');
  assert.deepEqual(s.devicePositionHistory.undoName, 'Move lamp', 'the Devices history is independent');
});
test('#883 AC4 a live gesture owns the first press; the second one moves the history', async () => {
  for (const [label, gesture] of [
    ['decor draft', s => { s.host._decorDraft = { kind: 'line', a: [0, 0], b: [1, 1], pid: 1 }; }],
    ['physical drag', s => { s.runtime.physicalGesture.begin({ pointerId: 1, clientX: 1, clientY: 1,
      stopPropagation() {}, target: null }, 'partition', 'p-f-1');
      assert.equal(s.runtime.physicalGesture.active, true); }],
  ]) {
    const s = setup();
    const step = await s.addWall('f');
    gesture(s);
    s.runtime._undoGeometry();
    s.expectStack([step], [], `${label}: the first press cancels the gesture only`);
    s.runtime._undoGeometry();
    s.expectStack([], [step], label);
  }
});

// ---------------------------------------------------------------- AC5
test('#883 AC5 an unexpected exception keeps the command, restores plan and floor, and shows no success', async () => {
  const s = setup();
  const onF = await s.addWall('f');
  s.host._space = 'g';
  const plan = clone(s.host._serverCfg), sent = s.server.sets;
  let failing = true;
  s.host._maybeRebuildDevices = () => { if (failing) throw new Error('device rebuild failed'); };
  s.toasts.length = 0;
  s.runtime._undoGeometry();
  s.expectStack([onF], [], 'kept');
  assert.deepEqual([clone(s.host._serverCfg), s.host._space, s.toasts], [plan, 'g', ['history.unavailable']]);
  assert.deepEqual(await s.writes(), { armed: false, sets: sent }, 'no partial candidate is sent');
  failing = false; s.toasts.length = 0;
  s.runtime._undoGeometry();
  assert.deepEqual([s.toasts, s.ids('f'), s.host._space], [[undone(WALL)], [], 'f']);
});
test('#883 AC5 a new command after a refusal and an external adoption keep their invalidation', async () => {
  const s = setup();
  const onF = await s.addWall('f'), onG = await s.addWall('g');
  s.runtime._undoGeometry();
  s.host.floor = 'g'; s.host._space = 'g';
  s.runtime._undoGeometry(); // refused for now
  const fresh = await s.addWall('g');
  s.expectStack([onF, fresh], [], 'the new branch drops the old redo; the refusal restores nothing');
  s.host.floor = null; s.toasts.length = 0;
  s.runtime._redoGeometry();
  assert.deepEqual(s.toasts, [], 'nothing to redo');
  s.server.config.spaces[0].title = 'Foreign'; s.server.rev++;
  await s.host._reloadConfigOnly(true);
  assert.deepEqual([s.geometryHistory.canUndo, s.geometryHistory.canRedo], [false, false], 'external content: full invalidation as before');
  s.runtime._undoGeometry();
  assert.deepEqual(s.toasts, [], 'no attempt, no toast');
  assert.ok(onG);
});

test('#861 actual editor publication keeps begin/end full and queued physical moves live', async () => {
  const s = setup(); await s.addWall('f');
  const previousRaf = globalThis.requestAnimationFrame, previousCancel = globalThis.cancelAnimationFrame;
  const frames = new Map(); let serial = 0;
  globalThis.requestAnimationFrame = callback => { frames.set(++serial, callback); return serial; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  const routes = [];
  s.host.requestUpdate = () => routes.push(s.runtime._routeLiveEditorUpdate());
  const pointer = (x, y) => ({ pointerId: 7, clientX: x, clientY: y, target: null, stopPropagation() {} });
  try {
    s.runtime.physicalGesture.begin(pointer(1, 1), 'partition', 'p-f-1');
    assert.deepEqual(routes, [false], 'begin cannot be swallowed by the owner-active live predicate');
    for (let i = 0; i < 12; i++) { s.runtime.physicalGesture.move(pointer(2 + i, 3 + i)); await Promise.resolve(); }
    assert.deepEqual(routes, [false, ...Array(12).fill(true)]);
    assert.equal(frames.size, 1, 'the established RAF still coalesces all twelve live publications');
    s.runtime.physicalGesture.cancel();
    assert.equal(routes.at(-1), false, 'terminal publication is full even if another owner remains active');
    assert.equal(s.runtime.physicalGesture.active, false);
    assert.equal(s.geometryHistory.size, 1, 'cancelling preview creates no command');
  } finally {
    s.runtime._disposeLiveEditor();
    globalThis.requestAnimationFrame = previousRaf; globalThis.cancelAnimationFrame = previousCancel;
  }
});

test('#861 actual owner state blocks LiveRuntime and recovery/carousel idle and clears through the existing runtime', async () => {
  const s = setup(); await s.addWall('f');
  Object.assign(s.host, { _pointers: new Map(), _touchContacts: new Map(),
    _cameraTransition: { active: false }, _warmModeRequest: 0 });
  Object.defineProperty(s.host, '_curSpaceCfg', { get: () => s.spaceOf(s.host._space) });
  const pointer = { pointerId: 9, clientX: 1, clientY: 1, target: null, stopPropagation() {} };
  const live = new LiveRuntime(s.host);
  const idle = () => [live.active(), cardInteractionIdleSnapshot(s.host).gesturesIdle];
  assert.deepEqual(idle(), [false, true]);
  s.runtime.physicalGesture.begin(pointer, 'partition', 'p-f-1');
  assert.deepEqual(idle(), [true, false]);
  s.runtime._clearGeometryGesture();
  assert.deepEqual(idle(), [false, true]);
  s.spaceOf('f').plan_url = '/test.svg'; s.spaceOf('f').plan_aspect = 1;
  s.host._mode = 'decor'; s.host._decorTool = 'backdrop';
  s.runtime.backdropGesture.begin(pointer);
  assert.deepEqual(idle(), [true, false]);
  s.runtime._clearGeometryGesture();
  assert.deepEqual(idle(), [false, true]);
  s.runtime.backdropGesture.begin(pointer);
  s.runtime.backdropGesture.move({ ...pointer, clientX: 50, clientY: 50 });
  const before = clone(s.spaceOf('f'));
  s.runtime._disposeLiveEditor(); // cancels this card's actual shared microtask queue
  await Promise.resolve();
  assert.deepEqual(s.spaceOf('f'), before, 'disposed queued backdrop work cannot mutate the canonical record');
  assert.equal(s.geometryHistory.size, 1, 'reset/dispose never add a history entry');
});

for (const direction of ['undo', 'redo']) {
  for (const kind of ['move', 'rotation', 'backdrop']) {
    test(`#861 actual runtime ${direction} cancels a held ${kind} without history or persistence`, async () => {
      const s = setup();
      const column = { id: 'rotate', shape: 'square', center: [1, 1], cm: 10, angle: 0 };
      Object.assign(s.spaceOf('f'), { plan_url: '/test.svg', plan_aspect: 1, wall_columns: [column] });
      const step = await s.addWall('f');
      const before = clone(s.host._serverCfg), sets = s.server.sets;
      const pointer = { pointerId: 9, clientX: 2, clientY: 1, target: null,
        stopPropagation() {}, preventDefault() {} };
      if (kind === 'backdrop') {
        s.host._mode = 'decor'; s.host._decorTool = 'backdrop';
        Object.defineProperty(s.host, '_curSpaceCfg', { get: () => s.spaceOf('f') });
        s.runtime.backdropGesture.begin(pointer);
        s.runtime.backdropGesture.move({ ...pointer, clientX: 35, clientY: 25 });
      } else if (kind === 'rotation') {
        s.runtime.physicalGesture.rotateBegin(pointer, column);
        s.runtime.physicalGesture.rotateMove({ ...pointer, clientX: 2, clientY: 2 });
      } else {
        s.runtime.physicalGesture.begin(pointer, 'partition', 'p-f-1');
        s.runtime.physicalGesture.move({ ...pointer, clientX: 35, clientY: 25 });
      }
      await Promise.resolve();
      assert.equal(kind === 'backdrop' ? s.runtime.backdropGesture.active : s.runtime.physicalGesture.active, true);
      s.runtime[direction === 'undo' ? '_undoGeometry' : '_redoGeometry']();
      assert.deepEqual([s.runtime.physicalGesture.active, s.runtime.backdropGesture.active], [false, false]);
      s.expectStack([step], [], 'the first press cancels the gesture, not an ordinary command');
      assert.deepEqual(s.host._serverCfg, before, 'mutated backdrop transform is restored exactly');
      assert.deepEqual(await s.writes(), { armed: false, sets }, 'no deferred or actual write');
    });
  }
}

test('#861 actual mode/cancel/clear consumers retain their different physical reset subsets', async () => {
  for (const operation of ['mode', 'cancelPath', 'clear']) {
    const s = setup(); await s.addWall('f');
    const pointer = { pointerId: 7, clientX: 2, clientY: 1, target: null,
      stopPropagation() {}, preventDefault() {} };
    s.runtime.physicalGesture.begin(pointer, 'partition', 'p-f-1');
    s.runtime.physicalGesture.rotateBegin({ ...pointer, pointerId: 8 },
      { id: 'rotate', shape: 'square', center: [1, 1], cm: 10, angle: 0 });
    const before = clone(s.host._serverCfg), sets = s.server.sets;
    if (operation === 'mode') {
      Object.assign(s.host, { _bootSoftCancel() {}, _endTabDrag() {}, _clearTransientHover() {},
        _cancelDevicePressFeedback() {}, _cancelDangerConfirm() {}, _effectiveProjection: () => 'flat',
        _currentModeVisual: () => null, _cancelModeTransition() {}, _commitViewModeAtomic() {},
        _editorSecondary: { closeForNavigation() {} }, _zoom: 1, _modeTransitionRequest: 0 });
      s.runtime._setMode('view', false);
    } else if (operation === 'cancelPath') s.runtime._cancelPath();
    else s.runtime._clearGeometryGesture();
    assert.equal(s.runtime.physicalGesture.drag, null, `${operation} resets move`);
    assert.equal(!!s.runtime.physicalGesture.rotation, operation === 'mode',
      'mode deliberately preserves rotation; path/geometry clearing resets both');
    assert.deepEqual(s.host._serverCfg, before);
    assert.deepEqual(await s.writes(), { armed: false, sets });
    assert.equal(s.geometryHistory.size, 1, 'reset-only consumers never create a command');
  }
});
