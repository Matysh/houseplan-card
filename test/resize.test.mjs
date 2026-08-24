// Room resize geometry (docs/RESIZE.md): every «упор» and the T-junction
// vertex insertion are pinned here numerically.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  edgeNormal, movePolyEdge, sharedSpansWith, shiftSharedSpans, simplifyPoly,
  polyIsSimple, minParallelClearance, planEdgeDrag, applyEdgeDrag,
  validateEdgeDrag, clampEdgeDrag, applyRoomScale, validateRoomScale,
  clampRoomScale, areaM2, formatArea, MIN_ROOM_CM,
  resolveSafeResize, applySafeResize, validateSafeResize, clampSafeResize,
  safeResizeCachedDeltaCount,
} from '../test-build/resize.js';
import { roomPoly } from '../test-build/logic.js';
import fs from 'node:fs';

const OPTS = { minDim: 25, eps: 0.5 }; // 25 units ≈ 30 cm at cell_cm=5, pitch 1000/240
const STEP = 5;

// A: 300×300 square, right edge is index 1 ((400,100)→(400,400))
const A = () => ({ id: 'A', poly: [[100, 100], [400, 100], [400, 400], [100, 400]] });
// R: full-height neighbour to the right — the ENTIRE wall x=400 is shared
const R = () => ({ id: 'R', poly: [[400, 100], [700, 100], [700, 400], [400, 400]] });
// B: shorter neighbour to the right — T-junction (covers y 100..300 only)
const B = () => ({ id: 'B', poly: [[400, 100], [700, 100], [700, 300], [400, 300]] });

const closeTo = (got, want, tol = 1e-6) =>
  assert.ok(Math.abs(got - want) <= tol, `expected ${want}, got ${got}`);
const polyEq = (got, want, tol = 1e-6) => {
  assert.equal(got.length, want.length, `vertex count: ${JSON.stringify(got)}`);
  for (let i = 0; i < want.length; i++) {
    closeTo(got[i][0], want[i][0], tol);
    closeTo(got[i][1], want[i][1], tol);
  }
};

test('edgeNormal points outward for both windings', () => {
  const a = A();
  assert.deepEqual(edgeNormal(a.poly, 1).map((v) => Math.round(v) + 0), [1, 0]);   // right wall → +x
  assert.deepEqual(edgeNormal(a.poly, 3).map((v) => Math.round(v) + 0), [-1, 0]);  // left wall → −x
  const ccw = [...a.poly].reverse(); // reversed winding, same square
  const n = edgeNormal(ccw, ccw.findIndex((p) => p[0] === 400 && p[1] === 400));
  assert.deepEqual(n.map((v) => Math.round(v) + 0), [1, 0]);
});

test('movePolyEdge translates BOTH edge endpoints along the normal', () => {
  polyEq(movePolyEdge(A().poly, 1, 50), [[100, 100], [450, 100], [450, 400], [100, 400]]);
  polyEq(movePolyEdge(A().poly, 1, -50), [[100, 100], [350, 100], [350, 400], [100, 400]]);
});

test('legacy x/y/w/h rectangles resize through roomPoly', () => {
  const poly = roomPoly({ x: 100, y: 100, w: 300, h: 300 });
  polyEq(movePolyEdge(poly, 1, 50), [[100, 100], [450, 100], [450, 400], [100, 400]]);
});

test('full shared wall: the neighbour moves synchronously, no gap by construction', () => {
  const rooms = [A(), R()];
  const plan = planEdgeDrag(rooms, 'A', 1);
  const res = applyEdgeDrag(rooms, [], plan, 50, OPTS.eps);
  polyEq(res.polys.A, [[100, 100], [450, 100], [450, 400], [100, 400]]);
  polyEq(res.polys.R, [[450, 100], [700, 100], [700, 400], [450, 400]]); // R shrank, walls still coincide
});

