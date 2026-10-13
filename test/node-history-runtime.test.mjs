// #843: Undo/Redo of a node move through the production editor runtime.
// Real HouseplanEditorRuntime (_undoGeometry/_redoGeometry/_writeConfig/
// _applyGeometryState), the real lazy adapter, writeWallNode, CommandStack(50)
// and ConfigAdoption with the card's adoption sequence. Substituted: the HA
// transport (a server with the node_move proof rules), the card shell (space,
// navigation, toasts) and the deferred-write timer. A node is moved by a real
// pointer gesture through the adapter, never by writing history directly.
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
const { enqueueSerializedWrite } = await import('../test-build/serialized-write-queue.js');
const { canonicalizeConfigGeometry } = await import('../test-build/coordinate-canonicalization.js');
const { virtualLightSnapshot } = await import('../test-build/virtual-light-state.js');
const { applyNodeMove, prepareNodeMove, structuralWallNodes } = await import('../test-build/wall-node-move.js');
const { commitWallSegmentModel } = await import('../test-build/wall-segment-model.js');

const clone = value => JSON.parse(JSON.stringify(value));
const square = id => {
  const poly = [[0, 0], [2, 0], [2, 2], [0, 2]];
  const segs = poly.map((a, i) => ({ id: `${id}-w${i}`, a, b: poly[(i + 1) % 4], cm: 10 }));
  return { id, title: id, cell_cm: 1, rooms: [{ id: `${id}-room`, name: 'Room', poly, wall_ids: segs.map(w => w.id) }],
    wall_segments: segs };
};
const settle = async (rounds = 12) => { for (let i = 0; i < rounds; i++) await new Promise(r => setImmediate(r)); };
const MOVE = 'Move wall node';

