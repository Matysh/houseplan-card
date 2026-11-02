import test from 'node:test';
import assert from 'node:assert/strict';
import { finalizeWallChainSpace } from '../test-build/writer-fixed-point.js';
import { migrateGraphSpace, projectGraphSpace, validateGraph } from '../test-build/plan-graph.js';
import { spaceModels, GRID_PITCH, GRID_STEP_N, NORM_W } from '../test-build/space-geometry.js';
import { geometryOpenCuts } from '../test-build/plan-geometry-preflight.js';

const clone = value => JSON.parse(JSON.stringify(value));
const current = space => migrateGraphSpace(space, { sourceModelVersion: 10 }).space;
const finish = (space, seedIds) => {
  const model = spaceModels({ spaces: [space], markers: [], settings: {} })[0];
  return finalizeWallChainSpace(space, model, geometryOpenCuts(space, model), seedIds,
    { pitch: GRID_STEP_N, cellCm: 5, gridPitch: GRID_PITCH, coordScale: NORM_W });
};
const valid = space => assert.equal(validateGraph(space.plan_graph).ok, true);
const stable = (space, ids) => {
  const next = finish(space, ids);
  assert.equal(next.report.changed, false);
  assert.deepEqual(next.space, space);
};

test('current chain finish commits explicit two/three-edge collapse and exact host remap', () => {
  for (const count of [2, 3]) {
    const raw = { id: 's', cell_cm: 5, rooms: [], partitions: Array.from({ length: count }, (_, i) => ({
      id: 'chain-' + i, a: [i / count, .5], b: [(i + 1) / count, .5], cm: 15,
    })), openings: [{ id: 'door', type: 'door', x: 1 - .5 / count, y: .5, angle: 0, length: .1,
      host: { kind: 'partition', id: 'chain-' + (count - 1), t: .5 } }] };
    const space = current(raw), before = clone(space);
    const result = finish(space, raw.partitions.map(p => p.id));
    assert.deepEqual(space, before);
    valid(result.space);
    assert.equal(result.space.partitions.length, 1);
    assert.equal(result.space.partitions[0].id, 'chain-0');
    assert.equal(result.report.partitionsMerged, count - 1);
    assert.equal(result.space.openings[0].x, before.openings[0].x);
    assert.equal(result.space.openings[0].y, .5);
    assert.equal(result.space.openings[0].host.id, 'chain-0');
    stable(result.space, ['chain-0']);
  }
});

test('chain finish limits compaction to seeds and leaves off-grid rooms/unrelated historical seams unchanged', () => {
  const raw = { id: 's', cell_cm: 5,
    rooms: [{ id: 'room', poly: [[.001, .001], [.201, .001], [.201, .201], [.001, .201]], custom: true }],
    partitions: [
      { id: 'old-a', a: [0, .4], b: [.25, .4], cm: 15 },
      { id: 'old-b', a: [.25, .4], b: [.5, .4], cm: 15 },
      { id: 'new-a', a: [0, .8], b: [.25, .8], cm: 20 },
      { id: 'new-b', a: [.25, .8], b: [.5, .8], cm: 20 }],
    plan_x: .123456789, decor: [{ id: 'f', kind: 'furniture', x: .12345, y: .45678, w: .15321, h: .27777 }] };
  const space = current(raw), before = clone(space);
  const result = finish(space, ['new-a', 'new-b']);
  valid(result.space);
  assert.equal(result.report.partitionsMerged, 1);
  assert.deepEqual(result.space.rooms, before.rooms);
  assert.deepEqual(result.space.decor, before.decor);
  assert.equal(result.space.plan_x, before.plan_x);
  for (const id of ['old-a', 'old-b']) {
    assert.deepEqual(result.space.partitions.find(p => p.id === id), before.partitions.find(p => p.id === id));
    assert.deepEqual(result.space.plan_graph.edges.find(p => p.id === id), before.plan_graph.edges.find(p => p.id === id));
  }
  const oldNodes = new Map(before.plan_graph.nodes.map(n => [n.id, n]));
  for (const n of result.space.plan_graph.nodes) assert.deepEqual(n, oldNodes.get(n.id));
  stable(result.space, ['new-a']);
});

test('current scoped coincidence updates the graph and exact opening host as one candidate', () => {
  const space = current({ id: 's', cell_cm: 5,
    rooms: [{ id: 'left', poly: [[0, 0], [.5, 0], [.5, 1], [0, 1]] },
      { id: 'right', poly: [[.5, 0], [1, 0], [1, 1], [.5, 1]] }],
    walls: [{ key: 'shared', a: [.5, 0], b: [.5, 1], cm: 20 }],
    partitions: [{ id: 'chain', a: [.5, 0], b: [.5, 1], cm: 20 }],
    openings: [{ id: 'door', type: 'door', x: .5, y: .5, angle: -90, length: .2,
      host: { kind: 'partition', id: 'chain', t: .5 }, future: { keep: true } }],
  });
  const before = clone(space), result = finish(space, ['chain']);
  valid(result.space);
  assert.deepEqual(space, before);
  assert.equal(result.report.partitionsReconciled, 1);
  assert.equal(result.report.openingsRehosted, 1);
  assert.equal(result.space.partitions.length, 0);
  assert.equal(result.space.openings[0].host.kind, 'wall');
  assert.deepEqual(result.space.openings[0].host.tq, ['1', '2']);
  assert.deepEqual(result.space.openings[0].future, { keep: true });
  assert.deepEqual(result.space.plan_graph.nodes, before.plan_graph.nodes);
  stable(result.space, ['chain']);
});

test('missing or absent chain seeds cannot normalize unrelated current graph structure', () => {
  const space = current({ id: 's', rooms: [], partitions: [
    { id: 'old-a', a: [0, .4], b: [.25, .4], cm: 15 },
    { id: 'old-b', a: [.25, .4], b: [.5, .4], cm: 15 }] });
  for (const ids of [[], ['missing']]) {
    const result = finish(space, ids);
    assert.deepEqual(result.space, space);
    assert.equal(result.report.changed, false);
  }
});

test('coincident but intentionally detached chain endpoints retain their independent IDs', () => {
  const space = current({ id: 's', rooms: [], partitions: [
    { id: 'a', a: [0, .5], b: [.25, .5], cm: 15 },
    { id: 'b', a: [.25, .5], b: [.5, .5], cm: 15 }] });
  const graph = clone(space.plan_graph), edge = graph.edges.find(e => e.id === 'b');
  graph.nodes.push({ ...clone(graph.nodes.find(n => n.id === edge.from)), id: 'detached' });
  edge.from = 'detached';
  const detached = projectGraphSpace(space, graph).space;
  const result = finish(detached, ['a', 'b']);
  assert.deepEqual(result.space, detached);
  assert.equal(result.report.partitionsMerged, 0);
  assert.equal(result.report.changed, false);
});
