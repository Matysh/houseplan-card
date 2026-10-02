// #780: pure LED strip geometry — anchor, derived visible path, emitters,
// placement against bodies and the hit owner (ТЗ §3, §5, §6, §7; AC2, AC5,
// AC8, AC12 unit part). Results are judged, not the source text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LED_HIT_MIN_CSS_PX, clampToBodies, clampVertexMove, compactPoints,
  emitterSamples, isClosedStrip, polylineLength, stripAnchor, stripHitOwner,
  stripHitRadiusPx, stripPieces, validStripPoints, visibleStripPath,
} from '../test-build/led-strip-geometry.js';

const close = (actual, expected, eps = 1e-9, msg = '') => {
  assert.ok(Math.abs(actual - expected) <= eps, `${msg} ${actual} ≉ ${expected}`);
};
const closePt = (actual, expected, eps = 1e-9) => {
  close(actual[0], expected[0], eps, 'x');
  close(actual[1], expected[1], eps, 'y');
};

// A thick wall: the rectangle y ∈ [0, 1] across x ∈ [0, 10]. Its top face is
// y = 1 (free floor above), its bottom face y = 0 (free floor below).
const wall = [[0, 0], [10, 0], [10, 1], [0, 1]];
const insideRect = (r) => (p) => p[0] > r[0][0] && p[0] < r[1][0] && p[1] > r[0][1] && p[1] < r[2][1];
const ringFaces = (ring) => ring.map((a, i) => ({ a, b: ring[(i + 1) % ring.length] }));
const ctx = { faces: ringFaces(wall), inside: insideRect(wall), epsilon: 1e-5 };

test('AC2: the anchor is the point at half the polyline length', () => {
  assert.deepEqual(stripAnchor([[0, 0], [10, 0], [10, 10]]), [10, 0]);
  assert.deepEqual(stripAnchor([[0, 0], [4, 0]]), [2, 0]);
  // Unequal segments: not the vertex mean (4.67, 0.33), not the bbox centre (5, 0.5).
  closePt(stripAnchor([[0, 0], [9, 0], [9, 1]]), [5, 0]);
  // A closed strip: half of the perimeter, measured from the first vertex.
  closePt(stripAnchor([[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]]), [4, 4]);
  // Repeated points do not shift the anchor.
  closePt(stripAnchor([[0, 0], [0, 0], [4, 0], [4, 0]]), [2, 0]);
});

test('AC1 mirror: shape validity matches the backend rules', () => {
  assert.equal(validStripPoints([[0, 0], [1, 0]]), true);
  assert.equal(validStripPoints([[0, 0]]), false);
  assert.equal(validStripPoints([[0, 0], [0, 0]]), false);
  assert.equal(validStripPoints([[0, 0], [1, 0], [0, 0]]), false, 'closed with two distinct vertices');
  assert.equal(validStripPoints([[0, 0], [1, 0], [1, 1], [0, 0]]), true);
  assert.equal(validStripPoints([[0, 0], ['1', 0]]), false);
  assert.equal(validStripPoints(Array.from({ length: 51 }, (_, i) => [i, 0])), false);
  assert.equal(validStripPoints(Array.from({ length: 50 }, (_, i) => [i, 0])), true);
  assert.equal(isClosedStrip([[0, 0], [1, 0], [1, 1], [0, 0]]), true);
  assert.equal(isClosedStrip([[0, 0], [1, 0]]), false);
  assert.deepEqual(compactPoints([[0, 0], [0, 0], [1, 0]]), [[0, 0], [1, 0]]);
  assert.equal(polylineLength([[0, 0], [3, 4], [3, 10]]), 11);
});

test('AC8: offset is t/2 on a thick face, 0 on free floor and on a zero wall', () => {
  const t2 = 0.25;
  // On the top face: shifted up into the free floor.
  const top = visibleStripPath([[2, 1], [8, 1]], ctx, t2);
  assert.deepEqual(top.points, [[2, 1.25], [8, 1.25]]);
  // On the bottom face: shifted down — the side is the free floor, not a fixed sign.
  const bottom = visibleStripPath([[8, 0], [2, 0]], ctx, t2);
  assert.deepEqual(bottom.points, [[8, -0.25], [2, -0.25]]);
  // Free floor: no shift.
  assert.deepEqual(visibleStripPath([[2, 3], [8, 3]], ctx, t2).points, [[2, 3], [8, 3]]);
  // A zero-thickness wall is no body: a strip on its axis gets no offset.
  assert.deepEqual(visibleStripPath([[2, 5], [8, 5]], { faces: [{ a: [0, 5], b: [10, 5] }], inside: () => false, epsilon: 1e-5 }, t2).points,
    [[2, 5], [8, 5]]);
  // Near the face but outside epsilon is not "on the face".
  assert.deepEqual(visibleStripPath([[2, 1.001], [8, 1.001]], ctx, t2).points, [[2, 1.001], [8, 1.001]]);
});