test('T-junction: only the coinciding stretch of the neighbour moves, vertices are inserted', () => {
  const rooms = [A(), B()];
  // drag B's left wall (edge 3: (400,300)→(400,100)) 50 units INTO A
  const plan = planEdgeDrag(rooms, 'B', 3);
  assert.deepEqual(plan.n.map((v) => Math.round(v) + 0), [-1, 0]);
  const res = applyEdgeDrag(rooms, [], plan, 50, OPTS.eps);
  polyEq(res.polys.B, [[350, 100], [700, 100], [700, 300], [350, 300]]);
  // A becomes L-shaped: the shared stretch (y 100..300) caves in, the rest stays
  polyEq(res.polys.A, [[100, 100], [350, 100], [350, 300], [400, 300], [400, 400], [100, 400]]);
});

test('stop: own room minimum size (~30 cm)', () => {
  const rooms = [A()];
  const plan = planEdgeDrag(rooms, 'A', 1);
  assert.equal(validateEdgeDrag(rooms, [], plan, -280, OPTS), false); // width 20 < 25
  assert.equal(validateEdgeDrag(rooms, [], plan, -275, OPTS), true);  // width 25 — the floor
  closeTo(clampEdgeDrag(rooms, [], plan, -280, STEP, OPTS), -275);
});

test('stop: the shrinking neighbour keeps its minimum size too', () => {
  const rooms = [A(), R()];
  const plan = planEdgeDrag(rooms, 'A', 1);
  assert.equal(validateEdgeDrag(rooms, [], plan, 290, OPTS), false); // R would be 10 wide
  closeTo(clampEdgeDrag(rooms, [], plan, 290, STEP, OPTS), 275);     // R stays 25
});

test('stop: a growing wall may touch a foreign room but never overlap it', () => {
  const F = { id: 'F', poly: [[500, 100], [700, 100], [700, 400], [500, 400]] };
  const rooms = [A(), F];
  const plan = planEdgeDrag(rooms, 'A', 1);
  assert.equal(validateEdgeDrag(rooms, [], plan, 150, OPTS), false); // crosses F
  assert.equal(validateEdgeDrag(rooms, [], plan, 100, OPTS), true);  // touching = legal shared wall
  closeTo(clampEdgeDrag(rooms, [], plan, 150, STEP, OPTS), 100);
});

test('stop: islands (islandsOf) block the wall, including a jump fully past them', () => {
  const P = { id: 'P', poly: [[100, 100], [500, 100], [500, 500], [100, 500]] };
  const I = { id: 'I', poly: [[250, 250], [350, 250], [350, 350], [250, 350]] };
  const rooms = [P, I];
  const plan = planEdgeDrag(rooms, 'P', 1); // right wall of the parent
  assert.equal(validateEdgeDrag(rooms, [], plan, -200, OPTS), false); // wall at 300 cuts the island
  assert.equal(validateEdgeDrag(rooms, [], plan, -280, OPTS), false); // wall at 220 — island fully outside (no edge crossing!)
  assert.equal(validateEdgeDrag(rooms, [], plan, -155, OPTS), false); // wall at 345 crosses the island
  assert.equal(validateEdgeDrag(rooms, [], plan, -150, OPTS), true);  // wall at 350 — flush with the island is a touch, legal
  closeTo(clampEdgeDrag(rooms, [], plan, -280, STEP, OPTS), -150);
});

test('openings: a door ON the moving wall travels with it', () => {
  const rooms = [A(), R()];
  const plan = planEdgeDrag(rooms, 'A', 1);
  const ops = [{ id: 'o1', x: 400, y: 200, length: 60 }];
  const res = applyEdgeDrag(rooms, ops, plan, 50, OPTS.eps);
  assert.deepEqual(res.openings.o1, [450, 200]);
  assert.equal(validateEdgeDrag(rooms, ops, plan, 50, OPTS), true);
});

test('stop: a side wall cannot get too short for its opening (own room)', () => {
  const rooms = [A()];
  const plan = planEdgeDrag(rooms, 'A', 1);
  const ops = [{ id: 'o2', x: 350, y: 100, length: 80 }]; // top wall, spans x 310..390
  assert.equal(validateEdgeDrag(rooms, ops, plan, -50, OPTS), false); // top wall ends at 350 < 390
  assert.equal(validateEdgeDrag(rooms, ops, plan, -10, OPTS), true);  // ends exactly at 390
  closeTo(clampEdgeDrag(rooms, ops, plan, -50, STEP, OPTS), -10);
});

