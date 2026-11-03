import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { optimizePlans, PLAN_MODEL_VERSION } from '../test-build/plan-optimizer.js';
import { migrateGraphSpace, projectGraphSpace, validateGraph, verifyGraphProjection, graphIndex } from '../test-build/plan-graph.js';
import { cmp, encodePoint, exact, parseDecimal, pointAt, encodeRational, decodePoint, pointToNumbers } from '../test-build/plan-exact.js';

const clone = v => JSON.parse(JSON.stringify(v));
const p = (x, y) => encodePoint([parseDecimal(x), parseDecimal(y)]);
const config = space => ({ model_version: 11, spaces: [space], markers: [], settings: {} });
const legacy = space => ({ model_version: 10, spaces: [space], markers: [], settings: {} });
const current = space => migrateGraphSpace(space, { sourceModelVersion: 10 }).space;
const base = extra => ({ id: 'f', title: 'Synthetic', cell_cm: 5, view_box: [0, 0, 1, 1],
  rooms: [], ...extra });
const room = (id, poly) => ({ id, name: id, area: null, poly });
const square = [[0, 0], [1, 0], [1, 1], [0, 1]];
const valid = space => assert.equal(validateGraph(space.plan_graph).ok, true);
const noOp = result => {
  const again = optimizePlans(result.config, result.layout);
  assert.equal(again.changed, false);
  assert.deepEqual(again.config, result.config);
  assert.deepEqual(again.layout, result.layout);
  for (const name of ['moved', 'migrated', 'partitionsMerged', 'partitionsReconciled',
    'wallsMerged', 'openingsRehosted', 'maxShift', 'maxShiftCm']) assert.equal(again.report[name], 0, name);
};

test('#1224 near-axis repair reaches the graph fixed point before returning its first candidate', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/279-near-orthogonal-junction.json', import.meta.url)));
  for (const model of ['legacy', 'current']) {
    const source = base({ ...clone(fixture), extension: { keep: ['space', model] } });
    let migrated = current(source);
    if (model === 'current') {
      const index = graphIndex(migrated.plan_graph);
      const host = migrated.plan_graph.edges.find(e => e.cm === 20
        && cmp(index.points.get(e.from)[0], index.points.get(e.to)[0]) === 0);
      assert.ok(host);
      migrated = projectGraphSpace({ ...migrated, openings: [{ id: 'door', type: 'door', length: .1,
        x: 0, y: 0, angle: 90, host: { kind: 'wall', id: host.id, t: .5 },
        contact: 'binary_sensor.synthetic', invert: true, extension: { keep: 'opening' } }] }, migrated.plan_graph).space;
    }
    const input = model === 'legacy' ? legacy(source) : config(migrated);
    const original = clone(input);
    const beforeGraph = migrated.plan_graph;
    const first = optimizePlans(input, {});
    const space = first.config.spaces[0];
    assert.equal(first.changed, true, model);
    assert.equal(first.report.wallsStraightened, 1, model);
    assert.ok(Math.abs(first.report.maxStraightenShiftCm - 1) < 1e-6, model);
    valid(space);
    verifyGraphProjection(space, space.plan_graph);
    assert.deepEqual(input, original, `${model}: source is immutable`);
    assert.deepEqual(space.extension, source.extension);
    assert.deepEqual(space.rooms.map(r => r.id).sort(), source.rooms.map(r => r.id).sort());
    const oldNodes = new Set(beforeGraph.nodes.map(n => n.id));
    assert.ok(space.plan_graph.nodes.every(n => oldNodes.has(n.id)), `${model}: existing node identity`);
    if (model === 'current') {
      assert.equal(space.openings[0].host.id, migrated.openings[0].host.id);
      assert.equal(space.openings[0].length, .1);
      assert.equal(space.openings[0].contact, 'binary_sensor.synthetic');
      assert.equal(space.openings[0].invert, true);
      assert.deepEqual(space.openings[0].extension, { keep: 'opening' });
    }
    noOp(first);
    noOp({ ...first, config: clone(first.config), layout: clone(first.layout) });
  }
});

