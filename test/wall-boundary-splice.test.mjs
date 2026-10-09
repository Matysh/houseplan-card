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
  assert.deepEqual(inputs, snapshot, 'proof never mutates caller-owned operands/results');
  return result;
};

// Production provenance is checked by the wrapper and remains a precondition
// of the reuse/material cases below. The explicit malformed-candidate cases
// additionally exercise this helper's own defensive crossing proof; they do
// not claim that the canonical production wrapper emits those candidates.
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

const cross = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
const strictlyCross = (a, b, c, d) => cross(a, b, c) * cross(a, b, d) < 0
  && cross(c, d, a) * cross(c, d, b) < 0;
function refusesAddedEdges(before, current) {
  const fixed = [union(rect(100, 100, 101, 101))], baseline = difference(before, ...fixed);
  const prepared = prepareWallBoundarySplice(before, fixed, baseline);
  assert.equal(typeof prepared, 'function', 'the successful canonical baseline is reusable');
  const inputs = [before, current, fixed, baseline], snapshot = structuredClone(inputs);
  freeze(inputs);
  assert.equal(prepared(current), null, 'prepared reuse rejects the malformed new edge arrangement');
  assert.equal(spliceWallBooleanBoundary(...inputs), null, 'one-shot reuse has the same crossing guard');
  assert.deepEqual(inputs, snapshot);
}

test('#834 added edges cannot self-cross inside one reconstructed ring', () => {
  const before = union(rect(0, 0, 10, 10));
  const ring = [[0, 0], [10, 0], [10, 10], [2, 2], [8, 2], [0, 10], [0, 0]];
  assert.equal(strictlyCross(ring[2], ring[3], ring[4], ring[5]), true,
    'the two new diagonals cross strictly inside both segments at (5,5)');
  const current = [[ring]], normalized = union(current);
  assert.notDeepEqual(normalized, current, 'full clipping removes the self-crossing boundary');
  assert.ok(normalized[0][0].some(p => p[0] === 5 && p[1] === 5));
  refusesAddedEdges(before, current);
});

test('#834 added edges cannot cross between two reconstructed outer rings', () => {
  const before = union(rect(0, 0, 4, 4), rect(6, 0, 10, 4));
  const left = [[0, 0], [4, 0], [8, 3], [4, 4], [0, 4], [0, 0]];
  const right = [[6, 0], [10, 0], [10, 4], [6, 4], [5, -2], [6, 0]];
  assert.equal(strictlyCross(left[1], left[2], right[3], right[4]), true);
  assert.equal(strictlyCross(left[2], left[3], right[3], right[4]), true);
  // Each ring alone is a valid canonical polygon. Their newly introduced
  // crossings are between rings, away from all retained baseline edges.
  const current = [union([left])[0], union([right])[0]];
  assert.equal(before.length, 2); assert.equal(current.length, 2);
  assert.equal(union(current).length, 1, 'the full canonical operation merges the overlapping components');
  refusesAddedEdges(before, current);
});

test('#834 adjacent added edges cannot overlap beyond their common endpoint', () => {
  const before = union(rect(0, 0, 10, 10));
  const ring = [[0, 0], [10, 0], [10, 10], [2, 2], [6, 6], [0, 10], [0, 0]];
  assert.equal(cross(ring[2], ring[3], ring[4]), 0);
  assert.ok(ring[4][0] > ring[3][0] && ring[4][0] < ring[2][0],
    '(2,2)→(6,6) retraces part of the new (10,10)→(2,2) segment');
  assert.notDeepEqual(union([[ring]]), [[ring]], 'canonical clipping removes the overlapping retrace');
  refusesAddedEdges(before, [[ring]]);
});

test('#834 an added endpoint cannot land in the interior of another added edge', () => {
  const before = union(rect(0, 0, 10, 10));
  const ring = [[0, 0], [10, 0], [10, 10], [2, 2], [8, 2], [6, 6], [0, 10], [0, 0]];
  assert.equal(cross(ring[2], ring[3], ring[5]), 0);
  assert.ok(ring[5][0] > ring[3][0] && ring[5][0] < ring[2][0]);
  assert.notEqual(cross(ring[2], ring[3], ring[4]), 0,
    'the arriving segment is non-collinear: this is endpoint-interior contact, not overlap');
  refusesAddedEdges(before, [[ring]]);
});

test('#834 consecutive added edges may share their ordinary common endpoint', () => {
  const before = union(rect(0, 0, 10, 10));
  const current = union([[[0, 0], [10, 0], [12, 8], [10, 10], [0, 10], [0, 0]]]);
  const fixed = [union(rect(100, 100, 101, 101))], baseline = difference(before, ...fixed);
  const expected = difference(current, ...fixed);
  assert.ok(current[0][0].some(p => p[0] === 12 && p[1] === 8), 'two new edges meet at the new corner');
  const result = frozenCall(before, current, fixed, baseline);
  assert.ok(result, 'an ordinary shared endpoint is not a crossing or overlap');
  sameMaterial(result, expected);
  const prepared = prepareWallBoundarySplice(before, fixed, baseline);
  assert.equal(typeof prepared, 'function');
  sameMaterial(prepared(current), expected);
});

test('#834 boundary area keeps exact decimal signs through cancellation and mixed coordinate scales', () => {
  const origin = 1e8, ulp = 2 ** -26;
  const a = [origin, origin], b = [origin + 1, origin + 1];
  const tiny = union(rect(-2e-20, -2e-20, -1e-20, -1e-20));
  const before = union(tiny, [[a, b, [origin + 2, origin + 3], a]]);
  const fixed = [union(rect(2e8, 2e8, 2e8 + 1, 2e8 + 1))];
  const baseline = difference(before, ...fixed);
  const prepared = prepareWallBoundarySplice(before, fixed, baseline);
  assert.equal(typeof prepared, 'function');
  for (const delta of [ulp, -ulp, 0]) {
    const c = [origin + 2, origin + 2 + delta], ring = [a, b, c, a];
    let floatingArea = 0;
    for (let i = 1; i < ring.length; i++)
      floatingArea += ring[i - 1][0] * ring[i][1] - ring[i][0] * ring[i - 1][1];
    assert.equal(floatingArea, 0, 'ordinary Number shoelace loses both nonzero signs');
    assert.equal(Math.sign(c[1] - c[0]), Math.sign(delta), 'the exact determinant sign is known independently');
    const current = [...tiny, [ring]], normalized = union(current);
    const result = frozenCall(before, current, fixed, baseline);
    if (delta > 0) {
      assert.equal(normalized.length, 2, 'the thin nonzero triangle remains real material');
      assert.ok(result, 'the shared decimal scale must preserve a positive sign, not round it to zero');
      sameMaterial(result, difference(normalized, ...fixed));
      sameMaterial(prepared(current), result);
    } else {
      // These deliberately malformed candidates retain the old directed edge
      // but reverse or collapse the ring. Canonical provenance is not claimed.
      assert.equal(result, null, 'opposite and zero signs never reuse the old positive owner');
      assert.equal(prepared(current), null);
    }
  }
});

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
