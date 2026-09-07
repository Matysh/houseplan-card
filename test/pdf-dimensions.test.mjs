import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PDF_SCALE_SERIES, areOppositeDimensionEdges, choosePdfScale, compactRing,
  dedupeOppositeDimensionEdges, dimensionEdges, dimensionEpsilonUnits, inwardNormalForEdge,
  groupCollinearDimensionEdges, projectDimensionEdge, readableAngle, stableDimensionEdges,
} from '../test-build/pdf/pdf-dimensions.js';
import { NEAR_AXIS_MAX_SLOPE } from '../test-build/near-axis.js';

test('dimension contour compacts collinear vertices but retains every turn', () => {
  assert.deepEqual(compactRing([[0, 0], [2, 0], [4, 0], [4, 3], [0, 3]]),
    [[0, 0], [4, 0], [4, 3], [0, 3]]);
  assert.equal(dimensionEdges([[0, 0], [4, 0], [4, 3], [0, 3]], 10, false).length, 4);
});

test('1 mm physical duplicate normalization precedes fixed-point collinear cleanup', () => {
  const epsilon = dimensionEpsilonUnits(2);
  assert.equal(epsilon, 0.05, '1 mm is 0.1 cm divided by cm-per-render-unit');
  const input = [[0, 0], [10, 0], [10.04, 0.02], [10, 10], [0, 10]];
  const snapshot = structuredClone(input);
  assert.deepEqual(compactRing(input, epsilon), [[0, 0], [10, 0], [10, 10], [0, 10]],
    'the near duplicate is collapsed before its two adjacent turns are inspected');
  assert.deepEqual(input, snapshot, 'print normalization must not mutate config geometry');

  assert.deepEqual(compactRing([
    [0, 0], [10, 0], [10, 10], [0, 10], [0.02, 0.01],
  ], epsilon), [[0, 0], [10, 0], [10, 10], [0, 10]], 'the ring seam is normalized too');
  assert.deepEqual(compactRing([
    [0, 0], [10, 0], [10, 0.04], [20, 0], [20, 10], [0, 10],
  ], epsilon), [[0, 0], [20, 0], [20, 10], [0, 10]],
  'a tiny spur is collapsed before the newly exposed straight edge is compacted');
  assert.equal(compactRing([
    [0, 0], [5, 0], [10, 0], [10, 5], [10, 10], [0, 10], [0, 5],
  ], epsilon).length, 4, 'collinear cleanup reaches a fixed point');
});

test('compaction removes only forward collinear vertices and retains a real reversal', () => {
  const ring = [[0, 0], [10, 0], [5, 0], [5, 10], [0, 10]];
  assert.ok(compactRing(ring, 0.01).some(([x, y]) => x === 10 && y === 0),
    'a positive-length U-turn is not a redundant point');
});

test('a non-finite ring fails closed instead of bridging a phantom dimension', () => {
  const ring = [[0, 0], [4, 0], [Number.NaN, 2], [4, 4], [0, 4]];
  const snapshot = structuredClone(ring);

  assert.deepEqual(compactRing(ring, 0.01), [],
    'compaction cannot represent a broken contour and deterministically rejects the whole ring');
  assert.deepEqual(compactRing(ring, 0.01), [], 'repeated compaction has the same result');
  assert.deepEqual(dimensionEdges(ring, 10, false), [],
    'the neighbours around the corrupt vertex must not become a synthetic edge');
  assert.deepEqual(stableDimensionEdges(ring, 10, false), [],
    'numbered callouts use the same fail-closed normalization');
  assert.deepEqual(ring, snapshot, 'rejecting corrupt print geometry must not mutate config');

  assert.deepEqual(dimensionEdges([
    [0, 0], [4, 0], [4, Number.POSITIVE_INFINITY], [0, 4],
  ], 10, false), [], 'all non-finite coordinates invalidate the ring');
});

