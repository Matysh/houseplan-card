import test from 'node:test';
import { haPlanHost } from '../test-build/ha-plan-host.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { optimizePlans } from '../test-build/plan-optimizer.js';
import { projectGraphSpace, validateGraph, verifyGraphProjection, migrateGraphSpace, graphIndex } from '../test-build/plan-graph.js';
import { encodePoint, exact, parseDecimal, pointAt, encodeRational, decodePoint } from '../test-build/plan-exact.js';
import { OptimizePlansDialog } from '../test-build/optimize-plans-dialog.js';
import { contentFingerprint } from '../test-build/visual-continuity.js';

const p = (x, y) => encodePoint([parseDecimal(x), parseDecimal(y)]);
const base = extra => ({ id: 'floor', title: 'Synthetic floor', cell_cm: 5,
  view_box: [0, 0, 1, 1], rooms: [], ...extra });
const cfg = space => ({ model_version: 11, spaces: [space], markers: [], settings: {} });
const current = space => migrateGraphSpace(space, { sourceModelVersion: 10 }).space;
const flatten = value => value == null || typeof value === 'symbol' || typeof value === 'function' ? ''
  : Array.isArray(value) ? value.map(flatten).join('')
    : value?.strings ? value.strings.reduce((s, part, i) => s + part + flatten(value.values[i]), '') : String(value);
const render = result => {
  const dialog = new OptimizePlansDialog({ dialog: () => ({ ...result,
    preflight: { ok: true, failures: [], fingerprint: contentFingerprint(result.config) }, cm: 0, where: '' }),
    t: (key, vars) => key + (vars ? JSON.stringify(vars) : ''), config: () => result.config,
    planHost: () => haPlanHost({}), canWrite: () => true, ledNote: () => '', integrationVersion: () => 'test', cardVersion: () => 'test',
  }, { optimize: optimizePlans, sourceMatches: () => true });
  return flatten(dialog.render());
};
const settled = result => {
  const next = optimizePlans(result.config, result.layout);
  assert.equal(next.changed, false);
  for (const key of ['moved', 'wallsMerged', 'partitionsMerged', 'openingParametersCanonicalized',
    'wallsStraightened', 'latticeCoordinatesCanonicalized', 'canonicalized']) assert.equal(next.report[key] ?? 0, 0, key);
};

test('#1284 a decimal tq rewrite has its own explanation and no geometric movement', () => {
  let space = current(base({ rooms: [{ id: 'room', poly: [[0, 0], [1, 0], [1, 1], [0, 1]] }] }));
  const edge = space.plan_graph.edges.find(e => {
    const index = graphIndex(space.plan_graph);
    return index.points.get(e.from)[1].n === 0n && index.points.get(e.to)[1].n === 0n;
  });
  assert.ok(edge);
  space = projectGraphSpace({ ...space, openings: [{ id: 'door', type: 'door', x: .3, y: 0,
    angle: 0, length: .1, host: { kind: 'wall', id: edge.id, tq: ['29999999999999999', '100000000000000000'], t: .3 },
  }] }, space.plan_graph).space;
  const before = structuredClone(space), result = optimizePlans(cfg(space), {});
  assert.equal(result.changed, true);
  assert.equal(result.report.moved, 0);
  assert.equal(result.report.maxShiftCm, 0);
  assert.equal(result.report.openingsRehosted, 0);
  assert.equal(result.report.openingParametersCanonicalized, 1);
  assert.deepEqual(result.config.spaces[0].openings[0].host.tq, ['3', '10']);
  assert.deepEqual(space, before);
  assert.match(render(result), /gs\.optimize_opening_parameters\{"n":"1"\}/);
  settled(result);
});

test('#1284 model11 wall seams count actual collapse-node operations and explain Apply', () => {
  const space = current(base({ rooms: [{ id: 'room', poly: [[0, 0], [.5, 0], [1, 0], [1, 1], [0, 1]] }] }));
  assert.equal(space.plan_graph.edges.length, 5);
  const result = optimizePlans(cfg(space), {});
  assert.equal(result.changed, true);
  assert.equal(result.config.spaces[0].plan_graph.edges.length, 4);
  assert.equal(result.report.wallsMerged, 1);
  assert.equal(result.report.moved, 0);
  assert.match(render(result), /gs\.optimize_changes[^<]*"w":"1"/);
  settled(result);
});

