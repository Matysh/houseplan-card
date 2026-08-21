// Issue #229: a straight run of one thickness is one record; a node stays only
// where something else meets it. docs/specs/229-merge-collinear-partitions.md
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyOpeningMoves, EPS_JOIN, mergeCollinearPartitions, junctionAt, remapHostT,
  spaceMergeGeometry,
} from '../test-build/wall-merge.js';

const PITCH = 10;                       // one grid pitch in test coordinates
const seg = (id, ax, ay, bx, by, cm = 15) => ({ id, a: [ax, ay], b: [bx, by], cm });
const merge = (list, options = {}) => mergeCollinearPartitions(list, { pitch: PITCH, ...options });
const geometryOf = (result) => result.partitions
  .map((p) => `${p.a.join()}→${p.b.join()}@${p.cm}`).sort();

// --- AC1: прямая цепочка становится одной записью ----------------------------

test('issue 229 a straight chain of one thickness collapses into a single record', () => {
  const result = merge([
    seg('a', 0, 0, 100, 0), seg('b', 100, 0, 220, 0), seg('c', 220, 0, 300, 0),
  ]);
  assert.equal(result.partitions.length, 1);
  assert.equal(result.merged, 2);
  const [only] = result.partitions;
  assert.deepEqual([only.a, only.b], [[0, 0], [300, 0]]);
  assert.equal(only.cm, 15);
});

test('issue 229 a corner is not a straight run', () => {
  const result = merge([seg('a', 0, 0, 100, 0), seg('b', 100, 0, 100, 90)]);
  assert.equal(result.partitions.length, 2);
  assert.equal(result.merged, 0);
});

// --- AC2: узел с причиной остаётся -------------------------------------------

test('issue 229 a third partition at the joint keeps the node', () => {
  const result = merge([
    seg('a', 0, 0, 100, 0), seg('b', 100, 0, 200, 0), seg('t', 100, 0, 100, 80),
  ]);
  assert.equal(result.merged, 0, 'a T of three walls is a junction');
});

test('issue 229 a room side keeps the node, corner or not', () => {
  // The room's nearest CORNER is far away; its SIDE runs right through the
  // joint. A partition meeting the middle of a room wall is an ordinary
  // T-junction and must survive the merge.
  // The two segments meet at (100, -100). The room's top side runs along
  // y = -100 from x = 0 to x = 400, so the joint sits in the MIDDLE of that
  // side — 100 and 300 units away from either corner of the room.
  const room = [[[0, -100], [400, -100], [400, 300], [0, 300]]];
  const chain = [seg('a', 100, -300, 100, -100), seg('b', 100, -100, 100, 0)];
  assert.equal(merge(chain).merged, 1, 'nothing meets this joint yet');
  const withRoom = merge(chain, { geometry: { roomPolygons: room } });
  assert.equal(withRoom.merged, 0, 'the joint sits on a room side, not on a corner');
});

test('issue 229 a column or a draft end keeps the node', () => {
  const chain = [seg('a', 0, 0, 100, 0), seg('b', 100, 0, 200, 0)];
  assert.equal(merge(chain, {
    geometry: { columns: [{ id: 'c', shape: 'circle', center: [100, 0], cm: 30 }] },
  }).merged, 0);
  assert.equal(merge(chain, { geometry: { draftEnds: [[100, 0]] } }).merged, 0);
});

// --- AC4: разная толщина ------------------------------------------------------

test('issue 229 different thickness is a real break', () => {
  const result = merge([seg('a', 0, 0, 100, 0, 15), seg('b', 100, 0, 200, 0, 25)]);
  assert.equal(result.merged, 0);
  assert.equal(result.partitions.length, 2);
});

// --- AC5: допуски -------------------------------------------------------------

test('issue 229 tolerance forgives float noise and refuses a real gap', () => {
  const ulp = merge([seg('a', 0, 0, 100, 0), seg('b', 100.0000000001, 0, 200, 0)]);
  assert.equal(ulp.merged, 1, 'a last-bit difference is the same point');
  const gap = merge([seg('a', 0, 0, 100, 0), seg('b', 100 + EPS_JOIN * PITCH * 4, 0, 200, 0)]);
  assert.equal(gap.merged, 0, 'a deliberate gap stays a gap');
});

// --- AC6: детерминизм ---------------------------------------------------------

test('issue 229 the result does not depend on the order of the input', () => {
  const parts = [seg('a', 0, 0, 100, 0), seg('b', 100, 0, 200, 0), seg('c', 200, 0, 300, 0)];
  const forward = geometryOf(merge(parts));
  const backward = geometryOf(merge([...parts].reverse()));
  const shuffled = geometryOf(merge([parts[1], parts[2], parts[0]]));
  assert.deepEqual(backward, forward);
  assert.deepEqual(shuffled, forward);
});

