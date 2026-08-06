// Wall thickness pure geometry (docs/WALL-THICKNESS.md §10).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  wallKey, lookupWall, thicknessCmAt, degradeWalls, rekeyWallsAfterMove,
  setWallThickness, setWallThicknessForRoom, applyWallThicknessToNewRoom,
  drawWallPreviewD, DRAW_WALL_DEFAULT_CM, clampWallCm, cmToField, fieldToCm,
  wallCmToUnits, insetContour, inwardNormal, edgeKinds, wallEdgeBodies,
  wallBodyRings, wallBodiesUnionPath, innerContourForRoom,
  paperRoomShapesWithWalls, WALL_MIN_CM, WALL_MAX_CM, MITRE_LIMIT,
  atomicPolyForRoom, insetOffsetsForRoom, wallIntervals, normalizeWallIntervals,
  intervalCmAt, wallBodyNeedsSolid, WALL_HATCH_MIN_PX,
} from '../test-build/wall-thickness.js';
import { polygonArea, paperRoomShapes } from '../test-build/logic.js';
import { GRID_PITCH } from '../test-build/space-geometry.js';

const closeTo = (got, want, tol = 1e-6) =>
  assert.ok(Math.abs(got - want) <= tol, `expected ${want}, got ${got}`);

const pitch = 1 / 240; // normalised grid step
const cellCm = 5;

// ------------------------------- key ----------------------------------------

test('wallKey is the same from either end of the wall', () => {
  const a = [0.1, 0.2], b = [0.4, 0.2];
  assert.equal(wallKey(a, b, pitch), wallKey(b, a, pitch));
});

test('wallKey changes when the wall moves by one grid step', () => {
  const a = [0.1, 0.2], b = [0.4, 0.2];
  const a2 = [0.1, 0.2 + pitch], b2 = [0.4, 0.2 + pitch];
  assert.notEqual(wallKey(a, b, pitch), wallKey(a2, b2, pitch));
});

test('lookupWall finds an entry and thicknessCmAt reads it', () => {
  const a = [0.1, 0.2], b = [0.4, 0.2];
  const walls = [{ key: wallKey(a, b, pitch), cm: 20 }];
  assert.equal(lookupWall(walls, a, b, pitch)?.cm, 20);
  assert.equal(lookupWall(walls, b, a, pitch)?.cm, 20);
  assert.equal(thicknessCmAt(walls, a, b, pitch), 20);
  assert.equal(thicknessCmAt(walls, [0, 0], [1, 1], pitch), 0);
});

// ------------------------------- units --------------------------------------

test('cm ↔ field: metric stays cm, imperial is inches', () => {
  assert.equal(cmToField(25.4, false), '25.4');
  assert.equal(cmToField(25.4, true), '10');
  assert.equal(fieldToCm('10', true), 25.4);
  assert.equal(fieldToCm('20', false), 20);
  assert.equal(fieldToCm('', false), null);
  assert.equal(fieldToCm('0', true), null);
  assert.equal(clampWallCm(0.5), WALL_MIN_CM);
  assert.equal(clampWallCm(999), WALL_MAX_CM);
});

test('wallCmToUnits goes through cell_cm like every other length', () => {
  // 5 cm at 5 cm/cell and pitch P → 1 cell = P units
  closeTo(wallCmToUnits(5, 5, GRID_PITCH), GRID_PITCH);
  closeTo(wallCmToUnits(10, 5, GRID_PITCH), 2 * GRID_PITCH);
});

test('thin-on-screen fallback policy is shared by both renderers', () => {
  assert.equal(wallBodyNeedsSolid(2, 1), true);
  assert.equal(wallBodyNeedsSolid(WALL_HATCH_MIN_PX, 1), false);
  assert.equal(wallBodyNeedsSolid(2, 2), false);
  assert.equal(wallBodyNeedsSolid(Number.NaN, 1), false);
  assert.equal(wallBodyNeedsSolid(2, 0), false);
});

// ------------------------------- degrade / rekey ----------------------------

test('degradeWalls drops a key with no matching room edge', () => {
  const rooms = [{ id: 'r1', poly: [[0, 0], [1, 0], [1, 1], [0, 1]] }];
  const live = wallKey([0, 0], [1, 0], pitch);
  const walls = [
    { key: live, cm: 15 },
    { key: '0.00,0.00@9.9999', cm: 10 },
  ];
  const kept = degradeWalls(walls, rooms, pitch);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].key, live);
});

