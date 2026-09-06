import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveZeroWalls, zeroWallHasOpening, zeroWallStyleOf,
} from '../test-build/zero-walls.js';

const model = {
  rooms: [
    { id: 'left', poly: [[0, 0], [500, 0], [500, 1000], [0, 1000]] },
    { id: 'right', poly: [[500, 0], [1000, 0], [1000, 1000], [500, 1000]] },
  ],
  wall_segments: [
    { id: 'shared-zero', a: [500, 0], b: [500, 1000], cm: 0 },
    { id: 'positive', a: [0, 0], b: [500, 0], cm: 15 },
  ],
  partitions: [{ id: 'free-zero', a: [100, 200], b: [400, 200], cm: 0 }],
};

test('missing/unknown style is dashed and every current cm:0 source shares the policy', () => {
  assert.equal(zeroWallStyleOf({}), 'dashed');
  assert.equal(zeroWallStyleOf({ zero_wall_style: 'future' }), 'dashed');
  const result = resolveZeroWalls({}, model, 1000, 0.1);
  assert.equal(result.style, 'dashed');
  assert.equal(result.contour.length, 1);
  assert.equal(result.lines.length, 2);
  assert.equal(result.barriers.length, 0);
  assert.deepEqual(result.transmissive, result.contour);
});

test('solid style keeps identical geometry and turns every zero axis into a barrier', () => {
  const dashed = resolveZeroWalls({}, model, 1000, 0.1);
  const solid = resolveZeroWalls({ zero_wall_style: 'solid' }, model, 1000, 0.1);
  assert.deepEqual(solid.lines, dashed.lines);
  assert.deepEqual(solid.contour, dashed.contour);
  assert.deepEqual(solid.barriers, solid.lines);
  assert.deepEqual(solid.transmissive, []);
});

test('legacy open spans project read-only into the same contour answer', () => {
  const legacy = resolveZeroWalls({
    open_spans: [{ a: [0.5, 0.25], b: [0.5, 0.75] }],
  }, { ...model, wall_segments: [] }, 1000, 0.1);
  assert.deepEqual(legacy.contour, [[500, 250, 500, 750]]);
});

test('opening host guard is exact and ignores another carrier', () => {
  const openings = [{ host: { kind: 'partition', id: 'p1', t: 0.5 } }];
  assert.equal(zeroWallHasOpening(openings, { kind: 'partition', id: 'p1' }), true);
  assert.equal(zeroWallHasOpening(openings, { kind: 'wall', id: 'p1' }), false);
});