test('dimension candidates use the canonical 0.25 degree axis boundary only', () => {
  const atBoundary = [[0, 0], [100, 100 * NEAR_AXIS_MAX_SLOPE], [100, 50], [0, 50]];
  const accepted = dimensionEdges(atBoundary, 1, false, { ringIndex: 9 });
  const projected = accepted.find((edge) => edge.source.edgeIndex === 0);
  assert.ok(projected, 'the inclusive canonical boundary is eligible');
  assert.equal(projected.axis, 'horizontal');
  assert.deepEqual(projected.sourceA, atBoundary[0]);
  assert.deepEqual(projected.sourceB, atBoundary[1]);
  assert.equal(projected.projectedLength, 100, 'length is the major projection, not the chord');
  assert.equal(projected.a[1], projected.b[1], 'near-axis print geometry passes through midpoint');

  const aboveBoundary = [[0, 0], [100, 100 * NEAR_AXIS_MAX_SLOPE * 1.000001],
    [100, 50], [0, 50]];
  assert.equal(dimensionEdges(aboveBoundary, 1, false, { ringIndex: 9 })
    .some((edge) => edge.source.edgeIndex === 0), false);
  assert.equal(projectDimensionEdge([0, 0], [10, 10]), null, 'true diagonals have no projection');

  const diagonalCorner = [[0, 0], [10, 10], [10, 20], [0, 20]];
  const diagonalEdges = dimensionEdges(diagonalCorner, 1, false);
  assert.equal(diagonalEdges.some((edge) => edge.source.edgeIndex === 0), false);
  assert.equal(diagonalEdges.length, 3, 'filtering a diagonal must not connect its neighbours by a chord');
});

test('dimension candidates retain stable pre-compaction source identity', () => {
  const ring = [[0, 0], [5, 0], [10, 0], [10, 10], [0, 10]];
  const snapshot = structuredClone(ring);
  const top = dimensionEdges(ring, 1, false, { ringIndex: 7 })
    .find((edge) => edge.axis === 'horizontal' && edge.normalCoordinate === 0);
  assert.ok(top);
  assert.deepEqual(top.source, { ringIndex: 7, edgeIndex: 0 });
  assert.deepEqual(top.sourceEdgeIndices, [0, 1]);
  assert.match(top.stableKey, /^horizontal\|0\|1\|7\|0$/);
  assert.deepEqual(ring, snapshot);
});

test('parallel steps on different facade lines receive independent dimension lanes', () => {
  const epsilon = 0.1;
  const edges = dimensionEdges([
    [0, 1], [2, 1], [2, 0], [4, 0], [4, 3], [0, 3],
  ], 10, false, { epsilon });
  const upwardFacing = edges.filter((edge) => edge.axis === 'horizontal'
    && edge.inwardNormal[1] > 0);
  assert.equal(upwardFacing.length, 2, 'the stepped facade exposes two parallel top edges');
  assert.equal(groupCollinearDimensionEdges(upwardFacing, epsilon).length, 2,
    'parallel edges at distinct normal coordinates are not coupled into one lane');

  const nearlySameLine = { ...upwardFacing[0],
    normalCoordinate: upwardFacing[0].normalCoordinate + epsilon / 2 };
  assert.deepEqual(groupCollinearDimensionEdges([upwardFacing[0], nearlySameLine], epsilon)
    .map((group) => group.length), [2], 'sub-millimetre projection noise remains one line');
});

test('30 cm threshold belongs to internal edge labels', () => {
  const edges = dimensionEdges([[0, 0], [2, 0], [2, 10], [0, 10]], 10, false);
  assert.equal(edges[0].short, true);
  assert.equal(edges[1].short, false);
});

test('angles stay readable and scale is selected from the standard series', () => {
  assert.equal(readableAngle([1, 0], [0, 0]), 0);
  assert.ok(PDF_SCALE_SERIES.includes(choosePdfScale(1000, 500, 273, 160)));
  assert.ok(choosePdfScale(100000, 100000, 100, 100) > 500);
});

