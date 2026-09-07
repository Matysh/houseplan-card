import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PDF_SCALE_SERIES, choosePdfScale, compactRing, dimensionEdges, outsideNormal, readableAngle,
  stableDimensionEdges,
} from '../test-build/pdf/pdf-dimensions.js';

test('dimension contour compacts collinear vertices but retains every turn', () => {
  assert.deepEqual(compactRing([[0, 0], [2, 0], [4, 0], [4, 3], [0, 3]]),
    [[0, 0], [4, 0], [4, 3], [0, 3]]);
  assert.equal(dimensionEdges([[0, 0], [4, 0], [4, 3], [0, 3]], 10, false).length, 4);
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

test('external dimension normal points outside the room contour', () => {
  assert.deepEqual(outsideNormal([0, 0], [10, 0], [5, 5]), [0, -1]);
  assert.deepEqual(outsideNormal([10, 10], [0, 10], [5, 5]), [0, 1]);
});
