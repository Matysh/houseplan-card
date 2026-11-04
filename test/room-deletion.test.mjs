import test from 'node:test';
import assert from 'node:assert/strict';
import { parameterOnPartition, planRoomDeletion, roomTopologyLayoutCandidate } from '../test-build/room-deletion.js';
import { harness, fixture } from './helpers/geometry-commit-harness.mjs';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';
import { CommandStack } from '../test-build/command-stack.js';
import { PhysicalWriteHistory } from '../test-build/physical-write-history.js';
import { optimizePlans } from '../test-build/plan-optimizer.js';

const interval = (patch = {}) => ({
  a: [0, 0], b: [100, 0], key: 'outer', kind: 'outer', cm: 20, open: false, ...patch,
});

test('Keep walls materializes only positive exclusive solids and reuses compatible masonry', () => {
  const plan = planRoomDeletion([
    interval(),
    interval({ a: [100, 0], b: [100, 100], key: 'shared', kind: 'shared' }),
    interval({ a: [0, 100], b: [100, 100], key: 'open', open: true }),
    interval({ a: [0, 0], b: [0, 100], key: 'zero', cm: 0 }),
  ], [{ id: 'existing', a: [0, 0], b: [120, 0], cm: 20 }], [], 0.001);
  assert.deepEqual(plan.materialize.map((item) => [item.interval.key, item.reusePartitionId]), [
    ['outer', 'existing'],
  ]);
});

test('exclusive room openings rehost or cascade while shared and hosted openings survive', () => {
  const plan = planRoomDeletion([
    interval(),
    interval({ a: [100, 0], b: [100, 100], key: 'shared', kind: 'shared' }),
  ], [], [
    { id: 'exclusive', x: 50, y: 0, angle: 0 },
    { id: 'shared', x: 100, y: 50, angle: 90 },
    { id: 'hosted', x: 20, y: 0, angle: 0, host: { kind: 'partition', id: 'p', t: 0.2 } },
  ], 0.001);
  assert.equal(plan.openingIntervals.get('exclusive'), 'outer');
  assert.deepEqual(plan.removeOpeningIds, ['exclusive']);
  assert.ok(!plan.openingIntervals.has('shared'));
  assert.ok(!plan.openingIntervals.has('hosted'));
});

test('opening host parameter is stable for either endpoint direction', () => {
  assert.equal(parameterOnPartition([25, 0], { a: [0, 0], b: [100, 0] }), 0.25);
  assert.equal(parameterOnPartition([25, 0], { a: [100, 0], b: [0, 0] }), 0.75);
});

test('#1287 label cleanup belongs only to rooms removed by the topology gesture', () => {
  const before = { id: 'f', rooms: [{ id: 'a' }, { id: 'b' }] }, after = { id: 'f', rooms: [{ id: 'a' }] };
  const layout = { rl_a: { x: .1, y: .2, s: 'f', opaque: 'retained' },
    rl_b: { x: .3, y: .4, s: 'f', opaque: 'restore' }, unknown: { x: .5, y: .6, s: 'f' } };
  const result = roomTopologyLayoutCandidate(before, after, layout);
  assert.deepEqual(result.layout, { rl_a: layout.rl_a, unknown: layout.unknown });
  assert.deepEqual(result.roomLabelPositions, { before: { rl_b: layout.rl_b }, after: { rl_b: null } });
  assert.equal(layout.rl_b.opaque, 'restore', 'input stays unchanged');
  const foreign = { rl_b: { x: .2, y: .3, s: 'foreign' } };
  assert.deepEqual(roomTopologyLayoutCandidate(before, after, foreign).layout, foreign);
});

function runtimeHistory(config = fixture()) {
  const h = harness(config), proto = Object.getPrototypeOf(h.runtime);
  h.host._layout = { rl_f_r: { x: .5, y: .5, s: 'f' } };
  h.host._geometryHistory = new CommandStack();
  h.host._loadOk = true; h.host._canCommitSpace = () => true;
  h.host._maybeRebuildDevices = () => {};
  h.runtime.physicalWriteHistory = new PhysicalWriteHistory();
  h.runtime.decorLine = { reset() {} };
  h.runtime._recordGeometry = proto._recordGeometry;
  h.runtime._showGeometrySpace = () => {};
  return h;
}

