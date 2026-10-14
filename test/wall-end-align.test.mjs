// #885: the end of an exact H/V wall aligns with the line through an end of a
// parallel exact H/V wall — Walls drawing (`_resolvePlanDrawPoint`) and the
// wall-node move (`resolveNodeMoveSnap`). The pure function is exercised on its
// own, the drawing link through the production runtime method over a real
// snap snapshot, the node link through the real node plan and applyNodeMove.
import test from 'node:test';
import assert from 'node:assert/strict';
import { alignWallEnd, alignDrawnWallEnd } from '../test-build/wall-end-align.js';
import { applyNodeMove, prepareNodeMove, resolveNodeMoveSnap, structuralWallNodes }
  from '../test-build/wall-node-move.js';

globalThis.window ??= { customCards: [] };
const { HouseplanEditorRuntime } = await import('../test-build/houseplan-editor-runtime.js');

const G = 1000 / 240; // the render grid pitch (CANVAS §9.2)
const c = n => n * G;

test('#885 AC1/AC3/AC5 pure magnet: radius both sides, parallel exact H/V only, nearest, exact off-grid', () => {
  const h = [[0, 50], [417.3, 50]], v = [[417.3, 60], [417.3, 90]], diag = [[0, 0], [417.3, 30]];
  for (const dx of [-7.9, 0, 7.9]) assert.equal(alignWallEnd([417.3 + dx, 5], 0, [h], 8, [], 1e-6)?.at, 417.3, `dx=${dx}`);
  assert.equal(alignWallEnd([417.3 + 8.1, 5], 0, [h], 8, [], 1e-6), null, 'outside the radius');
  assert.equal(alignWallEnd([417.3 + 2, 5], 0, [v, diag], 8, [], 1e-6), null, 'perpendicular or slanted ends are no candidates');
  assert.equal(alignWallEnd([10, 53], 1, [h], 8, [], 1e-6), null, 'vertical: a horizontal end at y=50 is no candidate');
  assert.equal(alignWallEnd([10, 63], 1, [v], 8, [], 1e-6).at, 60);
  // Several in radius: the nearest on screen; an own fixed end would collapse the wall.
  assert.equal(alignWallEnd([100, 0], 0, [[[96, 9], [400, 9]], [[0, 7], [103, 7]]], 8, [], 1e-6).at, 103);
  assert.equal(alignWallEnd([100, 0], 0, [[[96, 9], [400, 9]], [[0, 7], [103, 7]]], 8, [103], 1e-6).at, 96);
  // The drawn segment: only an exact H/V free end is moved, along its own axis.
  assert.deepEqual(alignDrawnWallEnd([0, 5], [420, 5], [415, 6], [h], 8, 1e-6), [417.3, 5]);
  assert.deepEqual(alignDrawnWallEnd([417.3, -40], [417.3, 63], [417.3, 63], [v], 8, 1e-6), [417.3, 60]);
  assert.deepEqual(alignDrawnWallEnd([0, 5], [420, 9], [415, 9], [h], 8, 1e-6), [420, 9], 'slanted segment');
  assert.deepEqual(alignDrawnWallEnd([416, 5], [416, 5], [415, 5], [h], 8, 1e-6), [416, 5], 'zero length');
});

/** The production runtime method over a fake card shell: 1 render unit per CSS px. */
function drawRuntime({ partitions = [], rooms = [], path }) {
  const space = { id: 'f', rooms, partitions };
  const host = {
    _space: 'f', _cfgEpoch: 1, _planSnapGeometryCache: null, _spaceModel: () => space, _openCuts: () => [],
    _openingsR: [], _curSpaceCfg: null, _cellCm: 5, _gridPitch: G, _path: path, _tool: 'draw',
    _stageEl: { clientWidth: 1000, clientHeight: 1000 }, _baseVb: () => null, _viewOr: () => ({ w: 1000, h: 1000 }),
  };
  return Object.assign(Object.create(HouseplanEditorRuntime.prototype), { host });
}
const wallP = (id, a, b, cm = 20) => ({ id, a, b, cm });

test('#885 AC1 Walls: within 8 px of a parallel end on either side the end takes its x/y; outside, the grid', () => {
  const X0 = c(100), A = [c(24), c(48)];
  const rt = drawRuntime({ path: [A], partitions: [wallP('h', [c(30), c(72)], [X0, c(72)])] });
  for (const dx of [-6, 6]) {
    const r = rt._resolvePlanDrawPoint([X0 + dx, A[1] + 1], false);
    assert.deepEqual([r.point, r.candidate], [[X0, A[1]], null], `dx=${dx}`);
  }
  assert.deepEqual(rt._resolvePlanDrawPoint([X0 + 10, A[1] + 1], false).point, [c(102), A[1]], 'outside: grid');
  const Y0 = c(130), B = [c(24), c(20)];
  const vt = drawRuntime({ path: [B], partitions: [wallP('v', [c(80), c(20)], [c(80), Y0])] });
  assert.deepEqual(vt._resolvePlanDrawPoint([B[0] + 1, Y0 - 5], false).point, [B[0], Y0]);
  assert.deepEqual(vt._resolvePlanDrawPoint([B[0] + 1, Y0 + 9], false).point, [B[0], c(132)]);
});

