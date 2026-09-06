// The furniture library (docs/FURNITURE.md): the arithmetic that turns real
// centimetres into canvas units, the wall magnet, the independent resize and
// the generated geometry. Everything here is pure — the card only renders it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FURNITURE, FURNITURE_GROUPS, furnitureSymbol, furnitureOfGroup,
  furnitureDefaultCm, furniturePathD, furnitureGraphic, furnitureCorners, furnitureResize,
  furniturePlanScreenScale, furnitureStrokePx,
  resizeFurnitureTransform, furnitureRotationAngle, furnitureRenderTransform,
  furnitureSignedFieldCm, furnitureSignedFieldValue,
  cmToNorm, normToCm, clampFurnSize, clampFurnCm,
  FURN_MIN_N, FURN_MIN_CM, FURN_MAX_CM,
} from '../test-build/furniture.js';
import {
  FURN_WALL_CELLS, resolveFurniturePlacement, snapFurnitureToWall,
} from '../test-build/furniture-placement.js';
import {
  furnitureWallSurfacesFor, physicalFurnitureWallSurfaces, roomFurnitureWallSurfaces,
} from '../test-build/furniture-wall-surface.js';
import { setWallThickness, wallCmToUnits } from '../test-build/wall-thickness.js';
import { FURNITURE_ART_RUNTIME } from '../test-build/furniture-art-runtime.js';
import { FURNITURE_ART_FINGERPRINT, GENERATED_FURNITURE_ART } from '../test-build/furniture-plan-art.generated.js';

// #474: designer artwork is lazy; these tests exercise the library with the
// artwork handed over the way the editor does it (synchronous adopt).
assert.equal(FURNITURE_ART_RUNTIME.adopt(GENERATED_FURNITURE_ART, FURNITURE_ART_FINGERPRINT), true);
import { NORM_W, GRID_PITCH, GRID_N, GRID_STEP_N } from '../test-build/space-geometry.js';

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
      const art = furnitureGraphic(s.id);
      assert.equal(s.designer, true, `${s.id}: designer symbol without the lazy flag`);
      assert.deepEqual([art.viewW, art.viewH], [s.w, s.h], `${s.id}: manifest and SVG viewBox differ`);
    }
  }
  assert.equal(FURNITURE.length, 56);
  assert.equal(FURNITURE.filter((s) => s.designer).length, 44);
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

test('furniture stroke follows the outer plan viewBox camera like physical decor', () => {
  // 1000 plan units fitted into 500 CSS px: the same 3-unit physical line is
  // 1.5 px on screen. Halving the viewBox is a 2x camera zoom and doubles it.
  const fit = furniturePlanScreenScale(500, 300, 1000, 600);
  const zoom2 = furniturePlanScreenScale(500, 300, 500, 300);
  closeTo(fit, 0.5);
  closeTo(zoom2, 1);
  closeTo(furnitureStrokePx(3, fit), 1.5);
  closeTo(furnitureStrokePx(3, zoom2), 3);
  closeTo(furnitureStrokePx(3, zoom2) / furnitureStrokePx(3, fit), 2);
});

test('furniture stroke uses the meet scale and stays independent of the local artwork box', () => {
  // Width alone would say 0.8; xMidYMid meet is constrained by height at 0.5.
  const letterboxed = furniturePlanScreenScale(800, 300, 1000, 600);
  closeTo(letterboxed, 0.5);
  const stroke = furnitureStrokePx(4, letterboxed);
  for (const symbol of ['sofa', 'fridge']) {
    assert.ok(furnitureGraphic(symbol), `${symbol}: fixture must render`);
    // Designer native viewBox and retained unit-box art receive the same
    // physical stroke even if their independent width/depth scales differ.
    closeTo(furnitureStrokePx(4, letterboxed), stroke);
  }
});

test('furniture stroke layout fallbacks are finite and recover on measured layout', () => {
  for (const metrics of [
    [0, 300, 1000, 600], [500, NaN, 1000, 600], [500, 300, 0, 600],
    [undefined, undefined, undefined, undefined],
  ]) assert.equal(furniturePlanScreenScale(...metrics), 1);
  assert.equal(furnitureStrokePx(NaN, NaN, 2.5), 2.5);
  assert.equal(furnitureStrokePx(3, 0), 3);
  assert.ok(Number.isFinite(furnitureStrokePx(Infinity, Infinity)));
  closeTo(furnitureStrokePx(3, furniturePlanScreenScale(500, 300, 500, 300)), 3);
});