test('#1284 ULP repair does not report the numerical draft moving a diagonal T', () => {
  const a = p(0, 0), b = p(1, .8), t = exact(61n, 288n);
  const graph = { version: 1, nodes: [{ id: 'a', p: a }, { id: 'b', p: b },
    { id: 't', p: encodePoint(pointAt(decodePoint(a), decodePoint(b), t)) },
    { id: 'c', p: p(1, 1) }, { id: 'd', p: p(0, 1.0000000000000002) },
    { id: 'e', p: ['l', '51', '180'] }], edges: [
    { kind: 'wall', id: 'at', from: 'a', to: 't', cm: 15 },
    { kind: 'wall', id: 'tb', from: 't', to: 'b', cm: 15 },
    { kind: 'wall', id: 'bc', from: 'b', to: 'c', cm: 15 },
    { kind: 'wall', id: 'cd', from: 'c', to: 'd', cm: 15 },
    { kind: 'wall', id: 'da', from: 'd', to: 'a', cm: 15 },
    { kind: 'partition', id: 'te', from: 't', to: 'e', cm: 15 }],
    rooms: [{ room: 'room', edges: ['at', 'tb', 'bc', 'cd', 'da'].map(id => ({ kind: 'wall', id, reverse: false })) }],
    dependencies: [{ node: 't', kind: 'on-edge', refs: [{ from: 'a', to: 'b' }], parameters: [encodeRational(t)] }],
  };
  const space = projectGraphSpace(base({ rooms: [{ id: 'room', poly: [] }] }), graph).space;
  const result = optimizePlans(cfg(space), {}), out = result.config.spaces[0];
  assert.equal(result.changed, true);
  assert.equal(validateGraph(out.plan_graph).ok, true);
  verifyGraphProjection(out, out.plan_graph);
  assert.deepEqual(out.plan_graph.nodes.find(n => n.id === 't'), graph.nodes.find(n => n.id === 't'));
  assert.deepEqual(out.plan_graph.dependencies, graph.dependencies);
  assert.equal(result.report.moved, 0);
  assert.equal(result.report.wallsStraightened, 0);
  assert.equal(result.report.maxShiftCm, 0);
  assert.equal(result.report.latticeCoordinatesCanonicalized, 1);
  const markup = render(result);
  assert.match(markup, /gs\.optimize_lattice_summary/);
  assert.doesNotMatch(markup, /gs\.align_count|gs\.optimize_walls_straightened/);
  settled(result);
});

test('#1284 actual movement is measured once per graph node through its own floor scale', () => {
  let space = current(base({ cell_cm: 100, rooms: [{ id: 'room', poly: [[0, 0], [1, 0], [1, 1], [0, 1]] }] }));
  const graph = structuredClone(space.plan_graph), node = graph.nodes.find(n => n.p[1] === '0' && n.p[2] === '0');
  node.p = p(.001, .001);
  space = projectGraphSpace(space, graph).space;
  const result = optimizePlans(cfg(space), {});
  assert.equal(result.report.moved, 1);
  assert.ok(Math.abs(result.report.maxShiftCm - Math.hypot(.001, .001) * 24000) < 1e-10);
  assert.equal(result.report.maxSpace, 'floor');
  settled(result);
});

test('#1284 accepted near-axis repair retains its real physical count and maximum', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/279-near-orthogonal-junction.json', import.meta.url)));
  const result = optimizePlans(cfg(current(base(fixture))), {});
  assert.equal(result.report.wallsStraightened, 1);
  assert.ok(Math.abs(result.report.maxStraightenShiftCm - 1) < 1e-6);
  assert.match(render(result), /gs\.optimize_walls_straightened/);
  settled(result);
});

test('#1284 movement includes four decor corners and retained positions on a missing floor', () => {
  const space = current(base({ cell_cm: 100, decor: [
    { id: 'box', kind: 'rect', x: .001, y: -.001, w: .004, h: .004, fill: 'solid' },
  ] }));
  const layout = { archived: { s: 'removed-floor', x: .002, y: .002 } };
  const result = optimizePlans(cfg(space), layout);
  const output = result.config.spaces[0].decor[0], input = space.decor[0];
  let maximum = 0;
  for (const x of [0, 1]) for (const y of [0, 1]) maximum = Math.max(maximum,
    Math.hypot((output.x + output.w * x) - (input.x + input.w * x),
      (output.y + output.h * y) - (input.y + input.h * y)) * 24000);
  maximum = Math.max(maximum, Math.hypot(result.layout.archived.x - .002, result.layout.archived.y - .002) * 24000);
  assert.equal(result.report.moved, 2);
  assert.equal(result.report.archivedPositionsMoved, 1);
  assert.ok(Math.abs(result.report.maxShiftCm - maximum) < 1e-10);
  assert.equal(result.report.maxSpace, 'removed-floor');
  settled(result);
});

test('#1284 stale compatibility-only projection repair is explained even with no moved graph node', () => {
  const space = current(base({ rooms: [{ id: 'room', poly: [[0, 0], [1, 0], [1, 1], [0, 1]] }] }));
  const graph = structuredClone(space.plan_graph);
  space.rooms[0].poly[0] = [.2, .2];
  const result = optimizePlans(cfg(space), {});
  assert.equal(result.changed, true);
  assert.equal(result.report.moved, 0);
  assert.equal(result.report.canonicalized, 1);
  assert.deepEqual(result.config.spaces[0].plan_graph, graph);
  assert.match(render(result), /gs\.optimize_changes[^<]*"c":"1"/);
  settled(result);
});