function setup({ floors = ['f', 'g'], damaged = false } = {}) {
  const config = commitWallSegmentModel({ model_version: 10, spaces: floors.map(square), markers: [], settings: {} }).config;
  // #842 K2: a record the write filter refuses, on a floor the node never touches.
  if (damaged) config.spaces[1].wall_columns = [{ id: 'c-far', shape: 'square', center: [6000, 0.5], cm: 20, angle: 0 }];
  const server = { config: clone(config), rev: 3, log: [], fail: {} };
  const forward = (base, source, intent) => {
    const committed = commitWallSegmentModel({ ...base, spaces: [source] }).config.spaces[0];
    const nodes = structuralWallNodes(committed);
    const node = nodes.find(n => n.point[0] === intent.point[0] && n.point[1] === intent.point[1]);
    if (!node) throw Object.assign(new Error('node_move_invalid'), { code: 'node_move_invalid' });
    const result = applyNodeMove(prepareNodeMove(committed, node, nodes, intent.split_ids), intent.target, intent.axis);
    if (!result.ok) throw Object.assign(new Error('node_move_invalid'), { code: 'node_move_invalid' });
    return result.space;
  };
  // The websocket contract: expected_rev conflict; Undo is accepted only with a
  // proved inverse of the CURRENT floor; Apply (Redo) is not proved by the server.
  const callWS = async message => {
    server.log.push(clone(message));
    await Promise.resolve();
    const failure = server.fail[message.type];
    if (failure) { delete server.fail[message.type]; throw failure; }
    if (message.expected_rev !== server.rev) throw Object.assign(new Error('conflict'), { code: 'conflict' });
    if (message.type === 'houseplan/config/set') {
      server.config = clone(message.config); server.rev++;
      return { ok: true, rev: server.rev };
    }
    if (message.type === 'houseplan/wall/node_move') {
      const index = server.config.spaces.findIndex(s => s.id === message.space_id);
      let next;
      if (message.direction === 'undo') {
        if (JSON.stringify(forward(server.config, message.before_space, message.intent))
            !== JSON.stringify(server.config.spaces[index])) throw Object.assign(new Error('node_move_invalid'), { code: 'node_move_invalid' });
        next = message.before_space;
      } else next = forward(server.config, server.config.spaces[index], message.intent);
      const result = clone(server.config); result.spaces[index] = clone(next);
      server.config = result; server.rev++;
      return { ok: true, rev: server.rev, config: clone(result) };
    }
    throw new Error(`unexpected ${message.type}`);
  };

  const toasts = [], shell = [], confirms = [];
  const adoption = createConfigAdoption(() => {});
  const geometryHistory = new CommandStack(50), devicePositionHistory = new CommandStack(50);
  const devicePosition = { name: 'Move lamp', before: { deviceId: 'lamp' }, after: { deviceId: 'lamp' } };
  devicePositionHistory.push(devicePosition);
  const deferred = () => { deferred.armed = true; };
  deferred.armed = false;
  deferred.pending = () => deferred.armed;
  deferred.cancel = () => { deferred.armed = false; };
  deferred.flush = () => {
    if (!deferred.armed) return; deferred.armed = false;
    // The card's deferred writer and its background failure policy.
    runtime._writeConfig().catch(error => {
      if (error?.code === 'geometry-unsafe' || error?.code === 'geometry-cleanup-required') return;
      if (error?.code === 'conflict') { toasts.push('toast.conflict'); void host._reloadConfigOnly(true); }
      else toasts.push('toast.cfg_save_failed');
    });
  };
  const window = new EventTarget();
  window.requestAnimationFrame = callback => { setImmediate(() => callback(0)); return 1; };
  window.cancelAnimationFrame = () => {};
  const document = { defaultView: window, createElementNS: () => ({ style: {}, classList: { add() {} }, appendChild() {} }) };
  const captures = new Set();
  const stage = { clientWidth: 1000, style: {}, setPointerCapture: id => captures.add(id),
    hasPointerCapture: id => captures.has(id), releasePointerCapture: id => captures.delete(id) };
  const root = { ownerDocument: document, querySelectorAll: () => [], querySelector: () => null };
  const host = {
    get _serverCfg() { return adoption.config; }, set _serverCfg(next) { adoption.stageLocalConfig(next); },
    get _cfgRev() { return adoption.configRev; }, _adoption: adoption,
    _space: floors[0], _mode: 'plan', _tool: 'select', _canEdit: true, _kiosk: false, isConnected: true,
    _haWallNodeMoveApi: 1, _stageEl: stage, renderRoot: undefined, _config: { language: 'en' },
    updateComplete: new Promise(() => {}), hass: { callWS },
    _fillColors: { wall_fill: { c: '#aaa', a: 1 } }, _openingAmt: () => 0,
    _baseVb: () => [0, 0, 1000, 1000], _viewOr: () => ({ w: 1000 }),
    _cancelCameraTransition() {}, _t: (key, params) => (params ? `${key}${JSON.stringify(params)}` : key),
    _showToast: text => toasts.push(text), requestUpdate() {},
    _geometryHistory: geometryHistory, _devicePositionHistory: devicePositionHistory,
    _writeChain: Promise.resolve(), _writesPending: 0, _cfgEpoch: 0, _cacheSnapshot() {},
    _saveConfigDebounced: deferred, _pendingPhysicalWrites: new Map(),
    _checkSpacePhysicalGeometry: () => ({ ok: true }), _maybeRebuildDevices() {},
    _modelCache: null, _frame: null, _regSignature: '', _path: [],
    _physicalDrag: null, _physicalRotate: null, _decorDraft: null, _decorMove: null, _dtDrag: null, _bdDrag: null,
    _activeWallChainId: null, _activeWallChainPartitionIds: [], _wallChainRedo: [], _wallFaceBatch: null,
    // Card shell: one boundary for every space mutation, as `_canCommitSpace`/`_commitSpace`.
    _canCommitSpace: () => true,
    _commitSpace(id) { shell.push(`commit:${id}`); host._space = id; return true; },
    _saveNav() { shell.push('saveNav'); }, _restoreZoom() { shell.push('restoreZoom'); },
    async _sendConfigCandidate(candidate) {
      const canonical = canonicalizeConfigGeometry(candidate);
      const response = await callWS({ type: 'houseplan/config/set', config: canonical, expected_rev: host._cfgRev });
      adoption.acceptConfigWrite(canonical, response);
    },
    async _reloadConfigOnly() {
      adoptStructuralResponses(host, { config: clone(server.config), rev: server.rev }, undefined);
    },
    _reloadRejectedPhysicalWrite: () => runtime._reloadRejectedPhysicalWrite(),
    _confirmDanger: request => new Promise(resolve => confirms.push({ request, resolve })),
    // ConfigAdoptionHostPort for the authoritative (foreign) adoption sequence.
    _model: [], _virtualLights: virtualLightSnapshot(null), _capturedSnapshotVirtual: '',
    _canOptimizeUndo: false, _undoKind: null, _serverCanWrite: true,
    _continuity: { hasCompleteFrame: false, state: 'steady', note() {} },
    _cancelDeviceDrag() {}, _clearRoomFocus() {}, _clearGeometryGesture: () => runtime._clearGeometryGesture(),
    _seedDecorStyle() {}, _adoptConfigCapabilities() {},
  };
  adoption.adoptResponses({ config: clone(server.config), rev: server.rev }, undefined, () => {}, () => {});
  // Editor styles have no document here: construct before the shell has a root.
  const runtime = new HouseplanEditorRuntime(host);
  host.renderRoot = root; host.updateComplete = Promise.resolve(true);
  // Screen → plan coordinates need the SVG layout; the fake pointer already carries plan units.
  runtime._svgPoint = event => [event.clientX, event.clientY];
  // The production Select render loads the lazy adapter (the only entry before #843).
  const install = () => runtime._renderWallNodes();
  const ev = (type, x, y) => ({ type, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, detail: 1,
    clientX: x * 1000, clientY: y * 1000, composedPath: () => [stage], preventDefault() {}, stopImmediatePropagation() {} });
  const idle = async () => {
    await settle();
    for (let i = 0; i < 300 && (runtime.nodeMove?.busy || runtime.nodeMove?.dragging || runtime._nodeMoveLoad); i++) await settle(1);
    await settle();
  };
  /** A real Select gesture through the production adapter: down → move → up → write → record. */
  const drag = async (to = [-0.1, -0.1], from = [0, 0]) => {
    const editor = runtime.nodeMove;
    assert.ok(editor.guardEvent(ev('pointerdown', ...from)), 'node captured');
    editor.guardEvent(ev('pointermove', ...to)); await settle();
    editor.guardEvent(ev('pointerup', ...to)); await idle();
  };
  /** An older, unrelated geometry command below the node move. */
  const pushOlder = () => {
    const snapshot = runtime._geometrySnapshot('g');
    geometryHistory.push({ name: 'Add room', before: snapshot, after: snapshot });
  };
  const nodeWrites = () => server.log.filter(m => m.type === 'houseplan/wall/node_move')
    .map(m => `${m.direction}@${m.expected_rev}:${m.space_id}`);
  const stack = () => ({ undo: geometryHistory.undoName, redo: geometryHistory.redoName, size: geometryHistory.size });
  const floorOf = id => clone(server.config.spaces.find(s => s.id === id));
  return { host, runtime, server, toasts, shell, confirms, install, drag, idle, pushOlder, nodeWrites, stack, floorOf,
    geometryHistory, devicePositionHistory, devicePosition };
}
async function moved(options) {
  const s = setup(options);
  s.install(); await s.idle();
  s.pushOlder();
  const original = s.floorOf('f');
  await s.drag();
  assert.deepEqual(s.nodeWrites(), ['apply@3:f']);
  assert.deepEqual(s.stack(), { undo: MOVE, redo: null, size: 2 });
  return { ...s, original, after: s.floorOf('f') };
}
const undoName = name => `history.undone{"name":"${name}"}`;
const redoName = name => `history.redone{"name":"${name}"}`;

