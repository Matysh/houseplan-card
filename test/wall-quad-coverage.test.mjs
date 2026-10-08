import test from 'node:test';
import assert from 'node:assert/strict';
import { union, difference } from 'polyclip-ts';
import { wallQuadCovered } from '../test-build/wall-quad-coverage.js';
import { geometryArea } from '../test-build/physical-geometry.js';

const quad = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const polygon = points => [[...points, points[0]]];
const rect = (x, y, w, h) => polygon(quad(x, y, w, h));

test('#834 covered convex strips include exact axis-aligned boundary and remain immutable', () => {
  const geometry = union(rect(0, 0, 10, 10)), before = structuredClone(geometry);
  for (const strip of [quad(1, 1, 2, 3), quad(0, 0, 10, 1), quad(0, 0, 10, 10)]) {
    assert.equal(wallQuadCovered(strip, geometry), true);
    assert.equal(geometryArea(difference(polygon(strip), geometry)), 0, 'independent exact clipping proves no omitted masonry');
  }
  const diamond = [[1, 2], [2, 1], [3, 2], [2, 3]];
  assert.equal(geometryArea(difference(polygon(diamond), geometry)), 0, 'the diagonal strip really is covered');
  assert.equal(wallQuadCovered(diamond, geometry), false,
    'no single quad halfplane separates a long outer segment: conservative clipping fallback');
  assert.deepEqual(geometry, before);
});

test('#834 containment never hides a hole, concave bay, crossing or gap between components', () => {
  const holed = difference(rect(0, 0, 10, 10), rect(4, 4, 2, 2));
  assert.equal(wallQuadCovered(quad(1, 1, 8, 8), holed), false, 'hole wholly inside a strip with covered vertices');
  assert.equal(wallQuadCovered(quad(1, 4, 8, 2), holed), false, 'strip crosses the hole');
  assert.equal(wallQuadCovered(quad(4, 4, 2, 2), holed), false, 'a strip exactly matching a floor hole is not masonry');
  const cornerHole = difference(rect(-1, -1, 12, 12), [[[0, 0], [3, 0], [0, 3], [0, 0]]]);
  assert.equal(wallQuadCovered(quad(0, 0, 10, 10), cornerHole), false,
    'a hole with vertices on the strip boundary and an edge inside it is not covered');
  const adversarial = [[0, 0], [4, 1], [0, 4], [-1, 3]];
  const longBoundary = difference(rect(-30, -30, 60, 80),
    [[[0, -20], [0, 40], [-20, 40], [-20, 3], [-1, 3], [-1, -20], [0, -20]]]);
  assert.ok(geometryArea(difference(polygon(adversarial), longBoundary)) > 0,
    'the long hole boundary removes a real wedge despite covered quad vertices and centre');
  assert.equal(wallQuadCovered(adversarial, longBoundary), false,
    'a boundary through quad vertices is not proved safe by an outside midpoint');
  assert.equal(wallQuadCovered(quad(0, 0, 10, 4), holed), true, 'a real hole boundary may touch the strip');
  const bay = union([[[0, 0], [10, 0], [10, 10], [7, 10], [7, 3], [3, 3], [3, 10], [0, 10], [0, 0]]]);
  assert.equal(wallQuadCovered(quad(1, 2, 8, 7), bay), false, 'all four corners alone would miss the exterior bay');
  const islands = union(rect(0, 0, 2, 2), rect(4, 0, 2, 2));
  assert.equal(wallQuadCovered(quad(1, .5, 4, 1), islands), false);
  assert.equal(wallQuadCovered(quad(-1, 1, 2, 2), holed), false);
  assert.equal(wallQuadCovered([[0, 0], [1, 0], [0, 0], [0, 1]], holed), false, 'degenerate strip');
  assert.equal(wallQuadCovered([[0, 0], [1, 0], [NaN, 1], [0, 1]], holed), false);
});

test('#834 containment decisions agree with full clipping across boundaries and hole corners', () => {
  const body = union(difference(rect(-2, -2, 8, 8), rect(0, 0, 2, 2)), rect(10, 0, 2, 2));
  let proved = 0, refused = 0;
  for (const x of [-3, -2, -1, 0, 1, 2, 4, 5, 9, 10]) for (const y of [-3, -2, -1, 0, 1, 2, 4, 5]) {
    const strip = quad(x, y, 1, 1), covered = wallQuadCovered(strip, body);
    if (covered) {
      proved++;
      assert.equal(geometryArea(difference(polygon(strip), body)), 0, `false coverage at ${x},${y}`);
    } else refused++;
  }
  assert.ok(proved > 20 && refused > 20, 'both optimization and fallback are exercised');
});

test('#834 underflow and subnormal orientation products remain unproved', () => {
  for (const width of [1e-200, 1e-160]) {
    const height = 1 / width;
    const strip = quad(0, 0, width, height);
    const enclosingBody = [[[[0, -width], [width, -width], [width, height], [0, height], [0, -width]]]];
    assert.equal(wallQuadCovered(strip, enclosingBody), false,
      'a numerically unproved separator falls back even if the shape looks covered');
  }
  assert.equal(wallQuadCovered([[0, 0, 1], [1, 0], [1, 1], [0, 1]], [rect(0, 0, 2, 2)]), false);
});