test('#1224 representative imported plans stay at their first graph fixed point after JSON round-trip', () => {
  const names = ['real-plan-first-floor.json', 'real-plan-second-floor.json',
    ...['c1-short-edges', 'c2-t-junction-thicknesses', 'c3-x-junction', 'c4-opening-at-vertex']
      .map(name => `560-corpus/${name}.json`)];
  for (const name of names) {
    const raw = JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));
    const input = raw.config ?? (raw.spaces ? raw : { spaces: [raw.space] });
    const layout = raw.layout ?? {}, original = clone(input);
    const first = optimizePlans(input, layout);
    for (const space of first.config.spaces) {
      valid(space);
      verifyGraphProjection(space, space.plan_graph);
    }
    assert.deepEqual(input, original, name);
    noOp({ ...first, config: clone(first.config), layout: clone(first.layout) });
  }
});

test('legacy is decoded from untouched raw coordinates once, then Optimize uses stable graph IDs', () => {
  const input = legacy(base({ rooms: [room('r', [[.001, .001], [.999, .001], [.999, .999], [.001, .999]])] }));
  const original = clone(input);
  const expected = migrateGraphSpace(input.spaces[0], { sourceModelVersion: 10 }).graph;
  const result = optimizePlans(input, {});
  assert.deepEqual(input, original);
  assert.equal(result.config.model_version, PLAN_MODEL_VERSION);
  assert.equal(PLAN_MODEL_VERSION, 11);
  valid(result.config.spaces[0]);
  assert.deepEqual(result.config.spaces[0].plan_graph.nodes.map(n => n.id), expected.nodes.map(n => n.id));
  assert.deepEqual(result.config.spaces[0].rooms[0].poly, square);
  assert.equal(result.report.modelFrom, 10);
  noOp(result);
});

test('current graph is authoritative even when the compatibility room draft is stale', () => {
  const space = current(base({ rooms: [room('r', square)] }));
  const graph = clone(space.plan_graph);
  space.rooms[0].poly[0] = [.25, .25];
  const result = optimizePlans(config(space), {});
  assert.deepEqual(result.config.spaces[0].plan_graph, graph);
  assert.deepEqual(result.config.spaces[0].rooms[0].poly, square);
  noOp(result);
});

test('current11 without graph is invalid, never reconstructed as a legacy draft', () => {
  assert.throws(() => optimizePlans(config(base({ rooms: [room('r', square)] })), {}), /graph-missing/);
});

test('whole-grid Optimize keeps exact affine T incidence and dependent hosts after support moves', () => {
  const a = [.001, .001], b = [.999, .503];
  const t = exact(1n, 3n);
  const tp = pointAt(decodePoint(p(...a)), decodePoint(p(...b)), t);
  const graph = { version: 1,
    nodes: [{ id: 'a', p: p(...a) }, { id: 'b', p: p(...b) },
      { id: 't', p: encodePoint(tp) }, { id: 'c', p: p(.999, .999) },
      { id: 'd', p: p(.001, .999) }, { id: 'e', p: p(.45, .8) }],
    edges: [
      { kind: 'wall', id: 'at', from: 'a', to: 't', cm: 15 },
      { kind: 'wall', id: 'tb', from: 't', to: 'b', cm: 15 },
      { kind: 'wall', id: 'bc', from: 'b', to: 'c', cm: 15 },
      { kind: 'wall', id: 'cd', from: 'c', to: 'd', cm: 15 },
      { kind: 'wall', id: 'da', from: 'd', to: 'a', cm: 15 },
      { kind: 'partition', id: 'te', from: 't', to: 'e', cm: 15 }],
    rooms: [{ room: 'r', edges: ['at', 'tb', 'bc', 'cd', 'da'].map(id => ({ kind: 'wall', id, reverse: false })) }],
    dependencies: [{ node: 't', kind: 'on-edge', refs: [{ from: 'a', to: 'b' }], parameters: [encodeRational(t)] }],
  };
  const space = projectGraphSpace(base({ rooms: [room('r', [])], openings: [
    { id: 'door', type: 'door', host: { kind: 'partition', id: 'te', t: .5 }, x: 0, y: 0, angle: 0, length: .02 },
  ] }), graph).space;
  const result = optimizePlans(config(space), {});
  const out = result.config.spaces[0];
  valid(out);
  const byId = graphIndex(out.plan_graph).nodes;
  assert.deepEqual(byId.get('a').p, ['l', '0', '0']);
  assert.deepEqual(byId.get('b').p, ['l', '240', '121']);
  assert.deepEqual(byId.get('t').p, encodePoint(pointAt(decodePoint(byId.get('a').p), decodePoint(byId.get('b').p), t)));
  assert.deepEqual(out.plan_graph.dependencies, graph.dependencies);
  assert.equal(out.plan_graph.edges.find(e => e.id === 'at').to, 't');
  assert.equal(out.plan_graph.edges.find(e => e.id === 'te').from, 't');
  assert.equal(out.plan_graph.edges.find(e => e.id === 'at').cm, 15);
  assert.deepEqual(out.openings[0].host.tq, ['1', '2']);
  const finalT = pointToNumbers(decodePoint(byId.get('t').p));
  const finalE = pointToNumbers(decodePoint(byId.get('e').p));
  assert.equal(out.openings[0].x, (finalT[0] + finalE[0]) / 2);
  noOp(result);
});

