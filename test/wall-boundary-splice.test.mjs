import test from 'node:test';
import assert from 'node:assert/strict';
import { difference, union } from 'polyclip-ts';
import { prepareWallBoundarySplice, spliceWallBooleanBoundary } from '../test-build/wall-boundary-splice.js';

const rect = (x0, y0, x1, y1) => [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]];
const counts = geometry => geometry.map(polygon => polygon.length).sort((a, b) => a - b);
const freeze = value => {
  if (Array.isArray(value)) { value.forEach(freeze); Object.freeze(value); }
  return value;
};
const sameMaterial = (actual, expected) => {
  assert.deepEqual(difference(actual, expected), [], 'no additional material, including filled holes');
  assert.deepEqual(difference(expected, actual), [], 'no lost material');
};
const frozenCall = (before, current, fixed, baseline) => {
  const inputs = [before, current, fixed, baseline], snapshot = structuredClone(inputs);
  freeze(inputs);
  const result = spliceWallBooleanBoundary(...inputs);
  assert.deepEqual(inputs, snapshot, 'proof never mutates caller-owned canonical operands/results');
  return result;
};

// The helper's provenance precondition is supplied by its caller. Every input
// here is an actual successful clipping result, not an invented self-crossing
// ring intended to bypass that precondition. Operation/provenance cache tests
// belong to the wrapper; these tests exercise the geometric proof itself.
function exchangingHoles() {
  const [leftHole] = rect(1, 1, 2, 2), [rightHole] = rect(8, 1, 9, 2);
  const before = union(difference(rect(0, 0, 4, 4), [leftHole]),
    difference(rect(6, 0, 10, 4), [rightHole]));
  const left = [[0, -2], [9.3, -2], [9.3, 2.5], [7, 2.5], [7, 0],
    [.5, 0], [.5, .4], [0, .4], [0, -2]];
  const right = [[.75, .5], [3, .5], [3, 3.5], [9.5, 3.5], [9.5, 3],
    [10, 3], [10, 6], [.75, 6], [.75, .5]];
  const current = union(difference([left], [rightHole]), difference([right], [leftHole]));
  return { before, current, leftHole, rightHole };
}

test('#834 boundary splice changes local masonry while preserving real fixed cuts and owned holes', () => {
  const before = difference(rect(0, 0, 10, 10), rect(2, 2, 3, 3));
  const current = difference(rect(0, 0, 12, 10), rect(2, 2, 3, 3));
  const fixed = [union(rect(-1, 4, 2, 6)), union(rect(5, 5, 6, 6)), union(rect(100, 100, 101, 101))];
  const baseline = difference(before, ...fixed), expected = difference(current, ...fixed);
  const result = frozenCall(before, current, fixed, baseline);
  assert.ok(result, 'certified local difference is actually reused');
  sameMaterial(result, expected);
  assert.deepEqual(counts(result), [3], 'both the authored hole and the independent cut survive');
  const expectedCopy = structuredClone(result);
  result[0][0][0][0] += 1000;
  sameMaterial(spliceWallBooleanBoundary(before, current, fixed, baseline), expectedCopy);
  assert.deepEqual(baseline, difference(before, ...fixed), 'mutating the returned copy cannot poison the baseline');
});

test('#834 boundary splice also preserves union material and resolves rings without array-index identity', () => {
  const before = union(rect(0, 0, 2, 2), difference(rect(10, 10, 12, 12), rect(10.5, 10.5, 11, 11)));
  const current = union(rect(0, 0, 2, 2), difference(rect(-2, 10, 12, 12), rect(10.5, 10.5, 11, 11)));
  const fixed = [union(rect(50, 50, 51, 51))];
  assert.equal(before[0][0][0][0], 0);
  assert.equal(current[0][0][0][0], -2, 'canonical component order really changes');
  const result = frozenCall(before, current, fixed, union(before, ...fixed));
  assert.ok(result, 'stable edge ownership, not the new component index, identifies the old ring');
  sameMaterial(result, union(current, ...fixed));
  assert.deepEqual(counts(result), [1, 1, 2]);
});

