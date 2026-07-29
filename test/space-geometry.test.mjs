import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NORM_W, spaceModels, roomBounds, roomCenter, defaultPositions, markerPos, labelPos, fitInSquare, contentBounds,
} from '../test-build/space-geometry.js';

const cfg = {
  spaces: [{
    id: 'f1', title: '1st', plan_aspect: 2, plan_url: '/plans/f1.svg', view_box: [0, 0, 1, 1],
    rooms: [{ id: 'r1', name: 'Room', area: 'a1', poly: [[0.1, 0.1], [0.5, 0.1], [0.5, 0.5], [0.1, 0.5]] }],
  }, {
    id: 'yard', title: 'Yard', view_box: [0, 0, 1, 1], rooms: [],
  }],
  markers: [], settings: {},
};

test('spaceModels: the canvas is square; the image is centred by its own ratio', () => {
  const m = spaceModels(cfg);
  assert.equal(m.length, 2);
  const f1 = m[0];
  assert.deepEqual(f1.vb, [0, 0, 1000, 1000]);
  assert.equal(f1.bg.href, '/plans/f1.svg');
  // a plan twice as wide as it is tall: full width, half height, margins above
  // and below — the canvas has no proportions of its own any more (v1.48.0)
  assert.deepEqual(f1.bg, { href: '/plans/f1.svg', x: 0, y: 250, w: 1000, h: 500 });
  assert.deepEqual(f1.rooms[0].poly, [[100, 100], [500, 100], [500, 500], [100, 500]]);
  assert.equal(m[1].bg, null); // no plan_url
  assert.equal(spaceModels(null).length, 0);
});

test('fitInSquare: wide gets top/bottom margins, tall gets side margins', () => {
  assert.deepEqual(fitInSquare(2, 1000), { x: 0, y: 250, w: 1000, h: 500 });
  assert.deepEqual(fitInSquare(0.5, 1000), { x: 250, y: 0, w: 500, h: 1000 });
  assert.deepEqual(fitInSquare(1, 1000), { x: 0, y: 0, w: 1000, h: 1000 });
  // unknown ratio (image not loaded yet, old config): assume square
  for (const bad of [null, undefined, 0, -3, NaN, 'x']) {
    assert.deepEqual(fitInSquare(bad, 1000), { x: 0, y: 0, w: 1000, h: 1000 });
  }
});

test('roomBounds + roomCenter for a polygon', () => {
  const r = spaceModels(cfg)[0].rooms[0];
  assert.deepEqual(roomBounds(r), { x: 100, y: 100, w: 400, h: 400 });
  assert.deepEqual(roomCenter(r), [300, 300]);
});

test('markerPos: saved layout → default grid → space centre', () => {
  const model = spaceModels(cfg)[0];
  const dev = { id: 'd1', space: 'f1', area: 'a1', entities: [] };
  // saved layout (normalized) → render units
  assert.deepEqual(
    markerPos(dev, { d1: { s: 'f1', x: 0.2, y: 0.3 } }, cfg, {}, model),
    { x: 200, y: 300 }, // 0.2*1000, 0.3*1000
  );
  // default grid position (inside the room)
  const defPos = defaultPositions([dev], model, 2.5);
  assert.ok(defPos.d1);
  assert.deepEqual(markerPos(dev, {}, cfg, defPos, model), defPos.d1);
  const b = roomBounds(model.rooms[0]);
  assert.ok(defPos.d1.x >= b.x && defPos.d1.x <= b.x + b.w && defPos.d1.y >= b.y && defPos.d1.y <= b.y + b.h);
  // no layout, no defPos → space centre
  assert.deepEqual(markerPos(dev, {}, cfg, {}, model), { x: 500, y: 500 });
});

