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
  assert.equal(count('stairs'), LARGE_HOUSE_COUNTS.stairs);
  assert.equal(fixture.config.spaces[0].stairs.length, 250, 'one floor exercises the backend cap');
  assert.equal(Object.keys(fixture.devices).length, LARGE_HOUSE_COUNTS.devices);
  assert.equal(Object.keys(fixture.entities).length, LARGE_HOUSE_COUNTS.devices);
  assert.equal(fixture.config.markers.length > 0, true);
  assert.equal(fixture.config.markers.every((marker) => marker.is_light === true), true);
  assert.equal(makeLargeHouseFixture({ includeStairs: false }).config.spaces
    .some((space) => space.stairs?.length), false, 'visual goldens can omit the stress-only collection');
});

test('large-house fixture is deterministic and geometry ids are unique per space', () => {
  const first = makeLargeHouseFixture();
  const second = makeLargeHouseFixture();
  assert.deepEqual(first, second);

  for (const space of first.config.spaces) {
    const ids = ['rooms', 'openings', 'partitions', 'wall_columns', 'decor', 'stairs']
      .flatMap((field) => (space[field] || []).map((item) => item.id));
    assert.equal(new Set(ids).size, ids.length, space.id);
  }
});

test('#1344 medium shares the canonical fixture with accurate bounded counts', () => {
  const options = { floors: 1, roomsPerFloor: 12, devices: 60, openings: 24, decor: 60, includeStairs: false };
  const fixture = makeLargeHouseFixture(options);
  assert.deepEqual(fixture, makeLargeHouseFixture(options));
  assert.equal(fixture.config.spaces.length, 1);
  assert.equal(fixture.config.spaces[0].rooms.length, 12);
  assert.equal(fixture.config.spaces[0].openings.length, 24);
  assert.equal(fixture.config.spaces[0].decor.length, 60);
  assert.equal(Object.keys(fixture.devices).length, 60);
  assert.equal(Object.keys(fixture.states).length, 60);
  assert.equal(fixture.counts.stairs, 0);
  const areas = new Set(fixture.config.spaces[0].rooms.map(room => room.area));
  assert.ok(Object.values(fixture.devices).every(device => areas.has(device.area_id)));
  assert.ok(Object.values(fixture.layout).every(item => item.s === fixture.config.spaces[0].id));
  assert.throws(() => makeLargeHouseFixture({ roomsPerFloor: 0 }), /Invalid fixture/);
});
