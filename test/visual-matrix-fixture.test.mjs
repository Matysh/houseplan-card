import assert from 'node:assert/strict';
import test from 'node:test';
import { makeVisualMatrixFixture, VISUAL_MATRIX_COUNTS } from '../demo/fixtures/visual-matrix.mjs';

test('visual matrix fixture is deterministic and covers its declared geometry', () => {
  const first = makeVisualMatrixFixture();
  const second = makeVisualMatrixFixture();
  const count = (field) => first.config.spaces.reduce((sum, space) => sum + (space[field]?.length || 0), 0);
  assert.deepEqual(first, second);
  assert.equal(first.config.spaces.length, VISUAL_MATRIX_COUNTS.spaces);
  assert.equal(count('rooms'), VISUAL_MATRIX_COUNTS.rooms);
  assert.equal(count('openings'), VISUAL_MATRIX_COUNTS.openings);
  assert.equal(count('partitions'), VISUAL_MATRIX_COUNTS.partitions);
  assert.equal(count('wall_columns'), VISUAL_MATRIX_COUNTS.columns);
});

test('visual matrix fixture keeps geometry ids unique per space', () => {
  for (const space of makeVisualMatrixFixture().config.spaces) {
    const ids = ['rooms', 'openings', 'partitions', 'wall_columns', 'decor']
      .flatMap((field) => (space[field] || []).map((item) => item.id));
    assert.equal(new Set(ids).size, ids.length, space.id);
  }
});
