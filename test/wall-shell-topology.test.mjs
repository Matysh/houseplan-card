import test from 'node:test';
import assert from 'node:assert/strict';
import { union, difference } from 'polyclip-ts';
import { canonicalComputedWallGeometry, unionWallShellGeometry } from '../test-build/wall-shell-union.js';
import { sameWallOperandTopology } from '../test-build/wall-operand-topology.js';
import { geometryArea, pointInPhysicalGeometry } from '../test-build/physical-geometry.js';

const rect = (x, y, width, height) => [[[x, y], [x + width, y],
  [x + width, y + height], [x, y + height], [x, y]]];
const ringCounts = geometry => geometry.map(polygon => polygon.length).sort((a, b) => a - b);
const deepFreeze = value => {
  if (Array.isArray(value)) { value.forEach(deepFreeze); Object.freeze(value); }
  return value;
};
const owner = (geometry, point) => geometry.findIndex(polygon =>
  pointInPhysicalGeometry(point, [[polygon[0]]]));

// Both operands are genuine canonical clipping results, not malformed rings.
// Rounding removes A's thin neck and joins its right lobe to independent B.
// One hole therefore changes component while counts remain exactly [2, 3].
function migratingHole() {
  const quantum = 1e-6;
  const a = difference(union(rect(0, 0, 10, 10), rect(20, 0, 10, 10),
    rect(9, 5 - .2 * quantum, 12, .4 * quantum)), rect(2, 2, 6, 6), rect(22, 2, 6, 6));
  const b = difference(rect(20, 10 + .2 * quantum, 10, 10), rect(22, 12, 6, 6));
  const source = union(a, b);
  const rounded = source.map(polygon => polygon.map(ring => ring.map(point =>
    point.map(value => Math.round(value / quantum) * quantum))));
  return { source, candidate: union(rounded), quantum };
}

test('#834 canonical retry rejects hole ownership migration even when sorted ring counts are unchanged', () => {
  const { source, candidate } = migratingHole(), before = structuredClone(source);
  assert.deepEqual(union(source), source, 'the source is already a canonical, valid clipping result');
  assert.deepEqual(ringCounts(source), [2, 3]);
  assert.deepEqual(ringCounts(candidate), ringCounts(source), 'the former count-only guard cannot distinguish this result');
  const left = [5, 5], right = [25, 5], upper = [25, 15];
  assert.equal(owner(source, left), owner(source, right), 'both lower holes initially belong to A');
  assert.notEqual(owner(source, right), owner(source, upper), 'B initially owns the upper hole independently');
  assert.notEqual(owner(candidate, left), owner(candidate, right), 'A splits at the rounded neck');
  assert.equal(owner(candidate, right), owner(candidate, upper), 'the right hole migrates into the component joined to B');
  for (const point of [left, right, upper]) {
    assert.ok(owner(source, point) >= 0 && owner(candidate, point) >= 0);
    assert.equal(pointInPhysicalGeometry(point, source), false);
    assert.equal(pointInPhysicalGeometry(point, candidate), false, 'mere survival of every hole is insufficient');
  }
  deepFreeze(source);
  assert.throws(() => canonicalComputedWallGeometry(source, 1000), /changed boolean topology/);
  assert.deepEqual(source, before, 'a rejected retry cannot edit caller-owned coordinates');
});

test('#834 an ownership-changing repair preserves the original error without calling merge a second time', () => {
  const { source } = migratingHole(), shell = [rect(40, 0, 2, 2)];
  const before = structuredClone([source, shell]), original = new Error('original shell clipping failure');
  deepFreeze(source); deepFreeze(shell);
  let attempts = 0;
  assert.throws(() => unionWallShellGeometry(source, shell, 1000, (...operands) => {
    if (++attempts === 1) throw original;
    return union(...operands);
  }), error => error === original);
  assert.equal(attempts, 1, 'unproved operand topology never reaches the repaired merge');
  assert.deepEqual([source, shell], before);
});

function reshapeRing(ring, { start = 0, reverse = false, collinear = false }) {
  let points = ring.slice(0, -1).map(point => [...point]);
  if (collinear) points = points.flatMap((point, index) => {
    const next = points[(index + 1) % points.length];
    return [point, [(point[0] + next[0]) / 2, (point[1] + next[1]) / 2]];
  });
  points = [...points.slice(start), ...points.slice(0, start)];
  if (reverse) points.reverse();
  return [...points, [...points[0]]];
}

