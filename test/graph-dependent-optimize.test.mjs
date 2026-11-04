import test from 'node:test';
import assert from 'node:assert/strict';
import { commitGraphEdit } from '../test-build/graph-edit-intent.js';
import { optimizePlans } from '../test-build/plan-optimizer.js';
import { optimizeGraphTargets } from '../test-build/graph-optimize.js';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';
import * as G from '../test-build/plan-graph.js';
import * as Q from '../test-build/plan-exact.js';

const config = space => ({ model_version: 11, spaces: [space], markers: [], settings: {} });
const empty = () => G.projectGraphSpace({ id: 'floor', title: 'Synthetic', cell_cm: 5, rooms: [] },
  { version: 1, nodes: [], edges: [], rooms: [], dependencies: [] }).space;
const point = p => Q.encodePoint(Q.readAuthoredPoint(p));
const teeSpace = (a, b, t = ['1', '2']) => {
  const ap = point(a), bp = point(b), tp = Q.encodePoint(Q.pointAt(Q.decodePoint(ap), Q.decodePoint(bp), Q.decodeRational(t)));
  const graph = { version: 1, nodes: [{ id: 'a', p: ap }, { id: 'b', p: bp }, { id: 'tee', p: tp },
    { id: 'end', p: ['l', '216', '192'] }], edges: [
    { id: 'support', kind: 'partition', from: 'a', to: 'tee', cm: 25 },
    { id: 'support-child', kind: 'partition', from: 'tee', to: 'b', cm: 25 },
    { id: 'branch', kind: 'partition', from: 'tee', to: 'end', cm: 25 }], rooms: [],
    dependencies: [{ node: 'tee', kind: 'on-edge', refs: [{ from: 'a', to: 'b' }], parameters: [t] }] };
  return G.projectGraphSpace({ id: 'floor', title: 'Synthetic', cell_cm: 5, rooms: [] }, graph).space;
};
const valid = space => {
  assert.equal(G.validateGraph(space.plan_graph).ok, true);
  G.verifyGraphProjection(space, space.plan_graph);
};
const migratedAxialT = vertical => {
  const xy = (x, y) => (vertical ? [y, x] : [x, y]).map(v => v / 240);
  const legacy = { model_version: 10, markers: [], settings: {}, spaces: [{
    id: 'floor', title: 'Synthetic', cell_cm: 5, view_box: [0, 0, 1, 1], rooms: [], partitions: [
      { id: 'support', a: xy(24, 60), b: xy(180, 60), cm: 25 },
      { id: 'branch', a: xy(100.3, 60), b: xy(100.3, 180), cm: 25 },
    ],
  }] };
  const frozen = structuredClone(legacy), migrated = commitWallSegmentModel(legacy).config;
  assert.deepEqual(legacy, frozen);
  assert.equal(migrated.model_version, 11, 'an ordinary writer already migrated the plan before Optimize');
  assert.equal(migrated.spaces[0].plan_graph.dependencies.length, 1);
  return migrated;
};

for (const vertical of [false, true]) test(`#1285 auto-migrated ${vertical ? 'vertical' : 'horizontal'} support accepts exact axial T sliding on the first Optimize`, () => {
  const before = migratedAxialT(vertical), frozen = structuredClone(before), source = before.spaces[0];
  const originalDependency = source.plan_graph.dependencies[0], originalNode = source.plan_graph.nodes.find(n => n.id === originalDependency.node);
  assert.equal(originalNode.p[0], 'q', 'migration preserves the genuine 0.3-step legacy offset');
  const first = optimizePlans(before, {}), space = first.config.spaces[0];
  valid(space);
  assert.equal(first.changed, true, 'explicit Optimize still aligns an already migrated legacy plan');
  const movedNode = space.plan_graph.nodes.find(n => n.id === originalDependency.node);
  assert.deepEqual(movedNode.p, vertical ? ['l', '60', '100'] : ['l', '100', '60']);
  const dependency = space.plan_graph.dependencies.find(d => d.node === originalDependency.node);
  assert.ok(dependency, 'safe sliding keeps the existing support constraint');
  assert.deepEqual({ ...dependency, parameters: [] }, { ...originalDependency, parameters: [] });
  assert.deepEqual(dependency.parameters, [['19', '39']]);
  const branch = space.partitions.find(p => p.id === 'branch');
  const axis = vertical ? 1 : 0;
  assert.equal(branch.a[axis], 100 / 240);
  assert.equal(branch.b[axis], 100 / 240, 'Optimize must not leave the branch tilted until a second pass');
  const second = optimizePlans(first.config, first.layout);
  assert.equal(second.changed, false);
  assert.deepEqual(second.config, first.config);
  assert.deepEqual(before, frozen);
});

