import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classifyWallFaceRoom, classifyWallFaceCandidates } from '../test-build/wall-face-room-split.js';
import { polygonArea } from '../test-build/logic.js';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';
import { setWallThickness } from '../test-build/wall-thickness.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/874-room-closure.json', import.meta.url), 'utf8'));
const epsilon = 1 / 240 * .0002;
const rectangle = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const room = poly => ({ id: 'parent', poly });
const classify = (face, parent = rectangle(0, 0, 10, 10)) => classifyWallFaceRoom(face, [room(parent)], epsilon);

test('#874 exact exported face refuses an additive third owner but a composite split is valid', () => {
  const rooms = [{ ...room(fixture.parent), name: 'Parent', area: 'synthetic-parent', settings: { name_size: 1.2 } },
    { id: 'neighbor', name: 'Neighbor', poly: fixture.neighbor }];
  let walls = [];
  for (const r of rooms) r.poly.forEach((p, i) => {
    walls = setWallThickness(walls, p, r.poly[(i + 1) % r.poly.length], 30, 1 / 240, 1);
  });
  const config = commitWallSegmentModel({ spaces: [{ id: 'floor', rooms, walls,
    partitions: [fixture.oldWall, fixture.addedWall] }], markers: [], settings: {} }).config;
  const before = structuredClone(config);
  const wrong = structuredClone(config);
  wrong.spaces[0].rooms.push({ id: 'child', poly: fixture.face });
  assert.throws(() => commitWallSegmentModel(wrong), e => e.reason === 'third-owner');
  const result = classifyWallFaceRoom(fixture.face, rooms, epsilon);
  assert.equal(result.kind, 'split');
  assert.equal(result.split.roomId, 'parent');
  assert.ok(polygonArea(result.split.mainPoly) > polygonArea(result.split.newPoly));
  assert.ok(Math.abs(polygonArea(result.split.mainPoly) + polygonArea(result.split.newPoly)
    - polygonArea(fixture.parent)) < 1e-9);
  const next = structuredClone(config);
  next.spaces[0].rooms[0].poly = result.split.mainPoly;
  next.spaces[0].rooms.push({ id: 'child', poly: result.split.newPoly });
  const committed = commitWallSegmentModel(next).config;
  assert.equal(committed.spaces[0].rooms.length, 3);
  assert.equal(committed.spaces[0].rooms[0].area, 'synthetic-parent');
  assert.deepEqual(committed.spaces[0].rooms[0].settings, before.spaces[0].rooms[0].settings);
  assert.deepEqual(config, before, 'classification does not mutate the input');
  const owners = new Map();
  for (const r of committed.spaces[0].rooms) for (const id of r.wall_ids) owners.set(id, (owners.get(id) || 0) + 1);
  assert.ok([...owners.values()].every(n => n <= 2));
});

for (const face of [rectangle(0, 0, 3, 10), rectangle(0, 0, 10, 3),
  rectangle(0, 0, 8, 10), rectangle(0, 0, 10, 8)]) {
  test(`#874 H/V and large presented face keep the larger side ${JSON.stringify(face)}`, () => {
    const result = classify(face);
    assert.equal(result.kind, 'split');
    assert.equal(polygonArea(result.split.mainPoly), Math.max(polygonArea(face), 100 - polygonArea(face)));
    assert.equal(polygonArea(result.split.mainPoly) + polygonArea(result.split.newPoly), 100);
  });
}

test('#874 an equal-area choice is stable under winding, cyclic start and room order', () => {
  const face = rectangle(0, 0, 5, 10);
  const a = classify(face).split;
  const shifted = [...face.slice(2), ...face.slice(0, 2)].reverse();
  const b = classify(shifted, [...rectangle(0, 0, 10, 10)].reverse()).split;
  assert.equal(polygonArea(a.mainPoly), 50);
  assert.deepEqual([...a.mainPoly].sort(), [...b.mainPoly].sort());
});

test('#874 true island and point-only contact are not boundary splits', () => {
  assert.equal(classify(rectangle(2, 2, 3, 3)).kind, 'plain');
  assert.equal(classify([[0, 0], [2, 1], [1, 2]]).kind, 'plain');
});

for (const [name, face] of [
  ['duplicate', rectangle(0, 0, 10, 10)],
  ['partial overlap', rectangle(0, 0, 11, 5)],
  ['two disconnected remainders', rectangle(4, 0, 2, 10)],
  ['self crossing', [[0, 0], [10, 10], [0, 10], [10, 0]]],
  ['backtracking', [[0, 0], [10, 0], [5, 0], [10, 10], [0, 10]]],
]) {
  test(`#874 refuses ${name} without nested fallback`, () => assert.equal(classify(face).kind, 'refuse'));
}

test('#874 ambiguous containing parents fail closed, an adjacent neighbor does not', () => {
  const face = rectangle(0, 0, 3, 10), parent = room(rectangle(0, 0, 10, 10));
  assert.equal(classifyWallFaceRoom(face, [parent, { ...parent, id: 'other-parent' }], epsilon).kind, 'refuse');
  assert.equal(classifyWallFaceRoom(face, [parent, { id: 'neighbor', poly: rectangle(0, 10, 10, 5) }], epsilon).kind, 'split');
});

const graphFace = ring => ({ ring, area: polygonArea(ring), key: JSON.stringify(ring), atomKeys: [], sourceKeys: [] });
test('#874 complementary wall-to-wall faces queue one smaller room, conflicting cuts queue none', () => {
  const parent = room(rectangle(0, 0, 10, 10));
  const left = graphFace(rectangle(0, 0, 3, 10)), right = graphFace(rectangle(3, 0, 7, 10));
  const a = classifyWallFaceCandidates([left, right], [parent], epsilon);
  const b = classifyWallFaceCandidates([right, left], [parent], epsilon);
  assert.equal(a.length, 1);
  assert.equal(a[0].area, 30);
  assert.equal(a[0].key, b[0].key);
  assert.deepEqual(classifyWallFaceCandidates([left, graphFace(rectangle(7, 0, 3, 10))], [parent], epsilon), []);
});
test('#874 complementary equal parts deduplicate despite collinear graph subdivisions', () => {
  const parent = room(rectangle(0, 0, 10, 10));
  const left = graphFace(rectangle(0, 0, 5, 10));
  const right = graphFace([[5, 0], [10, 0], [10, 5], [10, 10], [5, 10], [5, 5]]);
  const a = classifyWallFaceCandidates([left, right], [parent], epsilon);
  assert.equal(a.length, 1);
  assert.equal(a[0].area, 50);
});