// ------------------------------ the wall magnet -----------------------------

// One 400x300 room in the render-space units used by the card.
const ROOM = { id: 'r', poly: [[100, 100], [500, 100], [500, 400], [100, 400]] };
const roomSurfaces = (rooms, walls = [], openCuts = []) => roomFurnitureWallSurfaces(
  rooms, walls, openCuts, GRID_STEP_N, 5, GRID_PITCH, NORM_W,
);
const ZERO_SURFACES = roomSurfaces([ROOM]);
const thickTopWalls = (cm) => setWallThickness(
  [], ROOM.poly[0], ROOM.poly[1], cm, GRID_STEP_N, NORM_W,
);
const THICK_SURFACES = roomSurfaces([ROOM], thickTopWalls(20));
const HALF_10 = wallCmToUnits(10, 5, GRID_PITCH) / 2;
const HALF_20 = wallCmToUnits(20, 5, GRID_PITCH) / 2;
const TOP_20 = 100 + HALF_20;

test('the magnet presses the BACK edge onto the wall and turns the piece to it', () => {
  const s = snapFurnitureToWall(300, TOP_20, 90, THICK_SURFACES, 30);
  assert.ok(s, 'the physical face under the pointer must be found');
  closeTo(s.angle, 0);
  closeTo(s.cy, TOP_20 + 45);       // centre = physical face + half the depth
  closeTo(s.cx, 300);
  closeTo(s.dist, 0);
});

test('an exterior wall exposes both physical faces and keeps furniture on the intent side', () => {
  const outsideY = 100 - HALF_20;
  const s = snapFurnitureToWall(300, outsideY, 90, THICK_SURFACES, 30);
  closeTo(Math.abs(s.angle), 180);
  closeTo(s.cy, outsideY - 45);
  closeTo(s.dist, 0);

  const top = THICK_SURFACES.filter((surface) => Math.abs(surface.axisA[1] - 100) < 1e-9
    && Math.abs(surface.axisB[1] - 100) < 1e-9);
  assert.equal(top.length, 2);
  assert.deepEqual(top.map((surface) => surface.roomSide).sort(), ['inside', 'outside']);
  const inside = snapFurnitureToWall(300, TOP_20, 90, THICK_SURFACES, 30);
  closeTo(inside.angle, 0);
  closeTo(inside.cy, TOP_20 + 45);
});

test('new exact-axis exterior placement defaults inside while drag preserves either side', () => {
  const placed = snapFurnitureToWall(300, 100, 90, THICK_SURFACES, 30);
  closeTo(placed.angle, 0);
  closeTo(placed.cy, TOP_20 + 45);
  const keepOutside = snapFurnitureToWall(
    300, 100, 90, [...THICK_SURFACES].reverse(), 30, 0, [300, 100], [0, -1],
  );
  closeTo(Math.abs(keepOutside.angle), 180);
  closeTo(keepOutside.cy, 100 - HALF_20 - 45);
});

test('a vertical wall gives a right angle and the depth measured sideways', () => {
  const left = snapFurnitureToWall(112, 250, 60, THICK_SURFACES, 30);
  closeTo(Math.abs(left.angle), 90);
  closeTo(left.cx, 100 + 30); // this unconfigured edge remains zero-thickness
  closeTo(left.cy, 250);
  const right = snapFurnitureToWall(488, 250, 60, THICK_SURFACES, 30);
  closeTo(right.cx, 500 - 30);
  // the two are opposite: the back always looks at its own wall
  closeTo(Math.abs(((left.angle - right.angle) % 360 + 360) % 360), 180);
});

test('out of reach there is no magnet at all', () => {
  assert.equal(snapFurnitureToWall(300, 250, 90, ZERO_SURFACES, 30), null);
  assert.equal(snapFurnitureToWall(300, 112, 90, [], 30), null);     // no walls
  // Reach is measured from the physical y=112 face, not the y=100 axis.
  assert.equal(snapFurnitureToWall(300, TOP_20 + 30.1, 90, THICK_SURFACES, 30), null);
  assert.ok(snapFurnitureToWall(300, TOP_20 + 29.9, 90, THICK_SURFACES, 30));
});

