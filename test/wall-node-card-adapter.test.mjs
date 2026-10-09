import test from 'node:test';
import assert from 'node:assert/strict';
import { createWallNodeEditor } from '../test-build/wall-node-card-adapter.js';
import { WallBooleanBaseline } from '../test-build/wall-boolean-baseline.js';
import { applyNodeMove, prepareNodeMove, structuralWallNodes } from '../test-build/wall-node-move.js';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';

function setup(t) {
  const poly = [[0, 0], [2, 0], [2, 2], [0, 2]];
  const segments = poly.map((a, i) => ({ id: `w${i}`, a, b: poly[(i + 1) % 4], cm: 10 }));
  const cfg = { model_version: 10, spaces: [{ id: 'f', cell_cm: 1,
    rooms: [{ id: 'room', poly, wall_ids: segments.map(w => w.id) }], wall_segments: segments }], markers: [], settings: {} };
  const window = new EventTarget(), captures = new Set(), proofs = [], queries = [];
  const stage = { clientWidth: 1000, style: {}, setPointerCapture: id => captures.add(id),
    hasPointerCapture: id => captures.has(id), releasePointerCapture: id => captures.delete(id) };
  const document = { defaultView: window,
    createElementNS: () => ({ style: {}, classList: { add() {} }, appendChild() {} }) };
  const root = { ownerDocument: document, querySelectorAll: () => [], querySelector: selector => { queries.push(selector); return null; } };
  let paints = 0, updates = 0, recordedOperations = 0, candidateOperations = 0;
  const originalApply = WallBooleanBaseline.prototype.apply;
  t.mock.method(WallBooleanBaseline.prototype, 'apply', function (operation, operands, record) {
    if (record) recordedOperations++; else candidateOperations++;
    return originalApply.call(this, operation, operands, record);
  });
  const host = { _serverCfg: cfg, _cfgRev: 1, _space: 'f', _mode: 'plan', _tool: 'select',
    _canEdit: true, _kiosk: false, isConnected: true, _haWallNodeMoveApi: 1,
    _stageEl: stage, renderRoot: root, _config: { language: 'en' }, updateComplete: Promise.resolve(true),
    _fillColors: { wall_fill: { c: '#aaa', a: 1 } }, _openingAmt: () => 0,
    _baseVb: () => [0, 0, 1000, 1000], _viewOr: () => ({ w: 1000 }),
    _cancelCameraTransition() {}, _t: key => key, _showToast() {}, requestUpdate: () => { updates++; },
    _geometryHistory: { push() {}, clear() {} }, _writeChain: Promise.resolve(),
    _saveConfigDebounced: { pending: () => false }, _reloadRejectedPhysicalWrite: async () => {},
    hass: { callWS: async () => { throw new Error('intentional write refusal'); } } };
  const editor = createWallNodeEditor(host, { point: ev => [ev.clientX, ev.clientY], snapshot: () => ({}),
    introduced: (...args) => { proofs.push(args); return []; } });
  editor.paint = () => { paints++; };
  t.after(() => editor.dispose());
  const source = () => commitWallSegmentModel({ ...host._serverCfg, spaces: [host._serverCfg.spaces[0]] }).config.spaces[0];
  const candidate = before => {
    const nodes = structuralWallNodes(before), node = nodes.find(n => n.point[0] === 0 && n.point[1] === 0);
    assert.ok(node?.supported);
    const result = applyNodeMove(prepareNodeMove(before, node, nodes), [-.1, -.1], null);
    assert.equal(result.ok, true); assert.equal(result.changed, true); return result.space;
  };
  const validate = (before = source()) => {
    const next = candidate(before);
    assert.equal(editor.port.validate(next, before, false), true);
    return { before, next };
  };
  const down = () => {
    assert.equal(editor.guardEvent({ type: 'pointerdown', pointerId: 1, pointerType: 'mouse', isPrimary: true,
      button: 0, clientX: 0, clientY: 0, composedPath: () => [stage], preventDefault() {}, stopImmediatePropagation() {} }), true);
    assert.equal(editor.dragging, true);
    return editor.session.plan.source;
  };
  return { host, editor, window, proofs, queries, source, candidate, validate, down,
    counts: () => ({ paints, updates, recordedOperations, candidateOperations }) };
}

