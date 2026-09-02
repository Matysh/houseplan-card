import test from 'node:test';
import assert from 'node:assert/strict';

import { wholePixelClip } from '../demo/docs/clip.mjs';

// #410/#422: обрезка обязана быть целой и обязана СОДЕРЖАТЬ цель целиком.
// Округление к ближайшему выглядит естественнее, но срезает край на половине
// входов — именно поэтому здесь floor для начала и ceil для конца.

test('дробный прямоугольник расширяется до целого, а не округляется', () => {
  const clip = wholePixelClip({ x: 233.3359375, y: 431.5, width: 322.015625, height: 158 });
  assert.deepEqual(clip, { x: 233, y: 431, width: 323, height: 159 });
});

test('обрезка не теряет ни полпикселя по краю', () => {
  const rect = { x: 10.9, y: 20.1, width: 5.2, height: 7.8 };
  const clip = wholePixelClip(rect);
  assert.ok(clip.x <= rect.x, 'левый край не заходит внутрь цели');
  assert.ok(clip.y <= rect.y, 'верхний край не заходит внутрь цели');
  assert.ok(clip.x + clip.width >= rect.x + rect.width, 'правый край покрывает цель');
  assert.ok(clip.y + clip.height >= rect.y + rect.height, 'нижний край покрывает цель');
});

test('целый прямоугольник остаётся собой', () => {
  const rect = { x: 4, y: 8, width: 16, height: 32 };
  assert.deepEqual(wholePixelClip(rect), rect);
});

test('все стороны целые на любом дробном входе', () => {
  for (const seed of [0.1, 0.49, 0.5, 0.51, 0.99]) {
    const clip = wholePixelClip({ x: seed, y: seed, width: 100 + seed, height: 50 + seed });
    for (const [side, value] of Object.entries(clip)) {
      assert.equal(value, Math.trunc(value), `${side} должна быть целой при сдвиге ${seed}`);
    }
  }
});

test('отсутствующая область проходит насквозь', () => {
  assert.equal(wholePixelClip(null), null);
  assert.equal(wholePixelClip(undefined), undefined);
});