test('#885 AC2 Walls: an accepted segment of the active chain and a zero-thickness wall are candidates', () => {
  // Rectangle: A→B→C accepted (already ordinary partitions), the third side
  // ends opposite A so the fourth closes strictly vertically.
  const A = [c(24), c(24)], B = [c(72), c(24)], C = [c(72), c(48)];
  const chain = drawRuntime({ path: [A, B, C], partitions: [wallP('ab', A, B), wallP('bc', B, C)] });
  const r = chain._resolvePlanDrawPoint([A[0] + 5, C[1] + 1], false);
  assert.deepEqual([r.point, r.candidate], [[A[0], C[1]], null]);
  const zero = drawRuntime({ path: [[c(24), c(48)]], partitions: [wallP('virtual', [c(30), c(72)], [c(100), c(72)], 0)] });
  assert.deepEqual(zero._resolvePlanDrawPoint([c(100) - 5, c(48) + 1], false).point, [c(100), c(48)]);
});

test('#885 AC3 Walls: perpendicular/slanted candidates and a slanted or 45° segment have no magnet; Shift 0° keeps it', () => {
  const X0 = c(100), A = [c(24), c(48)];
  const perpendicular = drawRuntime({ path: [A], partitions: [wallP('v', [X0, c(72)], [X0, c(100)]),
    wallP('d', [c(60), c(90)], [X0, c(110)])] });
  assert.deepEqual(perpendicular._resolvePlanDrawPoint([X0 + 6, A[1] + 1], false).point, [c(101), A[1]]);
  const parallel = drawRuntime({ path: [A], partitions: [wallP('h', [c(30), c(72)], [X0, c(72)])] });
  const slanted = parallel._resolvePlanDrawPoint([X0 + 6, A[1] + 60], false).point;
  assert.notEqual(slanted[0], X0, 'a slanted free segment is never aligned');
  // Shift: 45° ray near the line → no magnet; 0° ray → the magnet works.
  const ray = parallel._resolvePlanDrawPoint([X0 - 3, A[1] + (X0 - 3 - A[0])], true).point;
  assert.equal(ray[0] - A[0], ray[1] - A[1], 'still exactly on the 45° ray');
  assert.notEqual(ray[0], X0);
  assert.deepEqual(parallel._resolvePlanDrawPoint([X0 + 6, A[1] + 2], true).point, [X0, A[1]]);
});

test('#885 AC4 Walls: an existing wall node in the hit zone wins over a nearby alignment line', () => {
  const X0 = c(100), A = [c(24), c(48)], E = [X0 + 9, A[1]];
  const rt = drawRuntime({ path: [A], partitions: [wallP('h', [c(30), c(72)], [X0, c(72)]),
    wallP('node', E, [E[0], c(80)])] });
  const r = rt._resolvePlanDrawPoint([X0 + 4, A[1] + 1], false);
  assert.deepEqual([r.point, r.candidate?.kind], [E, 'endpoint']);
});

test('#885 AC5 Walls: an off-grid parallel end is reached exactly', () => {
  const X0 = 417.3, A = [c(24), c(48)];
  const rt = drawRuntime({ path: [A], partitions: [wallP('h', [c(30), c(72)], [X0, c(72)])] });
  assert.equal(Math.abs(X0 / G - Math.round(X0 / G)) > 0.01, true, 'the candidate is off the grid');
  assert.deepEqual(rt._resolvePlanDrawPoint([X0 + 5, A[1] - 1], false).point, [X0, A[1]]);
});

// ---- node move (normalized units; 0.001 per CSS px → 8 px = 0.008) ----
const wall = (id, a, b, cm = 0) => ({ id, a, b, cm });
const floor = partitions => ({ id: 'f', rooms: [], wall_segments: [], partitions });
const plan = (s, p) => {
  const nodes = structuralWallNodes(s), n = nodes.find(q => Math.hypot(q.point[0] - p[0], q.point[1] - p[1]) < 1e-8);
  assert.ok(n, `node ${p}`); return prepareNodeMove(s, n, nodes, {});
};