test('partition compaction uses explicit seam collapse and remaps exact hosted t', () => {
  const space = current(base({ partitions: [
    { id: 'a', a: [.1, .5], b: [.5, .5], cm: 15 },
    { id: 'b', a: [.5, .5], b: [.9, .5], cm: 15 },
  ], openings: [{ id: 'door', type: 'door', x: .7, y: .5, angle: 0, length: .1,
    host: { kind: 'partition', id: 'b', t: .5 } }] }));
  const result = optimizePlans(config(space), {});
  const out = result.config.spaces[0];
  valid(out);
  assert.equal(out.partitions.length, 1);
  assert.equal(out.partitions[0].id, 'a');
  assert.deepEqual(out.openings[0].host, { kind: 'partition', id: 'a', tq: ['3', '4'], t: .75 });
  assert.equal(out.openings[0].x, .7);
  assert.equal(result.report.partitionsMerged, 1);
  noOp(result);
});

test('intentionally detached current endpoints do not join by coordinate coincidence', () => {
  const space = current(base({ partitions: [
    { id: 'a', a: [.1, .5], b: [.5, .5], cm: 15 },
    { id: 'b', a: [.5, .5], b: [.9, .5], cm: 15 },
  ] }));
  const graph = clone(space.plan_graph);
  const edge = graph.edges.find(e => e.id === 'b');
  const source = graph.nodes.find(n => n.id === edge.from);
  graph.nodes.push({ ...clone(source), id: 'intentional-detach' });
  edge.from = 'intentional-detach';
  const detached = projectGraphSpace(space, graph).space;
  const result = optimizePlans(config(detached), {});
  assert.equal(result.config.spaces[0].partitions.length, 2);
  assert.deepEqual(result.config.spaces[0].plan_graph, graph);
  assert.equal(result.report.partitionsMerged, 0);
  noOp(result);
});

test('continuous stairs/furniture/image transforms, backdrop, room metadata and detached layout survive', () => {
  const shape = { kind: 'furniture', id: 'sofa', x: .123456789, y: .234567891, w: .132456789, h: .273456789, angle: 23.123456789 };
  const stair = { id: 'stairs', x: .123456789, y: .234567891, w: .132456789, h: .273456789, angle: 23.123456789 };
  const space = current(base({ rooms: [{ ...room('r', square), custom: { keep: true }, area: 'kitchen' }],
    decor: [shape, { ...shape, id: 'image', kind: 'image', src: '/local/example.png' }], stairs: [stair],
    plan_x: .123456789, plan_y: .234567891, plan_scale_x: 1.234567891, plan_scale_y: .987654321, custom: { keep: true },
  }));
  const layout = { unused: { s: 'removed-space', x: .25, y: .75, metadata: { keep: true } } };
  const result = optimizePlans(config(space), layout);
  const out = result.config.spaces[0];
  assert.deepEqual(out.decor, space.decor);
  assert.deepEqual(out.stairs, space.stairs);
  assert.equal(out.plan_x, space.plan_x);
  assert.equal(out.plan_scale_x, space.plan_scale_x);
  assert.deepEqual(out.custom, space.custom);
  assert.equal(out.rooms[0].area, 'kitchen');
  assert.deepEqual(out.rooms[0].custom, { keep: true });
  assert.deepEqual(result.layout, layout);
  noOp(result);
});
const coincident = (partial = false, roomCm = 20, partitionCm = 20) => base({
  rooms: [room('left', [[0, 0], [.5, 0], [.5, 1], [0, 1]]),
    room('right', [[.5, 0], [1, 0], [1, 1], [.5, 1]])],
  walls: [{ a: [.5, 0], b: [.5, 1], cm: roomCm, key: 'legacy' }],
  partitions: [{ id: 'redundant', a: [.5, partial ? .1 : 0], b: [.5, partial ? .9 : 1], cm: partitionCm }],
  openings: [{ id: 'door', type: 'door', x: .5, y: .5, angle: -90, length: .2,
    contact: 'binary_sensor.door', lock: 'lock.door', invert: true,
    host: { kind: 'partition', id: 'redundant', t: .5 } }],
});