test('the offset ALONG the wall is quantised to the grid when a step is given', () => {
  const step = GRID_PITCH;                     // one cell
  const free = snapFurnitureToWall(303.3, TOP_20, 90, THICK_SURFACES, 30);
  const snapped = snapFurnitureToWall(303.3, TOP_20, 90, THICK_SURFACES, 30, step);
  closeTo(free.cx, 303.3);
  // the wall starts at x=100, so a snapped centre sits on 100 + k*step
  closeTo(((snapped.cx - 100) / step) % 1, 0, 1e-9);
  assert.ok(Math.abs(snapped.cx - 303.3) <= step);
});

test('a shared thick wall selects the intent side and exact-axis drag preserves its side', () => {
  const rooms = [
    { id: 'a', poly: [[100, 100], [300, 100], [300, 400], [100, 400]] },
    { id: 'b', poly: [[300, 100], [500, 100], [500, 400], [300, 400]] },
  ];
  const walls = setWallThickness(
    [], [300, 100], [300, 400], 20, GRID_STEP_N, NORM_W,
  );
  const surfaces = roomSurfaces(rooms, walls);
  const shared = surfaces.filter((surface) => Math.abs(surface.axisA[0] - 300) < 1e-9
    && Math.abs(surface.axisB[0] - 300) < 1e-9);
  assert.equal(shared.length, 2, 'a shared atom already has one room-facing face per room');
  assert.ok(shared.every((surface) => surface.roomSide === undefined));
  const left = snapFurnitureToWall(280, 250, 60, surfaces, 30);
  const right = snapFurnitureToWall(320, 250, 60, surfaces, 30);
  closeTo(left.cx, 300 - HALF_20 - 30);
  closeTo(right.cx, 300 + HALF_20 + 30);
  closeTo(left.dist, 20 - HALF_20);
  closeTo(right.dist, 20 - HALF_20);

  // The higher-level decor snap may move the placement point onto the axis;
  // the untouched pointer still owns the requested room side.
  const snappedPointKeepsIntent = snapFurnitureToWall(
    300, 250, 60, surfaces, 30, 0, [320, 250],
  );
  closeTo(snappedPointKeepsIntent.cx, 300 + HALF_20 + 30);

  const keepRight = snapFurnitureToWall(
    300, 250, 60, surfaces, 30, 0, [300, 250], [1, 0],
  );
  closeTo(keepRight.cx, 300 + HALF_20 + 30);
  const keepLeft = snapFurnitureToWall(
    300, 250, 60, [...surfaces].reverse(), 30, 0, [300, 250], [-1, 0],
  );
  closeTo(keepLeft.cx, 300 - HALF_20 - 30);
});

test('partially shared edges are atomised before exterior ownership is assigned', () => {
  const rooms = [
    { id: 'main', poly: [[100, 100], [500, 100], [500, 400], [100, 400]] },
    { id: 'side', poly: [[500, 200], [700, 200], [700, 300], [500, 300]] },
  ];
  const walls = setWallThickness(
    [], [500, 100], [500, 400], 20, GRID_STEP_N, NORM_W,
  );
  const surfaces = roomSurfaces(rooms, walls);
  const vertical = surfaces.filter((surface) => Math.abs(surface.axisA[0] - 500) < 1e-9
    && Math.abs(surface.axisB[0] - 500) < 1e-9);
  const span = (surface) => [surface.axisA[1], surface.axisB[1]].sort((a, b) => a - b);
  const shared = vertical.filter((surface) => {
    const [lo, hi] = span(surface);
    return Math.abs(lo - 200) < 1e-9 && Math.abs(hi - 300) < 1e-9;
  });
  assert.equal(shared.length, 2);
  assert.ok(shared.every((surface) => surface.roomSide === undefined));
  for (const [lo, hi] of [[100, 200], [300, 400]]) {
    const outer = vertical.filter((surface) => {
      const extent = span(surface);
      return Math.abs(extent[0] - lo) < 1e-9 && Math.abs(extent[1] - hi) < 1e-9;
    });
    assert.equal(outer.length, 2, `outer child ${lo}..${hi} needs inside + outside`);
    assert.deepEqual(outer.map((surface) => surface.roomSide).sort(), ['inside', 'outside']);
  }
});