// --- AC3: проём не двигается --------------------------------------------------

test('issue 229 an opening keeps its place in the plan, not its fraction', () => {
  // Door in the middle of the second segment: absolute position 150.
  const parts = [seg('a', 0, 0, 100, 0), seg('b', 100, 0, 200, 0)];
  const result = merge(parts);
  assert.equal(result.merged, 1);
  const move = result.openingMoves.find((m) => m.fromId === 'b');
  assert.ok(move, 'the merged host reports how to remap its openings');
  const survivor = result.partitions[0];
  const length = Math.hypot(survivor.b[0] - survivor.a[0], survivor.b[1] - survivor.a[1]);
  const t = remapHostT(0.5, move);
  const x = survivor.a[0] + (survivor.b[0] - survivor.a[0]) * t;
  assert.equal(length, 200);
  assert.ok(Math.abs(x - 150) < 1e-9, `door moved to ${x}`);
});

test('issue 229 an opening survives a chain of merges and a reversed survivor', () => {
  // Three segments merged in two rounds; the door sits on the last one.
  const result = merge([
    seg('a', 300, 0, 200, 0), seg('b', 200, 0, 100, 0), seg('c', 100, 0, 0, 0),
  ]);
  assert.equal(result.partitions.length, 1);
  const survivor = result.partitions[0];
  const move = result.openingMoves.find((m) => m.fromId === 'c');
  assert.ok(move, 'every merged record reports a move');
  assert.equal(move.toId, survivor.id, 'the move points at the record that exists');
  const t = remapHostT(0.5, move);          // middle of "c" — absolute x = 50
  const x = survivor.a[0] + (survivor.b[0] - survivor.a[0]) * t;
  assert.ok(Math.abs(x - 50) < 1e-9, `door moved to ${x}`);
});

// --- §8.6: область слияния при завершении цепочки -----------------------------

test('issue 229 finishing a chain does not sweep unrelated seams', () => {
  const parts = [
    seg('new1', 0, 0, 100, 0), seg('new2', 100, 0, 200, 0),   // the chain just drawn
    seg('old1', 0, 500, 100, 500), seg('old2', 100, 500, 200, 500), // an old seam
  ];
  const scoped = merge(parts, { seedIds: ['new1', 'new2'] });
  assert.equal(scoped.merged, 1, 'only the chain is merged');
  assert.equal(scoped.partitions.length, 3);
  assert.ok(scoped.partitions.some((p) => p.id === 'old1'), 'the old seam is left alone');
  // The optimiser passes no seeds and sweeps everything.
  assert.equal(merge(parts).merged, 2);
});

test('issue 229 a chain merges into what it was drawn onto', () => {
  const result = merge(
    [seg('old', 0, 0, 100, 0), seg('new', 100, 0, 200, 0)],
    { seedIds: ['new'] },
  );
  assert.equal(result.merged, 1, 'the seam belongs to the new chain');
});

// --- junctionAt: прямой контракт ---------------------------------------------

test('issue 229 junctionAt measures a room by its side, not by its vertices', () => {
  const room = [[[0, 0], [400, 0], [400, 300], [0, 300]]];
  const middle = [200, 0];
  assert.equal(junctionAt(middle, [], new Set(), { roomPolygons: room }, EPS_JOIN * PITCH), true);
  const away = [200, -50];
  assert.equal(junctionAt(away, [], new Set(), { roomPolygons: room }, EPS_JOIN * PITCH), false);
});

test('issue 229 a door moved onto the survivor keeps its place in the plan', () => {
  const partitions = [seg('p1', 0, 0, 200, 0), seg('p2', 200, 0, 400, 0)];
  // Middle of p2 → absolute x = 300.
  const openings = [{
    id: 'door', type: 'door', x: 300, y: 0, angle: 0, length: 40,
    host: { kind: 'partition', id: 'p2', t: 0.5 },
  }];
  const result = merge(partitions);
  const moved = applyOpeningMoves(openings, result.partitions, result.openingMoves, {
    coordScale: 1, cellCm: 5, gridPitch: PITCH,
  });
  const [wall] = result.partitions;
  const [door] = openings;
  assert.equal(moved, 1);
  assert.equal(door.host.id, wall.id, 'the host that vanished is not referenced any more');
  const x = wall.a[0] + (wall.b[0] - wall.a[0]) * door.host.t;
  assert.ok(Math.abs(x - 300) < 1e-9, `door moved to ${x}`);
  assert.ok(Math.abs(door.x - 300) < 1e-9, `stale projection x: ${door.x}`);
});