// ---------------------------------------------------------------- AC1
for (const [label, change] of [
  ['tool Draw', h => { h._tool = 'draw'; }],
  ['tool Resize', h => { h._tool = 'resize'; }],
  ['Plan → View → Plan (tool reset to Draw)', h => { h._mode = 'view'; h._mode = 'plan'; h._tool = 'draw'; }],
  ['Plan → Background', h => { h._mode = 'decor'; }],
  ['another floor (tool reset to Draw)', h => { h._space = 'g'; h._tool = 'draw'; }],
]) test(`#843 AC1 ${label}: Undo and Redo of a node move are accepted and keep the history`, async () => {
  const s = await moved();
  change(s.host);
  const mode = s.host._mode, tool = s.host._tool;
  s.runtime._undoGeometry(); await s.idle();
  assert.deepEqual(s.nodeWrites(), ['apply@3:f', 'undo@4:f']);
  assert.deepEqual(s.stack(), { undo: 'Add room', redo: MOVE, size: 1 });
  assert.deepEqual(s.floorOf('f'), s.original);
  s.runtime._redoGeometry(); await s.idle();
  assert.deepEqual(s.nodeWrites(), ['apply@3:f', 'undo@4:f', 'apply@5:f']);
  assert.deepEqual(s.stack(), { undo: MOVE, redo: null, size: 2 });
  assert.deepEqual(s.floorOf('f'), s.after);
  assert.deepEqual(s.toasts, [undoName(MOVE), redoName(MOVE)]);
  assert.deepEqual([s.host._mode, s.host._tool], [mode, tool], 'editor and tool stay');
  assert.equal(typeof s.runtime._renderWallNodes(), 'symbol', 'no node handles outside Plan/Select');
});

