import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { roomOpeningHostFixture } from './helpers/room-opening-host-fixture.mjs';
import { checkSpacePhysicalGeometry } from '../test-build/plan-geometry-preflight.js';
const captured = JSON.parse(readFileSync(new URL('./fixtures/996-room-opening-host-candidates.json', import.meta.url), 'utf8'));

for (const type of ['door', 'window']) for (const reverse of [false, true]) {
  test(`#996 ${type}, reversed=${reverse}: deletion and face promotion retain physical identity`, () => {
    const { before, deleted, recreated } = roomOpeningHostFixture(type, reverse);
    const expected = captured.find(c => c.type === type && c.reverse === reverse);
    assert.deepEqual({ type, reverse, before, deleted, recreated }, expected, 'Python consumes the exact frontend candidates');
    for (const config of [before, deleted, recreated]) assert.equal(checkSpacePhysicalGeometry(config, 'floor').ok, true);
    const original = before.spaces[0], kept = deleted.spaces[0], after = recreated.spaces[0];
    const opening = original.openings[0], id = opening.host.id;
    assert.equal(kept.rooms.length, 1);
    assert.equal(kept.openings[0].host.kind, 'partition');
    assert.equal(kept.openings[0].host.id, id);
    assert.equal(after.rooms.length, 2);
    assert.equal(after.openings[0].host.kind, 'wall');
    assert.equal(after.openings[0].host.id, id);
    for (const space of [kept, after]) {
      const { host, ...fields } = space.openings[0];
      const { host: _originalHost, ...expected } = opening;
      assert.deepEqual(fields, expected);
      const wall = (host.kind === 'wall' ? space.wall_segments : space.partitions).find(w => w.id === id);
      assert.equal(wall.cm, original.wall_segments.find(w => w.id === id).cm);
      assert.deepEqual(space.rooms.find(r => r.id === 'neighbor'), original.rooms.find(r => r.id === 'neighbor'));
    }
  });
}
