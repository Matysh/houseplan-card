import test from 'node:test';
import assert from 'node:assert/strict';

import { radarConfigFromDraft } from '../test-build/radar-editor.js';
import {
  RadarSetupController, radarSetupFrame, radarSetupProjection,
} from '../test-build/radar-setup.js';
import { contentFrame, itemOf } from '../test-build/space-geometry.js';

/** The historical 1000-unit board: plan units ×1000, no offset. */
const BOARD = { x: 0, y: 0, w: 1000, h: 1000 };

const draft = () => ({
  original: null, enabled: true, showLive: true, profile: 'presence_v1', roomId: 'living',
  installationId: 'installation-1', mountX: '500', mountY: '500', heading: '0',
  rangeCm: '', fovDeg: '', mirror: false, unit: 'cm', xEntities: [''], yEntities: [''],
  distanceEntity: '', angleEntity: '', angleUnit: 'degrees', angleZero: 'forward',
  angleClockwise: true, occupancyEntity: 'binary_sensor.presence', countEntity: '',
  zoneEntity: '', zoneKind: 'occupancy',
});

const pointer = (x, y) => ({
  clientX: x, clientY: y,
  currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 1000 }) },
});

test('on-plan installation changes only the editor draft until ordinary Save', () => {
  let applied = null;
  const controller = new RadarSetupController({
    hass: () => ({}), requestUpdate() {}, t: (key) => key,
    configFromDraft: radarConfigFromDraft, apply: (next) => { applied = next; },
    confirmDiscard: async () => true,
  });
  assert.equal(controller.begin('radar', draft(), {
        id: 'living', name: 'Living', poly: [[0, 0], [1, 0], [1, 1], [0, 1]],
  }, 5, 7, BOARD), true);
  assert.equal(controller.isDirty(), false, 'an untouched setup may close synchronously');
  controller.choosePoint(pointer(250, 400));
  assert.equal(controller.isDirty(), true, 'placing the mount makes the setup discard-sensitive');
  controller.choosePoint(pointer(250, 100));
  assert.equal(applied, null, 'the setup surface must not persist or apply before confirmation');
  controller.apply();
  assert.equal(applied.mountX, '250');
  assert.equal(applied.mountY, '400');
  assert.equal(applied.heading, '0');
  assert.deepEqual(applied.calibrationOverride, {
    method: 'not_required', mirror: false, cell_cm: 5,
  });
  assert.equal(radarConfigFromDraft(applied, 5).mount.x, .25);
});

test('cancelling calibration releases its draft subscription exactly once', async () => {
  const controller = new RadarSetupController({
    hass: () => ({}), requestUpdate() {}, t: (key) => key,
    configFromDraft: radarConfigFromDraft, apply() {}, confirmDiscard: async () => true,
  });
  assert.equal(controller.begin('radar', draft(), {
    id: 'living', name: 'Living', poly: [[0, 0], [1, 0], [1, 1]],
  }, 5, 7, BOARD), true);
  let calls = 0;
  controller.unsubscribe = () => { calls += 1; };
  assert.equal(await controller.cancel(), true);
  assert.equal(await controller.cancel(), true);
  assert.equal(calls, 1);
  assert.equal(controller.isDirty(), false);
});

test('dirty calibration stays open when discard confirmation is rejected', async () => {
  let confirmations = 0;
  const controller = new RadarSetupController({
    hass: () => ({}), requestUpdate() {}, t: (key) => key,
    configFromDraft: radarConfigFromDraft, apply() {},
    confirmDiscard: async () => { confirmations += 1; return false; },
  });
  assert.equal(controller.begin('radar', draft(), {
    id: 'living', name: 'Living', poly: [[0, 0], [1, 0], [1, 1]],
  }, 5, 7, BOARD), true);
  controller.choosePoint(pointer(250, 400));
  let cleanups = 0;
  controller.unsubscribe = () => { cleanups += 1; };

  assert.equal(await controller.cancel(), false);
  assert.equal(confirmations, 1);
  assert.equal(cleanups, 0);
  assert.ok(controller.active);
});