test('AC8: a mixed strip leaves the face continuously — no gap, the stored points stay', () => {
  const t2 = 0.25;
  const stored = [[2, 1], [6, 1], [6, 4]];
  const before = JSON.stringify(stored);
  const path = visibleStripPath(stored, ctx, t2);
  // Face piece shifted, then a connector, then the free piece unshifted.
  assert.deepEqual(path.points, [[2, 1.25], [6, 1.25], [6, 1], [6, 4]]);
  for (let i = 1; i < path.points.length; i++) {
    const [a, b] = [path.points[i - 1], path.points[i]];
    assert.ok(Math.hypot(b[0] - a[0], b[1] - a[1]) > 0, 'no zero step');
  }
  assert.equal(JSON.stringify(stored), before, 'derivation never writes back');
  // A segment that only partly lies on the face splits into pieces.
  const pieces = stripPieces([[-4, 1], [4, 1]], ctx);
  assert.equal(pieces.length, 2);
  assert.equal(pieces[0].free, null);
  assert.deepEqual(pieces[1].free, [0, 1]);
  closePt(pieces[1].a, [0, 1]);
});

test('AC8: a closed strip closes through the same rule without a seam point', () => {
  const path = visibleStripPath([[2, 3], [6, 3], [6, 6], [2, 6], [2, 3]], ctx, 0.25);
  assert.equal(path.closed, true);
  assert.deepEqual(path.points, [[2, 3], [6, 3], [6, 6], [2, 6]]);
});

test('ТЗ §6: emitters sit epsilon outward on a face, cover the length, skip buried parts', () => {
  const onFace = emitterSamples([[2, 1], [8, 1]], ctx, 1);
  assert.equal(onFace.length, 7, 'every vertex plus spacing ≤ 1');
  for (const p of onFace) close(p[1], 1 + 1e-5, 1e-12, 'epsilon outward, never t/2');
  // Long strip with many vertices: every segment contributes, none is lost.
  const many = Array.from({ length: 30 }, (_, i) => [i % 2 ? 20 : 12, 3 + i]);
  const samples = emitterSamples(many, ctx, 2);
  for (const vertex of many) {
    assert.ok(samples.some((p) => Math.hypot(p[0] - vertex[0], p[1] - vertex[1]) < 1e-9), 'vertex kept');
  }
  // Partly inside the wall: the buried part emits nothing.
  const buried = emitterSamples([[5, 0.5], [5, 4]], ctx, 0.5);
  assert.ok(buried.every((p) => !ctx.inside(p)));
  assert.ok(buried.length > 0);
  assert.deepEqual(emitterSamples([[2, 0.5], [8, 0.5]], ctx, 1), [], 'entirely inside: no field');
});

const bodies = { rings: [wall], inside: insideRect(wall) };

test('AC5: a new segment stops at the first face; touching and sliding are allowed', () => {
  const hit = clampToBodies([5, 4], [5, -4], bodies);
  assert.equal(hit.stopped, true);
  closePt(hit.point, [5, 1]);
  const along = clampToBodies([1, 1], [9, 1], bodies);
  assert.equal(along.stopped, false, 'sliding along the face');
  assert.deepEqual(along.point, [9, 1]);
  const touch = clampToBodies([5, 4], [5, 1], bodies);
  assert.equal(touch.stopped, false, 'ending on the face');
  assert.equal(clampToBodies([5, 0.5], [5, 4], bodies), null, 'a start inside a body is refused');
  // Past the wall's end: free.
  assert.equal(clampToBodies([11, 4], [11, -4], bodies).stopped, false);
});

test('AC5: a fast vertex drag cannot jump the wall; neighbours are checked too', () => {
  const pts = [[2, 4], [5, 4], [8, 4]];
  const moved = clampVertexMove(pts, 1, [5, -4], bodies);
  assert.ok(moved[1] >= 1 - 1e-9, `vertex stays above the wall: ${moved}`);
  // The vertex itself may move freely, but a neighbour segment would cross.
  const sideways = clampVertexMove([[2, -4], [5, 4], [8, 4]], 1, [6, 4], bodies);
  assert.ok(!bodies.inside(sideways));
  // A closed strip: first and last are one handle; both neighbours judged.
  const ring = [[2, 4], [8, 4], [8, 8], [2, 8], [2, 4]];
  const dragged = clampVertexMove(ring, 0, [2, -2], bodies);
  assert.ok(dragged[1] >= 1 - 1e-9);
});

test('AC12: hit radius is max(22 px, t/2): 20 px hits, 30 px misses for a thin stripe', () => {
  assert.equal(stripHitRadiusPx(6), LED_HIT_MIN_CSS_PX);
  assert.equal(stripHitRadiusPx(60), 30);
  const strip = { id: 'a', points: [[0, 0], [200, 0], [200, 200]], closed: false, thicknessPx: 6 };
  assert.equal(stripHitOwner([100, 20], [strip]), 'a');
  assert.equal(stripHitOwner([100, 30], [strip]), null);
  // Round end caps: the radius applies past the free end too.
  assert.equal(stripHitOwner([-20, 0], [strip]), 'a');
  // Measured from the derived path, along its whole length incl. the corner.
  assert.equal(stripHitOwner([215, 100], [strip]), 'a');
});

test('AC12: nearest visible stripe wins; an exact tie goes to the stable id', () => {
  const a = { id: 'b-strip', points: [[0, 0], [100, 0]], closed: false, thicknessPx: 6 };
  const b = { id: 'a-strip', points: [[0, 30], [100, 30]], closed: false, thicknessPx: 6 };
  assert.equal(stripHitOwner([50, 10], [a, b]), 'b-strip');
  assert.equal(stripHitOwner([50, 15], [a, b]), 'a-strip', 'tie → smaller id');
  const loop = { id: 'loop', points: [[0, 0], [100, 0], [100, 100], [0, 100]], closed: true, thicknessPx: 6 };
  assert.equal(stripHitOwner([-10, 50], [loop]), 'loop', 'the closing edge is hit');
});
