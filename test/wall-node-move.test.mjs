import test from 'node:test';
import assert from 'node:assert/strict';
import { applyNodeMove, pickWallNode, prepareNodeMove, resolveNodeMoveSnap,
  structuralWallNodes } from '../test-build/wall-node-move.js';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';

const wall = (id, a, b, cm = 0) => ({ id, a, b, cm });
const floor = partitions => ({ id: 'f', rooms: [], wall_segments: [], partitions });
const plan = (s, p, splitIds = {}) => {
  const nodes = structuralWallNodes(s), n = nodes.find(n => Math.hypot(n.point[0] - p[0], n.point[1] - p[1]) < 1e-8);
  assert.ok(n, `node ${p}`); return prepareNodeMove(s, n, nodes, splitIds);
};
test('classification uses unique physical rays and the complete r2 matrix', () => {
  const rays = count => Array.from({ length: count }, (_, i) =>
    wall(String(i), [0, 0], [Math.cos(i * 0.41), Math.sin(i * 0.41)]));
  for (const count of [1, 2, 3, 4, 5, 6]) {
    const p = plan(floor(rays(count)), [0, 0]);
    assert.equal(p.node.valence, count); assert.equal(p.node.passing, 0); assert.equal(p.node.supported, true);
  }
  const h = wall('h', [-1, 0], [1, 0]), v = wall('v', [0, -1], [0, 1]);
  for (const [walls, p, b, supported] of [
    [[wall('h1', [-1, 0], [0, 0]), wall('h2', [0, 0], [1, 0])], 1, 0, true], [[h, wall('b', [0, 0], [0, 1])], 1, 1, true],
    [[h, v], 2, 0, true], [[h, wall('b', [0, 0], [0, 1]), wall('c', [0, 0], [1, 1])], 1, 2, false],
    [[h, v, wall('b', [0, 0], [1, 1])], 2, 1, false],
    [[h, v, wall('d', [-1, -1], [1, 1])], 3, 0, false],
  ]) {
    const s = floor(walls), target = plan(s, [0, 0]);
    assert.deepEqual([target.node.passing, target.node.branches, target.node.supported], [p, b, supported]);
    if (!supported) assert.deepEqual(applyNodeMove(target, [0.2, 0], target.node.axes[0].key),
      { ok: false, reason: 'unsupported_junction' });
  }
  const shared = floor([wall('h', [0, 0], [1, 0]), wall('copy', [0, 0], [1, 0])]);
  assert.equal(plan(shared, [0, 0]).node.valence, 1);
});
test('screen hit ambiguity has no arbitrary node choice', () => {
  const s = floor([wall('a', [0, 0], [0.004, 0.004])]);
  assert.deepEqual(pickWallNode(structuralWallNodes(s), [0, 0], 0.001), { node: null, ambiguous: true });
});

test('noisy atomized T/X use one consistent angular classifier, independent of order and a/b', () => {
  const h = [wall('h-a', [-0.012772885, -0.004954131], [0, 0]),
    wall('h-b', [0, 0], [0.014078099, 0.005460506])];
  const v = [wall('v-a', [0.003709279, -0.009286616], [0, 0]),
    wall('v-b', [0, 0], [-0.003709205, 0.009286646])];
  for (const x of [false, true]) for (const reversed of [false, true]) {
    const walls = [...h, ...(x ? v : [v[1]])];
    const source = floor(reversed ? walls.reverse().map(w => ({ ...w, a: w.b, b: w.a })) : walls);
    const frozen = structuredClone(source), p = plan(source, [0, 0]);
    assert.deepEqual([p.node.axes.length, p.node.passing, p.node.branches, p.node.valence, p.node.supported],
      x ? [2, 2, 0, 4, true] : [2, 1, 1, 3, true]);
    const moved = applyNodeMove(p, [0.00319322125, 0.00123853275], 'partition:h-a');
    assert.equal(moved.ok, true);
    for (const w of source.partitions) {
      const after = moved.space.partitions.find(a => a.id === w.id);
      const end = w.a.some(v => v !== 0) ? 'a' : 'b';
      assert.deepEqual(after[end], w[end], 'fixed far end');
    }
    assert.deepEqual(source, frozen);
  }
  // Just inside/outside the shared angular boundary. Rays cannot be borrowed
  // from another axis even for a non-transitive chain of close directions.
  for (const angle of [0.00004, 0.00005]) {
    const p = plan(floor([wall('a', [-1, 0], [0, 0]),
      wall('b', [0, 0], [Math.cos(angle), Math.sin(angle)]), wall('v', [0, 0], [0, 1])]), [0, 0]);
    assert.deepEqual([p.node.axes.length, p.node.passing, p.node.branches],
      angle < 0.000045 ? [2, 1, 1] : [3, 0, 3]);
  }
  const chain = [wall('a', [-1, 0], [0, 0]),
    wall('b', [0, 0], [Math.cos(.00004), Math.sin(.00004)]),
    wall('c', [-Math.cos(.00008), -Math.sin(.00008)], [0, 0])];
  for (const walls of [chain, chain.slice().reverse().map(w => ({ ...w, a: w.b, b: w.a }))]) {
    const p = plan(floor(walls), [0, 0]);
    assert.deepEqual([p.node.axes.length, p.node.passing, p.node.branches, p.node.valence], [2, 1, 1, 3]);
  }
});

