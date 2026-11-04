import test from 'node:test';
import assert from 'node:assert/strict';
import { commitGraphEdit } from '../test-build/graph-edit-intent.js';
import { optimizePlans } from '../test-build/plan-optimizer.js';
import { optimizeGraphTargets } from '../test-build/graph-optimize.js';
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