test('stop: the neighbour’s opening anchors the drag too', () => {
  const rooms = [A(), R()];
  const plan = planEdgeDrag(rooms, 'A', 1);
  const ops = [{ id: 'o3', x: 460, y: 100, length: 40 }]; // R’s top wall, spans x 440..480
  // the wall corner may not land INSIDE the door: at d=50 the joint (x=450)
  // would sit in the middle of the opening — that is the «упор»
  assert.equal(validateEdgeDrag(rooms, ops, plan, 50, OPTS), false);
  assert.equal(validateEdgeDrag(rooms, ops, plan, 40, OPTS), true);   // joint exactly at the door edge
  closeTo(clampEdgeDrag(rooms, ops, plan, 50, STEP, OPTS), 40);
  // fully past the door the opening sits on the GROWN room's wall — the
  // composite wall y=100 never shortens, so this is legal by construction
  assert.equal(validateEdgeDrag(rooms, ops, plan, 100, OPTS), true);
});

test('scale: all vertices scale proportionally about the fixed corner', () => {
  const res = applyRoomScale(A(), [], [], [100, 100], 1.5, OPTS.eps);
  polyEq(res.poly, [[100, 100], [550, 100], [550, 550], [100, 550]]);
});

test('scale stops: minimum size and the neighbour as a hard wall', () => {
  const F = { id: 'F', poly: [[500, 100], [700, 100], [700, 400], [500, 400]] };
  const rooms = [A(), F];
  assert.equal(validateRoomScale(rooms, [], 'A', [100, 100], 0.05, OPTS), false); // 15 < 25
  const kMin = clampRoomScale(rooms, [], 'A', [100, 100], 0.05, OPTS);
  closeTo(kMin * 300, 25, 0.5); // clamped at the 30 cm floor
  assert.equal(validateRoomScale(rooms, [], 'A', [100, 100], 2, OPTS), false);    // overlaps F
  const kMax = clampRoomScale(rooms, [], 'A', [100, 100], 2, OPTS);
  closeTo(kMax, 400 / 300, 1e-3); // right wall lands exactly on F
});

test('scale never drags the neighbour; a SHARED opening stays with the neighbour wall', () => {
  const rooms = [A(), R()];
  const shared = { id: 'os', x: 400, y: 200, length: 60 };   // on the shared wall
  const own = { id: 'oo', x: 100, y: 200, length: 60 };      // on A’s left wall only
  const res = applyRoomScale(A(), [shared, own], [R().poly], [400, 400], 0.5, OPTS.eps);
  assert.equal(res.openings.os, undefined);                  // stays put
  assert.deepEqual(res.openings.oo, [250, 300]);             // follows the transform
  assert.equal(validateRoomScale(rooms, [shared], 'A', [400, 400], 0.5, OPTS), true);
});

test('scale stop: an exclusive opening must still fit', () => {
  const rooms = [A()];
  const ops = [{ id: 'o4', x: 250, y: 100, length: 200 }]; // top wall, needs 200 units
  assert.equal(validateRoomScale(rooms, ops, 'A', [100, 100], 0.5, OPTS), false); // wall 150 < opening 200
  const k = clampRoomScale(rooms, ops, 'A', [100, 100], 0.5, OPTS);
  // the opening centre scales too: it fits while 100·(1−1.5k) ≤ ε, i.e. k ≥ 0.66
  closeTo(k, 0.66, 1e-3);
});

test('shared spans + shiftSharedSpans invariants', () => {
  const spans = sharedSpansWith(B().poly, [400, 100], [400, 400], OPTS.eps);
  assert.equal(spans.length, 1);
  polyEq([spans[0][0], spans[0][1]].sort((p, q) => p[1] - q[1]), [[400, 100], [400, 300]]);
  assert.equal(shiftSharedSpans(A().poly, [900, 100], [900, 400], [10, 0], OPTS.eps), null); // nothing coincides
});

