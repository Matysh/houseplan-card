// The furniture library (docs/FURNITURE.md): the arithmetic that turns real
// centimetres into canvas units, the wall magnet, the independent resize and
// the generated geometry. Everything here is pure — the card only renders it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FURNITURE, FURNITURE_GROUPS, furnitureSymbol, furnitureOfGroup,
  furnitureDefaultCm, furniturePathD, furnitureGraphic, furnitureCorners, furnitureResize,
  snapFurnitureToWall, cmToNorm, normToCm, clampFurnSize, clampFurnCm,
  FURN_MIN_N, FURN_MIN_CM, FURN_MAX_CM, FURN_WALL_CELLS,
} from '../test-build/furniture.js';
import { roomEdges } from '../test-build/logic.js';
import { NORM_W, GRID_PITCH, GRID_N } from '../test-build/space-geometry.js';

const closeTo = (got, want, tol = 1e-9) =>
  assert.ok(Math.abs(got - want) <= tol, `expected ${want}, got ${got}`);

// ------------------------------- the table ---------------------------------

test('every symbol is well formed: unique id, a known group, positive default size', () => {
  const seen = new Set();
  for (const s of FURNITURE) {
    assert.ok(/^[a-z0-9_]+$/.test(s.id), `bad id ${s.id}`);
    assert.ok(!seen.has(s.id), `duplicate id ${s.id}`);
    seen.add(s.id);
    assert.ok(FURNITURE_GROUPS.includes(s.group), `${s.id}: unknown group ${s.group}`);
    assert.ok(s.w > 0 && s.h > 0, `${s.id}: default size must be positive`);
    assert.match(s.category, /^[a-z0-9_]+$/, `${s.id}: invalid category`);
    assert.ok(furnitureGraphic(s.id)?.d, `${s.id}: nothing to draw`);
    if (s.g) {
      // Retained primitive art stays in the legacy unit box.
      for (const p of s.g) {
        const nums = p.slice(1);
        for (const v of nums) assert.ok(v >= -0.001 && v <= 1.001, `${s.id}: ${v} outside the unit box`);
      }
    } else {
      assert.deepEqual([s.art.viewW, s.art.viewH], [s.w, s.h], `${s.id}: manifest and SVG viewBox differ`);
    }
  }
  assert.equal(FURNITURE.length, 56);
  assert.equal(FURNITURE.filter((s) => s.art).length, 44);
  assert.equal(FURNITURE.filter((s) => s.g).length, 12);
});

test('the three groups the owner named are all populated, and every symbol is in exactly one', () => {
  for (const g of ['furniture', 'appliance', 'sanitary'])
    assert.ok(furnitureOfGroup(g).length > 0, `group ${g} is empty`);
  const total = FURNITURE_GROUPS.reduce((n, g) => n + furnitureOfGroup(g).length, 0);
  assert.equal(total, FURNITURE.length);
});

test('the owner’s default sizes are the ones stored', () => {
  // owner’s list, read as width ALONG the back edge x depth
  assert.deepEqual(furnitureDefaultCm('sofa'), { w: 180, h: 90 });
  assert.deepEqual(furnitureDefaultCm('bed_double'), { w: 160, h: 200 });
  assert.deepEqual(furnitureDefaultCm('bed_single'), { w: 90, h: 200 });
  assert.deepEqual(furnitureDefaultCm('table_dining'), { w: 160, h: 90 });
  assert.deepEqual(furnitureDefaultCm('toilet'), { w: 40, h: 70 });
  assert.deepEqual(furnitureDefaultCm('bathtub'), { w: 170, h: 75 });
  assert.deepEqual(furnitureDefaultCm('shower'), { w: 90, h: 90 });
  assert.deepEqual(furnitureDefaultCm('sink'), { w: 60, h: 45 });
  assert.deepEqual(furnitureDefaultCm('stove'), { w: 60, h: 60 });
  assert.deepEqual(furnitureDefaultCm('fridge'), { w: 60, h: 65 });
  assert.deepEqual(furnitureDefaultCm('washer'), { w: 60, h: 60 });
  assert.deepEqual(furnitureDefaultCm('dishwasher'), { w: 60, h: 60 });
  assert.deepEqual(furnitureDefaultCm('wardrobe'), { w: 180, h: 60 });
  assert.deepEqual(furnitureDefaultCm('chair'), { w: 50, h: 50 });
  assert.deepEqual(furnitureDefaultCm('desk'), { w: 140, h: 70 });
  assert.deepEqual(furnitureDefaultCm('sofa_corner_right'), { w: 260, h: 170 });
  assert.deepEqual(furnitureDefaultCm('kitchen_sink_double'), { w: 90, h: 50 });
});

