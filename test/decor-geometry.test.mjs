import test from 'node:test';
import assert from 'node:assert/strict';
import {
  boxCorners, decorStrokeUnits, decorStyleOf, resizeDecorBox, snapDecorPoint,
} from '../test-build/editors/decor/geometry.js';

const close = (actual, expected, epsilon = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);

test('canonical physical stroke and legacy render stroke remain visually exact', () => {
  close(decorStrokeUnits({ width_cm: 5 }, 5, 12), 12);
  close(decorStrokeUnits({ width: 3 }, 5, 12), 3);
  const legacy = decorStyleOf({ id: 'r', kind: 'rect', x: 0, y: 0, w: 1, h: 1,
    color: '#123456', width: 3, fill: true }, 5, 12);
  close(legacy.widthCm, 1.25);
  assert.equal(legacy.fillColor, '#123456');
  close(legacy.fillOpacity, 0.25);
});

test('oriented resize preserves ratio by default and Shift-style mode separates axes', () => {
  const original = { x: 10, y: 20, w: 40, h: 20, angle: 30 };
  const proportional = resizeDecorBox(original, 1, 1, 100, 100, true, 5, 5);
  close(proportional.w / proportional.h, 2);
  assert.equal(proportional.w % 5, 0);
  assert.equal(proportional.h % 5, 0);
  const independent = resizeDecorBox(original, 1, 1, 100, 100, false, 5, 5);
  assert.notEqual(independent.w / independent.h, 2);
  assert.equal(independent.w % 5, 0);
  assert.equal(independent.h % 5, 0);
});

test('decor magnet may choose a point or edge but always returns a grid point', () => {
  const grid = ([x, y]) => [Math.round(x / 10) * 10, Math.round(y / 10) * 10];
  const geometry = { points: [[31, 39]], segments: [{ a: [0, 50], b: [100, 50] }] };
  const point = snapDecorPoint([32, 38], geometry, 8, grid);
  assert.equal(point.kind, 'point');
  assert.deepEqual(point.point, [30, 40]);
  const edge = snapDecorPoint([63, 47], geometry, 8, grid);
  assert.equal(edge.kind, 'edge');
  assert.deepEqual(edge.point, [60, 50]);
});

test('rotated box exposes four rotated content corners around the same centre', () => {
  const corners = boxCorners({ x: 0, y: 0, w: 20, h: 10, angle: 90 });
  assert.deepEqual(corners.map((p) => p.map((v) => Math.round(v))), [[15, -5], [15, 15], [5, 15], [5, -5]]);
});