// ---------------------------------------------------------------- AC2
for (const when of ['waits for Save', 'is in flight']) {
  test(`#843 AC2 own settings write ${when}: one node request with the revision after it and the exact inverse`, async () => {
    const s = await moved();
    s.host._serverCfg.settings.theme = 'dark';
    s.runtime._saveConfig();
    if (when === 'is in flight') s.host._saveConfigDebounced.flush();
    s.runtime._undoGeometry(); await s.idle();
    const log = s.server.log.slice(1).map(m => `${m.type.split('/').at(-1)}@${m.expected_rev}`);
    assert.deepEqual(log, ['set@4', 'node_move@5']);
    assert.deepEqual(s.server.log.at(-1).before_space, s.original, 'the exact inverse state');
    assert.deepEqual([s.floorOf('f'), s.server.config.settings.theme], [s.original, 'dark']);
    assert.deepEqual(s.stack(), { undo: 'Add room', redo: MOVE, size: 1 });
    assert.deepEqual(s.toasts, [undoName(MOVE)]);
  });
}
test('#843 AC2 own write failed (transport): history.unavailable, history kept, the next attempt passes', async () => {
  const s = await moved();
  s.host._serverCfg.settings.theme = 'dark';
  s.runtime._saveConfig();
  s.server.fail['houseplan/config/set'] = Object.assign(new Error('network'), { code: 'timeout' });
  s.runtime._undoGeometry(); await s.idle();
  assert.deepEqual(s.nodeWrites(), ['apply@3:f'], 'nothing overtakes the unsent own edit');
  assert.deepEqual(s.stack(), { undo: MOVE, redo: null, size: 2 });
  assert.ok(s.toasts.includes('history.unavailable'));
  assert.ok(!s.toasts.some(t => t.startsWith('history.undone')));
  s.toasts.length = 0;
  s.runtime._undoGeometry(); await s.idle();
  assert.deepEqual(s.server.log.slice(-2).map(m => `${m.type.split('/').at(-1)}@${m.expected_rev}`), ['set@4', 'node_move@5']);
  assert.deepEqual([s.server.config.settings.theme, s.floorOf('f')], ['dark', s.original]);
  assert.deepEqual(s.stack(), { undo: 'Add room', redo: MOVE, size: 1 });
  assert.deepEqual(s.toasts, [undoName(MOVE)]);
});
test('#843 AC2 own write refused by #842 K2: history.unavailable, history kept; after the K3 answer Undo passes', async () => {
  const s = await moved({ damaged: true });
  s.host._serverCfg.settings.theme = 'dark';
  s.runtime._saveConfig();
  s.runtime._undoGeometry(); await s.idle();
  assert.equal(s.confirms.length, 1, 'the K3 question was asked');
  assert.deepEqual(s.nodeWrites(), ['apply@3:f']);
  assert.deepEqual(s.stack(), { undo: MOVE, redo: null, size: 2 });
  assert.deepEqual(s.toasts, ['history.unavailable']);
  s.confirms[0].resolve(true); await s.idle();
  s.runtime._undoGeometry(); await s.idle();
  assert.deepEqual(s.nodeWrites(), ['apply@3:f', 'undo@5:f']);
  assert.deepEqual([s.floorOf('f'), s.server.config.settings.theme], [s.original, 'dark']);
  assert.deepEqual(s.stack(), { undo: 'Add room', redo: MOVE, size: 1 });
});
for (const [name, edit] of [
  ['Rename room', space => { space.rooms[0].name = 'Renamed'; }],
  ['Add wall', space => { (space.partitions ||= []).push({ id: 'p-new', a: [0.5, 0.5], b: [1.5, 0.5], cm: 0 }); }],
]) test(`#843 AC2 two quick Ctrl+Z: ordinary «${name}» above the node command, both undone, one node request`, async () => {
  const s = await moved();
  const before = s.runtime._geometrySnapshot('f');
  edit(s.host._serverCfg.spaces[0]);
  s.runtime._recordGeometry(name, before);
  s.runtime._saveConfig(); s.host._saveConfigDebounced.flush(); await s.idle(); // saved long ago
  s.runtime._undoGeometry(); // ordinary, local-first: arms the deferred own write
  assert.equal(s.host._saveConfigDebounced.pending(), true);
  s.runtime._undoGeometry(); await s.idle();
  assert.deepEqual(s.nodeWrites(), ['apply@3:f', 'undo@6:f']);
  assert.deepEqual(s.floorOf('f'), s.original);
  assert.deepEqual(s.stack(), { undo: 'Add room', redo: MOVE, size: 1 });
  assert.deepEqual(s.toasts, [undoName(name), undoName(MOVE)]);
});