test('#834 topology identity permits component/hole order, ring starts, winding and collinear simplification', () => {
  const diamond = [[[20, 5], [25, 0], [30, 5], [25, 10], [20, 5]]];
  const expected = union(difference(rect(0, 0, 12, 12), rect(2, 2, 2, 2), rect(7, 7, 3, 3)),
    difference(diamond, rect(23, 3, 4, 4)));
  const variants = [
    { name: 'component and hole order', reorder: true },
    { name: 'different start vertex', start: 2 },
    { name: 'reverse winding', reverse: true },
    { name: 'collinear subdivisions', collinear: true },
    { name: 'all representation changes together', reorder: true, start: 3, reverse: true, collinear: true },
  ];
  for (const variant of variants) {
    let source = expected.map(polygon => polygon.map(ring => reshapeRing(ring, variant)));
    if (variant.reorder) source = source.reverse().map(([outer, ...holes]) => [outer, ...holes.reverse()]);
    const before = structuredClone(source); deepFreeze(source);
    const result = canonicalComputedWallGeometry(source, 1000);
    assert.deepEqual(difference(result, expected), [], `${variant.name}: no new material`);
    assert.deepEqual(difference(expected, result), [], `${variant.name}: no lost material`);
    assert.deepEqual(ringCounts(result), [2, 3], variant.name);
    for (const point of [[3, 3], [8, 8], [25, 5]])
      assert.equal(pointInPhysicalGeometry(point, result), false, `${variant.name}: preserved hole`);
    for (const point of [[1, 1], [21, 5]])
      assert.equal(pointInPhysicalGeometry(point, result), true, `${variant.name}: preserved outer`);
    assert.deepEqual(source, before, `${variant.name}: frozen input unchanged`);
  }
});

test('#834 topology keys bind each hole to its own equal-sized outer, not a global bag of rings', () => {
  const [left] = rect(0, 0, 10, 10), [right] = rect(20, 0, 10, 10);
  const [leftHole] = rect(2, 2, 2, 2), [rightHole] = rect(22, 2, 2, 2);
  const before = [[left, leftHole], [right, rightHole]];
  // Direct comparator adversary: the same literal rings assigned to other
  // owners. It need not be a legal clipping result to test the proof boundary.
  const reassigned = [[left, rightHole], [right, leftHole]];
  const allRings = geometry => geometry.flat().map(ring => JSON.stringify(ring)).sort();
  assert.deepEqual(ringCounts(before), ringCounts(reassigned));
  assert.deepEqual(allRings(before), allRings(reassigned));
  deepFreeze(before); deepFreeze(reassigned);
  assert.equal(sameWallOperandTopology(before, reassigned), false);
  assert.equal(sameWallOperandTopology(reassigned, before), false);
});

test('#834 equal-area equal-vertex holes cannot move and outer/hole roles cannot swap', () => {
  const [outer] = rect(0, 0, 10, 10), [hole] = rect(2, 2, 2, 2), [moved] = rect(3, 2, 2, 2);
  assert.equal(hole.length, moved.length);
  assert.equal(geometryArea([[hole]]), geometryArea([[moved]]));
  const before = [[outer, hole]], translated = [[outer, moved]], roleSwap = [[hole, outer]];
  assert.deepEqual(ringCounts(before), ringCounts(translated));
  assert.deepEqual(ringCounts(before), ringCounts(roleSwap));
  for (const after of [translated, roleSwap]) {
    deepFreeze(after);
    assert.equal(sameWallOperandTopology(deepFreeze(before), after), false);
    assert.equal(sameWallOperandTopology(after, before), false);
  }
});

test('#834 exact decimal collinear subdivision is removable but a one-ULP bend is not', () => {
  const first = [.1, .2], middle = [.2, .3], last = [.3, .4], corner = [.5, .2];
  const subdivided = [[[first, middle, last, corner, first]]];
  const simplified = [[[first, last, corner, first]]];
  const bentY = .3 + 2 ** -54;
  assert.equal(bentY - .3, 2 ** -54, 'exactly one binary64 ULP at 0.3');
  const bent = [[[first, [.2, bentY], last, corner, first]]];
  const frozen = structuredClone([subdivided, simplified, bent]);
  deepFreeze(subdivided); deepFreeze(simplified); deepFreeze(bent);
  assert.equal(sameWallOperandTopology(subdivided, simplified), true,
    'polyclip decimal coordinates .1/.2, .2/.3, .3/.4 lie exactly on one line');
  assert.equal(sameWallOperandTopology(simplified, subdivided), true);
  assert.equal(sameWallOperandTopology(bent, simplified), false, 'no epsilon or post-result rounding may erase the bend');
  assert.equal(sameWallOperandTopology(simplified, bent), false);
  assert.deepEqual([subdivided, simplified, bent], frozen);
  const a = [-1e-7, -2e-7], b = [-2e-7, -3e-7], c = [-3e-7, -4e-7], d = [-5e-7, -2e-7];
  assert.equal(sameWallOperandTopology([[[a, b, c, d, a]]], [[[a, c, d, a]]]), true,
    'negative scientific-notation coordinates obey the same exact decimal line proof');
});

