import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../test-build/plan-graph.js';
import * as Q from '../test-build/plan-exact.js';
import { commitGraphEdit } from '../test-build/graph-edit-intent.js';
import { nudgePlan } from '../test-build/editors/plan-nudge.js';
import { graphOpeningRunTarget, annotateGraphOpeningRuns } from '../test-build/graph-opening-run.js';
import { optimizePlans } from '../test-build/plan-optimizer.js';
import { applySafeResize, resolveSafeResize } from '../test-build/resize.js';
import { GRID_PITCH, NORM_W } from '../test-build/canvas-constants.js';
import { PhysicalBodyGestureRuntime } from '../test-build/physical-body-gesture.js';
import { graphDrawGridPoint } from '../test-build/graph-draw-binding.js';

const clone = structuredClone;
const graphSpace = (points, edges, cycles = []) => G.projectGraphSpace({
  id: 'floor', title: 'Synthetic', cell_cm: 5, rooms: cycles.map(room => ({ id: room.room, name: room.room })),
}, { version: 1, nodes: points.map(([id, x, y]) => ({ id, p: ['l', String(x), String(y)] })),
  edges: edges.map(([id, from, to, kind = 'partition']) => ({ id, from, to, kind, cm: 10 })),
  rooms: cycles, dependencies: [] }).space;
const free = k => graphSpace([['a', k, 48], ['b', k + 48, 48]], [['p', 'a', 'b']]);
const room = (k = 24) => graphSpace([['a', k, 24], ['b', k + 72, 24], ['c', k + 72, 96], ['d', k, 96]],
  [['top', 'a', 'b', 'wall'], ['right', 'b', 'c', 'wall'], ['bottom', 'c', 'd', 'wall'], ['left', 'd', 'a', 'wall']],
  [{ room: 'r', edges: ['top', 'right', 'bottom', 'left'].map(id => ({ kind: 'wall', id, reverse: false })) }]);
const noWork = (space, message) => {
  assert.equal(G.validateGraph(space.plan_graph).ok, true, message);
  G.verifyGraphProjection(space, space.plan_graph);
  const optimized = optimizePlans({ model_version: 11, spaces: [space], markers: [], settings: {} }, {});
  assert.equal(optimized.changed, false, message);
};

test('#1282 nudge commits every lattice origin/direction as exact l nodes and leaves Optimize no work', () => {
  for (let k = 0; k < 240; k++) for (const delta of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const before = free(k), snapshot = clone(before);
    const draft = nudgePlan(before, { kind: 'partition', id: 'p' }, delta[0] / 240, delta[1] / 240, 5);
    assert.ok(draft, `k=${k} delta=${delta}`);
    const result = commitGraphEdit(before, draft, { kind: 'partitions', ids: ['p'] });
    assert.ok(result.plan_graph.nodes.every(n => n.p[0] === 'l'), `k=${k} delta=${delta}`);
    assert.deepEqual(result.plan_graph.nodes.find(n => n.id === 'a').p,
      ['l', String(k + delta[0]), String(48 + delta[1])]);
    assert.deepEqual(before, snapshot);
    noWork(result, `k=${k} delta=${delta}`);
  }
});

test('#1282 all quantized centers on an axial room wall retain reduced exact opening fractions', () => {
  const before = room();
  const carriers = before.wall_segments.map(w => ({ ...w, a: w.a.map(v => v * NORM_W), b: w.b.map(v => v * NORM_W) }));
  annotateGraphOpeningRuns(before.plan_graph, carriers, 'wall', NORM_W);
  const host = carriers.find(w => w.id === 'top');
  for (let k = 0; k <= 72; k++) {
    // The arithmetic expression is the real drag producer, including its ULP tails.
    const along = k * GRID_PITCH;
    const physical = [host.a[0] + along, host.a[1]];
    const target = graphOpeningRunTarget(carriers, 'top', physical);
    assert.ok(target);
    assert.deepEqual(target.host.tq, Q.encodeRational(Q.exact(BigInt(k), 72n)), `step=${k}`);
    if (k < 3 || k > 69) continue; // Positive-width openings must retain both jambs.
    const draft = clone(before);
    draft.openings = [{ id: 'o', type: 'door', length: .01, angle: 0,
      x: target.normalized[0], y: target.normalized[1], host: target.host, custom: { keep: true } }];
    const result = commitGraphEdit(before, draft, { kind: 'openings', ids: ['o'] });
    assert.deepEqual(result.openings[0].host.tq, target.host.tq);
    assert.deepEqual(result.openings[0].custom, { keep: true });
    noWork(result, `opening step=${k}`);
  }
});