// ---------------------------------------------------------------- AC3
test('#843 AC3 own change of the target floor outside history: Undo is not sent, only this command leaves', async () => {
  const s = await moved();
  s.host._serverCfg.spaces[0].title = 'Ground floor'; // a space dialog edit
  s.runtime._saveConfig();
  s.runtime._undoGeometry(); await s.idle();
  assert.deepEqual(s.nodeWrites(), ['apply@3:f']);
  assert.deepEqual(s.toasts, ['history.node_outdated_undo']);
  assert.deepEqual(s.stack(), { undo: 'Add room', redo: null, size: 1 }, 'neighbours stay');
  assert.equal(s.server.config.spaces[0].title, 'Ground floor');
});
test('#843 AC3 Redo is checked by the client before sending: own same-floor change makes it unfit', async () => {
  const s = await moved();
  s.runtime._undoGeometry(); await s.idle();
  s.host._serverCfg.spaces[0].rooms[0].name = 'Kitchen'; // a room dialog edit, outside history
  s.runtime._saveConfig();
  s.runtime._redoGeometry(); await s.idle();
  assert.deepEqual(s.nodeWrites(), ['apply@3:f', 'undo@4:f'], 'the server would apply it over the change');
  assert.deepEqual(s.toasts, [undoName(MOVE), 'history.node_outdated_redo']);
  assert.deepEqual(s.stack(), { undo: 'Add room', redo: null, size: 1 });
  assert.deepEqual(s.floorOf('f').rooms[0].name, 'Kitchen');
});
test('#843 AC3 foreign change that the Undo runs into: both histories are invalidated and history.conflict', async () => {
  const s = await moved();
  s.server.config.spaces[0].rooms[0].name = 'Foreign'; s.server.rev++; // another client, not yet adopted
  s.runtime._undoGeometry(); await s.idle();
  assert.deepEqual(s.nodeWrites(), ['apply@3:f', 'undo@4:f']);
  assert.deepEqual(s.toasts, ['history.conflict']);
  assert.deepEqual([s.stack().size, s.geometryHistory.canRedo, s.devicePositionHistory.canUndo], [0, false, false]);
  assert.equal(s.host._serverCfg.spaces[0].rooms[0].name, 'Foreign');
});

