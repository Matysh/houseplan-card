/**
 * The backdrop transform and the paper contract (docs/BACKDROP.md).
 *
 * Two questions only, and both are pure geometry:
 *   1. where the picture ends up once it has been moved and scaled, and
 *   2. that the frame ("Вписать всё") counts THAT rectangle, not the old one.
 * The third half of the feature — the paper is the rooms and only the rooms —
 * lives in the renderers, so it is asserted in the DOM by demo/smoke_backdrop.mjs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NORM_W, planRect, fitInSquare, spaceModels, contentItems, contentBounds,
  PLAN_SCALE_MIN, PLAN_SCALE_MAX, CANVAS_LIMIT,
} from '../test-build/space-geometry.js';
import { paperRoomShapes } from '../test-build/logic.js';

const wide = { id: 's', title: 's', plan_url: '/p.svg', plan_aspect: 2, view_box: [0, 0, 1, 1], rooms: [] };
const cfgOf = (space) => ({ spaces: [space], markers: [], settings: {} });

test('planRect: no fields at all is EXACTLY the centred default (no migration)', () => {
  assert.deepEqual(planRect(wide), fitInSquare(2, NORM_W));
  assert.deepEqual(planRect(wide), { x: 0, y: 250, w: 1000, h: 500 });
  // an explicitly neutral transform is the same rectangle, to the bit
  assert.deepEqual(planRect({ ...wide, plan_x: 0, plan_y: 0, plan_scale: 1 }),
    { x: 0, y: 250, w: 1000, h: 500 });
  // …and so is every kind of junk a legacy store could hold. A non-number is
  // no transform at all; for the SCALE zero and negatives are junk too (it is
  // a multiplier), while for the OFFSET they are perfectly good coordinates.
  for (const bad of [null, undefined, 'x', NaN, Infinity])
    assert.deepEqual(planRect({ ...wide, plan_scale: bad, plan_x: bad, plan_y: bad }),
      { x: 0, y: 250, w: 1000, h: 500 }, `plan_* = ${String(bad)}`);
  for (const bad of [0, -3])
    assert.deepEqual(planRect({ ...wide, plan_scale: bad }),
      { x: 0, y: 250, w: 1000, h: 500 }, `plan_scale = ${String(bad)}`);
});

test('planRect: the offset is normalised, the scale is uniform about the top-left', () => {
  // 0.25 of the canvas right, 0.1 down
  assert.deepEqual(planRect({ ...wide, plan_x: 0.25, plan_y: 0.1 }),
    { x: 250, y: 350, w: 1000, h: 500 });
  // half size: BOTH sides halve, the top-left corner stays put — no rotation,
  // no stretch, one number
  assert.deepEqual(planRect({ ...wide, plan_scale: 0.5 }),
    { x: 0, y: 250, w: 500, h: 250 });
  // offset and scale compose: the offset moves the (already scaled) corner
  assert.deepEqual(planRect({ ...wide, plan_x: -0.5, plan_y: 0.2, plan_scale: 2 }),
    { x: -500, y: 450, w: 2000, h: 1000 });
  // the aspect ratio is preserved by construction, whatever the scale
  const r = planRect({ ...wide, plan_scale: 3.7 });
  assert.ok(Math.abs(r.w / r.h - 2) < 1e-12);
});

test('planRect: the stored numbers are clamped, never trusted', () => {
  const far = planRect({ ...wide, plan_x: 1e9, plan_y: -1e9 });
  assert.equal(far.x, 0 + CANVAS_LIMIT * NORM_W);
  assert.equal(far.y, 250 - CANVAS_LIMIT * NORM_W);
  assert.equal(planRect({ ...wide, plan_scale: 1e9 }).w, 1000 * PLAN_SCALE_MAX);
  assert.equal(planRect({ ...wide, plan_scale: 1e-9 }).w, 1000 * PLAN_SCALE_MIN);
});

test('spaceModels: the model carries the TRANSFORMED image rectangle', () => {
  const [m] = spaceModels(cfgOf({ ...wide, plan_x: 0.5, plan_y: 0.5, plan_scale: 0.5 }));
  assert.deepEqual(m.bg, { href: '/p.svg', x: 500, y: 750, w: 500, h: 250 });
  // and an untouched space is bit-identical to what it rendered before
  const [old] = spaceModels(cfgOf(wide));
  assert.deepEqual(old.bg, { href: '/p.svg', x: 0, y: 250, w: 1000, h: 500 });
});

test('the content frame follows the picture (Вписать всё never loses it)', () => {
  const moved = spaceModels(cfgOf({
    ...wide, plan_x: 2, plan_y: 2, plan_scale: 0.5,
    rooms: [{ id: 'r', name: 'r', poly: [[0.4, 0.4], [0.5, 0.4], [0.5, 0.5], [0.4, 0.5]] }],
  }))[0];
  // the picture is still ONE content item, exactly like a room
  const items = contentItems(moved);
  assert.equal(items.length, 2);
  const img = items[1];
  assert.deepEqual(img, { minX: 2000, minY: 2250, maxX: 2500, maxY: 2500 });
  const b = contentBounds(moved);
  assert.ok(b.x <= 400 && b.x + b.w >= 2500, 'the frame reaches the moved picture');
  assert.ok(b.y <= 400 && b.y + b.h >= 2500);
  // …and shrinking the picture shrinks the frame with it
  const small = spaceModels(cfgOf({ ...wide, plan_scale: 0.25 }))[0];
  const sb = contentBounds(small);
  assert.ok(sb.w < 400, `a quarter-scale picture frames tight, got ${sb.w}`);
});

test('the paper is the ROOMS, image or no image (docs/BACKDROP.md §3)', () => {
  // paperRoomShapes knows nothing about plan_url — which is the whole point:
  // there is no longer a branch where the picture makes paper of its own.
  const rooms = [{ id: 'r', name: 'r', poly: [[100, 100], [500, 100], [500, 500], [100, 500]] }];
  assert.equal(paperRoomShapes(rooms).length, 1);
  assert.equal(paperRoomShapes([]).length, 0, 'an empty space has no paper at all');
});