test('simplifyPoly drops collinear leftovers, polyIsSimple flags a bowtie', () => {
  polyEq(simplifyPoly([[0, 0], [50, 0], [100, 0], [100, 100], [0, 100]]), [[0, 0], [100, 0], [100, 100], [0, 100]]);
  assert.equal(polyIsSimple([[0, 0], [100, 100], [100, 0], [0, 100]]), false);
  assert.equal(polyIsSimple(A().poly), true);
});

test('minParallelClearance: the opposite-wall distance', () => {
  closeTo(minParallelClearance(A().poly, [[[400, 100], [400, 400]]], OPTS.eps), 300);
  // L-shape: only walls with an OVERLAPPING projection count — the x=80 wall
  // spans y 60..200 and casts no shadow on the y 0..60 span, so the opposite
  // wall is x=0 at distance 200 (the x=80 obstruction is the simplicity stop)
  const L = [[0, 0], [200, 0], [200, 60], [80, 60], [80, 200], [0, 200]];
  closeTo(minParallelClearance(L, [[[200, 0], [200, 60]]], OPTS.eps), 200);
});

test('live numbers: areaM2 and formatArea', () => {
  const pitch = 1000 / 240;
  const poly = [[0, 0], [100, 0], [100, 100], [0, 100]]; // 24 cells → 120 cm a side
  closeTo(areaM2(poly, pitch, 5), 1.44, 1e-9);
  assert.equal(formatArea(1.44, false), '1.4 m²');
  assert.equal(formatArea(1.44, true), '16 ft²');
  assert.equal(MIN_ROOM_CM, 30);
});

test('zero drag is always valid and clamps to zero', () => {
  const rooms = [A()];
  const plan = planEdgeDrag(rooms, 'A', 1);
  assert.equal(validateEdgeDrag(rooms, [], plan, 0, OPTS), true);
  assert.equal(clampEdgeDrag(rooms, [], plan, 0, STEP, OPTS), 0);
});

// ================= HP-1550-02 (the v1.55.0 audit): the 30 cm floor must be
// orientation-independent — triangles have no parallel opposite wall and a
// rotated rectangle hides its true short side from the axis-aligned bbox.

test('HP-1550-02: triangle — the min-size stop holds without a parallel opposite wall', () => {
  // base 300 wide, apex 300 above it; drag the base toward the apex
  const T = { id: 'T', poly: [[0, 0], [300, 0], [150, 300]] };
  const rooms = [T];
  const plan = planEdgeDrag(rooms, 'T', 0);
  assert.deepEqual(plan.n.map((v) => Math.round(v) + 0), [0, -1]); // outward = away from the apex
  assert.equal(validateEdgeDrag(rooms, [], plan, -295, OPTS), false); // height 5 < 25
  const d = clampEdgeDrag(rooms, [], plan, -295, STEP, OPTS);
  const height = 300 - Math.abs(d);
  assert.ok(height >= OPTS.minDim - OPTS.eps, `triangle squeezed to height ${height}`);
});

test('HP-1550-02: rotated rectangle — scale stops at the TRUE short side, not the bbox', () => {
  // 500×100 rectangle rotated 45°: its axis-aligned bbox is ≈424×424, so the
  // bbox measure let k=0.1 slip through while the real short side became 10
  const c45 = Math.SQRT1_2;
  const rot = ([x, y]) => [x * c45 - y * c45, x * c45 + y * c45];
  const P = [[0, 0], [500, 0], [500, 100], [0, 100]].map(rot);
  const rooms = [{ id: 'S', poly: P }];
  const fixed = [P[0][0], P[0][1]];
  assert.equal(validateRoomScale(rooms, [], 'S', fixed, 0.1, OPTS), false); // side 10 < 25
  const k = clampRoomScale(rooms, [], 'S', fixed, 0.1, OPTS);
  assert.ok(k * 100 >= OPTS.minDim - OPTS.eps, `short side shrank to ${k * 100}`);
});