test('labelPos: saved rl_<id> → render units; else room centre', () => {
  const model = spaceModels(cfg)[0];
  const r = model.rooms[0];
  assert.deepEqual(labelPos(r, 'f1', { rl_r1: { s: 'f1', x: 0.3, y: 0.4 } }, cfg), { x: 300, y: 400 });
  assert.deepEqual(labelPos(r, 'f1', {}, cfg), { x: 300, y: 300 }); // room centre
});

test('defaultPositions: several devices in one room are spread (declumped, distinct)', () => {
  const model = spaceModels(cfg)[0];
  const devs = [0, 1, 2, 3].map((i) => ({ id: 'd' + i, space: 'f1', area: 'a1', entities: [] }));
  const pos = defaultPositions(devs, model, 2.5);
  assert.equal(Object.keys(pos).length, 4);
  const keys = Object.keys(pos);
  for (let i = 0; i < keys.length; i++)
    for (let j = i + 1; j < keys.length; j++) {
      const a = pos[keys[i]], b = pos[keys[j]];
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 1, 'positions distinct');
    }
});

test('NORM_W is 1000', () => assert.equal(NORM_W, 1000));

test('contentBounds: fits what is drawn, with a 5% margin', () => {
  const one = spaceModels({ spaces: [{
    id: 's', view_box: [0, 0, 1, 1],
    rooms: [{ id: 'r', poly: [[0.4, 0.4], [0.6, 0.4], [0.6, 0.6], [0.4, 0.6]] }],
  }], markers: [] })[0];
  // 200x200 render units in the middle of a 1000x1000 canvas, +5% of 200 each side
  assert.deepEqual(contentBounds(one), { x: 390, y: 390, w: 220, h: 220 });

  // rectangles count too, and the margin follows the LARGER side
  const rect = spaceModels({ spaces: [{
    id: 's', view_box: [0, 0, 1, 1],
    rooms: [{ id: 'r', x: 0.1, y: 0.4, w: 0.6, h: 0.1 }],
  }], markers: [] })[0];
  const b = contentBounds(rect);
  assert.equal(Math.round(b.w), 660);   // 600 + 2 * 5% of 600
  assert.equal(Math.round(b.h), 160);   // 100 + the same absolute margin
  assert.equal(Math.round(b.x), 70);

  // nothing drawn → the caller keeps the whole canvas
  const empty = spaceModels({ spaces: [{ id: 's', view_box: [0, 0, 1, 1], rooms: [] }], markers: [] })[0];
  assert.equal(contentBounds(empty), null);
});

test('contentBounds: devices outside every room stretch the frame', () => {
  const one = spaceModels({ spaces: [{
    id: 's', view_box: [0, 0, 1, 1],
    rooms: [{ id: 'r', poly: [[0.4, 0.4], [0.6, 0.4], [0.6, 0.6], [0.4, 0.6]] }],
  }], markers: [] })[0];
  // a gate sensor far to the right of the room
  const b = contentBounds(one, 0.05, [[900, 500]]);
  // span 400..900 wide, 400..600 tall; margin 5% of the larger side (500)
  assert.deepEqual(b, { x: 375, y: 375, w: 550, h: 250 });
  // devices alone are content enough — an empty yard with two cameras
  const empty = spaceModels({ spaces: [{ id: 's', view_box: [0, 0, 1, 1], rooms: [] }], markers: [] })[0];
  const only = contentBounds(empty, 0.05, [[100, 100], [300, 200]]);
  assert.equal(Math.round(only.w), 220);
  // and junk coordinates are ignored, not spread across the canvas
  assert.deepEqual(contentBounds(one, 0.05, [[NaN, 5]]), contentBounds(one));
});

