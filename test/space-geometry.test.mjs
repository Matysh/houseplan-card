import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NORM_W, spaceModels, roomBounds, roomCenter, defaultPositions, markerPos, labelPos,
} from '../test-build/space-geometry.js';

const cfg = {
  spaces: [{
    id: 'f1', title: '1st', aspect: 2, plan_url: '/plans/f1.svg', view_box: [0, 0, 1, 1],
    rooms: [{ id: 'r1', name: 'Room', area: 'a1', poly: [[0.1, 0.1], [0.5, 0.1], [0.5, 0.5], [0.1, 0.5]] }],
  }, {
    id: 'yard', title: 'Yard', aspect: 1, view_box: [0, 0, 1, 1], rooms: [],
  }],
  markers: [], settings: {},
};

test('spaceModels: scales vb/rooms by NORM_W and H=NORM_W/aspect; bg only with plan_url', () => {
  const m = spaceModels(cfg);
  assert.equal(m.length, 2);
  const f1 = m[0];
  assert.deepEqual(f1.vb, [0, 0, 1000, 500]); // aspect 2 → H 500
  assert.equal(f1.bg.href, '/plans/f1.svg');
  assert.deepEqual(f1.rooms[0].poly, [[100, 50], [500, 50], [500, 250], [100, 250]]);
  assert.equal(m[1].bg, null); // no plan_url
  assert.equal(spaceModels(null).length, 0);
});

test('roomBounds + roomCenter for a polygon', () => {
  const r = spaceModels(cfg)[0].rooms[0];
  assert.deepEqual(roomBounds(r), { x: 100, y: 50, w: 400, h: 200 });
  assert.deepEqual(roomCenter(r), [300, 150]);
});

test('markerPos: saved layout → default grid → space centre', () => {
  const model = spaceModels(cfg)[0];
  const dev = { id: 'd1', space: 'f1', area: 'a1', entities: [] };
  // saved layout (normalized) → render units
  assert.deepEqual(
    markerPos(dev, { d1: { s: 'f1', x: 0.2, y: 0.3 } }, cfg, {}, model),
    { x: 200, y: 150 }, // 0.2*1000, 0.3*(1000/2)
  );
  // default grid position (inside the room)
  const defPos = defaultPositions([dev], model, 2.5);
  assert.ok(defPos.d1);
  assert.deepEqual(markerPos(dev, {}, cfg, defPos, model), defPos.d1);
  const b = roomBounds(model.rooms[0]);
  assert.ok(defPos.d1.x >= b.x && defPos.d1.x <= b.x + b.w && defPos.d1.y >= b.y && defPos.d1.y <= b.y + b.h);
  // no layout, no defPos → space centre
  assert.deepEqual(markerPos(dev, {}, cfg, {}, model), { x: 500, y: 250 });
});

test('labelPos: saved rl_<id> → render units; else room centre', () => {
  const model = spaceModels(cfg)[0];
  const r = model.rooms[0];
  assert.deepEqual(labelPos(r, 'f1', { rl_r1: { s: 'f1', x: 0.3, y: 0.4 } }, cfg), { x: 300, y: 200 });
  assert.deepEqual(labelPos(r, 'f1', {}, cfg), { x: 300, y: 150 }); // room centre
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