test('#834 exact collinear retraces preserve filled polygons but a one-ULP excursion does not', () => {
  const simple = [rect(0, 1, 4, 4)];
  const spike = [[[[0, 1], [4, 1], [2, 1], [4, 1], [4, 5], [0, 5], [0, 1]]]];
  assert.deepEqual(difference(simple, spike), [], 'returning over an exact line removes no filled area');
  assert.deepEqual(difference(spike, simple), [], 'returning over an exact line adds no filled area');
  deepFreeze(simple); deepFreeze(spike);
  assert.equal(sameWallOperandTopology(spike, simple), true);
  assert.equal(sameWallOperandTopology(simple, spike), true);
  const y = 1 + 2 ** -52;
  assert.equal(y - 1, 2 ** -52, 'one ULP above the horizontal edge');
  const excursion = [[[[0, 1], [2, y], [4, 1], [4, 5], [0, 5], [0, 1]]]];
  assert.ok(difference(simple, excursion).length > 0, 'independent clipping sees the nonzero-area excursion');
  deepFreeze(excursion);
  assert.equal(sameWallOperandTopology(excursion, simple), false);
  assert.equal(sameWallOperandTopology(simple, excursion), false);
});

test('#834 reduced two-room step 5 retains its hole while dropping an exact computed retrace', () => {
  const outer = [[-1733.3333329999998, 2958.333333], [-395.833333, 2958.333333],
    [-395.833333, 2962.5], [-395.833333, 2245.833333], [1100, 2245.833333],
    [1100, 3929.166667], [-353.672236, 3929.166667],
    [-1733.3333329999998, 3950.9967469999997], [-1733.3333329999998, 2958.333333]];
  const hole = [[-1608.333333, 3083.333333], [-1608.333333, 3824.003253],
    [-354.661098, 3804.166667], [1016.666667, 3804.166667], [1016.666667, 2329.166667],
    [-312.5, 2329.166667], [-312.5, 3083.333333], [-1608.333333, 3083.333333]];
  const computed = [[outer, hole]], normalized = [[outer.filter((_, index) => index !== 2), hole]];
  const before = structuredClone([computed, normalized]);
  assert.deepEqual(union(computed), normalized, 'real clipping removes exactly the retraced vertex');
  assert.deepEqual(difference(computed, normalized), []);
  assert.deepEqual(difference(normalized, computed), []);
  assert.equal(pointInPhysicalGeometry([0, 3500], computed), false);
  assert.equal(pointInPhysicalGeometry([0, 3500], normalized), false);
  deepFreeze(computed); deepFreeze(normalized);
  assert.equal(sameWallOperandTopology(computed, normalized), true);
  assert.equal(sameWallOperandTopology(normalized, computed), true);
  assert.deepEqual([computed, normalized], before);
});

test('#834 topology proof rejects invalid, non-finite and unclosed rings on either side', () => {
  const valid = [rect(0, 0, 4, 4)];
  const open = structuredClone(valid); open[0][0].pop();
  const infinite = structuredClone(valid); infinite[0][0][1][0] = Infinity;
  const nan = structuredClone(valid); nan[0][0][1][1] = NaN;
  const wrongDimension = structuredClone(valid); wrongDimension[0][0][1].push(1);
  const tooShort = [[[[0, 0], [1, 0], [0, 0]]]];
  const collapsed = [[[[0, 0], [1, 1], [2, 2], [0, 0]]]];
  for (const invalid of [open, infinite, nan, wrongDimension, tooShort, collapsed, [[]], [[[]]]]) {
    deepFreeze(invalid);
    assert.equal(sameWallOperandTopology(invalid, valid), false);
    assert.equal(sameWallOperandTopology(valid, invalid), false);
    assert.equal(sameWallOperandTopology(invalid, invalid), false, 'identical invalid data is not a topology proof');
  }
});