test('HP-1550-02: concave room — a non-parallel obstacle stops the drag', () => {
  // a "roof" vertex dips into the room at (200,120); the bottom wall dragged up
  // has NO parallel opposite wall, yet must stop ~30 cm short of the dip
  const C = { id: 'C', poly: [[0, 0], [400, 0], [400, 200], [200, 120], [0, 200]] };
  const rooms = [C];
  const plan = planEdgeDrag(rooms, 'C', 0);
  assert.equal(validateEdgeDrag(rooms, [], plan, -115, OPTS), false); // 5 from the dip
  assert.equal(validateEdgeDrag(rooms, [], plan, -95, OPTS), true);   // 25 — the floor
  closeTo(clampEdgeDrag(rooms, [], plan, -115, STEP, OPTS), -95);
});

test('HP-1550-02: an already-thin triangle may improve but never worsen', () => {
  const T = { id: 'T', poly: [[0, 0], [300, 0], [150, 20]] }; // height 20 < 25 already
  const rooms = [T];
  const plan = planEdgeDrag(rooms, 'T', 0);
  assert.equal(validateEdgeDrag(rooms, [], plan, -5, OPTS), false); // 20 → 15: worse
  assert.equal(validateEdgeDrag(rooms, [], plan, 50, OPTS), true);  // 20 → 70: better
});

// ================= #277: production uses only this fixed-topology pipeline.

const SAFE = { minDim: 25, eps: 0.1, movingHalf: 10, obstacles: [] };

test('#277 non-shared: exactly two existing vertices move and topology stays fixed', () => {
  const rooms = [A()];
  const resolution = resolveSafeResize(rooms, [], 'A', 1, SAFE);
  assert.equal(resolution.enabled, true);
  const result = applySafeResize(rooms, [], resolution.plan, 50);
  polyEq(result.polys.A, [[100, 100], [450, 100], [450, 400], [100, 400]]);
  assert.equal(result.polys.A.length, rooms[0].poly.length);
  assert.deepEqual(Object.keys(result.polys), ['A']);
  assert.equal(validateSafeResize(rooms, [], resolution.plan, 50, SAFE), true);
  assert.equal(validateSafeResize(
    rooms, [], { ...resolution.plan, topology: { A: 5 } }, 50, SAFE,
  ), false);
});

test('#277 exact shared: two rooms move, endpoints remain exact, no third room changes', () => {
  const rooms = [A(), R(), { id: 'F', poly: [[900, 100], [1000, 100], [1000, 400], [900, 400]] }];
  const resolution = resolveSafeResize(rooms, [], 'A', 1, SAFE);
  assert.equal(resolution.enabled, true);
  assert.deepEqual(resolution.plan.roomIds, ['A', 'R']);
  const result = applySafeResize(rooms, [], resolution.plan, 50);
  assert.deepEqual(Object.keys(result.polys), ['A', 'R']);
  assert.equal(result.polys.F, undefined);
  polyEq(result.polys.A, [[100, 100], [450, 100], [450, 400], [100, 400]]);
  polyEq(result.polys.R, [[450, 100], [700, 100], [700, 400], [450, 400]]);
});

test('#277 diagonal and non-perpendicular side walls are disabled deterministically', () => {
  const diagonal = [{ id: 'D', poly: [[0, 0], [100, 20], [100, 100], [0, 100]] }];
  assert.deepEqual(resolveSafeResize(diagonal, [], 'D', 0, SAFE), { enabled: false, reason: 'diagonal' });
  const badSide = [{ id: 'S', poly: [[0, 0], [100, 0], [120, 100], [0, 100]] }];
  assert.deepEqual(resolveSafeResize(badSide, [], 'S', 0, SAFE), { enabled: false, reason: 'side-angle' });
});

test('#277 partial shared and third-owner topology never enter a resize plan', () => {
  const partial = resolveSafeResize([A(), B()], [], 'A', 1, SAFE);
  assert.deepEqual(partial, { enabled: false, reason: 'partial-shared' });
  const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/resize-safe-regression.json', import.meta.url), 'utf8'));
  const realRegression = resolveSafeResize(
    fixture.rooms, [], fixture.selected.roomId, fixture.selected.edge, SAFE,
  );
  assert.deepEqual(realRegression, { enabled: false, reason: fixture.expectedReason });
  assert.match(fixture.provenance, /anonymized/);
});