test('Esc retries reuse one immutable baseline across fresh node snapshots, never a candidate or proof', t => {
  const s = setup(t), original = structuredClone(s.host._serverCfg);
  let previousSource, baseline, baselineProof, recorded;
  for (let gesture = 0; gesture < 3; gesture++) {
    const before = s.down(); assert.notEqual(before, previousSource);
    const { next } = s.validate(before), latest = s.proofs.at(-1);
    if (!gesture) { baseline = latest[1]; baselineProof = latest[4]; recorded = s.counts().recordedOperations; assert.ok(recorded > 0); }
    else { assert.equal(latest[1], baseline); assert.equal(latest[4], baselineProof);
      assert.equal(s.counts().recordedOperations, recorded, 'no repeated baseline build'); }
    assert.equal(s.proofs.length, gesture + 1, 'every independent candidate is still proved');
    assert.ok(s.counts().candidateOperations > 0);
    const proofCount = s.proofs.length;
    assert.equal(s.editor.port.validate(next, before, true), true);
    assert.equal(s.proofs.length, proofCount, 'only the same already-proved candidate has the identity fast path');
    assert.equal(s.editor.cancel(), true);
    assert.equal(s.editor.cache, null, 'source node cache is still discarded');
    assert.equal(s.editor.preview, null); assert.equal(s.editor.port.scene(next, before), null);
    previousSource = before;
  }
  assert.notEqual(baseline.settings, s.host._serverCfg.settings, 'retained proof config is a private snapshot');
  assert.deepEqual(s.host._serverCfg, original, 'neither retries nor cached proof mutate the authority');
});

test('generic live editor ownership is acquired once per capture and reacquired after cancel', t => {
  const s = setup(t);
  for (let gesture = 1; gesture <= 2; gesture++) {
    s.down(); s.editor.port.changed(); s.editor.port.changed();
    assert.equal(s.queries.filter(q => q === '[data-hp-live-editor]').length, gesture);
    assert.equal(s.counts().paints, gesture * 3);
    s.editor.cancel();
  }
  assert.equal(s.counts().updates, 2);
});

test('switching local components replaces the single retained baseline instead of keeping a per-node map', t => {
  const s = setup(t), space = s.host._serverCfg.spaces[0];
  const remoteWalls = space.wall_segments.map(wall => ({ ...wall, id: `remote-${wall.id}`,
    a: [wall.a[0] + 10, wall.a[1]], b: [wall.b[0] + 10, wall.b[1]] }));
  space.rooms.push({ id: 'remote', poly: space.rooms[0].poly.map(p => [p[0] + 10, p[1]]),
    wall_ids: remoteWalls.map(wall => wall.id) });
  space.wall_segments.push(...remoteWalls);
  s.validate(); const first = s.proofs.at(-1)[1], firstCount = s.counts().recordedOperations;
  assert.deepEqual(first.spaces[0].rooms.map(room => room.id), ['room']);
  s.editor.port.changed();
  const before = s.source(), nodes = structuralWallNodes(before);
  const node = nodes.find(n => n.point[0] === 10 && n.point[1] === 0);
  assert.ok(node?.supported);
  const moved = applyNodeMove(prepareNodeMove(before, node, nodes), [9.9, -.1], null);
  assert.equal(moved.ok, true);
  assert.equal(s.editor.port.validate(moved.space, before, false), true);
  const second = s.proofs.at(-1)[1], secondCount = s.counts().recordedOperations;
  assert.deepEqual(second.spaces[0].rooms.map(room => room.id), ['remote']);
  assert.notEqual(second, first); assert.ok(secondCount > firstCount);
  s.editor.port.changed(); s.validate();
  assert.notEqual(s.proofs.at(-1)[1], first, 'the replaced first component is not retained elsewhere');
  assert.notEqual(s.proofs.at(-1)[1], second);
  assert.ok(s.counts().recordedOperations > secondCount);
});