test('equal-distance H/V snap ties use stable wall ID then a/b-independent anchor', () => {
  const walls = [wall('h', [-10, -10], [10, 10]), wall('v', [5, -5], [-5, 5])];
  const expected = { point: [5, 5], axis: 'partition:h', guide: 'horizontal' };
  for (const reversed of [false, true]) {
    const source = floor(reversed ? walls.slice().reverse().map(w => ({ ...w, a: w.b, b: w.a })) : walls);
    assert.deepEqual(resolveNodeMoveSnap(plan(source, [0, 0]), [0, 0], 1, 'partition:h'), expected);
  }
  const tied = [wall('z', [0, 0], [.05, -.05]), wall('a', [0, 0], [.05, .05])];
  for (const walls of [tied, tied.slice().reverse().map(w => ({ ...w, a: w.b, b: w.a }))])
    assert.deepEqual(resolveNodeMoveSnap(plan(floor(walls), [0, 0]), [.5, 0], .01, null),
      { point: [.5, .05], axis: null, guide: 'horizontal' });
});

test('an exact original-axis and H/V intersection outranks longitudinal quantisation', () => {
  for (const vertical of [false, true]) {
    const swap = p => vertical ? [p[1], p[0]] : p;
    const source = floor([wall('a', [0, 0], swap([1, 0])), wall('b', [0, 0], swap([.503, 1]))]);
    const p = plan(source, [0, 0]), target = swap([.503, 0]);
    const snap = resolveNodeMoveSnap(p, target, .001, null);
    assert.deepEqual(snap, { point: target, axis: null, guide: 'axis' });
    assert.equal(applyNodeMove(p, snap.point, snap.axis).ok, true);
    // Parallel/coincident H/V is not a second point constraint: grid remains.
    const single = plan(floor([source.partitions[0]]), [0, 0]);
    assert.notDeepEqual(resolveNodeMoveSnap(single, target, .001, null).point, target);
  }
});

test('carrier ignores foreign nodes beyond its finite interval; foreign connectivity cannot exchange edges', () => {
  const s = floor([wall('h', [-1, 0], [1, 0]), wall('b', [0, 0], [0, 1]),
    wall('foreign', [2, 0], [2, 1])]);
  const frozen = structuredClone(s), result = applyNodeMove(plan(s, [0, 0]), [.25, 0], 'partition:h');
  assert.equal(result.ok, true); assert.deepEqual(result.space.partitions[2], s.partitions[2]);
  assert.deepEqual(s, frozen);
  const exchange = floor([wall('a', [0, 0], [1, 0]), wall('b', [0, 0], [0, 1]),
    wall('foreign', [.5, 0], [.5, -.25])]);
  const unchanged = structuredClone(exchange);
  // The old physical foreign point stays [.5,0], but would switch a -> b.
  assert.deepEqual(applyNodeMove(plan(exchange, [0, 0]), [1, -1], null), { ok: false, reason: 'invalid' });
  assert.deepEqual(exchange, unchanged);
});