test('new exact-axis placement is stable across room order, winding and surface order', () => {
  const base = [
    { id: 'a', poly: [[100, 100], [300, 100], [300, 400], [100, 400]] },
    { id: 'b', poly: [[300, 100], [500, 100], [500, 400], [300, 400]] },
  ];
  const walls = setWallThickness(
    [], [300, 100], [300, 400], 20, GRID_STEP_N, NORM_W,
  );
  const variants = [
    base,
    [...base].reverse(),
    base.map((room) => ({ ...room, poly: [...room.poly].reverse() })),
  ];
  const snaps = variants.flatMap((rooms) => {
    const surfaces = roomSurfaces(rooms, walls);
    return [surfaces, [...surfaces].reverse()].map((input) =>
      snapFurnitureToWall(300, 250, 60, input, 30));
  });
  for (const snap of snaps.slice(1)) {
    closeTo(snap.cx, snaps[0].cx);
    closeTo(snap.cy, snaps[0].cy);
    closeTo(snap.angle, snaps[0].angle);
  }
});

test('local atomic wall thickness owns the surface under the projection', () => {
  let walls = setWallThickness(
    [], [100, 100], [300, 100], 10, GRID_STEP_N, NORM_W,
  );
  walls = setWallThickness(
    walls, [300, 100], [500, 100], 20, GRID_STEP_N, NORM_W,
  );
  const surfaces = roomSurfaces([ROOM], walls);
  const thin = snapFurnitureToWall(200, 100 + HALF_10, 20, surfaces, 30);
  const thick = snapFurnitureToWall(400, 100 + HALF_20, 20, surfaces, 30);
  closeTo(thin.cy, 100 + HALF_10 + 10);
  closeTo(thick.cy, 100 + HALF_20 + 10);
  closeTo(thin.dist, 0);
  closeTo(thick.dist, 0);
});

test('zero walls keep the old centreline geometry', () => {
  const snap = snapFurnitureToWall(300, 112, 90, ZERO_SURFACES, 30);
  closeTo(snap.cy, 100 + 45);
  closeTo(snap.dist, 12);
});

test('independent physical-body faces are not offset twice', () => {
  const surfaces = physicalFurnitureWallSurfaces([[
    [200, 200], [400, 200], [400, 220], [200, 220],
  ]]);
  const above = snapFurnitureToWall(300, 190, 20, surfaces, 30);
  closeTo(above.cy, 200 - 10);
  closeTo(above.dist, 10);
  const below = snapFurnitureToWall(300, 230, 20, surfaces, 30);
  closeTo(below.cy, 220 + 10);
  closeTo(below.dist, 10);
});

test('corner selection is nearest-first, intent-aware and invariant to input order', () => {
  const horizontal = {
    a: [-100, 0], b: [100, 0], axisA: [-100, 0], axisB: [100, 0],
    normal: [0, 1], owner: 'room', stableId: 'z-horizontal', roomId: 'h',
  };
  const vertical = {
    a: [0, -100], b: [0, 100], axisA: [0, -100], axisB: [0, 100],
    normal: [1, 0], owner: 'room', stableId: 'a-vertical', roomId: 'v',
  };
  const nearest = snapFurnitureToWall(20, 10, 10, [horizontal, vertical], 30);
  closeTo(nearest.angle, 0); // y=0 is 10 away; x=0 is 20 away

  // Equal distance, but the point is on the allowed side of horizontal and
  // the forbidden side of vertical. Intent wins even though vertical sorts first.
  const intended = snapFurnitureToWall(-10, 10, 10, [vertical, horizontal], 30);
  closeTo(intended.angle, 0);

  const tiedA = snapFurnitureToWall(10, 10, 10, [horizontal, vertical], 30);
  const tiedB = snapFurnitureToWall(10, 10, 10, [vertical, horizontal], 30);
  assert.deepEqual(tiedA, tiedB);
  closeTo(Math.abs(tiedA.angle), 90); // stable id a-vertical wins full equality
});

