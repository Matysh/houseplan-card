import assert from 'node:assert/strict';
import test from 'node:test';
import { LARGE_HOUSE_COUNTS, makeLargeHouseFixture } from '../demo/fixtures/large-house.mjs';

test('large-house fixture meets the HP-PERF-01 reference counts', () => {
  const fixture = makeLargeHouseFixture();
  const count = (field) => fixture.config.spaces.reduce((sum, space) => sum + (space[field]?.length || 0), 0);

  assert.equal(fixture.config.spaces.length, LARGE_HOUSE_COUNTS.floors);
  assert.equal(count('rooms'), LARGE_HOUSE_COUNTS.rooms);
  assert.equal(count('openings'), LARGE_HOUSE_COUNTS.openings);
  assert.equal(count('partitions'), LARGE_HOUSE_COUNTS.partitions);
  assert.equal(count('wall_columns'), LARGE_HOUSE_COUNTS.columns);
  assert.equal(count('decor'), LARGE_HOUSE_COUNTS.decor);
  assert.equal(Object.keys(fixture.devices).length, LARGE_HOUSE_COUNTS.devices);
  assert.equal(Object.keys(fixture.entities).length, LARGE_HOUSE_COUNTS.devices);
});

test('large-house fixture is deterministic and geometry ids are unique per space', () => {
  const first = makeLargeHouseFixture();
  const second = makeLargeHouseFixture();
  assert.deepEqual(first, second);

  for (const space of first.config.spaces) {
    const ids = ['rooms', 'openings', 'partitions', 'wall_columns', 'decor']
      .flatMap((field) => space[field].map((item) => item.id));
    assert.equal(new Set(ids).size, ids.length, space.id);
  }
});