test('#277 irregular exact pair clamps at the first corner and never removes a vertex', () => {
  const left = A();
  const irregular = {
    id: 'I',
    poly: [[400, 100], [700, 100], [700, 200], [650, 200], [650, 400], [400, 400]],
  };
  const rooms = [left, irregular];
  const resolution = resolveSafeResize(rooms, [], 'A', 1, SAFE);
  assert.equal(resolution.enabled, true);
  assert.equal(validateSafeResize(rooms, [], resolution.plan, 250, SAFE), false);
  // The 25-unit minimum clearance is reached before the zero-length corner.
  assert.equal(clampSafeResize(rooms, [], resolution.plan, 300, 5, SAFE), 225);
  const result = applySafeResize(rooms, [], resolution.plan, 225);
  assert.equal(result.polys.A.length, 4);
  assert.equal(result.polys.I.length, 6);
  assert.equal(result.polys.I[5][0], 625);
});

test('#277 side opening stops at the physical jamb and cannot be jumped', () => {
  const rooms = [A()];
  const openings = [{ id: 'door', x: 250, y: 100, length: 80 }];
  const resolution = resolveSafeResize(rooms, openings, 'A', 1, SAFE);
  assert.equal(resolution.enabled, true);
  // Opening ends at x=290; a 10-unit wall half-depth stops its axis at x=300.
  assert.equal(validateSafeResize(rooms, openings, resolution.plan, -100, SAFE), true);
  assert.equal(validateSafeResize(rooms, openings, resolution.plan, -105, SAFE), false);
  assert.equal(clampSafeResize(rooms, openings, resolution.plan, -200, 5, SAFE), -100);
});

test('#277 moving opening travels once; hosted moving opening is disabled', () => {
  const rooms = [A(), R()];
  const opening = { id: 'door', x: 400, y: 220, length: 80 };
  const resolution = resolveSafeResize(rooms, [opening], 'A', 1, SAFE);
  assert.equal(resolution.enabled, true);
  assert.deepEqual(applySafeResize(rooms, [opening], resolution.plan, 50).openings.door, [450, 220]);
  assert.deepEqual(
    resolveSafeResize(rooms, [{ ...opening, hosted: true }], 'A', 1, SAFE),
    { enabled: false, reason: 'opening-conflict' },
  );
});

test('#277 coincident independent wall disables the handle; a column is a hard stop', () => {
  const duplicate = { ...SAFE, obstacles: [{ kind: 'segment', a: [400, 100], b: [400, 400], half: 10 }] };
  assert.deepEqual(
    resolveSafeResize([A()], [], 'A', 1, duplicate),
    { enabled: false, reason: 'duplicate-physical-wall' },
  );
  assert.deepEqual(
    resolveSafeResize([A()], [], 'A', 1, { ...SAFE, thicknessConflict: true }),
    { enabled: false, reason: 'thickness-conflict' },
  );
  const blocked = { ...SAFE, obstacles: [{ kind: 'circle', center: [500, 250], radius: 20 }] };
  const resolution = resolveSafeResize([A()], [], 'A', 1, blocked);
  assert.equal(resolution.enabled, true);
  assert.equal(clampSafeResize([A()], [], resolution.plan, 150, 5, blocked), 70);
});

test('#277 pointer clamp memoizes exact deltas and bounds the active-plan cache', () => {
  const rooms = [A()];
  const resolution = resolveSafeResize(rooms, [], 'A', 1, SAFE);
  assert.equal(resolution.enabled, true);
  assert.equal(clampSafeResize(rooms, [], resolution.plan, 100, 5, SAFE), 100);
  const once = safeResizeCachedDeltaCount(resolution.plan);
  assert.equal(once, 20);
  assert.equal(clampSafeResize(rooms, [], resolution.plan, 100, 5, SAFE), 100);
  assert.equal(safeResizeCachedDeltaCount(resolution.plan), once);
  assert.ok(once <= 4096);
});