test('malformed surfaces are ignored and along-wall quantisation stays inside an atom', () => {
  const valid = THICK_SURFACES.find((surface) => surface.roomId === 'r'
    && Math.abs(surface.a[1] - TOP_20) < 1e-9);
  const broken = {
    a: [NaN, 0], b: [0, 0], axisA: [0, 0], axisB: [0, 0],
    normal: [0, 1], owner: 'room', stableId: 'broken', roomId: 'bad',
  };
  const snap = snapFurnitureToWall(
    499.9, TOP_20, 10, [broken, valid], 30, 400, [499.9, TOP_20],
  );
  assert.ok(Number.isFinite(snap.cx) && Number.isFinite(snap.cy));
  closeTo(snap.cx, 500); // rounded along coordinate is clamped to the atom end
});

test('runtime wall surfaces are built once per geometry epoch', () => {
  let builds = 0;
  const source = {
    _cfgEpoch: 1,
    _cellCm: 5,
    _gridPitch: GRID_PITCH,
    _wallKeyPitch: GRID_STEP_N,
    _spaceWalls: thickTopWalls(20),
    _spaceModel: () => ({ id: 'cache-room', rooms: [ROOM] }),
    _openCuts: () => { builds++; return []; },
    _rawPhysicalBodiesR: () => [],
  };
  const first = furnitureWallSurfacesFor(source);
  const second = furnitureWallSurfacesFor(source);
  assert.equal(first, second);
  assert.equal(builds, 1);
  source._cfgEpoch++;
  const afterGeometryChange = furnitureWallSurfacesFor(source);
  assert.notEqual(afterGeometryChange, first);
  assert.equal(builds, 2);
});

test('the default reach is six cells — thirty centimetres on a default plan', () => {
  assert.equal(FURN_WALL_CELLS, 6);
  closeTo(GRID_PITCH * FURN_WALL_CELLS * (5 / GRID_PITCH), 30);  // cells x cell_cm
});

test('preview and commit share one deterministic furniture placement resolver', () => {
  const input = {
    symbol: 'sofa', widthCm: 180, depthCm: 90,
    point: [300, TOP_20], canvasW: 1000, canvasH: 1000,
    intentPoint: [300, TOP_20],
    cellCm: 5, gridPitch: GRID_PITCH, walls: THICK_SURFACES,
    wallReach: 30,
  };
  const preview = resolveFurniturePlacement(input);
  const commit = resolveFurniturePlacement({ ...input });
  assert.deepEqual(preview, commit);
  assert.equal(preview.symbol, 'sofa');
  closeTo((preview.x + preview.w / 2) * 1000, 300, GRID_PITCH);
  closeTo((preview.y + preview.h / 2) * 1000, TOP_20 + preview.h * 500);
  assert.equal(preview.angle, 0);
});