test('degradeWalls keeps an exact maximal run even when another breakpoint subdivides it', () => {
  const rooms = [{ id: 'r1', poly: [[0, 0], [1, 0], [1, 1], [0, 1]] }];
  const walls = setWallThickness([], [0, 0], [0.4, 0], 18, pitch);
  const kept = degradeWalls(walls, rooms, pitch);
  assert.equal(kept.length, 1);
  assert.deepEqual(kept[0].a, [0, 0]);
  assert.deepEqual(kept[0].b, [0.4, 0]);
});

test('rekeyWallsAfterMove rewrites the key when a span shifts by one cell', () => {
  const oldA = [0.1, 0.2], oldB = [0.4, 0.2];
  const newA = [0.1, 0.2 + pitch], newB = [0.4, 0.2 + pitch];
  const walls = [{ key: wallKey(oldA, oldB, pitch), cm: 18 }];
  const next = rekeyWallsAfterMove(walls, [[oldA, oldB]], [[newA, newB]], pitch);
  assert.equal(next.length, 1);
  assert.equal(next[0].key, wallKey(newA, newB, pitch));
  assert.equal(next[0].cm, 18);
});

test('rekeyWallsAfterMove carries atomic remainders of a partially virtual wall', () => {
  const oldA = [0.5, 0.1], oldB = [0.5, 0.7];
  const newA = [0.6, 0.1], newB = [0.6, 0.7];
  const walls = [
    { key: wallKey([0.5, 0.1], [0.5, 0.3], pitch), cm: 20 },
    { key: wallKey([0.5, 0.5], [0.5, 0.7], pitch), cm: 25 },
  ];
  const next = rekeyWallsAfterMove(walls, [[oldA, oldB]], [[newA, newB]], pitch);
  assert.deepEqual(next, [
    { key: wallKey([0.6, 0.1], [0.6, 0.3], pitch), cm: 20 },
    { key: wallKey([0.6, 0.5], [0.6, 0.7], pitch), cm: 25 },
  ]);
});

test('rekeyWallsAfterMove carries exact interval endpoints with the wall', () => {
  const oldA = [0.2, 0.1], oldB = [0.2, 0.4];
  const newA = [0.3, 0.1], newB = [0.3, 0.4];
  const walls = setWallThickness([], oldA, oldB, 22, pitch);
  const next = rekeyWallsAfterMove(walls, [[oldA, oldB]], [[newA, newB]], pitch);
  assert.equal(next[0].key, wallKey(newA, newB, pitch));
  assert.deepEqual(next[0].a, newA);
  assert.deepEqual(next[0].b, newB);
});

test('setWallThickness upserts and removes', () => {
  const a = [0, 0], b = [1, 0];
  let walls = setWallThickness([], a, b, 12, pitch);
  assert.equal(walls.length, 1);
  walls = setWallThickness(walls, a, b, 30, pitch);
  assert.equal(walls[0].cm, 30);
  walls = setWallThickness(walls, a, b, null, pitch);
  assert.equal(walls.length, 0);
});

test('setWallThicknessForRoom skips open cuts', () => {
  const room = { id: 'r', poly: [[0, 0], [1, 0], [1, 1], [0, 1]] };
  const open = [[0, 0, 1, 0]];
  const walls = setWallThicknessForRoom([], [room], 'r', 20, pitch, open);
  // three edges get thickness; the open bottom does not
  assert.equal(walls.length, 3);
  assert.equal(thicknessCmAt(walls, [0, 0], [1, 0], pitch), 0);
  assert.equal(thicknessCmAt(walls, [1, 0], [1, 1], pitch), 20);
});

// ---------------------- atomic intervals (AUD-159B6-01) ---------------------

// A's right edge runs y=0..10, B only touches y=0..4: thickness set on that
// shared stretch used to be reported for the whole 10-long edge, so the outer
// remainder silently grew a wall the user never asked for.
const partialRooms = () => ([
  { id: 'a', poly: [[0, 0], [5, 0], [5, 10], [0, 10]] },
  { id: 'b', poly: [[5, 0], [10, 0], [10, 4], [5, 4]] },
]);