test('#1285 a literal grid target on a 45-degree support still preserves its native q junction', () => {
  let space = empty(), draft = structuredClone(space);
  draft.partitions = [{ id: 'support', a: [24 / 240, 24 / 240], b: [121 / 240, 121 / 240], cm: 25 }];
  space = commitGraphEdit(space, draft, { kind: 'partitions', ids: ['support'] });
  draft = structuredClone(space);
  draft.partitions.push({ id: 'branch', a: [72.5 / 240, 72.5 / 240], b: [180 / 240, 60 / 240], cm: 25 });
  space = commitGraphEdit(space, draft, { kind: 'partitions', ids: ['branch'], endpointRefs: { branch: [
    { kind: 'on-edge', node: 'tee', edge: { kind: 'partition', id: 'support' }, t: ['1', '2'], splitIds: ['support-child'] },
    undefined,
  ] } });
  const before = config(space), result = optimizePlans(before, {});
  valid(result.config.spaces[0]);
  assert.equal(result.changed, false, 'rounded coordinates staying on a diagonal do not authorize sliding');
  assert.deepEqual(result.config, before);
});

test('#1285 axial sliding rejects a lattice target outside the finite support', () => {
  const before = migratedAxialT(false).spaces[0], draft = structuredClone(before);
  const dependency = before.plan_graph.dependencies[0], source = before.plan_graph.nodes.find(n => n.id === dependency.node);
  const p = Q.pointToNumbers(Q.decodePoint(source.p));
  for (const part of draft.partitions) for (const key of ['a', 'b'])
    if (part[key][0] === p[0] && part[key][1] === p[1]) part[key] = [200 / 240, 60 / 240];
  const result = optimizeGraphTargets(before, draft, true).space;
  valid(result);
  assert.deepEqual(result.plan_graph.nodes.find(n => n.id === dependency.node).p, source.p);
  assert.deepEqual(result.plan_graph.dependencies, before.plan_graph.dependencies);
});

test('#1285 axial candidate membership uses the proposed support rather than its old position', () => {
  const before = migratedAxialT(false).spaces[0], draft = structuredClone(before);
  const dependency = before.plan_graph.dependencies[0], source = before.plan_graph.nodes.find(n => n.id === dependency.node);
  const p = Q.pointToNumbers(Q.decodePoint(source.p));
  for (const part of draft.partitions) for (const key of ['a', 'b']) {
    if (part[key][0] === p[0] && part[key][1] === p[1]) part[key] = [100 / 240, 60 / 240];
    else if (part[key][1] === 60 / 240) part[key] = [part[key][0], 61 / 240];
  }
  const result = optimizeGraphTargets(before, draft, true).space;
  valid(result);
  const index = G.graphIndex(result.plan_graph), support = dependency.refs[0];
  assert.deepEqual(result.plan_graph.dependencies, before.plan_graph.dependencies);
  assert.deepEqual(index.nodes.get(dependency.node).p, Q.encodePoint(Q.pointAt(index.points.get(support.from),
    index.points.get(support.to), Q.decodeRational(dependency.parameters[0]))));
  assert.equal(Q.toNumber(index.points.get(dependency.node)[1]), 61 / 240);
  assert.equal(index.nodes.get(dependency.node).p[0], 'q', 'the old-line grid proposal was not authorized');
});