test('calibration reports bad reference placement separately from a measurement mismatch', () => {
  const controller = new RadarSetupController({
    hass: () => ({}), requestUpdate() {}, t: (key) => key,
    configFromDraft: radarConfigFromDraft, apply() {}, confirmDiscard: async () => true,
  });
  assert.equal(controller.begin('radar', draft(), {
    id: 'living', name: 'Living', poly: [[0, 0], [1, 0], [1, 1]],
  }, 5, 7, BOARD), true);
  const plan = (x, y) => [.5 + x / 1200, .5 - y / 1200];
  controller.active.mount = [.5, .5];
  controller.active.refs = [
    { local: [100, 0], plan: plan(100, 0) },
    { local: [200, 0], plan: plan(200, 0) },
  ];
  controller.solve();
  assert.equal(controller.active.error, 'radar.bad_references');

  controller.active.refs = [
    { local: [100, 0], plan: plan(100, 0) },
    { local: [0, 100], plan: plan(-50, 86.603) },
  ];
  controller.solve();
  assert.equal(controller.active.error, 'radar.bad_fit');
});

// ---------------------------------------------------------------------------
// #774: one projection for the on-plan setup. The oracles below are computed
// by hand from the frame, the SVG rectangle and xMidYMid meet — never by the
// production function — so an offset, a scale, a clamp or a frame-relative
// normalisation slipping into the code changes a number here.