for (const [label, mutate] of [
  ['authority replacement with identical values', s => { s.host._serverCfg = structuredClone(s.host._serverCfg); }],
  ['revision adoption', s => { s.host._cfgRev++; }],
  ['cell scale mutation', s => { s.host._serverCfg.spaces[0].cell_cm = 2; }],
  ['room geometry mutation', s => {
    const space = s.host._serverCfg.spaces[0]; space.rooms[0].poly[2] = [2.2, 2];
    space.wall_segments[1].b = [2.2, 2]; space.wall_segments[2].a = [2.2, 2];
  }],
  ['non-geometric settings mutation', s => { s.host._serverCfg.settings.proof_marker = 'changed'; }],
  ['marker mutation', s => { s.host._serverCfg.markers.push({ id: 'marker', note: 'new proof input' }); }],
]) test(`retained baseline retires for ${label}`, t => {
  const s = setup(t); s.validate(); const previous = s.proofs.at(-1)[1], count = s.counts().recordedOperations;
  s.editor.port.changed(); mutate(s); s.validate();
  assert.notEqual(s.proofs.at(-1)[1], previous);
  assert.ok(s.counts().recordedOperations > count);
});

test('in-place proof-input changes invalidate even the final candidate identity fast path', t => {
  const s = setup(t), { before, next } = s.validate();
  const old = s.proofs.at(-1)[1];
  s.host._serverCfg.settings.proof_marker = 'new';
  assert.equal(s.editor.port.validate(next, before, true), true);
  assert.equal(s.proofs.length, 2); assert.notEqual(s.proofs.at(-1)[1], old);
  assert.equal(s.proofs.at(-1)[1].settings.proof_marker, 'new');
  assert.equal(old.settings.proof_marker, undefined, 'old private config did not alias settings');
});

for (const [key, value] of [['_mode', 'view'], ['_tool', 'wall'], ['_canEdit', false], ['_kiosk', true],
  ['isConnected', false], ['_haWallNodeMoveApi', 0], ['_space', 'other']]) {
  test(`idle cancellation releases retained baseline after ${key} context exit`, t => {
    const s = setup(t); s.validate(); const previous = s.proofs.at(-1)[1], original = s.host[key];
    s.host[key] = value; assert.equal(s.editor.cancel(), false, 'there is no live gesture');
    s.host[key] = original; s.validate(); assert.notEqual(s.proofs.at(-1)[1], previous);
  });
}

for (const reason of ['dispose', 'pagehide']) test(`${reason} releases retained baseline even while idle`, t => {
  const s = setup(t); s.validate(); const previous = s.proofs.at(-1)[1];
  if (reason === 'dispose') s.editor.dispose(); else s.window.dispatchEvent(new Event('pagehide'));
  s.validate(); assert.notEqual(s.proofs.at(-1)[1], previous);
});

test('write or history attempt retires retained baseline even if no new config is adopted', async t => {
  const s = setup(t), { before } = s.validate(); const previous = s.proofs.at(-1)[1];
  await assert.rejects(s.editor.port.write({ beforeSpace: before, intent: {}, direction: 'undo' }, s.host._cfgRev),
    /intentional write refusal/);
  s.validate(); assert.notEqual(s.proofs.at(-1)[1], previous);
});

test('failed baseline build is not retained for another independent retry', t => {
  const s = setup(t), originalApply = WallBooleanBaseline.prototype.apply;
  let refuse = true;
  t.mock.method(WallBooleanBaseline.prototype, 'apply', function (operation, operands, record) {
    if (record && refuse) throw new Error('intentional baseline boolean failure');
    return originalApply.call(this, operation, operands, record);
  });
  const before = s.source(), next = s.candidate(before);
  s.editor.port.validate(next, before, false);
  const recorded = s.counts().recordedOperations;
  refuse = false; s.editor.port.changed(); s.validate();
  assert.ok(s.counts().recordedOperations > recorded, 'healthy retry builds a new baseline');
});