test('#834 boundary splice accepts the canonical outer-hole-island-hole hierarchy', () => {
  const island = difference(rect(5, 5, 8, 8), rect(6, 6, 7, 7));
  const before = union(difference(rect(0, 0, 20, 20), rect(2, 2, 18, 18)), island);
  const current = union(difference(rect(0, 0, 22, 20), rect(2, 2, 18, 18)), island);
  const fixed = [union(rect(-1, 9, 1, 10))];
  const result = frozenCall(before, current, fixed, difference(before, ...fixed));
  assert.ok(result, 'a legitimate island inside a hole is not an overlapping outer');
  sameMaterial(result, difference(current, ...fixed));
  assert.deepEqual(counts(result), [2, 2]);
});

test('#834 separate changed-edge boxes cannot hide enclosure or removal of a fixed component', () => {
  const small = union(rect(-10, -10, 0, 10)), large = union(rect(-10, -10, 10, 10));
  const fixed = [union(rect(2, 2, 3, 3))];
  // Every changed edge separately misses B. Their ONE global support box
  // contains B: A1 encloses it without any individual changed edge touching it.
  for (const operation of [difference, union]) for (const [before, current] of [[small, large], [large, small]]) {
    const baseline = operation(before, ...fixed), expected = operation(current, ...fixed);
    assert.notDeepEqual(counts(baseline), counts(expected), 'this is a real component/hole topology change');
    assert.equal(frozenCall(before, current, fixed, baseline), null,
      'both removed and added edge support must be separated from every fixed operand');
  }
});

test('#834 unchanged ring counts and edge owners cannot hide A input hole migration', () => {
  const { before, current } = exchangingHoles(), fixed = [union(rect(100, 100, 101, 101))];
  assert.deepEqual(counts(before), [2, 2]);
  assert.deepEqual(counts(current), [2, 2]);
  // Each new outer retains a directed piece of exactly one old outer. The
  // unchanged hole rings switch actual parent, despite all counts matching.
  assert.equal(frozenCall(before, current, fixed, difference(before, ...fixed)), null);
});

test('#834 result holes cannot migrate between B-split components even when A ownership is unchanged', () => {
  const exchanged = exchangingHoles();
  const bridge = union(rect(-2, .1, .25, .3), rect(-2, .1, -1.8, 20), rect(-2, 19.8, 12, 20),
    rect(11.8, 3.1, 12, 20), rect(9.75, 3.1, 12, 3.3));
  const before = union(exchanged.before, bridge), current = union(exchanged.current, bridge);
  const fixed = [union(rect(4, 19, 6, 22))];
  const baseline = difference(before, ...fixed), expected = difference(current, ...fixed);
  assert.deepEqual(counts(before), [3]);
  assert.deepEqual(counts(current), [3], 'both unchanged A holes still have the same sole A outer');
  assert.deepEqual(counts(baseline), [2, 2]);
  assert.deepEqual(counts(expected), [2, 2], 'count-only output proof cannot distinguish this case');
  // The old implementation attached each surviving hole to its old R0 owner.
  // Use containment against each bare outer to build that wrong assignment
  // without assuming how polyclip orders components or ring start vertices.
  const leftOldOwner = baseline.find(polygon => difference([exchanged.leftHole], [polygon[0]]).length === 0);
  const currentOuterWithLeftStem = expected.find(polygon =>
    polygon[0].some(point => point[0] === -2 && point[1] === .1));
  assert.ok(leftOldOwner && currentOuterWithLeftStem);
  const wrong = expected.map(polygon => [polygon[0], polygon === currentOuterWithLeftStem
    ? exchanged.leftHole.slice().reverse() : exchanged.rightHole.slice().reverse()]);
  sameMaterial(difference(wrong, expected), union([exchanged.leftHole], [exchanged.rightHole]));
  assert.deepEqual(difference(expected, wrong), [], 'the broken result specifically fills both holes');
  assert.equal(frozenCall(before, current, fixed, baseline), null,
    'fresh canonical A ownership does not prove the new result hierarchy');
});