test('an unknown symbol is data, not a crash', () => {
  assert.equal(furnitureSymbol('no_such_thing'), null);
  assert.equal(furnitureSymbol(undefined), null);
  assert.deepEqual(furnitureDefaultCm('no_such_thing'), { w: 60, h: 60 });
  assert.equal(furniturePathD('no_such_thing', 10, 10), '');
});

// --------------------------- centimetres <-> canvas -------------------------

test('cmToNorm goes through cell_cm: one cell of the grid is cell_cm centimetres', () => {
  // a 220 cm sofa on a 5 cm/cell plan is 44 cells; the canvas has GRID_N cells
  closeTo(cmToNorm(220, 5), 44 / GRID_N, 1e-12);
  // …and the same sofa on a 10 cm/cell plan is HALF the canvas fraction
  closeTo(cmToNorm(220, 10), 22 / GRID_N, 1e-12);
  // the render-unit form the card actually uses
  closeTo(cmToNorm(220, 5) * NORM_W, (220 / 5) * GRID_PITCH, 1e-9);
});

test('normToCm is its inverse, and a missing cell_cm defaults to 5', () => {
  for (const cm of [1, 45, 220, 10000]) {
    closeTo(normToCm(cmToNorm(cm, 5), 5), cm, 1e-9);
    closeTo(normToCm(cmToNorm(cm, 12.5), 12.5), cm, 1e-9);
  }
  closeTo(cmToNorm(100, 0), cmToNorm(100, 5), 1e-12);
  closeTo(cmToNorm(100, NaN), cmToNorm(100, 5), 1e-12);
});

test('sizes are clamped, not trusted', () => {
  assert.equal(clampFurnSize(NaN), FURN_MIN_N);
  assert.equal(clampFurnSize(-3), FURN_MIN_N);
  assert.equal(clampFurnSize(1e9), 5000);
  assert.equal(clampFurnCm(0), FURN_MIN_CM);
  assert.equal(clampFurnCm(1e9), FURN_MAX_CM);
  assert.equal(clampFurnCm(220), 220);
});

// ------------------------------- the drawing --------------------------------

test('designer paths keep their native viewBox; retained paths still scale from the unit box', () => {
  const sofa = furnitureGraphic('sofa');
  assert.deepEqual([sofa.viewW, sofa.viewH], [180, 90]);
  assert.ok(sofa.d.length > 10);
  const fridge = furniturePathD('fridge', 60, 65);
  assert.ok(fridge.startsWith('M0 0H60V65H0Z'), fridge.slice(0, 40));
  // a degenerate box draws nothing rather than NaNs
  assert.equal(furniturePathD('sofa', 0, 10), '');
  assert.ok(!/NaN/.test(furniturePathD('toilet', 40, 70)));
});

test('every symbol exposes one finite path and a positive native coordinate box', () => {
  for (const s of FURNITURE) {
    const art = furnitureGraphic(s.id);
    assert.ok(art.viewW > 0 && art.viewH > 0, `${s.id}: invalid viewBox`);
    assert.ok(art.d.length > 0, `${s.id}: empty path`);
    assert.ok(!/NaN|Infinity|undefined/.test(art.d), `${s.id}: ${art.d.slice(0, 60)}`);
  }
});

// ------------------------------ the wall magnet -----------------------------

// one 400x300 room, normalised like the config stores it, in render units
const ROOM = { id: 'r', poly: [[0.1, 0.1], [0.5, 0.1], [0.5, 0.4], [0.1, 0.4]] };
const EDGES = roomEdges([ROOM]).map((e) => [e[0] * 1000, e[1] * 1000, e[2] * 1000, e[3] * 1000]);
// -> the box (100,100)-(500,400) in render units

test('the magnet presses the BACK edge onto the wall and turns the piece to it', () => {
  // held just inside the TOP wall (y=100), body below it -> angle 0, back on y=100
  const s = snapFurnitureToWall(300, 112, 90, EDGES, 30);
  assert.ok(s, 'a wall 12 units away must be found');
  closeTo(s.angle, 0);
  closeTo(s.cy, 100 + 45);          // centre = wall + half the depth
  closeTo(s.cx, 300);
  closeTo(s.dist, 12);
});

test('the same wall from the OTHER side turns the piece round instead of flipping it through', () => {
  const s = snapFurnitureToWall(300, 88, 90, EDGES, 30);   // above the top wall
  closeTo(Math.abs(s.angle), 180);
  closeTo(s.cy, 100 - 45);
});

test('a vertical wall gives a right angle and the depth measured sideways', () => {
  const left = snapFurnitureToWall(112, 250, 60, EDGES, 30);  // inside the x=100 wall
  closeTo(Math.abs(left.angle), 90);
  closeTo(left.cx, 100 + 30);
  closeTo(left.cy, 250);
  const right = snapFurnitureToWall(488, 250, 60, EDGES, 30); // inside the x=500 wall
  closeTo(right.cx, 500 - 30);
  // the two are opposite: the back always looks at its own wall
  closeTo(Math.abs(((left.angle - right.angle) % 360 + 360) % 360), 180);
});