test('numbered callout edge order is clockwise and stable across ring rotation', () => {
  const ring = [[4, 0], [4, 3], [0, 3], [0, 0]];
  const rotated = [[0, 3], [0, 0], [4, 0], [4, 3]];
  const signature = (value) => stableDimensionEdges(value, 10, false)
    .map((edge) => `${edge.a.join(',')}>${edge.b.join(',')}:${edge.text}`);
  assert.deepEqual(signature(ring), signature(rotated));
  assert.deepEqual(stableDimensionEdges([...ring].reverse(), 10, false)
    .map((edge) => [edge.a, edge.b]), stableDimensionEdges(ring, 10, false)
    .map((edge) => [edge.a, edge.b]));
});

test('concave inward normals are selected by local point-in-ring probes', () => {
  const cShape = [[0, 0], [6, 0], [6, 2], [2, 2], [2, 4], [6, 4], [6, 6], [0, 6]];
  assert.deepEqual(inwardNormalForEdge(cShape, [6, 2], [2, 2], 0.01), [0, -1]);
  assert.deepEqual(inwardNormalForEdge(cShape, [2, 4], [6, 4], 0.01), [0, 1]);
});

test('opposite dimension dedupe is local, geometric and placement-aware', () => {
  const rectangle = [[0, 0], [10, 0], [10, 6], [0, 6]];
  const edges = dimensionEdges(rectangle, 1, false, { ringIndex: 4 });
  assert.equal(edges.length, 4);
  assert.equal(areOppositeDimensionEdges(edges[0], edges[2], rectangle, 0.1), true);
  assert.equal(areOppositeDimensionEdges(edges[0], edges[1], rectangle, 0.1), false,
    'equal-looking adjacent axes are not an opposite pair');

  const defaultKept = dedupeOppositeDimensionEdges(edges, { ring: rectangle, epsilon: 0.1 });
  assert.equal(defaultKept.length, 2);
  assert.deepEqual(new Set(defaultKept.map((edge) => edge.axis)), new Set(['horizontal', 'vertical']),
    'a square keeps one value on each axis rather than globally deduping equal text');
  const shuffledKept = dedupeOppositeDimensionEdges([...edges].reverse(), {
    ring: rectangle, epsilon: 0.1,
  });
  assert.deepEqual([...defaultKept.map((edge) => edge.stableKey)].sort(),
    [...shuffledKept.map((edge) => edge.stableKey)].sort(), 'full ties use stable source keys');

  const preferred = dedupeOppositeDimensionEdges(edges, {
    ring: rectangle,
    epsilon: 0.1,
    score: (edge) => ({
      hardCollisions: edge.source.edgeIndex < 2 ? 0 : 1,
      normalClearance: edge.source.edgeIndex < 2 ? 5 : 100,
    }),
  });
  assert.deepEqual(preferred.map((edge) => edge.source.edgeIndex), [0, 1],
    'hard collisions outrank normal clearance');
});

test('opposite dedupe preserves equal non-opposite L/C contour spans and separate rings', () => {
  const cShape = [[0, 0], [6, 0], [6, 2], [2, 2], [2, 4], [6, 4], [6, 6], [0, 6]];
  const cEdges = dimensionEdges(cShape, 1, false, { ringIndex: 0 });
  assert.equal(dedupeOppositeDimensionEdges(cEdges, { ring: cShape, epsilon: 0.1 }).length,
    cEdges.length, 'matching spans separated by the open notch are not paired');

  const square = [[0, 0], [10, 0], [10, 10], [0, 10]];
  const first = dedupeOppositeDimensionEdges(
    dimensionEdges(square, 1, false, { ringIndex: 1 }), { ring: square, epsilon: 0.1 },
  );
  const second = dedupeOppositeDimensionEdges(
    dimensionEdges(square, 1, false, { ringIndex: 2 }), { ring: square, epsilon: 0.1 },
  );
  assert.equal([...first, ...second].length, 4, 'equal dimensions in separate local rings survive');
});