test('#885 AC6/AC5 node: one wall straightened by its H magnet AND its end aligned on x, both exact after apply', () => {
  const X0 = 0.7031; // off the 1/240 grid
  // A slanted wall ending even nearer (x = 0.70305) is no candidate.
  const s = floor([wall('w1', [0.2, 0.6], [0.5, 0.65]), wall('w2', [0.5, 0.3], [0.5, 0.65]),
    wall('parallel', [0.6, 0.8], [X0, 0.8]), wall('slanted', [0.70305, 0.9], [0.95, 0.99])]);
  const p = plan(s, [0.5, 0.65]);
  for (const raw of [[0.703, 0.601], [X0 + 0.0075, 0.5995]]) {
    const snap = resolveNodeMoveSnap(p, raw, 0.001, null);
    assert.deepEqual(snap, { point: [X0, 0.6], axis: null, guide: 'horizontal' }, `raw ${raw}`);
    const moved = applyNodeMove(p, snap.point, snap.axis);
    assert.equal(moved.ok, true);
    const w1 = moved.space.partitions.find(w => w.id === 'w1');
    assert.deepEqual([w1.a[1] === w1.b[1], w1.b[0]], [true, X0], 'horizontal and aligned, exactly');
  }
  // Outside 8 px: the node's own result, unchanged.
  assert.deepEqual(resolveNodeMoveSnap(p, [X0 + 0.0085, 0.601], 0.001, null).point, [X0 + 0.0085, 0.6]);
});

test('#885 node: a node H/V goal on the same coordinate keeps the node result when nearer or tied', () => {
  // w2 from (0.7, 0.3) can be made vertical (x = 0.7); the parallel end is at 0.705.
  const s = floor([wall('w1', [0.2, 0.6], [0.5, 0.65]), wall('w2', [0.7, 0.3], [0.5, 0.65]),
    wall('parallel', [0.6, 0.8], [0.705, 0.8])]);
  const p = plan(s, [0.5, 0.65]);
  assert.deepEqual(resolveNodeMoveSnap(p, [0.7026, 0.6008], 0.001, null).point, [0.705, 0.6], 'alignment nearer');
  assert.deepEqual(resolveNodeMoveSnap(p, [0.7024, 0.6008], 0.001, null).point, [0.7024, 0.6], 'node goal nearer');
  // An exact tie (dyadic values, 0.005 per px): the node's own result stays.
  const tie = floor([wall('w1', [0.1875, 0.59375], [0.5, 0.65625]), wall('w2', [0.625, 0.25], [0.5, 0.65625]),
    wall('parallel', [0.75, 0.875], [0.6875, 0.875])]);
  const t = plan(tie, [0.5, 0.65625]);
  assert.deepEqual(resolveNodeMoveSnap(t, [0.65625, 0.6015625], 0.005, null).point, [0.65625, 0.59375], 'tie: node magnet');
  assert.deepEqual(resolveNodeMoveSnap(t, [0.65625 + 2 ** -10, 0.6015625], 0.005, null).point, [0.6875, 0.59375]);
});

test('#885 AC7 node: a T sliding along its carrier aligns only along it; walls the node moves are no candidates', () => {
  // Horizontal carrier through the T; stem down. A vertical wall ending at
  // y = 0.0042 must not lift the T off its carrier; a horizontal one aligns x.
  const s = floor([wall('h', [-1, 0], [1, 0]), wall('stem', [0, 0], [0, 1]),
    wall('vertical', [0.3, 0.0042], [0.3, 0.5]), wall('parallel', [0.5, -0.4], [0.2031, -0.4])]);
  const p = plan(s, [0, 0]), axis = p.node.axes.find(a => a.passing).key;
  const snap = resolveNodeMoveSnap(p, [0.2, 0.003], 0.001, null);
  assert.deepEqual(snap, { point: [0.2031, 0], axis, guide: 'axis' });
  assert.equal(applyNodeMove(p, snap.point, snap.axis).ok, true);
  // At its start the stem is vertical; the vertical wall end 1.2 px away still
  // must not lift the T off its horizontal carrier.
  assert.deepEqual(resolveNodeMoveSnap(p, [0.001, 0.003], 0.001, null).point, [0, 0], 'never off the carrier');
  // Walls the node moves are no candidates: back near its start along `a`,
  // the original end x = 0 of `a` itself must not pull the node home.
  const own = floor([wall('a', [0, 0], [1, 0]), wall('k', [0, 0], [0.5, 1])]);
  const q = resolveNodeMoveSnap(plan(own, [0, 0]), [0.006, 0.001], 0.001, null);
  assert.deepEqual([Math.abs(q.point[0] - 1 / 240) < 1e-12, q.point[1], q.guide], [true, 0, 'axis']);
});
