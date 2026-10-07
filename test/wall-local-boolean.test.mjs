import test from 'node:test';
import assert from 'node:assert/strict';
import { union, intersection, difference } from 'polyclip-ts';
import { unionLocalWallGeometry, intersectLocalWallGeometry, subtractLocalWallGeometry } from '../test-build/wall-local-boolean.js';

const rect = (x, y, w, h) => [[[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]];
test('local wall booleans equal the original library for disjoint, touching, holed and nested components', () => {
  const subjects = [union(rect(0, 0, 2, 2), rect(10, 10, 2, 2)),
    difference(rect(0, 0, 4, 4), rect(1, 1, 2, 2))];
  const clips = [rect(20, 20, 1, 1), rect(2, 0, 1, 1), rect(.5, .5, 1, 1),
    rect(-1, -1, 15, 15), union(rect(.5, .5, 1, 1), rect(30, 30, 1, 1))];
  for (const own of subjects) for (const clip of clips) {
    const before = structuredClone([own, clip]);
    for (const [local, original] of [[unionLocalWallGeometry, union],
      [intersectLocalWallGeometry, intersection], [subtractLocalWallGeometry, difference]]) {
      const actual = local(own, clip), expected = original(own, clip);
      assert.deepEqual(union(actual), expected);
    }
    assert.deepEqual([own, clip], before, 'caller-owned canonical polygons stay immutable');
  }
});
test('a bridge merges every touched component; empty clips preserve exact geometry', () => {
  const own = union(rect(0, 0, 2, 2), rect(3, 0, 2, 2), rect(100, 100, 2, 2));
  const bridge = rect(1, .5, 3, 1);
  assert.deepEqual(union(unionLocalWallGeometry(own, bridge)), union(own, bridge));
  assert.deepEqual(subtractLocalWallGeometry(own, []), own);
  assert.deepEqual(intersectLocalWallGeometry(own, []), []);
  assert.deepEqual(unionLocalWallGeometry([], own), own);
});