test('#1282 safe Resize translates lattice indices before the graph commit', () => {
  for (let k = 1; k < 32; k++) for (const edge of [0, 1, 2, 3]) {
    const before = room(k);
    const rooms = before.rooms.map(r => ({ ...r, poly: r.poly.map(p => p.map(v => v * NORM_W)) }));
    const resolution = resolveSafeResize(rooms, [], 'r', edge,
      { minDim: 6 * GRID_PITCH, eps: GRID_PITCH * .05, step: GRID_PITCH });
    assert.equal(resolution.enabled, true, `k=${k} edge=${edge}`);
    const moved = applySafeResize(rooms, [], resolution.plan, GRID_PITCH);
    const draft = clone(before);
    draft.rooms[0].poly = moved.polys.r.map(p => p.map(v => v / NORM_W));
    const result = commitGraphEdit(before, draft, { kind: 'resize', rooms: ['r'] });
    assert.ok(result.plan_graph.nodes.every(n => n.p[0] === 'l'), `k=${k} edge=${edge}`);
    noWork(result, `Resize k=${k} edge=${edge}`);
  }
});

test('#1282 repeated decimal lattice coordinates in v10 migrate to l, not a decimal q alias', () => {
  const source = { id: 'floor', cell_cm: 5, rooms: [{ id: 'r', name: 'R',
    poly: [[0, 0], [72 / 240, 44 / 240], [72 / 240, 120 / 240], [0, 120 / 240]] }] };
  const snapshot = clone(source);
  const result = G.migrateGraphSpace(source, { sourceModelVersion: 10 });
  assert.ok(result.graph.nodes.every(n => n.p[0] === 'l'));
  assert.deepEqual(source, snapshot);
  G.verifyGraphProjection(result.space, result.graph);
});

test('#1282 authored noise tolerance has an explicit boundary and never changes raw source decoding', () => {
  const step = 1 / 240;
  for (const sign of [-1, 1]) {
    const near = (72 + sign * .00009) / 240;
    assert.deepEqual(Q.encodePoint(Q.readAuthoredPoint([near, 44 / 240])), ['l', '72', '44']);
    const far = (72 + sign * .00011) / 240;
    assert.equal(Q.encodePoint(Q.readAuthoredPoint([far, 44 / 240]))[0], 'q');
    assert.deepEqual(Q.readSourcePoint([near, step]), [Q.parseDecimal(near), Q.parseDecimal(step)]);
  }
});

test('#1282 physical body release preserves exact grid nodes after the real transient drag owner', () => {
  for (let k = 0; k < 240; k++) {
    const before = free(k), stored = clone(before), frozen = clone(before);
    const render = { ...before, wall_columns: [], partitions: before.partitions.map(p => ({ ...p,
      a: p.a.map(v => v * NORM_W), b: p.b.map(v => v * NORM_W) })) };
    let result, writes = 0;
    const owner = new PhysicalBodyGestureRuntime({ queueTarget: {}, space: () => render,
      storedGeometry: () => stored, units: () => ({ cellCm: 5, gridPitch: GRID_PITCH }),
      point: e => e.point, snap: p => p.map(v => Math.round(v / GRID_PITCH) * GRID_PITCH),
      snapshot: () => null, select: () => true, publish() {}, now: () => 0, openDialog() {}, toast() {},
      commit() { writes++; result = commitGraphEdit(before, stored, { kind: 'partitions', ids: ['p'] }); } });
    const event = (point, clientX) => ({ point, clientX, clientY: 0, pointerId: 1, stopPropagation() {}, target: {} });
    const start = render.partitions[0].a;
    owner.begin(event(start, 0), 'partition', 'p');
    owner.move(event([start[0] + GRID_PITCH, start[1]], 10));
    assert.deepEqual(stored, frozen, 'queued/held movement never mutates persisted geometry');
    owner.end(event([start[0] + GRID_PITCH, start[1]], 10));
    assert.equal(writes, 1);
    assert.ok(result.plan_graph.nodes.every(n => n.p[0] === 'l'), `physical k=${k}`);
    assert.deepEqual(before, frozen);
    noWork(result, `physical k=${k}`);
  }
});

test('#1282 native Draw accepts ULP grid tails only with the actual snap producer', () => {
  const point = [54 / 240 * NORM_W + Number.EPSILON * 256, 95 / 240 * NORM_W];
  assert.deepEqual(graphDrawGridPoint(point, point, GRID_PITCH), ['l', '54', '95']);
  assert.equal(graphDrawGridPoint(point, undefined, GRID_PITCH), undefined);
});