const near = (actual, expected, message) => {
  assert.ok(actual, `${message}: expected a point, got ${actual}`);
  assert.ok(Math.abs(actual[0] - expected[0]) < 1e-9 && Math.abs(actual[1] - expected[1]) < 1e-9,
    `${message}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
};

/** Values of a lit template (recursively) whose static part ends with `suffix`. */
const templateValues = (result, suffix) => {
  const found = [];
  const walk = (node) => {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (!node || typeof node !== 'object' || !Array.isArray(node.strings)) return;
    node.values.forEach((value, index) => {
      if (node.strings[index].replace(/\s+/g, ' ').endsWith(suffix)) found.push(value);
      walk(value);
    });
  };
  walk(result);
  return found;
};

// Offset, non-square frame in a square 400 px SVG at (10, 20): the scale is
// 400 / 2000 = 0.2, the frame is 200 px tall, so 100 px of letterbox lie above
// (client y 20..120) and below (320..420) the projected viewBox.
const WIDE = { x: -500, y: 200, w: 2000, h: 1000 };
const SQUARE = { left: 10, top: 20, width: 400, height: 400 };

test('#774 projection: screen → absolute render units → plan units, letterbox honoured', () => {
  const view = radarSetupProjection(WIDE);
  assert.equal(view.viewBox, '-500 200 2000 1000');
  assert.equal(view.glyph, 2, 'marker glyphs keep their 1000-unit board size');
  const table = [
    // client point        expected plan units (null = ignored)
    [[60, 220], [-0.25, 0.7], 'negative x inside an offset frame'],
    [[390, 300], [1.4, 1.1], 'both axes past 1, never clamped'],
    [[10, 120], [-0.5, 0.2], 'top-left corner of the projected viewBox is inside'],
    [[410, 320], [1.5, 1.2], 'bottom-right corner of the projected viewBox is inside'],
    [[200, 60], null, 'upper letterbox'],
    [[200, 380], null, 'lower letterbox'],
    [[200, 119], null, 'one pixel above the projected viewBox'],
    [[5, 200], null, 'left of the SVG rectangle'],
  ];
  for (const [[x, y], expected, label] of table) {
    const actual = view.plan(x, y, SQUARE);
    if (expected) near(actual, expected, label);
    else assert.equal(actual, null, label);
  }
  // The historical board is the identity case, and a wide rectangle letterboxes sideways.
  const board = radarSetupProjection(BOARD);
  near(board.plan(250, 400, { left: 0, top: 0, width: 1000, height: 1000 }), [0.25, 0.4], 'board');
  const wideRect = { left: 0, top: 0, width: 600, height: 300 };
  near(board.plan(150, 0, wideRect), [0, 0], 'left edge of a sideways letterbox');
  near(board.plan(300, 150, wideRect), [0.5, 0.5], 'centre of a sideways letterbox');
  assert.equal(board.plan(100, 150, wideRect), null, 'sideways letterbox');
  for (const rect of [
    { left: 0, top: 0, width: 0, height: 400 },
    { left: 0, top: 0, width: 400, height: 0 },
    { left: 0, top: 0, width: Number.NaN, height: 400 },
  ]) assert.equal(view.plan(100, 100, rect), null, `degenerate rect ${JSON.stringify(rect)}`);
  assert.deepEqual(view.scene([-0.25, 1.4]), [-250, 1400], 'plan → render is ×NORM_W, unclamped');
});

const L_ROOM = { id: 'r_l', name: 'L', poly: [
  [100, 200], [700, 200], [700, 450], [400, 450], [400, 600], [100, 600]] };
const OUT_ROOM = { id: 'r_out', name: 'Out', poly: [
  [-550, -400], [-150, -400], [-150, -100], [-350, -100], [-550, -250]] };
const spaceOf = (rooms, vb = [0, 0, 1000, 1000]) => ({
  id: 's', title: 'S', cellCm: 5, vb, bg: null, rooms, stairs: [],
});
const itemsOf = (rooms, devices = []) => [
  ...rooms.map((room) => itemOf(room.poly)),
  ...devices.map(([x, y]) => ({ minX: x, minY: y, maxX: x, maxY: y })),
];

test('#774 frame: the content frame, not the stored view_box, frames a room outside [0,1]', () => {
  const rooms = [L_ROOM, OUT_ROOM];
  const items = itemsOf(rooms, [[300, 300]]);
  // bbox x -550..700 (1250), y -400..600 (1000); 5 % of the longer side = 62.5
  const expected = { x: -612.5, y: -462.5, w: 1375, h: 1125 };
  for (const room of rooms) {
    assert.deepEqual(radarSetupFrame(spaceOf(rooms), room, items), expected, room.id);
  }
  const frame = radarSetupFrame(spaceOf(rooms), OUT_ROOM, items);
  const own = itemOf(OUT_ROOM.poly);
  assert.ok(frame.x <= own.minX && frame.y <= own.minY
    && frame.x + frame.w >= own.maxX && frame.y + frame.h >= own.maxY,
  'the whole contour of the room outside [0,1] fits the frame');
  assert.ok(own.maxX < 0 && own.maxY < 0, 'premise: the stored unit view_box would cut it entirely');
  for (const vb of [[5000, 5000, 2000, 2000], [-3, 7, 0.5, 9]]) {
    assert.deepEqual(radarSetupFrame(spaceOf(rooms, vb), L_ROOM, items), expected,
      `replacing the stored view_box ${vb} does not move a content frame`);
  }
});

test('#774 frame: the configured room is never left to the outlier vote (core → all)', () => {
  const square = (id, x, y, side = 100) => ({ id, name: id, poly: [
    [x, y], [x + side, y], [x + side, y + side], [x, y + side]] });
  const near4 = [square('a', 400, 400), square('b', 500, 400), square('c', 400, 500),
    square('d', 500, 500)];
  const far = square('far', 40000, 40000, 500);
  const rooms = [...near4, far];
  const items = itemsOf(rooms);
  const { core, all, outliers } = contentFrame(items);
  assert.equal(outliers, 1, 'premise: the vote rejects the far room');
  assert.deepEqual(core, { x: 390, y: 390, w: 220, h: 220 });
  assert.deepEqual(all, { x: -1605, y: -1605, w: 44110, h: 44110 });
  assert.ok(core.x + core.w < 40000, 'core excludes the far room');
  assert.deepEqual(radarSetupFrame(spaceOf(rooms), far, items), all, 'the far room opens on all');
  assert.deepEqual(radarSetupFrame(spaceOf(rooms), near4[0], items), core,
    'a room inside the main mass keeps the ordinary opening frame');
});

test('#774 frame: the stored view_box is only the empty-content fallback', () => {
  const room = { id: 'gone', name: 'No contour' };
  assert.deepEqual(radarSetupFrame(spaceOf([], [300, -200, 1500, 900]), room, []),
    { x: 300, y: -200, w: 1500, h: 900 }, 'a valid offset hint is used verbatim');
  for (const vb of [[0, 0, 0, 1000], [0, 0, -5, 10], undefined]) {
    assert.deepEqual(radarSetupFrame(spaceOf([], vb), room, []), BOARD,
      `invalid hint ${JSON.stringify(vb)} → the standard unit frame`);
  }
});

const coordinateDraft = () => ({
  ...draft(), profile: 'cartesian_v1', roomId: 'r_out',
  xEntities: ['sensor.x'], yEntities: ['sensor.y'], swapXY: [false], xSigns: [1], ySigns: [1],
  slotPresenceEntities: [''], distanceEntities: [''], angleEntities: [''],
});
const press = (x, y, rect = SQUARE) => ({
  clientX: x, clientY: y, currentTarget: { getBoundingClientRect: () => rect },
});

test('#774 every layer goes through the one projection; the frame stays put', () => {
  let applied = null;
  const controller = new RadarSetupController({
    hass: () => ({}), requestUpdate() {}, t: (key) => key,
    configFromDraft: radarConfigFromDraft, apply: (next) => { applied = next; },
    confirmDiscard: async () => true,
  });
  assert.equal(controller.begin('radar', coordinateDraft(), OUT_ROOM, 5, 7, WIDE), true);
  const frame = controller.active.projection.frame;
  controller.choosePoint(press(200, 60));
  assert.equal(controller.active.mount, null, 'a press in the letterbox places nothing');
  assert.equal(controller.active.phase, 'mount');
  controller.choosePoint(press(60, 220));
  near(controller.active.mount, [-0.25, 0.7], 'mount');
  controller.choosePoint(press(390, 220));
  near(controller.active.headingPoint, [1.4, 0.7], 'heading point');
  assert.equal(controller.active.draft.mountX, '-250');
  assert.equal(controller.active.draft.mountY, '700');
  assert.equal(controller.active.draft.heading, '90');
  assert.equal(controller.active.phase, 'reference_1');
  controller.choosePoint(press(60, 300));
  near(controller.active.pendingPlan, [-0.25, 1.1], 'pending reference');
  // Live diagnostics: 120 cm straight ahead (east) of the mount, then 60 cm to its right.
  controller.receive({ local_targets: [{ slot: 'target_1', x_cm: 0, y_cm: 120 }] });
  controller.receive({ local_targets: [{ slot: 'target_1', x_cm: 60, y_cm: 120 }] });
  assert.equal(controller.active.projection.frame, frame, 'clicks and live data keep the session frame');
  const view = controller.render();
  assert.deepEqual(templateValues(view, '<svg viewBox='), ['-500 200 2000 1000']);
  assert.deepEqual(templateValues(view, 'class="room" points='),
    ['-550,-400 -150,-400 -150,-100 -350,-100 -550,-250'], 'the contour is drawn once, untouched');
  assert.deepEqual(templateValues(view, 'x1='), [-250]);
  assert.deepEqual(templateValues(view, 'y1='), [700]);
  assert.deepEqual(templateValues(view, 'x2='), [1400]);
  assert.deepEqual(templateValues(view, 'y2='), [700]);
  assert.deepEqual(templateValues(view, 'transform="translate('), ['-250 700', '-250 1100'],
    'mount and pending marker in the same render units');
  assert.deepEqual(templateValues(view, ') scale('), [2, 2]);
  const trail = templateValues(view, 'class="trail" points=');
  assert.equal(trail.length, 1);
  const points = trail[0].split(' ').map((pair) => pair.split(',').map(Number));
  near(points[0], [-150, 700], 'trail sample 1 (120 cm ahead = +0.1 plan)');
  near(points[1], [-150, 750], 'trail sample 2 (60 cm right = +0.05 plan)');

  // Presence profile: Apply hands back plain plan units, unclamped, and nothing else.
  assert.equal(controller.begin('radar', draft(), OUT_ROOM, 5, 7, WIDE), true);
  controller.choosePoint(press(60, 220));
  controller.choosePoint(press(390, 220));
  controller.apply();
  assert.equal(applied.mountX, '-250');
  assert.equal(applied.mountY, '700');
  assert.equal(applied.heading, '90');
  assert.deepEqual(radarConfigFromDraft(applied, 5).mount.x, -0.25);
  assert.deepEqual(radarConfigFromDraft(applied, 5).mount.y, 0.7);
});

test('#774 a room without a contour draws no invented outline', () => {
  const controller = new RadarSetupController({
    hass: () => ({}), requestUpdate() {}, t: (key) => key,
    configFromDraft: radarConfigFromDraft, apply() {}, confirmDiscard: async () => true,
  });
  const room = { id: 'living', name: 'Legacy', x: 100, y: 100, w: 300, h: 200 };
  const space = spaceOf([room]);
  const frame = radarSetupFrame(space, room, [itemOf([[100, 100], [400, 300]])]);
  assert.equal(controller.begin('radar', draft(), room, 5, 7, frame), true);
  assert.deepEqual(templateValues(controller.render(), 'class="room" points='), [''],
    'the camera frame is not substituted for the missing polygon');
});
