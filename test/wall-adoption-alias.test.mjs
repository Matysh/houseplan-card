import assert from 'node:assert/strict';
import test from 'node:test';
import { adoptWallSegmentModelCandidateInPlace, commitWallSegmentModel } from '../test-build/wall-segment-model.js';

const copy = value => JSON.parse(JSON.stringify(value));
const room = id => ({ id, poly: [[0, 0], [1, 0], [1, 1], [0, 1]] });
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
for (const reverse of [false, true]) for (const crossFloor of [false, true]) {
  test(`#826 point ownership: ${crossFloor ? 'two floors' : 'room/independent wall'}, reverse=${reverse}`, () => {
    const target = commitWallSegmentModel({ spaces: [
      { id: 'a', rooms: [room('ra')], partitions: [{ id: 'free', a: [0, 0], b: [2, 0], cm: 15 }] },
      { id: 'b', rooms: [room('rb')] },
    ], future: { keep: [1, 2] } }).config;
    if (reverse) target.spaces.reverse();
    const a = target.spaces.find(space => space.id === 'a');
    const b = target.spaces.find(space => space.id === 'b');
    if (reverse && !crossFloor) {
      const fields = Object.entries(a).reverse();
      for (const key of Object.keys(a)) delete a[key];
      for (const [key, value] of fields) a[key] = value;
    }
    if (crossFloor) b.rooms[0].poly[0] = a.rooms[0].poly[0];
    else a.partitions[0].a = a.rooms[0].poly[0];
    const refs = target.spaces.flatMap(space => [space, ...space.rooms, ...space.wall_segments, ...(space.partitions || [])]);
    const candidate = copy(target), next = candidate.spaces.find(space => space.id === 'a');
    if (crossFloor) {
      // A complete translated floor: its validated coordinate owners agree.
      for (const room of next.rooms) room.poly = room.poly.map(([x, y]) => [x + .2, y + .2]);
      for (const wall of [...next.wall_segments, ...(next.walls || []), ...next.partitions]) {
        wall.a = wall.a.map(value => value + .2); wall.b = wall.b.map(value => value + .2);
      }
    } else {
      next.partitions[0].a = [.2, .2]; next.partitions[0].b = [2.2, .2];
    }
    // Also require candidate key order, not the old target's ordering.
    candidate.future = { newFirst: 7, ...candidate.future };
    const expected = JSON.stringify(candidate), otherFloor = JSON.stringify(b.rooms[0].poly);
    freeze(candidate);
    assert.equal(adoptWallSegmentModelCandidateInPlace(target, candidate), target, 'root identity');
    assert.equal(JSON.stringify(target), expected, 'adoption must equal the candidate despite shared point owners');
    assert.equal(JSON.stringify(b.rooms[0].poly), otherFloor, 'unrelated floor coordinates');
    assert.equal(JSON.stringify(candidate), expected, 'candidate is immutable');
    const afterRefs = target.spaces.flatMap(space => [space, ...space.rooms, ...space.wall_segments, ...(space.partitions || [])]);
    assert.ok(refs.every((reference, index) => reference === afterRefs[index]), 'id-bearing gesture references');
    adoptWallSegmentModelCandidateInPlace(target, candidate);
    assert.equal(JSON.stringify(target), expected, 'byte-idempotent repeated adoption');
    const repeatedRefs = target.spaces.flatMap(space => [space, ...space.rooms, ...space.wall_segments, ...(space.partitions || [])]);
    assert.ok(refs.every((reference, index) => reference === repeatedRefs[index]), 'repeated adoption keeps gesture references');
  });
}

for (const reverse of [false, true]) test(`#826 catalog endpoint ownership, reverse=${reverse}`, () => {
  const target = commitWallSegmentModel({ spaces: [
    { id: 'a', rooms: [room('ra')] }, { id: 'b', rooms: [room('rb')] },
  ] }).config;
  if (reverse) target.spaces.reverse();
  const a = target.spaces.find(space => space.id === 'a'), b = target.spaces.find(space => space.id === 'b');
  b.wall_segments[0].a = a.rooms[0].poly[0];
  const refs = target.spaces.flatMap(space => [space, ...space.rooms, ...space.wall_segments]);
  const candidate = copy(target), moving = candidate.spaces.find(space => space.id === 'a');
  for (const owner of moving.rooms) owner.poly = owner.poly.map(point => point.map(value => value + .2));
  for (const owner of [...moving.wall_segments, ...(moving.walls || [])]) {
    owner.a = owner.a.map(value => value + .2); owner.b = owner.b.map(value => value + .2);
  }
  const expected = JSON.stringify(candidate);
  freeze(candidate);
  for (let pass = 0; pass < 2; pass++) {
    assert.equal(adoptWallSegmentModelCandidateInPlace(target, candidate), target);
    assert.equal(JSON.stringify(target), expected, 'room and catalog endpoint owners match the candidate');
    const after = target.spaces.flatMap(space => [space, ...space.rooms, ...space.wall_segments]);
    assert.ok(refs.every((reference, index) => reference === after[index]));
    assert.equal(JSON.stringify(candidate), expected);
  }
});

test('#826 ordinary JSON ownership still preserves root, room and catalog refs', () => {
  const target = copy(commitWallSegmentModel({ spaces: [{ id: 'a', rooms: [room('ra')] }] }).config);
  const refs = [target.spaces[0], target.spaces[0].rooms[0], ...target.spaces[0].wall_segments];
  const candidate = copy(target);
  candidate.spaces[0].rooms[0].name = 'Renamed';
  candidate.future = { newFirst: 1, keep: [2, 3] };
  const expected = JSON.stringify(candidate);
  freeze(candidate);
  assert.equal(adoptWallSegmentModelCandidateInPlace(target, candidate), target);
  assert.equal(JSON.stringify(target), expected);
  assert.deepEqual([target.spaces[0], target.spaces[0].rooms[0], ...target.spaces[0].wall_segments], refs);
  assert.ok(refs.every((ref, index) => ref === [target.spaces[0], target.spaces[0].rooms[0], ...target.spaces[0].wall_segments][index]));
  assert.equal(JSON.stringify(candidate), expected);
});
