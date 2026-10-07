import test from 'node:test';
import assert from 'node:assert/strict';
import { nodeMoveLocalSpaces, buildNodePreview, nodePreviewScene } from '../test-build/wall-node-preview.js';
import { applyNodeMove, prepareNodeMove, structuralWallNodes } from '../test-build/wall-node-move.js';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';

test('local production preview keeps complete far-end junctions and excludes remote geometry', () => {
  const before = commitWallSegmentModel({ spaces: [{ id: 'f', rooms: [
    { id: 'local', poly: [[0, 0], [1, 0], [1, 1], [0, 1]] },
    { id: 'remote', poly: [[10, 10], [11, 10], [11, 11], [10, 11]] },
  ], partitions: [{ id: 'local-wall', a: [0.25, 0.25], b: [0.75, 0.25], cm: 25 },
    { id: 'far-end-neighbour', a: [0.75, 0.25], b: [0.75, 0.75], cm: 15 },
    { id: 'remote-wall', a: [10.25, 10.25], b: [10.75, 10.25], cm: 25 }] }], markers: [], settings: {} }).config.spaces[0];
  const nodes = structuralWallNodes(before), node = nodes.find(n => n.point[0] === .25 && n.point[1] === .25);
  const moved = applyNodeMove(prepareNodeMove(before, node, nodes), [.3, .35], null);
  assert.equal(moved.ok, true);
  const [localBefore, localNext] = nodeMoveLocalSpaces(before, moved.space);
  assert.deepEqual(localBefore.rooms.map(r => r.id), ['local']);
  assert.deepEqual(localNext.partitions.map(w => w.id), ['local-wall', 'far-end-neighbour']);
  assert.equal(buildNodePreview(localNext).safe, true);
  assert.deepEqual(before.rooms.map(r => r.id), ['local', 'remote']);
  assert.deepEqual(moved.space.partitions[2], before.partitions[2]);
});
test('zero-only preview uses the production style and preserves zero wall identity', () => {
  for (const style of ['solid', 'dashed']) {
    const before = { id: 'f', rooms: [], wall_segments: [], zero_wall_style: style,
      partitions: [{ id: 'zero', a: [0, 0], b: [1, 0], cm: 0 }] };
    const next = { ...before, partitions: [{ ...before.partitions[0], a: [0, .25] }] };
    const scene = nodePreviewScene(buildNodePreview(before), buildNodePreview(next),
      { px: 1, color: 'black', fill: 'white', opacity: 1, amount: () => 0 });
    assert.deepEqual(scene.oldZeroD, ['M0 0L1000 0']);
    assert.ok(scene.walls.values.includes(`zero-walls ${style}`));
  }
});