test('#1285 native on-edge q T remains exact when the numeric draft proposes a literal lattice node', () => {
  let space = empty(), draft = structuredClone(space);
  draft.partitions = [{ id: 'support', a: [24 / 240, 24 / 240], b: [120 / 240, 91 / 240], cm: 25 }];
  space = commitGraphEdit(space, draft, { kind: 'partitions', ids: ['support'] });
  draft = structuredClone(space);
  draft.partitions.push({ id: 'branch', a: [72 / 240, 57.5 / 240], b: [72 / 240, 170 / 240], cm: 25 });
  space = commitGraphEdit(space, draft, { kind: 'partitions', ids: ['branch'], endpointRefs: { branch: [
    { kind: 'on-edge', node: 'tee', edge: { kind: 'partition', id: 'support' }, t: ['1', '2'], splitIds: ['support-child'] },
    undefined,
  ] } });
  assert.deepEqual(space.plan_graph.nodes.find(n => n.id === 'tee').p, ['q', '3', '10', '23', '96']);
  const before = config(space), frozen = structuredClone(before), result = optimizePlans(before, {});
  valid(result.config.spaces[0]);
  assert.equal(result.changed, false, 'a numeric grid proposal cannot bend the accepted support or retire its T constraint');
  assert.deepEqual(result.config, frozen);
  assert.deepEqual(before, frozen);
});

test('#1285 dependent points still follow support movement using their original exact parameter', () => {
  const before = teeSpace([.101, .101], [.501, .379], ['1', '3']), dependency = structuredClone(before.plan_graph.dependencies);
  const result = optimizePlans(config(before), {}), space = result.config.spaces[0];
  valid(space);
  assert.equal(result.changed, true);
  const nodes = G.graphIndex(space.plan_graph).nodes;
  assert.deepEqual(nodes.get('a').p, ['l', '24', '24']);
  assert.deepEqual(nodes.get('b').p, ['l', '120', '91']);
  assert.deepEqual(nodes.get('tee').p, Q.encodePoint(Q.pointAt(Q.decodePoint(nodes.get('a').p),
    Q.decodePoint(nodes.get('b').p), Q.exact(1n, 3n))));
  assert.deepEqual(space.plan_graph.dependencies, dependency);
  assert.equal(optimizePlans(result.config, result.layout).changed, false);
});

test('#1285 independent off-grid nodes still align and report their actual movement', () => {
  const graph = { version: 1, nodes: [{ id: 'a', p: point([.101, .103]) }, { id: 'b', p: point([.501, .403]) }],
    edges: [{ id: 'free', kind: 'partition', from: 'a', to: 'b', cm: 25 }], rooms: [], dependencies: [] };
  const before = G.projectGraphSpace({ id: 'floor', cell_cm: 5, rooms: [] }, graph).space;
  const result = optimizePlans(config(before), {});
  valid(result.config.spaces[0]);
  assert.equal(result.changed, true);
  assert.ok(result.report.moved > 0);
  assert.ok(result.config.spaces[0].plan_graph.nodes.every(n => n.p[0] === 'l'));
  assert.equal(optimizePlans(result.config, result.layout).changed, false);
});

test('#1285 only an explicit repair grant can independently retarget a current dependent point', () => {
  const before = teeSpace([.1, .1], [.5, 91 / 240]), draft = structuredClone(before);
  for (const partition of draft.partitions) for (const key of ['a', 'b']) {
    if (partition[key][0] === .3 && Math.abs(partition[key][1] - 57.5 / 240) < 1e-12)
      partition[key] = [.3, 58 / 240];
  }
  const automatic = optimizeGraphTargets(before, draft, true).space;
  assert.deepEqual(automatic.plan_graph, before.plan_graph);
  const granted = optimizeGraphTargets(before, draft, true, { retargetNodes: new Set(['tee']) }).space;
  valid(granted);
  assert.deepEqual(granted.plan_graph.nodes.find(n => n.id === 'tee').p, ['l', '72', '58']);
  assert.equal(granted.plan_graph.dependencies.length, 0);
});