test('ordinary five/six-ray nodes move every endpoint, preserving mixed thickness and far ends', () => {
  const ends = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0.25], [0.25, -1]];
  const thickness = [0, 15, 25, 100, 25, 15];
  for (const count of [5, 6]) {
    const source = floor(ends.slice(0, count).map((b, i) => wall(`ray-${i}`, [0, 0], b, thickness[i])));
    const frozen = structuredClone(source), p = plan(source, [0, 0]), target = [-0.1, -0.1];
    const moved = applyNodeMove(p, target, null); assert.equal(moved.ok, true);
    assert.deepEqual(moved.space.partitions, source.partitions.map(w => ({ ...w, a: target })));
    assert.deepEqual(source, frozen);
  }
});
test('a node cannot merge into a foreign endpoint or create a new T contact', () => {
  const s = floor([wall('moving', [0, 0], [1, 0]), wall('foreign', [0.25, 0.25], [0.25, 1])]);
  const p = plan(s, [0, 0]);
  for (const target of [[0.25, 0.25], [0.25, 0.5], [1, 0]])
    assert.deepEqual(applyNodeMove(p, target, null), { ok: false, reason: 'invalid' });
});
test('frozen original axes, exact H/V and diagonal longitudinal grid at changing zoom', () => {
  const p = plan(floor([wall('a', [0, 0], [1, 1]), wall('b', [0, 0], [1, -0.5])]), [0, 0]);
  const ax = resolveNodeMoveSnap(p, [0.25, 0.251], 0.0002, null);
  assert.equal(ax.guide, 'axis'); assert.ok(Math.abs(ax.point[0] - ax.point[1]) < 1e-12);
  for (const zoom of [0.0001, 0.001]) {
    const h = resolveNodeMoveSnap(p, [0.34, 1.0005], zoom, null);
    assert.equal(h.point[1], 1); assert.equal(h.guide, 'horizontal');
  }
  const s = floor([wall('carrier', [-1, -1], [1, 1]), wall('branch', [0, 0], [0.3, 0.7])]);
  const t = plan(s, [0, 0]);
  const exact = resolveNodeMoveSnap(t, [0.699, 0.7005], 0.001, null);
  assert.deepEqual(exact.point, [0.7, 0.7]); assert.equal(exact.guide, 'horizontal');
});
test('T moves its endpoint branch only and cannot skip a foreign node or carrier end', () => {
  const s = floor([wall('h', [-1, 0], [1, 0]), wall('b', [0, 0], [0, 1]), wall('foreign', [0.5, 0], [0.5, -1])]);
  const p = plan(s, [0, 0]), axis = p.node.axes.find(a => a.passing).key;
  const result = applyNodeMove(p, [0.2, 0], axis);
  assert.equal(result.ok, true); assert.deepEqual(result.space.partitions[0], s.partitions[0]);
  assert.deepEqual(result.space.partitions[1].a, [0.2, 0]);
  for (const x of [0.5, 0.75, 1, 2]) assert.equal(applyNodeMove(p, [x, 0], axis).ok, false);
  assert.deepEqual(s.partitions[1].a, [0, 0]);
});

test('snap axes stay frozen through deformation, release outside 12px and ignore endpoint orientation', () => {
  const source = floor([wall('a', [0, 0], [1, 1]), wall('b', [0, 0], [1, -0.5])]);
  const normal = plan(source, [0, 0]);
  const reverse = plan(floor(source.partitions.map(w => ({ ...w, a: w.b, b: w.a }))), [0, 0]);
  const first = resolveNodeMoveSnap(normal, [.25, .251], .001, null);
  assert.equal(applyNodeMove(normal, first.point, first.axis).ok, true);
  for (const zoom of [.0001, .001]) for (const raw of [[-.25, -.249], [1.0005, .34], [.34, 1.0005]]) {
    const snap = resolveNodeMoveSnap(normal, raw, zoom, null);
    assert.deepEqual(resolveNodeMoveSnap(reverse, raw, zoom, null), snap);
    if (raw[0] < 0) assert.equal(snap.point[0], snap.point[1], 'original diagonal, not the deformed other arm');
    else if (raw[0] > 1) { assert.equal(snap.point[0], 1); assert.equal(snap.guide, 'vertical'); }
    else { assert.equal(snap.point[1], 1); assert.equal(snap.guide, 'horizontal'); }
  }
  assert.equal(resolveNodeMoveSnap(normal, [.251, .27], .001, null).guide, null);
  assert.deepEqual(source.partitions[0].a, [0, 0]);
});