test('exact coincident and fully hidden partial partitions convert through explicit known IDs', () => {
  for (const partial of [false, true]) {
    const result = optimizePlans(legacy(coincident(partial)), {});
    const out = result.config.spaces[0];
    valid(out);
    assert.equal(out.partitions.length, 0);
    assert.equal(out.openings[0].host.kind, 'wall');
    assert.deepEqual(out.openings[0].host.tq, ['1', '2']);
    assert.equal(out.openings[0].x, .5);
    assert.equal(out.openings[0].y, .5);
    assert.equal(out.openings[0].contact, 'binary_sensor.door');
    assert.equal(result.report.openingsRehosted, 1);
    noOp(result);
  }
});

test('coincident nested thickness keeps the maximum physical envelope', () => {
  for (const [roomCm, partitionCm] of [[30, 20], [20, 30]]) {
    const result = optimizePlans(legacy(coincident(false, roomCm, partitionCm)), {});
    const out = result.config.spaces[0];
    assert.equal(out.partitions.length, 0);
    const walls = out.wall_segments.filter(e => e.a[0] === .5 && e.b[0] === .5);
    assert.ok(walls.length);
    assert.ok(walls.every(w => w.cm === 30));
    noOp(result);
  }
});

test('isolated thickness micro-interval compacts without snapping away its topology', () => {
  const space = base({ rooms: [room('r', [[.2, .2], [.8, .2], [.8, .8], [.2, .8]])],
    walls: [
      { key: 'a', a: [.2, .2], b: [.5, .2], cm: 22 },
      { key: 'b', a: [.5, .2], b: [.5 + 1 / 720, .2], cm: 15 },
      { key: 'c', a: [.5 + 1 / 720, .2], b: [.8, .2], cm: 22 },
    ] });
  const result = optimizePlans(legacy(space), {});
  valid(result.config.spaces[0]);
  const walls = result.config.spaces[0].wall_segments.filter(w => w.cm > 0);
  assert.equal(walls.length, 1);
  assert.equal(walls[0].cm, 22);
  assert.deepEqual(walls[0].a, [.2, .2]);
  assert.deepEqual(walls[0].b, [.8, .2]);
  noOp(result);
});
test('thickness island beside a real room T-node preserves that shared node and room ownership', () => {
  const y = .345833333, split = .8875, microEnd = split + .001381904;
  const space = base({
    rooms: [room('main', [[.8, y], [.95, y], [.95, .5], [.8, .5]]),
      room('branch', [[.845833333, .245833333], [split, .245833333], [split, y], [.845833333, y]])],
    walls: [{ key: 'a', a: [.8, y], b: [split, y], cm: 22 },
      { key: 'b', a: [split, y], b: [microEnd, y], cm: 15 },
      { key: 'c', a: [microEnd, y], b: [.95, y], cm: 22 }],
  });
  const result = optimizePlans(legacy(space), {});
  const out = result.config.spaces[0];
  valid(out);
  const index = graphIndex(out.plan_graph);
  const t = out.plan_graph.nodes.find(node => {
    const at = pointToNumbers(decodePoint(node.p));
    return Math.abs(at[0] - split) < 1e-9 && Math.abs(at[1] - 83 / 240) < 1e-9;
  });
  assert.ok(t, 'the shared T node is still present');
  assert.ok(index.incident.get(t.id).length >= 3);
  assert.ok(out.wall_segments.filter(w => w.a[1] === 83 / 240 && w.b[1] === 83 / 240).every(w => w.cm === 22));
  assert.ok(out.rooms.some(r => r.id === 'main') && out.rooms.some(r => r.id === 'branch'));
  noOp(result);
});