test('partial shared wall: an edge is split at the shared boundary end', () => {
  const at = atomicPolyForRoom(partialRooms(), 'a', [], pitch);
  assert.ok(at);
  assert.equal(at.poly.length, 5, JSON.stringify(at.poly));
  assert.ok(at.poly.some((p) => Math.abs(p[0] - 5) < 1e-9 && Math.abs(p[1] - 4) < 1e-9));
});

test('partial shared wall: thickness stays on its own interval', () => {
  const rooms = partialRooms();
  const walls = [{ key: wallKey([5, 0], [5, 4], pitch), cm: 30 }];
  const kinds = edgeKinds(rooms, 'a', [], pitch);
  const offs = insetOffsetsForRoom(rooms, 'a', walls, [], pitch, cellCm, pitch);
  const ivs = wallIntervals(rooms, walls, [], pitch, cellCm, pitch)
    .filter((iv) => iv.roomId === 'a' && Math.abs(iv.a[0] - 5) < 1e-9 && Math.abs(iv.b[0] - 5) < 1e-9);
  const shared = ivs.find((iv) => iv.kind === 'shared');
  const outer = ivs.find((iv) => iv.kind === 'outer');
  assert.equal(shared?.cm, 30);
  assert.equal(outer?.cm, 0, 'thickness must not leak past the shared stretch');
  assert.equal(kinds.filter((k) => k === 'shared').length, 1);
  assert.equal(offs.filter((o) => o > 0).length, 1);
});

test('partial shared wall: a pre-atomic whole-edge key still covers both pieces', () => {
  const rooms = partialRooms();
  // written before the split: the key names the WHOLE right edge (mid y=5)
  const walls = [{ key: wallKey([5, 0], [5, 10], pitch), cm: 30 }];
  const ivs = wallIntervals(rooms, walls, [], pitch, cellCm, pitch)
    .filter((iv) => iv.roomId === 'a' && Math.abs(iv.a[0] - 5) < 1e-9 && Math.abs(iv.b[0] - 5) < 1e-9);
  assert.equal(ivs.length, 2);
  assert.ok(ivs.every((iv) => iv.cm === 30), 'an existing plan must not lose thickness');
});

test('equal solid atomic pieces compact back to one whole-wall key', () => {
  const rooms = partialRooms();
  const walls = [
    { key: wallKey([5, 0], [5, 4], pitch), cm: 30 },
    { key: wallKey([5, 4], [5, 10], pitch), cm: 30 },
  ];
  const next = normalizeWallIntervals(rooms, walls, [], pitch, cellCm, GRID_PITCH);
  assert.equal(next.length, 1);
  assert.equal(next[0].key, wallKey([5, 0], [5, 10], pitch));
  assert.equal(next[0].cm, 30);
  assert.deepEqual(next[0].a, [5, 0]);
  assert.deepEqual(next[0].b, [5, 10]);
});

test('different solid thicknesses remain separate atomic keys', () => {
  const rooms = partialRooms();
  const walls = [
    { key: wallKey([5, 0], [5, 4], pitch), cm: 30 },
    { key: wallKey([5, 4], [5, 10], pitch), cm: 20 },
  ];
  const next = normalizeWallIntervals(rooms, walls, [], pitch, cellCm, GRID_PITCH);
  assert.equal(next.length, 2);
  assert.deepEqual(new Set(next.map((w) => w.cm)), new Set([20, 30]));
  assert.ok(!next.some((w) => w.key === wallKey([5, 0], [5, 10], pitch)));
});

test('closing the sole geometric split preserves different thicknesses', () => {
  const rooms = [
    { id: 'a', poly: [[0, 0], [5, 0], [5, 10], [0, 10]] },
    { id: 'b', poly: [[5, 0], [10, 0], [10, 10], [5, 10]] },
  ];
  // No neighbour endpoint and no open cut remains at y=4. Exact endpoints in
  // new wall entries are therefore the only record of this intentional break.
  let walls = setWallThickness([], [5, 0], [5, 4], 20, pitch);
  walls = setWallThickness(walls, [5, 4], [5, 10], 30, pitch);
  const next = normalizeWallIntervals(rooms, walls, [], pitch, cellCm, GRID_PITCH);
  assert.equal(next.length, 2);
  assert.deepEqual(new Set(next.map((w) => w.cm)), new Set([20, 30]));
  assert.ok(next.some((w) => w.a?.[1] === 4 || w.b?.[1] === 4));
});