// ---------------------------------------------------------------- AC4
test('#843 AC4 transport refusal: cursor only after acceptance, repeated press ignored, next Undo passes', async () => {
  const s = await moved();
  let release; const gate = new Promise(resolve => { release = resolve; });
  const callWS = s.host.hass.callWS;
  s.host.hass.callWS = async m => { if (m.type === 'houseplan/wall/node_move') await gate; return callWS(m); };
  s.server.fail['houseplan/wall/node_move'] = Object.assign(new Error('timeout'), { code: 'timeout' });
  s.runtime._undoGeometry();
  for (let i = 0; i < 5; i++) await new Promise(r => setImmediate(r));
  assert.equal(s.runtime.nodeMove.busy, true);
  assert.deepEqual(s.stack(), { undo: MOVE, redo: null, size: 2 }, 'the cursor did not move before acceptance');
  s.runtime._undoGeometry(); s.runtime._redoGeometry();
  release(); await s.idle();
  assert.deepEqual(s.nodeWrites(), ['apply@3:f', 'undo@4:f'], 'one request: the repeated press was ignored');
  assert.deepEqual(s.stack(), { undo: MOVE, redo: null, size: 2 });
  assert.deepEqual(s.toasts, ['history.unavailable'], 'no «Undone» before acceptance, the cause is named');
  s.runtime._undoGeometry(); await s.idle();
  assert.deepEqual(s.nodeWrites(), ['apply@3:f', 'undo@4:f', 'undo@4:f']);
  assert.deepEqual(s.stack(), { undo: 'Add room', redo: MOVE, size: 1 });
});
test('#843 AC4 api !== 1 and a cold adapter are temporary refusals that keep the history', async () => {
  const s = await moved();
  s.host._haWallNodeMoveApi = 0;
  s.runtime._undoGeometry(); await s.idle();
  assert.deepEqual([s.nodeWrites().length, s.stack(), s.toasts.length], [1, { undo: MOVE, redo: null, size: 2 }, 1]);
  assert.match(s.toasts[0], /update/i);
  s.host._haWallNodeMoveApi = 1;
  const cold = s.runtime.nodeMove; s.runtime.nodeMove = null; // never loaded in this session
  s.runtime._undoGeometry();
  assert.deepEqual([s.toasts.at(-1), s.stack()], ['history.unavailable', { undo: MOVE, redo: null, size: 2 }]);
  await s.idle(); cold.dispose();
  assert.ok(s.runtime.nodeMove && s.runtime.nodeMove !== cold, 'the command loaded the adapter');
  s.runtime._undoGeometry(); await s.idle();
  assert.deepEqual(s.nodeWrites(), ['apply@3:f', 'undo@4:f']);
  assert.deepEqual(s.stack(), { undo: 'Add room', redo: MOVE, size: 1 });
});

// ---------------------------------------------------------------- AC5
test('#843 AC5 another floor is shown only after acceptance; editor and tool stay; a refusal does not switch', async () => {
  for (const refuse of [true, false]) {
    const s = await moved();
    s.host._space = 'g'; s.host._tool = 'draw';
    if (refuse) s.server.fail['houseplan/wall/node_move'] = Object.assign(new Error('timeout'), { code: 'timeout' });
    let release; const gate = new Promise(resolve => { release = resolve; });
    const callWS = s.host.hass.callWS;
    s.host.hass.callWS = async m => { if (m.type === 'houseplan/wall/node_move') await gate; return callWS(m); };
    s.runtime._undoGeometry(); await settle();
    assert.deepEqual([s.nodeWrites(), s.host._space, s.shell], [['apply@3:f'], 'g', []], 'nothing is shown before the answer');
    release(); await s.idle();
    assert.deepEqual([s.host._space, s.host._mode, s.host._tool], [refuse ? 'g' : 'f', 'plan', 'draw']);
    assert.deepEqual(s.shell, refuse ? [] : ['commit:f', 'saveNav', 'restoreZoom']);
  }
});
test('#843 AC5 a fixed floor that cannot show the result refuses before sending', async () => {
  const s = await moved();
  s.host._space = 'g'; s.host._tool = 'draw';
  s.host._canCommitSpace = id => id === 'g'; // the card's `floor` now pins g
  s.runtime._undoGeometry(); await s.idle();
  assert.deepEqual([s.nodeWrites(), s.toasts, s.shell], [['apply@3:f'], ['history.space_unavailable'], []]);
  assert.deepEqual(s.stack(), { undo: MOVE, redo: null, size: 2 });
});