test('X refuses an initial axis tie and never switches its chosen carrier during the gesture', () => {
  const p = plan(floor([wall('h', [-1, 0], [1, 0]), wall('v', [0, -1], [0, 1])]), [0, 0]);
  assert.deepEqual(resolveNodeMoveSnap(p, [.2, .2], .001, null), { point: [0, 0], axis: null, guide: null });
  const first = resolveNodeMoveSnap(p, [.2, .01], .001, null);
  assert.equal(first.axis, 'partition:h');
  const next = resolveNodeMoveSnap(p, [.01, .2], .001, first.axis);
  assert.equal(next.axis, first.axis); assert.equal(next.point[1], 0);
});
test('X bend keeps far ends and original-midpoint lineage, no fresh preview IDs', () => {
  for (const splitY of [0, 0.5, -0.5]) {
    const s = floor([wall('h', [-1, splitY], [1, splitY]), wall('v', [0, -1], [0, 1])]);
    const p = plan(s, [0, splitY], { 'partition:v': 'new-v' });
    const axis = p.node.axes.find(a => a.key === 'partition:h').key;
    const first = applyNodeMove(p, [0.25, splitY], axis);
    assert.equal(first.ok, true);
    assert.deepEqual(first.space.partitions[1].a, [0, -1]);
    assert.deepEqual(first.space.partitions[2].b, [0, 1]);
    assert.equal(first.space.partitions[splitY >= 0 ? 1 : 2].id, 'v');
    assert.deepEqual(applyNodeMove(p, [0.3, splitY], axis).space.partitions.map(w => w.id), first.space.partitions.map(w => w.id));
  }
});
test('T/X cannot jump through a whole carrier opening or its jamb', () => {
  for (const x of [-0.5, 0.5]) {
    const s = floor([wall('h', [-1, 0], [1, 0], 25), wall('b', [0, 0], [0, 1])]);
    s.openings = [{ id: 'door', type: 'door', x, y: 0, angle: 0, length: 0.1,
      host: { kind: 'partition', id: 'h', t: (x + 1) / 2 } }];
    const p = plan(s, [0, 0]);
    assert.equal(applyNodeMove(p, [Math.sign(x) * 0.25, 0], 'partition:h').ok, true);
    for (const magnitude of [0.445, 0.5, 0.75]) assert.deepEqual(
      applyNodeMove(p, [Math.sign(x) * magnitude, 0], 'partition:h'), { ok: false, reason: 'opening_blocked' });
  }
});
test('physical distance from the fixed end survives both endpoint orientations', () => {
  for (const reversed of [false, true]) {
    const s = floor([wall('w', reversed ? [1, 0] : [0, 0], reversed ? [0, 0] : [1, 0], 25)]);
    s.openings = [{ id: 'door', type: 'door', x: 0.75, y: 0, angle: 0, length: 0.1,
      host: { kind: 'partition', id: 'w', t: reversed ? 0.25 : 0.75 }, contact: 'sensor.a', flip_h: true }];
    const moved = applyNodeMove(plan(s, [0, 0]), [-0.5, 0], null);
    assert.equal(moved.ok, true); assert.equal(moved.space.openings[0].x, 0.75);
    assert.equal(moved.space.openings[0].host.t, reversed ? 1 / 6 : 5 / 6);
    assert.equal(moved.space.openings[0].flip_h, true); assert.equal(moved.space.openings[0].contact, 'sensor.a');
    assert.equal(applyNodeMove(plan(s, [0, 0]), [0.8, 0], null).ok, false);
  }
});
test('X children retain opening distance from their respective fixed far ends; crossing P0 refuses', () => {
  const s = floor([wall('h', [-1, 0], [1, 0]), wall('v', [0, -1], [0, 1], 25)]);
  s.openings = [-0.65, 0.65].map((y, i) => ({ id: String(i), type: 'window', x: 0, y, angle: -90, length: 0.1,
    host: { kind: 'partition', id: 'v', t: (y + 1) / 2 } }));
  const p = plan(s, [0, 0], { 'partition:v': 'new-v' });
  const r = applyNodeMove(p, [0.25, 0], 'partition:h'); assert.equal(r.ok, true);
  for (let i = 0; i < 2; i++) assert.ok(Math.abs(Math.hypot(r.space.openings[i].x,
    r.space.openings[i].y - (i ? 1 : -1)) - 0.35) < 1e-10);
  s.openings[0].host.t = 0.5; s.openings[0].y = 0;
  assert.deepEqual(applyNodeMove(plan(s, [0, 0], { 'partition:v': 'new-v' }), [0.25, 0], 'partition:h'),
    { ok: false, reason: 'opening_blocked' });
});
test('shared-room corner synchronizes catalogue, room references and metadata without moving foreign objects', () => {
  const cfg = commitWallSegmentModel({ spaces: [{ id: 'f', rooms: [
    { id: 'r1', name: 'One', area: 'area.one', poly: [[0, 0], [1, 0], [1, 1], [0, 1]] },
    { id: 'r2', name: 'Two', poly: [[1, 0], [2, 0], [2, 1], [1, 1]] },
  ], decor: [{ id: 'decor', x: 1, y: 0 }], future: { exact: 123 } }], markers: [], settings: {} }).config;
  const source = cfg.spaces[0], p = plan(source, [1, 0]);
  assert.equal(p.node.passing, 1); assert.equal(p.node.branches, 1);
  const r = applyNodeMove(p, [1.25, 0], p.node.axes.find(a => a.passing).key);
  assert.equal(r.ok, true);
  const material = commitWallSegmentModel({ ...cfg, spaces: [r.space] }).config.spaces[0];
  assert.deepEqual(material.rooms.map(r => r.id), ['r1', 'r2']);
  for (const room of material.rooms) assert.ok(room.poly.some(p => p[0] === 1.25 && p[1] === 0));
  assert.deepEqual(material.wall_segments.map(w => w.id).sort(), source.wall_segments.map(w => w.id).sort());
  assert.deepEqual(material.decor, source.decor); assert.deepEqual(material.future, source.future);
  assert.equal(material.rooms[0].area, 'area.one');
});