test('exact endpoints do not prevent equal closed pieces from compacting', () => {
  const rooms = [
    { id: 'a', poly: [[0, 0], [5, 0], [5, 10], [0, 10]] },
    { id: 'b', poly: [[5, 0], [10, 0], [10, 10], [5, 10]] },
  ];
  let walls = setWallThickness([], [5, 0], [5, 4], 20, pitch);
  walls = setWallThickness(walls, [5, 4], [5, 10], 20, pitch);
  const next = normalizeWallIntervals(rooms, walls, [], pitch, cellCm, GRID_PITCH);
  assert.equal(next.length, 1);
  assert.equal(next[0].key, wallKey([5, 0], [5, 10], pitch));
});

// An open span that does NOT contain the parent edge's midpoint used to leave
// the key in place, so the wall body stayed solid straight across the passage.
test('open span away from the edge midpoint clears only its own interval', () => {
  const scale = 1000;
  const p = 1 / 240;
  const rooms = [
    { id: 'a', poly: [[100, 140], [300, 140], [300, 460], [100, 460]] },
    { id: 'b', poly: [[300, 140], [500, 140], [500, 460], [300, 460]] },
  ];
  const walls = [{ key: wallKey([300 / scale, 140 / scale], [300 / scale, 460 / scale], p), cm: 30 }];
  const cut = [[300, 150, 300, 220]];
  const full = wallBodiesUnionPath(rooms, walls, [], [], p, cellCm, GRID_PITCH, scale);
  const opened = wallBodiesUnionPath(rooms, walls, cut, [], p, cellCm, GRID_PITCH, scale);
  assert.ok(full && opened);
  assert.notEqual(full.d, opened.d, 'the wall body must open under the span');

  const next = normalizeWallIntervals(rooms, walls, cut, p, cellCm, GRID_PITCH, scale);
  assert.equal(intervalCmAt(rooms, next, cut, [300, 150, 300, 220], p, cellCm, GRID_PITCH, scale), 0);
  assert.equal(intervalCmAt(rooms, next, cut, [300, 220, 300, 460], p, cellCm, GRID_PITCH, scale), 30);
  assert.equal(intervalCmAt(rooms, next, cut, [300, 140, 300, 150], p, cellCm, GRID_PITCH, scale), 30);
});

// ------------------------------- inset --------------------------------------

test('insetContour: rectangle inset by half-thickness on every side', () => {
  const poly = [[0, 0], [10, 0], [10, 6], [0, 6]];
  const inset = insetContour(poly, [1, 1, 1, 1]);
  assert.ok(inset && inset.length >= 4);
  // area of a 10×6 rect inset by 1 → 8×4 = 32
  closeTo(polygonArea(inset), 32, 0.05);
});

test('insetContour: one thick edge among thin ones', () => {
  const poly = [[0, 0], [10, 0], [10, 6], [0, 6]];
  // only bottom edge (i=0) has offset 2
  const inset = insetContour(poly, [2, 0, 0, 0]);
  assert.ok(inset);
  // bottom moves up; area shrinks by roughly 2×10 = 20
  assert.ok(polygonArea(inset) < polygonArea(poly) - 15);
});

