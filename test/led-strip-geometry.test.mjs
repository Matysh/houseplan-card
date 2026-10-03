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
  // The shifted face meets the unshifted free segment on its original line:
  // no out-and-back connector that would leave a round stub at the corner.
  assert.deepEqual(path.points, [[2, 1.25], [6, 1.25], [6, 4]]);
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

test('#787: a four-corner strip stays rectangular across a door opening', () => {
  // Opaque body faces around a door gap y=3..5 on the rectangle's right side.
  const faces = [
    { a: [0, 0], b: [10, 0] }, { a: [10, 0], b: [10, 3] },
    { a: [10, 5], b: [10, 10] }, { a: [10, 10], b: [0, 10] },
    { a: [0, 10], b: [0, 0] },
  ];
  const openingCtx = {
    faces,
    inside: ([x, y]) => (y > -1 && y < 0 && x > 0 && x < 10)
      || (x > 10 && x < 11 && ((y > 0 && y < 3) || (y > 5 && y < 10)))
      || (y > 10 && y < 11 && x > 0 && x < 10)
      || (x > -1 && x < 0 && y > 0 && y < 10),
    epsilon: 1e-5,
  };
  const stored = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
  const before = JSON.stringify(stored);
  const right = stripPieces([[10, 0], [10, 10]], openingCtx);
  assert.equal(right.length, 3, 'the opening remains a separate derived piece');
  assert.ok(right.every((piece) => JSON.stringify(piece.free) === JSON.stringify([-1, 0])),
    'the internal opening inherits the same free side from both wall faces');

  assert.deepEqual(visibleStripPath(stored, openingCtx, 0.25), {
    points: [[0.25, 0.25], [9.75, 0.25], [9.75, 9.75], [0.25, 9.75]],
    closed: true,
  }, 'shifted wall sides meet at exact miters without steps or diagonal inserts');
  assert.equal(JSON.stringify(stored), before, 'the stored four-corner contour is untouched');

  const emitters = emitterSamples([[10, 0], [10, 10]], openingCtx, 0.5);
  assert.ok(emitters.length > 0);
  for (const point of emitters) close(point[0], 10 - openingCtx.epsilon, 1e-12,
    'Glow stays on one side through the optically open doorway');
});

const rectangleFaces = (left, top, right, bottom) => {
  const ring = [[left, top], [right, top], [right, bottom], [left, bottom]];
  return {
    faces: ringFaces(ring),
    inside: ([x, y]) => x < left || x > right || y < top || y > bottom,
    epsilon: 1e-5,
  };
};

const loopOrders = (corners) => [corners, [...corners].reverse()].flatMap((order) =>
  order.map((_, start) => {
    const rotated = [...order.slice(start), ...order.slice(0, start)];
    return [...rotated, rotated[0]];
  }));

const sameLoopOutline = (actual, expected) => {
  assert.equal(actual.length, expected.length, 'no extra connector vertices');
  const cornerIndices = [];
  for (const point of actual) {
    const index = expected.findIndex((p) => Math.hypot(p[0] - point[0], p[1] - point[1]) < 1e-9);
    assert.notEqual(index, -1, `unexpected corner ${point}`);
    cornerIndices.push(index);
  }
  for (const point of expected) {
    assert.ok(actual.some((p) => Math.hypot(p[0] - point[0], p[1] - point[1]) < 1e-9),
      `missing expected corner ${point}: ${JSON.stringify(actual)}`);
  }
  const direction = (cornerIndices[1] - cornerIndices[0] + expected.length) % expected.length;
  assert.ok(direction === 1 || direction === expected.length - 1, 'no diagonal edge');
  for (let i = 1; i < cornerIndices.length; i++) {
    assert.equal((cornerIndices[i] - cornerIndices[i - 1] + expected.length) % expected.length, direction,
      'the whole outline keeps its cyclic order without crossing or retracing sides');
  }
};