for (const operation of ['delete', 'merge']) test(`#1287 real ${operation} commit and geometry Undo/Redo restore the owned label only`, () => {
  const input = operation === 'merge' ? commitWallSegmentModel({ model_version: 10, spaces: [{ id: 'f', cell_cm: 5,
    rooms: [{ id: 'a', poly: [[0, 0], [.5, 0], [.5, 1], [0, 1]] },
      { id: 'b', poly: [[.5, 0], [1, 0], [1, 1], [.5, 1]] }] }], markers: [], settings: {} }).config : fixture();
  const h = runtimeHistory(input), drop = operation === 'merge' ? 'b' : 'f-r';
  const key = 'rl_' + drop;
  h.host._layout = { [key]: { s: 'f', x: 1 / 4, y: 1 / 4, k: 9, custom: { preserved: true } },
    ...(operation === 'merge' ? { rl_a: { s: 'f', x: .5, y: .5 } } : {}),
    opaque: { s: 'g', x: .5, y: .5, untouched: true } };
  const layout = structuredClone(h.host._layout), before = h.runtime._geometrySnapshot('f');
  const space = h.host._serverCfg.spaces[0];
  if (operation === 'merge') {
    space.rooms.find(r => r.id === 'a').poly = [[0, 0], [1, 0], [1, 1], [0, 1]];
    space.rooms = space.rooms.filter(r => r.id !== 'b');
  } else space.rooms = [];
  const intent = operation === 'merge' ? { kind: 'merge-rooms', keep: 'a', drop: 'b' }
    : { kind: 'delete-room', room: drop, keepWalls: false };
  assert.equal(h.runtime._commitPhysicalGeometry(operation, before, [], true, intent), true, JSON.stringify(h.toasts));
  assert.equal(h.host._layout[key], undefined);
  assert.deepEqual(h.host._layout.opaque, layout.opaque);
  const command = h.host._geometryHistory.peekUndo();
  assert.deepEqual(command.before.roomLabelPositions, { [key]: layout[key] });
  assert.deepEqual(command.after.roomLabelPositions, { [key]: null });
  assert.equal(h.runtime._applyGeometryState(command.before), true);
  assert.deepEqual(h.host._layout, layout);
  assert.equal(h.runtime._applyGeometryState(command.after), true);
  assert.equal(h.host._layout[key], undefined);
  const optimized = optimizePlans(h.host._serverCfg, h.host._layout);
  assert.equal(optimized.report.orphanRoomLabelsRemoved, 0);
  assert.equal(optimized.changed, false);
});

test('#1287 a refused physical delete preserves its label and creates no history', () => {
  const h = runtimeHistory(), key = 'rl_f-r'; h.host._layout = { [key]: { s: 'f', x: .5, y: .5 } };
  const before = h.runtime._geometrySnapshot('f'), original = structuredClone(h.host._layout);
  h.host._serverCfg.spaces[0].rooms = [];
  h.host._checkSpacePhysicalGeometry = () => ({ ok: false });
  assert.equal(h.runtime._commitPhysicalGeometry('delete', before, [], true,
    { kind: 'delete-room', room: 'f-r', keepWalls: false }), false);
  assert.deepEqual(h.host._layout, original);
  assert.equal(h.host._geometryHistory.size, 0);
});

test('#1287 a rejected queued two-room deletion restores both bounded label deltas', () => {
  const input = commitWallSegmentModel({ model_version: 10, spaces: [{ id: 'f', cell_cm: 5, rooms: [
    { id: 'a', poly: [[0, 0], [.25, 0], [.25, .25], [0, .25]] },
    { id: 'b', poly: [[.5, .5], [.75, .5], [.75, .75], [.5, .75]] }] }], markers: [], settings: {} }).config;
  const h = runtimeHistory(input);
  h.host._layout = { rl_a: { s: 'f', x: .125, y: .125 }, rl_b: { s: 'f', x: .625, y: .625 },
    independent: { s: 'unknown', x: .5, y: .5 } };
  h.host._adoption = { refreshConfigFingerprint() {} };
  const layout = structuredClone(h.host._layout);
  for (const room of ['a', 'b']) {
    const before = h.runtime._geometrySnapshot('f');
    h.host._serverCfg.spaces[0].rooms = h.host._serverCfg.spaces[0].rooms.filter(r => r.id !== room);
    assert.equal(h.runtime._commitPhysicalGeometry('Delete ' + room, before, [], true,
      { kind: 'delete-room', room, keepWalls: false }), true);
  }
  assert.equal(h.host._layout.rl_a, undefined); assert.equal(h.host._layout.rl_b, undefined);
  assert.equal(h.runtime._rollbackRejectedPhysicalWrites([...h.host._pendingPhysicalWrites]), true);
  assert.deepEqual(h.host._layout, layout);
  assert.deepEqual(h.host._serverCfg, input);
  assert.equal(h.host._geometryHistory.size, 0);
});

test('#1287 a layout refresh before deferred Delete cannot turn its null label patch into a restore', async () => {
  const h = runtimeHistory(), key = 'rl_f-r';
  h.host._layout = { [key]: { s: 'f', x: .25, y: .25 } };
  const before = h.runtime._geometrySnapshot('f');
  h.host._serverCfg.spaces[0].rooms = [];
  assert.equal(h.runtime._commitPhysicalGeometry('Delete', before, [], true,
    { kind: 'delete-room', room: 'f-r', keepWalls: false }), true);
  // The layout-only reload has seen another writer's last label position while
  // the corresponding room still existed in the not-yet-updated server config.
  h.host._layout[key] = { s: 'f', x: .75, y: .75 };
  h.host._writesPending = 0; h.host._writeChain = Promise.resolve();
  h.host._configWriteGuard = () => () => true;
  h.host._adoption = { stageConfigCandidate() {}, snapshot: () => ({ config: h.host._serverCfg, layout: h.host._layout }) };
  let labels;
  h.host._sendConfigCandidate = async (_config, _contact, _current, patch) => { labels = patch; };
  await h.runtime._writeConfig();
  assert.deepEqual(labels, { [key]: null }, 'a removed room always owns a deletion, never an illegal restoration');
});