test('insetContour: L-shape stays a simple polygon', () => {
  const poly = [[0, 0], [6, 0], [6, 2], [2, 2], [2, 6], [0, 6]];
  const inset = insetContour(poly, [0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
  assert.ok(inset && inset.length >= 6);
  assert.ok(polygonArea(inset) < polygonArea(poly));
  assert.ok(polygonArea(inset) > 0);
});

test('insetContour: acute corner falls back to a bevel (no infinite spike)', () => {
  // very sharp tip at the origin
  const poly = [[0, 0], [10, 0.3], [10, 0], [0, 0]];
  // degenerate — use a proper acute triangle
  const sharp = [[0, 0], [10, 1], [10, -1]];
  const offsets = [1, 1, 1];
  const inset = insetContour(sharp, offsets);
  assert.ok(inset);
  for (const p of inset) {
    const dist = Math.hypot(p[0], p[1]);
    // no vertex may fly farther than MITRE_LIMIT × thickness from origin-ish
    assert.ok(dist < 10 + MITRE_LIMIT * 1 + 1, `spike at ${p}`);
  }
});

test('inwardNormal points into the rectangle', () => {
  const poly = [[0, 0], [10, 0], [10, 6], [0, 6]];
  const [nx, ny] = inwardNormal(poly, 0); // bottom edge → should point +y
  assert.ok(ny > 0.5, `expected +y inward, got ${nx},${ny}`);
});

// ------------------------------- bodies / paper -----------------------------

test('wallEdgeBodies: shared and outer both grow ±½ from the centreline', () => {
  const rooms = [
    { id: 'a', poly: [[0, 0], [5, 0], [5, 4], [0, 4]] },
    { id: 'b', poly: [[5, 0], [10, 0], [10, 4], [5, 4]] },
  ];
  // shared vertical at x=5
  const sharedKey = wallKey([5, 0], [5, 4], pitch);
  const outerKey = wallKey([0, 0], [5, 0], pitch);
  const walls = [
    { key: sharedKey, cm: 20 },
    { key: outerKey, cm: 30 },
  ];
  const kindsA = edgeKinds(rooms, 'a', [], pitch);
  assert.ok(kindsA.includes('shared'));
  assert.ok(kindsA.includes('outer'));

  const bodies = wallEdgeBodies(rooms, walls, [], pitch, cellCm, pitch);
  const shared = bodies.find((b) => b.key === sharedKey);
  const outer = bodies.find((b) => b.key === outerKey);
  assert.ok(shared, 'shared body missing');
  assert.ok(outer, 'outer body missing');
  assert.equal(shared.kind, 'shared');
  assert.equal(outer.kind, 'outer');
  // only one body per key even though two rooms see the shared wall
  assert.equal(bodies.filter((b) => b.key === sharedKey).length, 1);
  // outer grows half outward: min y of quad < 0
  const ys = outer.quad.map((p) => p[1]);
  assert.ok(Math.min(...ys) < -1e-9, 'outer must grow outward by half');
});

test('wallBodyRings / union: outset − inset forms a closed ring', () => {
  const rooms = [
    { id: 'a', poly: [[0, 0], [5, 0], [5, 4], [0, 4]] },
    { id: 'b', poly: [[5, 0], [10, 0], [10, 4], [5, 4]] },
  ];
  const walls = [
    { key: wallKey([5, 0], [5, 4], pitch), cm: 20 },
    { key: wallKey([0, 0], [5, 0], pitch), cm: 20 },
  ];
  const rings = wallBodyRings(rooms, walls, [], pitch, cellCm, pitch);
  assert.ok(rings.length >= 1);
  assert.ok(rings[0].d.includes('M'));
  const united = wallBodiesUnionPath(rooms, walls, [], [], pitch, cellCm, pitch);
  assert.ok(united && united.d.includes('M'));
  // Partial-thickness walls may produce a simple strip (one subpath); a fully
  // thick room must keep a floor hole — see the next test.
  const inner = innerContourForRoom(rooms, 'a', walls, [], pitch, cellCm, pitch);
  assert.ok(inner);
  assert.ok(polygonArea(inner) < polygonArea(rooms[0].poly));
});

test('wallBodiesUnionPath mitres real arms owned by different rooms at a virtual T', () => {
  const scale = 1000;
  const rooms = [
    { id: 'a', poly: [[100, 100], [500, 100], [500, 500], [100, 500]] },
    { id: 'b', poly: [[500, 500], [900, 500], [900, 900], [500, 900]] },
    { id: 'c', poly: [[500, 100], [900, 100], [900, 500], [500, 500]] },
  ];
  const open = [[500, 500, 900, 500]];
  const walls = [
    { key: wallKey([0.1, 0.5], [0.5, 0.5], pitch), cm: 20 },
    { key: wallKey([0.5, 0.5], [0.5, 0.9], pitch), cm: 20 },
  ];
  const united = wallBodiesUnionPath(rooms, walls, open, [], pitch, cellCm, GRID_PITCH, scale);
  assert.ok(united);
  const nums = (united.d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  const pts = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  const half = wallCmToUnits(20, cellCm, GRID_PITCH) / 2;
  assert.ok(
    pts.some((p) => Math.abs(p[0] - (500 + half)) < 1e-6
      && Math.abs(p[1] - (500 - half)) < 1e-6),
    `missing outer mitre corner in ${united.d}`,
  );
});

test('wallBodiesUnionPath: single fully-thick room keeps a floor hole', () => {
  const room = { id: 'n', poly: [[100, 100], [300, 100], [300, 300], [100, 300]] };
  const walls = applyWallThicknessToNewRoom([], [room], 'n', 15, 0.01, [], 1000);
  assert.equal(walls.length, 4);
  const united = wallBodiesUnionPath([room], walls, [], [], 0.01, cellCm, 4.166666666666667, 1000);
  assert.ok(united);
  assert.ok((united.d.match(/M/g) || []).length >= 2, united.d);
});

test('wallBodiesUnionPath: a parent floor never erases a nested room wall', () => {
  const scale = 1000;
  const rooms = [
    { id: 'parent', poly: [[100, 100], [900, 100], [900, 900], [100, 900]] },
    { id: 'nested', poly: [[300, 300], [700, 300], [700, 700], [300, 700]] },
  ];
  let walls = applyWallThicknessToNewRoom([], rooms, 'parent', 15, pitch, [], scale);
  walls = applyWallThicknessToNewRoom(walls, rooms, 'nested', 15, pitch, [], scale);
  const united = wallBodiesUnionPath(
    rooms, walls, [], [], pitch, cellCm, GRID_PITCH, scale,
  );
  assert.ok(united);
  // Parent ring (outer + floor hole) and nested ring (outer + floor hole).
  // The old `(union outsets) - (union insets)` formula returned only two
  // subpaths here because the parent floor swallowed the nested wall entirely.
  assert.ok((united.d.match(/M/g) || []).length >= 4, united.d);
});

test('paper with walls covers shared centreline; without walls matches paperRoomShapes', () => {
  const rooms = [
    { id: 'a', poly: [[0, 0], [5, 0], [5, 4], [0, 4]] },
    { id: 'b', poly: [[5, 0], [10, 0], [10, 4], [5, 4]] },
  ];
  const plain = paperRoomShapes(rooms);
  const same = paperRoomShapesWithWalls(rooms, [], [], pitch, cellCm, pitch);
  assert.deepEqual(same, plain);

  const walls = [{ key: wallKey([5, 0], [5, 4], pitch), cm: 20 }];
  const grown = paperRoomShapesWithWalls(rooms, walls, [], pitch, cellCm, pitch);
  assert.equal(grown.length, 2);
  // grown polys are still present (strings)
  assert.ok('poly' in grown[0]);
});

test('area of the room polygon is unchanged by thickness helpers', () => {
  const poly = [[0, 0], [8, 0], [8, 5], [0, 5]];
  const before = polygonArea(poly);
  insetContour(poly, [0.5, 0.5, 0.5, 0.5]);
  assert.equal(polygonArea(poly), before);
});

test('applyWallThicknessToNewRoom skips edges that already have thickness', () => {
  const sharedKey = wallKey([5, 0], [5, 4], pitch);
  const existing = [{ key: sharedKey, cm: 40 }];
  const older = { id: 'a', poly: [[0, 0], [5, 0], [5, 4], [0, 4]] };
  const newRoom = { id: 'b', poly: [[5, 0], [10, 0], [10, 4], [5, 4]] };
  const next = applyWallThicknessToNewRoom(
    existing, [older, newRoom], 'b', DRAW_WALL_DEFAULT_CM, pitch,
  );
  const shared = next.find((w) => w.key === sharedKey);
  assert.equal(shared?.cm, 40, 'neighbour thickness must be kept');
  // other three edges of b get the draw default
  assert.equal(next.filter((w) => w.cm === DRAW_WALL_DEFAULT_CM).length, 3);
  assert.equal(thicknessCmAt(next, [5, 0], [10, 0], pitch), DRAW_WALL_DEFAULT_CM);
});

test('applyWallThicknessToNewRoom with null cm is a no-op', () => {
  const room = { id: 'r', poly: [[0, 0], [1, 0], [1, 1], [0, 1]] };
  assert.deepEqual(applyWallThicknessToNewRoom([], [room], 'r', null, pitch), []);
});

test('drawWallPreviewD returns a path for open and closed outlines', () => {
  const open = drawWallPreviewD([[0, 0], [10, 0], [10, 6]], 1, false);
  assert.ok(open.includes('M'));
  const closed = drawWallPreviewD([[0, 0], [10, 0], [10, 6], [0, 6]], 1, true);
  assert.ok(closed.includes('M'));
  assert.equal(drawWallPreviewD([[0, 0]], 1, false), '');
});
