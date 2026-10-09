import test from 'node:test';
import assert from 'node:assert/strict';
import { insetContour, outsetContour, inwardNormal } from '../test-build/wall-thickness.js';

const rotate = ([x, y], turns) => turns === 0 ? [x, y]
  : turns === 1 ? [-y, x] : turns === 2 ? [-x, -y] : [y, -x];
const contours = [['inset', insetContour, 1], ['outset', outsetContour, -1]];

function rectangleExpected(poly, offset, sign) {
  const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
  const left = Math.min(...xs), right = Math.max(...xs);
  const bottom = Math.min(...ys), top = Math.max(...ys);
  return poly.map(([x, y]) => [
    x === left ? left + sign * offset : right - sign * offset,
    y === bottom ? bottom + sign * offset : top - sign * offset,
  ]);
}

// The ordinary parametric formula is the oracle only for non-axial coordinates.
// Exact axes instead have the independent literal-coordinate oracle above.
function offsetIntersection(poly, index, offset, sign) {
  const previous = (index + poly.length - 1) % poly.length;
  const point = edge => {
    const normal = inwardNormal(poly, edge), origin = poly[edge];
    return origin.map((v, k) => sign > 0 ? v + normal[k] * offset : v - normal[k] * offset);
  };
  const direction = edge => {
    const a = poly[edge], b = poly[(edge + 1) % poly.length];
    const delta = [b[0] - a[0], b[1] - a[1]], length = Math.hypot(...delta);
    return delta.map(v => v / length);
  };
  const p = point(previous), q = point(index), r = direction(previous), s = direction(index);
  const cross = r[0] * s[1] - r[1] * s[0];
  const t = ((q[0] - p[0]) * s[1] - (q[1] - p[1]) * s[0]) / cross;
  return { p, q, r, s, hit: [p[0] + t * r[0], p[1] + t * r[1]] };
}

test('834 exact axial contour joins retain literal faces in both windings and all quarter turns', () => {
  const base = [[-397 / 240 * 1000, -1 / 3], [503 / 240 * 1000, -1 / 3],
    [503 / 240 * 1000, 1000 + 1 / 3], [-397 / 240 * 1000, 1000 + 1 / 3]];
  for (const turns of [0, 1, 2, 3]) for (const reverse of [false, true]) {
    const poly = base.map(point => rotate(point, turns));
    if (reverse) poly.reverse();
    const before = structuredClone(poly), offset = 0.01;
    for (const [label, contour, sign] of contours) {
      assert.deepEqual(contour(poly, poly.map(() => offset)), rectangleExpected(poly, offset, sign),
        `${label}: ${turns * 90} degrees, reverse=${reverse}; no floating tail on either face`);
    }
    assert.deepEqual(poly, before, 'the exact-coordinate repair never rewrites author geometry');
  }
});

test('834 axial face coordinates survive wide spans without cancellation', () => {
  const poly = [[-1_000_000.1, -1 / 3], [1_000_000.3, -1 / 3],
    [1_000_000.3, 1000 + 1 / 3], [-1_000_000.1, 1000 + 1 / 3]];
  for (const [label, contour, sign] of contours) {
    const actual = contour(poly, [0.01, 0.01, 0.01, 0.01]);
    assert.deepEqual(actual, rectangleExpected(poly, 0.01, sign), label);
  }
});

test('834 one-ULP near-axis direction remains oblique instead of snapping', () => {
  const base = [[0, 0], [2, 0], [2, 1 + Number.EPSILON], [0, 1]], offset = .4;
  for (const turns of [0, 1, 2, 3]) {
    const poly = base.map(point => rotate(point, turns)), component = turns % 2 ? 0 : 1;
    for (const [label, contour, sign] of contours) {
      const expected = offsetIntersection(poly, 3, offset, sign);
      assert.notEqual(expected.r[component], 0, 'the perturbed direction is genuinely nonzero');
      assert.ok(Math.abs(expected.r[component]) < 1e-12, 'a tolerance-based axis shortcut would wrongly include it');
      assert.notEqual(expected.hit[component], expected.p[component], 'the fixture observes accidental axis forcing');
      assert.equal(contour(poly, [offset, offset, offset, offset])[3][component], expected.hit[component],
        `${label}: ${turns * 90} degrees preserves the non-axial intersection coordinate`);
    }
  }
});

test('834 genuinely oblique joins retain the ordinary intersection formula', () => {
  const base = [[.1, .2], [7.3, 1.1], [5.8, 8.4], [-1.2, 6.6]], offset = .05;
  for (const poly of [base, [...base].reverse()]) for (const [label, contour, sign] of contours) {
    const expected = poly.map((_, index) => offsetIntersection(poly, index, offset, sign).hit);
    assert.deepEqual(contour(poly, poly.map(() => offset)), expected, label);
  }
});

test('834 negative-zero axis inputs preserve the same physical faces and untouched input', () => {
  const negative = [[-0, -0], [2, -0], [2, 2], [-0, 2]], positive = [[0, 0], [2, 0], [2, 2], [0, 2]];
  for (const [, contour] of contours) {
    assert.deepEqual(contour(negative, [.01, .01, .01, .01]), contour(positive, [.01, .01, .01, .01]));
    assert.deepEqual(contour(negative, [0, 0, 0, 0]), negative, 'zero-depth remains an exact copy');
  }
  assert.ok(Object.is(negative[0][0], -0) && Object.is(negative[0][1], -0));
});

test('834 non-finite contour inputs retain invalid geometry rather than gaining finite axis joins', () => {
  const poly = [[0, 0], [2, 0], [2, Infinity], [0, 2]];
  assert.deepEqual(insetContour(poly, [.01, .01, .01, .01]), [
    [-.01, -.01], [2, -.01], [NaN, 0], [NaN, Infinity], [NaN, Infinity], [NaN, 2], [-.01, 2],
  ]);
  assert.deepEqual(outsetContour(poly, [.01, .01, .01, .01]), [
    [.01, .01], [2, .01], [NaN, 0], [NaN, Infinity], [NaN, Infinity], [NaN, 2], [.01, 2],
  ]);
});