test('#788: decimal loop joins are invariant to its start and traversal direction', () => {
  // Subtraction followed by addition does not reproduce .1/.2 exactly. In
  // beta.6 this lost both left miters even though all sides were on a face.
  const corners = [[0.1, 0.2], [10.3, 0.2], [10.3, 10.4], [0.1, 10.4]];
  const context = rectangleFaces(0.1, 0.2, 10.3, 10.4);
  const expected = [[0.35, 0.45], [10.05, 0.45], [10.05, 10.15], [0.35, 10.15]];
  for (const stored of loopOrders(corners)) {
    const before = JSON.stringify(stored);
    const path = visibleStripPath(stored, context, 0.25);
    assert.equal(path.closed, true);
    sameLoopOutline(path.points, expected);
    assert.equal(JSON.stringify(stored), before, 'saved coordinates are untouched');
  }
});

test('#788: a slightly tilted free side meets shifted faces without stubs or silent straightening', () => {
  // Synthetic minimal neighbour of the field report: only the left side is
  // not parallel to the wall, while top/bottom/right lie exactly on faces.
  const corners = [[0.14, 0.2], [0.1, 10.4], [10.3, 10.4], [10.3, 0.2]];
  const context = rectangleFaces(0.1, 0.2, 10.3, 10.4);
  const topX = 0.14 - (0.04 * 0.25) / 10.2;
  const bottomX = 0.1 + (0.04 * 0.25) / 10.2;
  const expected = [[topX, 0.45], [bottomX, 10.15], [10.05, 10.15], [10.05, 0.45]];
  for (const stored of loopOrders(corners)) {
    const before = JSON.stringify(stored);
    const path = visibleStripPath(stored, context, 0.25);
    sameLoopOutline(path.points, expected);
    assert.notEqual(topX, bottomX, 'the original nonzero tilt is retained');
    assert.equal(JSON.stringify(stored), before, 'rendering never snaps the saved shape');
  }
});

test('#788: an unsafe almost-parallel wall/free turn keeps a bounded connector', () => {
  const stored = [[2, 1], [8, 1], [2, 1.01]];
  const path = visibleStripPath(stored, ctx, 0.25);
  assert.equal(path.closed, false);
  assert.ok(path.points.every(([x, y]) => x >= 2 && x <= 8 && y >= 1 && y <= 1.25),
    'a far-away line intersection must not create a long miter spike');
  assert.deepEqual(path.points, [[2, 1.25], [8, 1.25], [8, 1], [2, 1.01]]);
});

test('#788: sub-epsilon collinear subdivisions cannot create a wall/free stub', () => {
  const expected = [[2, 1.25], [6, 1.25], [6, 4]];
  for (const step of [0.1, 1e-3, 1e-6, 1e-10]) {
    for (const stored of [
      [[2, 1], [2 + step, 1], [6, 1], [6, 4]],
      [[2, 1], [6, 1], [6, 1 + step], [6, 4]],
    ]) {
      const before = JSON.stringify(stored);
      for (const reversed of [false, true]) {
        const path = visibleStripPath(reversed ? [...stored].reverse() : stored, ctx, 0.25);
        const want = reversed ? [...expected].reverse() : expected;
        assert.equal(path.closed, false);
        assert.equal(path.points.length, want.length, 'a short intermediate step cannot turn into a connector');
        path.points.forEach((p, i) => closePt(p, want[i]));
      }
      assert.equal(JSON.stringify(stored), before, 'only the visible derivation is simplified');
    }
  }
});

test('#788: duplicate vertices and coincident faces preserve a closed offset loop', () => {
  const corners = [[0.1, 0.2], [10.3, 0.2], [10.3, 10.4], [0.1, 10.4]];
  const context = rectangleFaces(0.1, 0.2, 10.3, 10.4);
  // A catalog split or overlapping body may provide the same face more than
  // once and in either direction. It must not alter the free side or closure.
  context.faces.push(...context.faces.map(({ a, b }) => ({ a: b, b: a })));
  const expected = [[0.35, 0.45], [10.05, 0.45], [10.05, 10.15], [0.35, 10.15]];
  for (const order of loopOrders(corners)) {
    const stored = order.flatMap((p) => [p, [...p]]);
    const before = JSON.stringify(stored);
    const path = visibleStripPath(stored, context, 0.25);
    assert.equal(path.closed, true);
    sameLoopOutline(path.points, expected);
    assert.ok(path.points.every((p) => !context.inside(p)), 'the whole visible loop stays in free floor');
    assert.equal(JSON.stringify(stored), before);
  }
});

