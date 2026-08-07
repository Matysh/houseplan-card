import test from 'node:test';
import assert from 'node:assert/strict';
import {
  boxCorners, decorStrokeUnits, decorStyleOf, decorStylePatch, normalizeAngle,
  resizeDecorBox, resizedBoxTopLeft, snapDecorPoint, validDecorDraft,
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

test('decor style fallbacks and canonical patch stay inside the persisted schema', () => {
  const fallback = {
    color: '#112233', opacity: 0.8, widthCm: 4,
    fill: false, fillColor: '#445566', fillOpacity: 0.3,
  };
  const style = decorStyleOf({ id: 'r', kind: 'rect', x: 0, y: 0, w: 1, h: 1,
    color: 'invalid', opacity: 8, fill: true, fill_color: 'invalid' }, 5, 12, fallback);
  assert.equal(style.color, fallback.color);
  assert.equal(style.opacity, 1);
  assert.equal(style.fillColor, fallback.color);
  assert.equal(style.fillOpacity, 0.25);

  const high = decorStylePatch({ ...fallback, widthCm: 1e6, opacity: -2,
    fill: true, fillOpacity: 4 }, true);
  assert.equal(high.width_cm, 100);
  assert.equal(high.opacity, 0);
  assert.equal(high.fill_opacity, 1);
  const lowLine = decorStylePatch({ ...fallback, widthCm: -1 }, false);
  assert.equal(lowLine.width_cm, 0.1);
  assert.equal('fill' in lowLine, false);
});

test('angle normalization is stable at wrap boundaries', () => {
  assert.equal(normalizeAngle(0), 0);
  assert.equal(normalizeAngle(180), 180);
  assert.equal(normalizeAngle(181), -179);
  assert.equal(normalizeAngle(-181), 179);
  assert.equal(normalizeAngle(360), 0);
  assert.equal(normalizeAngle(Number.POSITIVE_INFINITY), 0);
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

  const empty = snapDecorPoint([14, 26], { points: [], segments: [] }, 8, grid);
  assert.deepEqual(empty, { point: [10, 30], target: null, kind: 'grid' });
  const tie = snapDecorPoint([20, 20], {
    points: [[20, 30]], segments: [{ a: [10, 10], b: [30, 10] }],
  }, 10, grid);
  assert.equal(tie.kind, 'point', 'equal-distance point wins deterministically');
});

test('rotated box exposes four rotated content corners around the same centre', () => {
  const corners = boxCorners({ x: 0, y: 0, w: 20, h: 10, angle: 90 });
  assert.deepEqual(corners.map((p) => p.map((v) => Math.round(v))), [[15, -5], [15, 15], [5, 15], [5, -5]]);
});

test('oriented resize caller preserves the derived top-left instead of translating the fixed corner', () => {
  const original = { x: 10, y: 20, w: 40, h: 20, angle: 30 };
  const resized = resizeDecorBox(original, 1, 1, 97, 83, true, 5, 5);
  const fixedBefore = boxCorners(original)[0];
  const fixedAfter = boxCorners(resized)[0];
  close(fixedAfter[0], fixedBefore[0]);
  close(fixedAfter[1], fixedBefore[1]);
  const grid = ([x, y]) => [Math.round(x / 5) * 5, Math.round(y / 5) * 5];
  assert.deepEqual(resizedBoxTopLeft(resized, original.angle, grid), [resized.x, resized.y]);
  assert.deepEqual(resizedBoxTopLeft({ x: 12.2, y: 18.1 }, 0, grid), [10, 20]);
});

test('resize cannot flip across the fixed corner and honours the common grid scale', () => {
  const original = { x: 0, y: 0, w: 40, h: 20, angle: 0 };
  const common = resizeDecorBox(original, 1, 1, 51, 31, true, 10, 10);
  assert.deepEqual([common.w, common.h], [60, 30]);
  assert.equal(common.w % 10, 0);
  assert.equal(common.h % 10, 0);

  const crossed = resizeDecorBox(original, 1, 1, -100, -100, false, 10, 10);
  assert.deepEqual([crossed.w, crossed.h], [10, 10]);
  assert.deepEqual(boxCorners(crossed)[0], boxCorners(original)[0],
    'opposite corner stays fixed at the minimum-size floor');
});

test('flat rectangle and ellipse drafts are rejected while a straight line is valid', () => {
  assert.equal(validDecorDraft('line', [0, 0], [20, 0], 5), true);
  assert.equal(validDecorDraft('rect', [0, 0], [20, 0], 5), false);
  assert.equal(validDecorDraft('ellipse', [0, 0], [0, 20], 5), false);
  assert.equal(validDecorDraft('rect', [0, 0], [20, 10], 5), true);
});