test('issue 229 the legacy projection turns around with the survivor', () => {
  // Both pieces are stored right-to-left; the survivor is canonicalised
  // left-to-right, so the angle an older reader draws from has to be rewritten.
  const partitions = [seg('p1', 400, 0, 200, 0), seg('p2', 200, 0, 0, 0)];
  const openings = [{
    id: 'door', type: 'door', x: 300, y: 0, angle: 180, length: 40,
    host: { kind: 'partition', id: 'p1', t: 0.5 },
  }];
  const result = merge(partitions);
  const [wall] = result.partitions;
  assert.deepEqual([wall.a, wall.b], [[0, 0], [400, 0]], 'survivor points one way');
  applyOpeningMoves(openings, result.partitions, result.openingMoves, {
    coordScale: 1, cellCm: 5, gridPitch: PITCH,
  });
  const [door] = openings;
  const x = wall.a[0] + (wall.b[0] - wall.a[0]) * door.host.t;
  assert.ok(Math.abs(x - 300) < 1e-9, `door moved to ${x}`);
  assert.ok(Math.abs(door.x - 300) < 1e-9, `stale projection x: ${door.x}`);
  assert.equal(door.angle, 0, 'stale projection angle');
});

test('issue 229 openings hosted elsewhere are left alone', () => {
  const partitions = [seg('p1', 0, 0, 200, 0), seg('p2', 200, 0, 400, 0), seg('far', 0, 500, 200, 500)];
  const openings = [
    { id: 'w', type: 'window', x: 100, y: 500, angle: 0, length: 40, host: { kind: 'partition', id: 'far', t: 0.5 } },
    { id: 'room', type: 'door', x: 10, y: 10, angle: 0, length: 40, host: { kind: 'room', id: 'r1', t: 0.5 } },
  ];
  const result = merge(partitions);
  const before = JSON.stringify(openings);
  const moved = applyOpeningMoves(openings, result.partitions, result.openingMoves, {
    coordScale: 1, cellCm: 5, gridPitch: PITCH,
  });
  assert.equal(moved, 0);
  assert.equal(JSON.stringify(openings), before);
});

test('issue 229 space geometry keeps rooms in the coordinates partitions use', () => {
  // Both callers used to build this themselves and both rescaled the polygon,
  // so a junction on a room side was never found (CODE-REVIEW-229-r1 High-1,
  // r2 Medium-1). One function now, checked in the units both paths share.
  const space = {
    rooms: [
      { id: 'r1', poly: [[0.1, 0.1], [0.5, 0.1], [0.5, 0.5], [0.1, 0.5]] },
      { id: 'r2', x: 0.6, y: 0.1, w: 0.2, h: 0.2 },
      { id: 'broken' },
    ],
    wall_columns: [{ id: 'c1', center: [0.7, 0.7] }],
  };
  const geometry = spaceMergeGeometry(space);
  assert.deepEqual(geometry.roomPolygons[0], [[0.1, 0.1], [0.5, 0.1], [0.5, 0.5], [0.1, 0.5]]);
  assert.deepEqual(geometry.roomPolygons[1][0], [0.6, 0.1], 'x/y/w/h rooms come through too');
  assert.equal(geometry.roomPolygons.length, 2, 'a room without geometry is skipped');
  assert.deepEqual(geometry.columns, space.wall_columns);
});

test('issue 229 the chain being finished is not its own junction', () => {
  const space = {
    rooms: [],
    room_drafts: [
      { id: 'active', points: [[0.1, 0.1], [0.3, 0.1]] },
      { id: 'other', points: [[0.6, 0.6], [0.8, 0.6]] },
    ],
  };
  assert.deepEqual(
    spaceMergeGeometry(space).draftEnds,
    [[0.1, 0.1], [0.3, 0.1], [0.6, 0.6], [0.8, 0.6]],
    'without an active chain every draft anchors a node',
  );
  assert.deepEqual(
    spaceMergeGeometry(space, { excludeDraftId: 'active' }).draftEnds,
    [[0.6, 0.6], [0.8, 0.6]],
    'the chain about to disappear does not hold a node',
  );
});

test('issue 229 a junction on a room side survives, through the shared geometry', () => {
  const partitions = [seg('p1', 100, 500, 300, 500), seg('p2', 300, 500, 500, 500)];
  const space = { rooms: [{ id: 'r1', x: 100, y: 100, w: 400, h: 400 }] };
  const result = mergeCollinearPartitions(partitions, {
    pitch: PITCH, geometry: spaceMergeGeometry(space),
  });
  assert.equal(result.merged, 0, 'the middle of the room side holds the node');
  assert.equal(result.partitions.length, 2);
});
