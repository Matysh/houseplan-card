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
const { CommandStack } = await import('../test-build/command-stack.js');
const { canonicalizeConfigGeometry } = await import('../test-build/coordinate-canonicalization.js');
const { virtualLightSnapshot } = await import('../test-build/virtual-light-state.js');
const { commitWallSegmentModel } = await import('../test-build/wall-segment-model.js');

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

function setup({ floors = ['f', 'g'] } = {}) {
  const config = commitWallSegmentModel({ model_version: 10, spaces: floors.map(square), markers: [], settings: {} }).config;
  const server = { config: clone(config), rev: 3, sets: 0 };
  const toasts = [], shell = [];
  const adoption = createConfigAdoption(() => {});
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
  const root = { ownerDocument: document, querySelectorAll: () => [], querySelector: () => null };
  const host = {
    get _serverCfg() { return adoption.config; }, set _serverCfg(next) { adoption.stageLocalConfig(next); },
    get _cfgRev() { return adoption.configRev; }, _adoption: adoption,
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
    _physicalDrag: null, _physicalRotate: null, _decorDraft: null, _decorMove: null, _dtDrag: null, _bdDrag: null,
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
  const runtime = new HouseplanEditorRuntime(host);
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
    ['decor draft', h => { h._decorDraft = { kind: 'line', a: [0, 0], b: [1, 1], pid: 1 }; }],
    ['physical drag', h => { h._physicalDrag = { pid: 1, kind: 'partition', id: 'p-f-1', start: [0, 0], startClient: [0, 0],
      before: null, moved: true, base: { id: 'p-f-1', a: [0.5, 0.5], b: [1.5, 0.5], cm: 10 }, delta: [0, 0] }; }],
  ]) {
    const s = setup();
    const step = await s.addWall('f');
    gesture(s.host);
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