test('contentBounds: never degenerate, never unbounded (HP-1500-03)', () => {
  const empty = spaceModels({ spaces: [{ id: 's', view_box: [0, 0, 1, 1], rooms: [] }], markers: [] })[0];
  // a single marker has no area — the frame gets a floor instead of a 0x0 viewBox
  const one = contentBounds(empty, 0.05, [[500, 500]]);
  assert.ok(one.w >= 200 && one.h >= 200, 'a lone marker still frames some canvas');
  assert.ok(Math.abs(one.x + one.w / 2 - 500) < 1, 'centred on the marker');
  // a collinear row: the flat axis gets the floor, the long one keeps its span
  const row = contentBounds(empty, 0.05, [[100, 500], [900, 500]]);
  assert.ok(row.h >= 200, 'the flat axis is opened up');
  assert.ok(row.w > 800, 'the long axis is untouched');
  // an absurd stored coordinate does not command the frame...
  const room = spaceModels({ spaces: [{
    id: 's', view_box: [0, 0, 1, 1],
    rooms: [{ id: 'r', poly: [[0.4, 0.4], [0.6, 0.4], [0.6, 0.6], [0.4, 0.6]] }],
  }], markers: [] })[0];
  assert.deepEqual(contentBounds(room, 0.05, [[1e100, 500]]), contentBounds(room));
  assert.deepEqual(contentBounds(room, 0.05, [[-1e100, -1e100]]), contentBounds(room));
  // ...but a device a bit past the canvas edge still counts (the gate sensor)
  const near = contentBounds(room, 0.05, [[1100, 500]]);
  assert.ok(near.x + near.w > 1050, 'slightly outside the canvas still stretches the frame');

  // HP-1501-01: the same envelope guards ROOM GEOMETRY — the server refuses
  // absurd vertices now, but a store may hold one from before that door
  // existed, and a legacy 1e100 vertex must not frame the plan into a dot
  const legacy = spaceModels({ spaces: [{
    id: 's', view_box: [0, 0, 1, 1],
    rooms: [
      { id: 'ok', poly: [[0.4, 0.4], [0.6, 0.4], [0.6, 0.6], [0.4, 0.6]] },
      { id: 'bad', poly: [[0, 0], [1e100, 0], [1, 1]] },
    ],
  }], markers: [] })[0];
  const lb = contentBounds(legacy);
  assert.ok(lb.w < 1500 && lb.h < 1500, 'the absurd vertex does not command the frame');
  assert.ok(lb.x <= 400 && lb.x + lb.w >= 600, 'the sane room is still inside it');
  // a space where EVERY point is absurd falls back to the whole canvas
  const allBad = spaceModels({ spaces: [{
    id: 's', view_box: [0, 0, 1, 1],
    rooms: [{ id: 'b', poly: [[1e100, 1e100], [2e100, 1e100], [2e100, 2e100]] }],
  }], markers: [] })[0];
  assert.equal(contentBounds(allBad), null, 'the caller keeps the full canvas');
});

test('spaceModels: a stored broken view_box falls back to the canvas (HP-1502-01)', () => {
  // the server refuses these now, but a store may already hold one
  for (const vb of [[0, 0, 0, 0], [0, 0, -1, -2], [0, 0, 1], null, [0, 0, NaN, 1]]) {
    const m = spaceModels({ spaces: [{ id: 's', view_box: vb, rooms: [] }], markers: [] })[0];
    assert.deepEqual(m.vb, [0, 0, 1000, 1000], JSON.stringify(vb) + ' falls back');
  }
  // a legitimate crop viewport is preserved
  const crop = spaceModels({ spaces: [{ id: 's', view_box: [0.1, 0.2, 0.5, 0.4], rooms: [] }], markers: [] })[0];
  assert.deepEqual(crop.vb, [100, 200, 500, 400]);
  // a legacy rect with a negative size is the same rectangle from the other corner
  const m = spaceModels({ spaces: [{
    id: 's', view_box: [0, 0, 1, 1],
    rooms: [{ id: 'r', x: 0.6, y: 0.7, w: -0.2, h: -0.3 }],
  }], markers: [] })[0];
  const r = m.rooms[0];
  assert.deepEqual([r.x, r.y, r.w, r.h].map(Math.round), [400, 400, 200, 300]);
});