test('#834 changed support rejects exact contact and a one-ULP overlap without an epsilon gap', () => {
  const before = union(rect(0, 0, 10, 10)), current = union(rect(0, 0, 12, 10));
  const ulp = 2 ** -49;
  assert.equal((12 + ulp) - 12, ulp);
  for (const x of [12, 12 - ulp]) {
    const fixed = [union(rect(x, 4, 13, 5))];
    assert.equal(frozenCall(before, current, fixed, difference(before, ...fixed)), null,
      'touch and overlap are not strictly separated');
  }
  const fixed = [union(rect(12 + ulp, 4, 13, 5))];
  const result = frozenCall(before, current, fixed, difference(before, ...fixed));
  assert.ok(result, 'a real one-ULP separation is not rounded to a contact');
  sameMaterial(result, difference(current, ...fixed));
});

test('#834 a clipped changing diagonal takes the canonical fallback instead of guessing segment identity', () => {
  const before = union([[[0, 0], [10, 10], [0, 10], [0, 0]]]);
  const current = union([[[0, 0], [11, 10], [0, 10], [0, 0]]]);
  const fixed = [union(rect(4, 3, 6, 7))];
  const baseline = difference(before, ...fixed), expected = difference(current, ...fixed);
  assert.ok(expected.length && baseline.length, 'both full canonical operations succeed');
  assert.notDeepEqual(expected, baseline, 'the diagonal change has an observable result');
  assert.equal(frozenCall(before, current, fixed, baseline), null);
});

test('#834 unchanged boundary reuse returns an independent copy of the canonical baseline', () => {
  const before = difference(rect(-4, -4, 8, 8), rect(1, 1, 2, 2));
  const current = union(before), fixed = [union(rect(-5, 4, -3, 6))];
  const baseline = difference(before, ...fixed), result = frozenCall(before, current, fixed, baseline);
  assert.ok(result);
  assert.deepEqual(result, baseline);
  result[0][0][0][0] += 100;
  assert.notDeepEqual(result, baseline, 'returned points are not aliases into the recorded baseline');
  sameMaterial(spliceWallBooleanBoundary(before, current, fixed, baseline), difference(current, ...fixed));
});

test('#834 prepared boundary proof owns frozen inputs and never aliases results or candidates', () => {
  const before = difference(rect(0, 0, 10, 10), rect(2, 2, 3, 3));
  const current = difference(rect(0, 0, 12, 10), rect(2, 2, 3, 3));
  const fixed = [union(rect(-1, 4, 2, 6))], baseline = difference(before, ...fixed);
  const expected = difference(current, ...fixed), currentSnapshot = structuredClone(current);
  const prepared = prepareWallBoundarySplice(before, fixed, baseline);
  assert.equal(typeof prepared, 'function');
  before[0][0][0][0] = NaN;
  fixed[0][0][0][0][0] = NaN;
  baseline[0][0][0][0] = NaN;
  const result = prepared(current);
  assert.ok(result, 'caller mutations cannot poison the privately owned baseline');
  sameMaterial(result, expected);
  assert.deepEqual(current, currentSnapshot);
  result[0][0][0][0] = Infinity;
  sameMaterial(prepared(current), expected);
  current[0][0][0][0] = NaN;
  assert.equal(prepared(current), null, 'each candidate is freshly validated, never cached by reference');
  sameMaterial(prepared(currentSnapshot), expected);
});

test('#834 prepared boundary proof refuses malformed frozen inputs', () => {
  const valid = union(rect(0, 0, 2, 2)), invalid = structuredClone(valid);
  invalid[0][0][0][0] = NaN;
  assert.equal(prepareWallBoundarySplice(invalid, [], valid), null);
  assert.equal(prepareWallBoundarySplice(valid, [], invalid), null);
  assert.equal(prepareWallBoundarySplice(valid, [invalid], valid), null);
});