test('out of reach there is no magnet at all', () => {
  assert.equal(snapFurnitureToWall(300, 250, 90, EDGES, 30), null);  // middle of the room
  assert.equal(snapFurnitureToWall(300, 112, 90, [], 30), null);     // no walls
  // …and the threshold is a threshold: 30.1 away with a reach of 30 is a miss
  assert.equal(snapFurnitureToWall(300, 130.1, 90, EDGES, 30), null);
  assert.ok(snapFurnitureToWall(300, 129.9, 90, EDGES, 30));
});

test('the offset ALONG the wall is quantised to the grid when a step is given', () => {
  const step = GRID_PITCH;                     // one cell
  const free = snapFurnitureToWall(303.3, 112, 90, EDGES, 30);
  const snapped = snapFurnitureToWall(303.3, 112, 90, EDGES, 30, step);
  closeTo(free.cx, 303.3);
  // the wall starts at x=100, so a snapped centre sits on 100 + k*step
  closeTo(((snapped.cx - 100) / step) % 1, 0, 1e-9);
  assert.ok(Math.abs(snapped.cx - 303.3) <= step);
});

test('the default reach is six cells — thirty centimetres on a default plan', () => {
  assert.equal(FURN_WALL_CELLS, 6);
  closeTo(GRID_PITCH * FURN_WALL_CELLS * (5 / GRID_PITCH), 30);  // cells x cell_cm
});

// ------------------------------- the frame ----------------------------------

test('the corners of an unrotated box are the box; a rotated one turns about its centre', () => {
  assert.deepEqual(furnitureCorners(100, 200, 40, 20, 0),
    [[100, 200], [140, 200], [140, 220], [100, 220]]);
  const c = furnitureCorners(0, 0, 40, 20, 90);
  // 90 degrees clockwise in SVG coordinates: the NW corner lands top-right
  closeTo(c[0][0], 30); closeTo(c[0][1], -10);
  closeTo(c[2][0], 10); closeTo(c[2][1], 30);
});

test('a corner drag moves BOTH axes and keeps the opposite corner still', () => {
  const orig = { x: 100, y: 100, w: 200, h: 100, angle: 0 };
  // pull the SE corner (+1,+1) out to (360, 260): the NW corner must not move
  const r = furnitureResize(orig, 1, 1, 360, 260);
  closeTo(r.x, 100); closeTo(r.y, 100);
  closeTo(r.w, 260); closeTo(r.h, 160);
  // …and pulling the NW corner (-1,-1) keeps the SE one
  const r2 = furnitureResize(orig, -1, -1, 60, 60);
  closeTo(r2.x + r2.w, 300); closeTo(r2.y + r2.h, 200);
  closeTo(r2.w, 240); closeTo(r2.h, 140);
});

test('the two axes are INDEPENDENT: the aspect ratio is not preserved', () => {
  const orig = { x: 0, y: 0, w: 200, h: 100 };
  const r = furnitureResize(orig, 1, 1, 400, 110);
  closeTo(r.w, 400);
  closeTo(r.h, 110);   // a uniform scale would have made this 200
});

test('a step quantises each dimension; without one the drag is exact (Shift)', () => {
  const orig = { x: 0, y: 0, w: 200, h: 100 };
  const step = GRID_PITCH;
  const snapped = furnitureResize(orig, 1, 1, 203.3, 101.1, step);
  closeTo((snapped.w / step) % 1, 0, 1e-9);
  closeTo((snapped.h / step) % 1, 0, 1e-9);
  const free = furnitureResize(orig, 1, 1, 203.3, 101.1, 0);
  closeTo(free.w, 203.3); closeTo(free.h, 101.1);
});

test('a resize never collapses below the minimum, however far the corner is dragged back', () => {
  const orig = { x: 0, y: 0, w: 200, h: 100 };
  const r = furnitureResize(orig, 1, 1, -500, -500, 0, 2);
  closeTo(r.w, 2); closeTo(r.h, 2);
});

test('resizing a ROTATED piece works along its own axes and keeps its own fixed corner', () => {
  const orig = { x: 0, y: 0, w: 100, h: 50, angle: 90 };
  // the fixed corner of an SE drag is the piece's NW corner, in WORLD units
  const fixed = furnitureCorners(orig.x, orig.y, orig.w, orig.h, orig.angle)[0];
  const r = furnitureResize(orig, 1, 1, fixed[0] + 10, fixed[1] + 200, 0);
  const after = furnitureCorners(r.x, r.y, r.w, r.h, orig.angle)[0];
  closeTo(after[0], fixed[0], 1e-6);
  closeTo(after[1], fixed[1], 1e-6);
  // rotated 90 degrees, pulling DOWN in world space grows the piece's WIDTH
  closeTo(r.w, 200, 1e-6);
});