// ---------------------------------------------------------------- AC6
for (const [label, change] of [
  ['View', h => { h._mode = 'view'; }],
  ['kiosk', h => { h._kiosk = true; }],
  ['not a writer', h => { h._canEdit = false; }],
]) test(`#843 AC6 ${label}: no geometry Undo/Redo and no node write; the Devices history is independent`, async () => {
  // A regression guard that already holds before #843 (its mutant keeps it honest).
  const s = await moved();
  change(s.host); s.host._tool = 'draw';
  s.runtime._undoGeometry(); await s.idle();
  assert.deepEqual([s.nodeWrites(), s.toasts], [['apply@3:f'], []]);
  const r = await moved();
  r.runtime._undoGeometry(); await r.idle(); // accepted by a writer in Plan first
  change(r.host); r.host._tool = 'draw';
  r.runtime._redoGeometry(); await r.idle();
  assert.deepEqual([r.nodeWrites(), r.toasts], [['apply@3:f', 'undo@4:f'], [undoName(MOVE)]]);
  for (const t of [s, r]) assert.deepEqual([t.devicePositionHistory.undoName, t.devicePositionHistory.size], ['Move lamp', 1]);
  assert.deepEqual(s.floorOf('f'), s.after); assert.deepEqual(r.floorOf('f'), r.original);
});

test('#843 contract 2: an unfinished Draw/Split draft owns the first press, the next one applies the node step', async () => {
  for (const draft of [h => { h._tool = 'draw'; h._path = [[0.5, 0.5]]; }, h => { h._tool = 'split'; h._splitSel = { roomId: 'f-room', pts: [[0.5, 0.5]] }; }]) {
    const s = await moved();
    draft(s.host);
    s.runtime._undoGeometry(); await s.idle();
    assert.deepEqual([s.nodeWrites(), s.stack().undo, s.host._path, s.host._splitSel], [['apply@3:f'], MOVE, [], null]);
    s.runtime._undoGeometry(); await s.idle();
    assert.deepEqual([s.nodeWrites(), s.stack().redo], [['apply@3:f', 'undo@4:f'], MOVE]);
  }
});

// ---------------------------------------------------------------- AC7
test('#843 AC7 a move right after an own edit (Save waits, flies, or is accepted mid-gesture) is one request', async () => {
  for (const when of ['waits', 'flies', 'accepted mid-gesture']) {
    const s = setup(); s.install(); await s.idle();
    s.host._serverCfg.settings.theme = 'dark'; s.runtime._saveConfig();
    if (when === 'flies') s.host._saveConfigDebounced.flush();
    const editor = s.runtime.nodeMove;
    if (when === 'accepted mid-gesture') {
      const ev = (type, x, y) => ({ type, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, detail: 1,
        clientX: x * 1000, clientY: y * 1000, composedPath: () => [s.host._stageEl], preventDefault() {}, stopImmediatePropagation() {} });
      assert.ok(editor.guardEvent(ev('pointerdown', 0, 0)));
      editor.guardEvent(ev('pointermove', -0.05, -0.05)); await settle();
      s.host._saveConfigDebounced.flush(); await settle();
      assert.equal(s.host._cfgRev, 4, 'own Save accepted while the node is held');
      editor.guardEvent(ev('pointermove', -0.1, -0.1)); await settle();
      assert.equal(editor.dragging, true, 'the gesture survives its own accepted Save');
      editor.guardEvent(ev('pointerup', -0.1, -0.1)); await s.idle();
    } else await s.drag();
    assert.deepEqual(s.server.log.map(m => `${m.type.split('/').at(-1)}@${m.expected_rev}`), ['set@3', 'node_move@4'], when);
    assert.deepEqual([s.stack().undo, s.toasts], [MOVE, []], when);
  }
});
test('#843 AC7 a foreign change of the floor still refuses the move', async () => {
  const s = setup(); s.install(); await s.idle();
  const editor = s.runtime.nodeMove;
  const ev = (type, x, y) => ({ type, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, detail: 1,
    clientX: x * 1000, clientY: y * 1000, composedPath: () => [s.host._stageEl], preventDefault() {}, stopImmediatePropagation() {} });
  assert.ok(editor.guardEvent(ev('pointerdown', 0, 0)));
  editor.guardEvent(ev('pointermove', -0.1, -0.1)); await settle();
  s.server.config.spaces[0].rooms[0].name = 'Foreign'; s.server.rev++;
  await s.host._reloadConfigOnly(true);
  editor.guardEvent(ev('pointerup', -0.1, -0.1)); await s.idle();
  assert.deepEqual(s.nodeWrites(), []); assert.equal(s.stack().size, 0);
});