test('near-axis repair remains an explicit whole-plan movement with the existing report', () => {
  const input = legacy(base({ rooms: [room('r', [[0, 0], [2, .004], [2, 1.004], [0, 1]])] }));
  const result = optimizePlans(input, {});
  const out = result.config.spaces[0];
  valid(out);
  assert.ok(result.report.wallsStraightened > 0);
  const poly = out.rooms[0].poly;
  assert.equal(poly[0][1], poly[1][1]);
  assert.equal(poly[2][1], poly[3][1]);
  noOp(result);
});

test('legacy nonstructural migrations and reference-repair reports remain meaningful', () => {
  const input = legacy(base({ rooms: [], plan_scale: 1.2,
    settings: { fill_mode: 'glow', glow_enabled: false },
    decor: [{ id: 'label', kind: 'text', x: .5, y: .5, text: 'State {}',
      entity: 'sensor.synthetic', attr: 'state', scale: 1 }],
  }));
  input.markers = [{ id: 'm', binding: 'entity:switch.synthetic', display: 'ripple',
    controls: ['switch.synthetic', 'input_boolean.synthetic'], space: 'gone',
    vacuum: { trail: false } }];
  const layout = { m: { s: 'gone', x: .25, y: .5 } };
  const result = optimizePlans(input, layout);
  assert.equal(result.config.spaces[0].plan_scale_x, 1.2);
  assert.equal(result.config.spaces[0].plan_scale, undefined);
  assert.equal(result.config.spaces[0].settings.fill_mode, 'none');
  assert.equal(result.config.spaces[0].settings.glow_enabled, false);
  assert.equal(result.config.spaces[0].decor[0].text, 'State {sensor.synthetic}');
  assert.deepEqual(result.config.markers[0].controls, ['input_boolean.synthetic']);
  assert.equal(result.config.markers[0].display, 'icon_ripple');
  assert.equal(result.config.markers[0].vacuum.trail_mode, 'never');
  assert.equal(result.config.markers[0].space, undefined);
  assert.equal(result.report.markersDetached, 1);
  assert.equal(result.report.glowSpacesMigrated, 1);
  assert.ok(result.report.migrated >= 4);
  assert.deepEqual(result.layout, layout);
  noOp(result);
});


test('current on-grid Optimize ignores object key order and still reports real movement', () => {
  // Settle all real maintenance first, then vary only JSON object insertion order
  // (including graph records and unknown nested metadata). Arrays retain order.
  const seed = legacy(base({ rooms: [room('r', square)],
    extension: { nested: { alpha: 1, beta: ['first', 'second'] } } }));
  const baseline = optimizePlans(seed, {}).config;
  const reverseKeys = value => Array.isArray(value) ? value.map(reverseKeys)
    : value && typeof value === 'object'
      ? Object.fromEntries(Object.entries(value).reverse().map(([k, v]) => [k, reverseKeys(v)]))
      : value;
  const input = reverseKeys(baseline), original = clone(input);
  const result = optimizePlans(input, {});
  assert.deepEqual(result.config, input, 'the candidate has exactly the same JSON values');
  assert.equal(result.changed, false, 'property insertion order is not a persisted edit');
  assert.deepEqual(input, original, 'Optimize does not reorder the input');
  for (const field of ['moved', 'migrated', 'canonicalized', 'partitionsMerged', 'wallsMerged', 'maxShift'])
    assert.equal(result.report[field], 0, field);
  noOp(result);

  // The comparison must not hide actual ordered-array/value maintenance.
  const offGrid = clone(input);
  const n = offGrid.spaces[0].plan_graph.nodes[0];
  n.p = p(.001, .001);
  offGrid.spaces[0] = projectGraphSpace(offGrid.spaces[0], offGrid.spaces[0].plan_graph).space;
  const moved = optimizePlans(offGrid, {});
  assert.equal(moved.changed, true, 'a real numerical movement still reports changed');
  assert.notDeepEqual(moved.config, offGrid);
});