test('#788: a doorway split closer than the offset to a corner cannot reverse the stripe', () => {
  const context = {
    faces: [
      { a: [0, 0], b: [10, 0] }, { a: [10, 0], b: [10, 0.1] },
      { a: [10, 5], b: [10, 10] }, { a: [10, 10], b: [0, 10] },
      { a: [0, 10], b: [0, 0] },
    ],
    inside: ([x, y]) => (y < 0 && x > 0 && x < 10)
      || (x > 10 && (y < 0.1 || y > 5))
      || (y > 10 && x > 0 && x < 10) || (x < 0 && y > 0 && y < 10),
    epsilon: 1e-5,
  };
  const corners = [[0, 0], [10, 0], [10, 10], [0, 10]];
  const expected = [[0.25, 0.25], [9.75, 0.25], [9.75, 9.75], [0.25, 9.75]];
  for (const stored of loopOrders(corners)) {
    const before = JSON.stringify(stored);
    const path = visibleStripPath(stored, context, 0.25);
    sameLoopOutline(path.points, expected);
    assert.equal(JSON.stringify(stored), before);
  }
  assert.equal(stripPieces([[10, 0], [10, 10]], context).length, 3,
    'physical face/gap classification still exists for emitters; only the visible line is coalesced');
});

test('#788: rotated rectangle matrix has no numerical free tails at face endpoints', () => {
  let checked = 0, failed = 0;
  const examples = [];
  for (let n = 0; n < 1000; n++) {
    const angle = (n * 0.137) % 6.28;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const width = 10.13 + n % 7, height = 7.89 + n % 11;
    const rotate = ([x, y]) => [0.13 + x * cos - y * sin, 0.27 + x * sin + y * cos];
    const corners = [[0, 0], [width, 0], [width, height], [0, height]].map(rotate);
    const expected = [[0.25, 0.25], [width - 0.25, 0.25],
      [width - 0.25, height - 0.25], [0.25, height - 0.25]].map(rotate);
    const context = {
      faces: ringFaces(corners), epsilon: 1e-5,
      inside: ([x, y]) => {
        const px = (x - 0.13) * cos + (y - 0.27) * sin;
        const py = -(x - 0.13) * sin + (y - 0.27) * cos;
        return px < 0 || px > width || py < 0 || py > height;
      },
    };
    for (const stored of loopOrders(corners)) {
      const before = JSON.stringify(stored);
      const pieces = stripPieces(stored, context);
      const path = visibleStripPath(stored, context, 0.25);
      const correct = pieces.length === 4 && pieces.every((piece) => piece.free)
        && path.points.length === 4 && expected.every((p) =>
          path.points.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-8));
      checked++;
      if (!correct) {
        failed++;
        if (examples.length < 3) examples.push({ n, pieces: pieces.length, visible: path.points.length });
      } else sameLoopOutline(path.points, expected);
      assert.equal(JSON.stringify(stored), before, 'rotation never changes stored coordinates');
    }
  }
  assert.equal(checked, 8000, '1000 rotations, four starts, two directions');
  assert.equal(failed, 0, `${failed}/${checked} rotated loops failed; examples ${JSON.stringify(examples)}`);
});

test('#788: numerical endpoint tolerance does not absorb real leading or trailing gaps', () => {
  const from = [0.1, 0.2], to = [10.1, 1.2];
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const along = (distance) => [from[0] + (to[0] - from[0]) * distance / length,
    from[1] + (to[1] - from[1]) * distance / length];
  for (const gap of [1e-8, 1e-5, 0.1]) {
    const context = {
      faces: [{ a: along(gap), b: along(length - gap) }], epsilon: 1e-5,
      inside: ([x, y]) => (to[0] - from[0]) * (y - from[1]) - (to[1] - from[1]) * (x - from[0]) < 0,
    };
    for (const stored of [[from, to], [to, from]]) {
      const pieces = stripPieces(stored, context);
      assert.equal(pieces.length, 3, `both ${gap}-unit real gaps remain separate`);
      assert.equal(pieces[0].free, null);
      assert.ok(pieces[1].free);
      assert.equal(pieces[2].free, null);
      close(Math.hypot(pieces[0].b[0] - pieces[0].a[0], pieces[0].b[1] - pieces[0].a[1]), gap, 1e-12);
      close(Math.hypot(pieces[2].b[0] - pieces[2].a[0], pieces[2].b[1] - pieces[2].a[1]), gap, 1e-12);
    }
  }
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
