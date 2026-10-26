import test from 'node:test';
import assert from 'node:assert/strict';
import {
  turnPoint, turnVector, turnRect, turnMatrix, framePercent, inversePlanRotation,
  stepPlanRotation, validPlanRotation, effectivePlanRotation, PlanRotationPreference,
  PLAN_ROTATION_STORAGE, presentationView, canonicalView,
} from '../test-build/view-frame.js';
import { isoCameraFor, isoPlaneMatrix, projectPlanPoint, unprojectFloorPoint } from '../test-build/iso-projection.js';
import { resolveIsoScene } from '../test-build/iso-scene-render.js';
import { fitView } from '../test-build/logic.js';
import { rotatePdfCommands, pdfCommandBounds } from '../test-build/pdf/pdf-layout.js';
import { invalidCardRotation, rotationConfigValue } from '../test-build/card-editor-validation.js';

test('#1070 AC2: exact clockwise quarter turns, inverse, and four-turn composition on the infinite canvas', () => {
  assert.deepEqual(turnPoint([600, 400], 90), [600, 600]);
  for (const point of [[0, 0], [500, 500], [-5000, 5000], [123.125, -987.625]]) {
    for (const rotation of [0, 90, 180, 270]) {
      assert.deepEqual(turnPoint(turnPoint(point, rotation), inversePlanRotation(rotation)), point);
    }
    let result = point;
    for (let n = 0; n < 4; n++) result = turnPoint(result, 90);
    assert.deepEqual(result, point);
  }
  assert.deepEqual(turnVector([10, 0], 270), [0, -10]);
  assert.equal(stepPlanRotation(0, -1), 270);
  assert.equal(stepPlanRotation(270, 1), 0);
});

test('#1070 AC3/AC7: one exact SVG matrix and HTML anchor route agree; inverse pointer has canonical coordinates', () => {
  const bounds = turnRect({ x: 100, y: 200, w: 600, h: 300 }, 90);
  assert.deepEqual(bounds, { x: 500, y: 100, w: 300, h: 600 });
  assert.equal(turnMatrix(90), 'matrix(0 1 -1 0 1000 0)');
  const anchor = framePercent([250, 400], bounds, 90);
  assert.ok(Math.abs(anchor[0] - 100 / 3) < 1e-12);
  assert.equal(anchor[1], 25);
  const displayed = [bounds.x + anchor[0] / 100 * bounds.w, bounds.y + anchor[1] / 100 * bounds.h];
  assert.deepEqual(turnPoint(displayed, 270), [250, 400]);
});

test('#1070 AC2/AC8: portrait fit changes only presentation; a later inverse reads the identical canonical camera', () => {
  const base = { x: 100, y: 200, w: 800, h: 400 };
  const canonical = { x: 250, y: 210, w: 400, h: 600 };
  const before = JSON.stringify(canonical), zoom = 2, aspect = 2 / 3;
  const rotated = turnRect(base, 90);
  const displayFit = fitView([rotated.x, rotated.y, rotated.w, rotated.h], aspect);
  const shown = presentationView(canonical, base, rotated, 90, zoom, displayFit);
  assert.ok(Math.abs(shown.w / shown.h - aspect) < 1e-12);
  const canonicalFit = { x: 0, y: 0, w: canonical.w * zoom, h: canonical.h * zoom };
  assert.deepEqual(canonicalView(shown, base, rotated, 90, zoom, canonicalFit), canonical);
  assert.equal(presentationView(canonical, base, base, 0, zoom, canonicalFit), canonical);
  assert.equal(JSON.stringify(canonical), before, 'turning never mutates camera state');
});

test('#1070 AC5/AC6: per-space choice overrides config, kiosk reads config only, and a new browser is independent', () => {
  const saved = new Map();
  const storage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
  const preference = new PlanRotationPreference(() => storage);
  assert.equal(preference.get('ground', 90), 90);
  preference.set('ground', 270);
  assert.equal(preference.get('ground', 90), 270);
  assert.equal(preference.get('first', 90), 90);
  assert.equal(preference.get('ground', 90, true), 90);
  assert.equal(preference.get('ground', undefined, true), 0);
  const reloaded = new PlanRotationPreference(() => storage);
  assert.equal(reloaded.get('ground', 90), 270);
  assert.equal(new PlanRotationPreference(() => null).get('ground', 90), 90);
  assert.deepEqual(JSON.parse(saved.get(PLAN_ROTATION_STORAGE)), { ground: 270 });
});