test('the shared placement resolver supports Shift/free, canvas guards and unknown symbols', () => {
  const base = {
    symbol: 'sofa', widthCm: 180, depthCm: 90,
    point: [300, TOP_20], canvasW: 1000, canvasH: 1000,
    intentPoint: [300, TOP_20],
    cellCm: 5, gridPitch: GRID_PITCH, walls: THICK_SURFACES,
    wallReach: 30,
  };
  const free = resolveFurniturePlacement({ ...base, free: true });
  closeTo((free.x + free.w / 2) * 1000, 300);
  closeTo((free.y + free.h / 2) * 1000, TOP_20);
  const guarded = resolveFurniturePlacement({ ...base, point: [-1e9, -1e9], free: true });
  assert.equal(guarded.x, -5000);
  assert.equal(guarded.y, -5000);
  assert.equal(resolveFurniturePlacement({ ...base, symbol: 'future_unknown_symbol' }), null);
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

test('#383 furniture resize is sub-grid, proportional by default and independent with Shift', () => {
  const orig = { x: 10, y: 20, w: 40, h: 20 };
  const proportional = resizeFurnitureTransform(orig, 1, 1, 50.37, 40.02, true, 0.1);
  closeTo(proportional.w / proportional.h, 2);
  assert.ok(Math.abs(proportional.w / GRID_PITCH - Math.round(proportional.w / GRID_PITCH)) > 1e-3,
    'continuous resize must not land on the cell lattice by construction');
  const independent = resizeFurnitureTransform(orig, 1, 1, 50.37, 40.02, false, 0.1);
  closeTo(independent.w, 40.37);
  closeTo(independent.h, 20.02);
});

test('#383 edge handles change one local axis and keep the opposite world edge fixed', () => {
  const orig = { x: 10, y: 20, w: 40, h: 20, angle: 90 };
  const before = furnitureCorners(orig.x, orig.y, orig.w, orig.h, orig.angle);
  const right = resizeFurnitureTransform(orig, 1, 0, 30, 90, false, 0.1);
  closeTo(right.h, orig.h);
  const after = furnitureCorners(right.x, right.y, right.w, right.h, orig.angle);
  closeTo((after[0][0] + after[3][0]) / 2, (before[0][0] + before[3][0]) / 2);
  closeTo((after[0][1] + after[3][1]) / 2, (before[0][1] + before[3][1]) / 2);

  const bottom = resizeFurnitureTransform(orig, 0, 1, -20, 40, false, 0.1);
  closeTo(bottom.w, orig.w);
});

test('#383 crossing keeps positive extents, toggles only crossed flips and preserves fixed corner', () => {
  const orig = { x: 0, y: 0, w: 40, h: 20, angle: 30, flip_h: true };
  const fixed = furnitureCorners(orig.x, orig.y, orig.w, orig.h, orig.angle)[0];
  const crossed = resizeFurnitureTransform(orig, 1, 1, fixed[0] - 20, fixed[1] + 5, false, 0.1);
  assert.ok(crossed.w > 0 && crossed.h > 0);
  assert.equal(crossed.flip_h, undefined, 'crossing horizontal axis toggles existing H flip off');
  assert.equal(crossed.flip_v, undefined);
  const after = furnitureCorners(crossed.x, crossed.y, crossed.w, crossed.h, orig.angle);
  // A crossed active corner becomes the adjacent geometric corner; the fixed
  // world point is nevertheless still one of the box corners.
  assert.ok(after.some((point) => Math.hypot(point[0] - fixed[0], point[1] - fixed[1]) < 1e-8));

  const both = resizeFurnitureTransform({ x: 0, y: 0, w: 40, h: 20 }, 1, 1, -5, -8, false, 0.1);
  assert.equal(both.flip_h, true);
  assert.equal(both.flip_v, true);
  assert.deepEqual([both.w, both.h], [5, 8]);
});

test('#383 furniture rotation is free normally and Shift snaps to 45 degrees', () => {
  closeTo(furnitureRotationAngle(10, 20, 33.4, false), 23.4);
  assert.equal(furnitureRotationAngle(10, 20, 33.4, true), 45);
  assert.equal(furnitureRotationAngle(170, 0, 30, true), 180);
  assert.equal(furnitureRotationAngle(0, 0, 22.5, true), 45);
  assert.equal(furnitureRotationAngle(0, 0, -22.5, true), -45);
});

test('#383 render transform mirrors inside the same positive box before rotation', () => {
  const base = { x: 0.1, y: 0.2, w: 0.3, h: 0.4, angle: 30 };
  assert.equal(
    furnitureRenderTransform(base, 1000, 500, 100, 50),
    'rotate(30 250 200) translate(100 100) scale(3 4)',
  );
  assert.equal(
    furnitureRenderTransform({ ...base, flip_h: true, flip_v: true }, 1000, 500, 100, 50),
    'rotate(30 250 200) translate(400 300) scale(-3 -4)',
  );
});

test('#383 signed property fields project flags without persisting negative extents', () => {
  assert.equal(furnitureSignedFieldValue(180, false, false), '1.8');
  assert.equal(furnitureSignedFieldValue(180, true, false), '-1.8');
  assert.equal(furnitureSignedFieldValue(30.48, true, true), '-1');
  assert.equal(furnitureSignedFieldValue(0.1, false, false), '0.001');
  assert.equal(furnitureSignedFieldCm(furnitureSignedFieldValue(0.1, false, false), false, 10000), 0.1);
  closeTo(
    furnitureSignedFieldCm(furnitureSignedFieldValue(0.1, false, true), true, 10000),
    0.1,
    0.0001,
  );
  assert.equal(furnitureSignedFieldCm('-1.8', false, 10000), -180);
  assert.equal(furnitureSignedFieldCm('1', true, 10000), 30.48);
  for (const invalid of ['', '0', 0, 'wat', Infinity])
    assert.equal(furnitureSignedFieldCm(invalid, false, 10000), null);
});