test('#1070 AC5/AC6: unavailable and malformed storage never disable rotation, invalid card values fail closed', () => {
  const preference = new PlanRotationPreference(() => ({
    getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); },
  }));
  preference.set('ground', 180);
  assert.equal(preference.get('ground', 90), 180);
  for (const value of [-90, 360, 45, '90', null, NaN, Infinity]) {
    assert.equal(validPlanRotation(value), false);
    assert.equal(effectivePlanRotation(value, undefined), 0);
    assert.equal(invalidCardRotation({ rotation: value }), true);
  }
  for (const rotation of [0, 90, 180, 270]) {
    assert.equal(invalidCardRotation({ rotation }), false);
    assert.equal(rotationConfigValue(String(rotation)), rotation);
  }
  assert.equal(invalidCardRotation({}), false);
});

test('#1070 AC9/AC11: four ISO camera sides expose front faces while one physical source and its zero view remain cached', () => {
  let builds = 0;
  const ring = [[100, 200], [900, 200], [900, 600], [100, 600]];
  const source = { key: 'synthetic-rectangle', build: () => {
    builds++; return { walls: [[ring]], floor: [[ring]], openings: [], openingSurfaces: [] };
  } };
  const cache = new Map(), sides = [];
  let initial;
  for (const rotation of [0, 90, 180, 270, 0]) {
    const camera = isoCameraFor(rotation);
    const scene = resolveIsoScene({ source, cache, cellCm: 5,
      liveFrame: { x: 100, y: 200, w: 800, h: 400 }, rotation });
    const floor = ring.map(point => projectPlanPoint(point, 0, camera));
    const frontY = Math.max(...floor.map(point => point[1]));
    assert.equal(scene.geometry.sides.length, 1);
    assert.equal(scene.geometry.sides[0].points[0][1], frontY);
    assert.equal(scene.geometry.sides[0].points[1][1], frontY);
    assert.ok(scene.geometry.sides[0].points[2][1] < frontY, 'wall height rises screen-up');
    assert.equal(scene.frame.w, rotation === 90 || rotation === 270 ? 400 : 800);
    const matrix = isoPlaneMatrix(0, camera);
    assert.ok(matrix.slice(0, 4).every(value => value === 0 || value === 1 || value === -1));
    assert.deepEqual(unprojectFloorPoint(projectPlanPoint([-1234.5, 2000.25], 0, camera), camera), [-1234.5, 2000.25]);
    if (!initial) initial = scene;
    sides.push(scene.geometry.sides[0].edge);
    if (sides.length === 5) assert.equal(scene.geometry, initial.geometry);
  }
  assert.equal(new Set(sides.slice(0, 4)).size, 4, 'the camera sees all four distinct sides');
  assert.equal(builds, 1, 'no floor booleans or physical bodies are rebuilt by rotation');
});

test('#1070 AC10: PDF rotates all geometry, Beziers and raster centres, preserving screen-facing captions and rotating decor text', () => {
  const commands = [
    { kind: 'line', points: [[10, 20], [110, 20]], width: 1, stroke: [0, 0, 0] },
    { kind: 'text', x: 50, y: 20, text: 'Room', size: 10 },
    { kind: 'text', x: 60, y: 30, text: 'Decor', size: 10, rotateWithPlan: true, angle: 15 },
    { kind: 'image', imageId: 'fixture', x: 10, y: 20, width: 100, height: 50, angle: 5 },
    { kind: 'vector', ops: [{ op: 'M', x: 0, y: 0 }, { op: 'C', x1: 10, y1: 20, x2: 20, y2: 30, x: 40, y: 50 }], width: 1 },
  ];
  const rotated = rotatePdfCommands(commands, 90);
  assert.deepEqual(rotated[0].points, [[-20, 10], [-20, 110]]);
  assert.equal(rotated[1].angle, undefined);
  assert.equal(rotated[2].angle, 105);
  assert.deepEqual([rotated[3].x, rotated[3].y, rotated[3].angle], [-95, 35, 95]);
  assert.deepEqual(rotated[4].ops[1], { op: 'C', x1: -20, y1: 10, x2: -30, y2: 20, x: -50, y: 40 });
  const bounds = pdfCommandBounds([rotated[0]]);
  assert.deepEqual(bounds, { minX: -20.5, minY: 9.5, maxX: -19.5, maxY: 110.5 });
  assert.deepEqual(commands[0].points, [[10, 20], [110, 20]], 'export does not mutate the live plan');
});
