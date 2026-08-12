import test from 'node:test';
import assert from 'node:assert/strict';
import {
  openingPlacementPreset,
  openingPlacementTargets,
  resolveOpeningPlacement,
  sameOpeningPlacementInput,
} from '../test-build/opening-placement.js';

const interval = (patch = {}) => ({
  roomId: 'r1',
  a: [0, 0],
  b: [100, 0],
  key: '0,0@100,0',
  kind: 'outer',
  cm: 15,
  open: false,
  half: 10,
  ...patch,
});

const resolve = (patch = {}) => resolveOpeningPlacement({
  pointer: [50, 0],
  preset: openingPlacementPreset('door', 1),
  geometryRevision: 7,
  renderedLength: 30,
  intervals: [interval()],
  baseTolerance: 4,
  bodyPointerPadding: 2,
  gridStep: 10,
  ...patch,
});

test('Opening presets use the agreed type-specific defaults', () => {
  assert.deepEqual(openingPlacementPreset('window', 1), {
    type: 'window', lengthCm: 120, flipH: false, flipV: false, revision: 1,
  });
  assert.equal(openingPlacementPreset('door', 2).lengthCm, 90);
  assert.equal(openingPlacementPreset('gate', 3).lengthCm, 300);
});

test('Shared room-owned copies collapse to one physical target', () => {
  const targets = openingPlacementTargets([
    interval({ roomId: 'r1', half: 7 }),
    interval({ roomId: 'r2', a: [100, 0], b: [0, 0], half: 10 }),
  ]);
  assert.equal(targets.length, 1);
  assert.deepEqual(targets[0].a, [0, 0]);
  assert.deepEqual(targets[0].b, [100, 0]);
  assert.equal(targets[0].physicalHalfWidth, 10);
});

test('Different concentric spans never alias through the legacy wall key', () => {
  const targets = openingPlacementTargets([
    interval({ a: [0, 0], b: [100, 0], key: 'same-midpoint-and-angle' }),
    interval({ a: [20, 0], b: [80, 0], key: 'same-midpoint-and-angle' }),
  ]);
  assert.equal(targets.length, 2);
  assert.deepEqual(targets.map((target) => [target.a, target.b]), [
    [[0, 0], [100, 0]],
    [[20, 0], [80, 0]],
  ]);
});

test('Virtual and degenerate intervals are not placement targets', () => {
  assert.deepEqual(openingPlacementTargets([
    interval({ open: true, kind: null }),
    interval({ key: 'zero', a: [2, 2], b: [2, 2] }),
  ]), []);
});

test('Pointer anywhere inside a thick wall body resolves to its axis', () => {
  const candidate = resolve({ pointer: [43, 11.5] });
  assert.ok(candidate);
  assert.equal(candidate.x, 40);
  assert.equal(candidate.y, 0);
  assert.equal(candidate.angle, 0);
  assert.ok(resolve({ pointer: [43, -11.5] }));
  assert.equal(resolve({ pointer: [43, 12.5] }), null);
});

test('A physical body envelope never leaks into its adjacent virtual span', () => {
  const intervals = [
    interval({ a: [0, 0], b: [50, 0], key: 'physical' }),
    interval({ a: [50, 0], b: [100, 0], key: 'virtual', kind: null, open: true, cm: 0, half: 0 }),
  ];
  assert.ok(resolve({ pointer: [48, 8], intervals }));
  assert.equal(resolve({ pointer: [50.1, 0], intervals }), null);
  assert.equal(resolve({ pointer: [52, 8], intervals }), null);
  assert.equal(resolve({ pointer: [70, 0], intervals }), null);
});

test('A crossing virtual interval does not block a physical wall', () => {
  const candidate = resolve({
    pointer: [50, 0],
    intervals: [
      interval({ key: 'physical' }),
      interval({ a: [50, -50], b: [50, 50], key: 'crossing-virtual', kind: null, open: true }),
    ],
  });
  assert.ok(candidate);
  assert.deepEqual(candidate.target.a, [0, 0]);
  assert.deepEqual(candidate.target.b, [100, 0]);
});

test('A blocked endpoint candidate does not hide another valid wall at a junction', () => {
  const candidate = resolve({
    pointer: [52, 0],
    intervals: [
      interval({ a: [0, 0], b: [50, 0], key: 'ending-physical' }),
      interval({ a: [50, 0], b: [100, 0], key: 'continuing-virtual', kind: null, open: true }),
      interval({ a: [52, -50], b: [52, 50], key: 'valid-crossing-physical' }),
    ],
  });
  assert.ok(candidate);
  assert.deepEqual(candidate.target.a, [52, -50]);
  assert.deepEqual(candidate.target.b, [52, 50]);
});

test('Grid snap and soft centre magnet are deterministic', () => {
  assert.equal(resolve({ pointer: [46, 0] }).x, 50);
  assert.equal(resolve({ pointer: [34, 0] }).x, 30);
  assert.ok(resolve({ pointer: [46, 0] }).measure.guide);
  assert.equal(resolve({ pointer: [34, 0] }).measure.guide, null);
});

test('centre magnet wins over grid on a wall whose midpoint is off-grid', () => {
  const offGridWall = interval({ b: [105, 0] });
  const centred = resolve({ pointer: [50, 0], intervals: [offGridWall] });
  assert.equal(centred.x, 52.5);
  assert.deepEqual(centred.measure.guide, { x: 52.5, y: 0, angle: 0 });

  const awayFromCentre = resolve({ pointer: [43, 0], intervals: [offGridWall] });
  assert.equal(awayFromCentre.x, 40);
  assert.equal(awayFromCentre.measure.guide, null);
});

test('Junction tie-break does not depend on interval input order', () => {
  const horizontal = interval({ key: 'a-horizontal' });
  const vertical = interval({ key: 'b-vertical', a: [50, -50], b: [50, 50] });
  const first = resolve({ pointer: [50, 0], intervals: [vertical, horizontal] });
  const second = resolve({ pointer: [50, 0], intervals: [horizontal, vertical] });
  assert.equal(first.target.segmentKey, second.target.segmentKey);
  assert.deepEqual(first.target.a, second.target.a);
  assert.deepEqual(first.target.b, second.target.b);
});

test('A gate wider than its wall remains placeable without truncation', () => {
  const candidate = resolve({
    preset: openingPlacementPreset('gate', 4),
    renderedLength: 160,
  });
  assert.ok(candidate);
  assert.equal(candidate.renderedLength, 160);
  assert.equal(candidate.x, 50);
  assert.deepEqual(candidate.measure.labels.map((item) => item.distance), [0, 0]);
});

test('Hover candidate can be reused only for the exact preset and geometry epoch', () => {
  const candidate = resolve();
  assert.ok(candidate);
  assert.equal(sameOpeningPlacementInput(candidate, [50, 0], 1, 7), true);
  assert.equal(sameOpeningPlacementInput(candidate, [50.01, 0], 1, 7), false);
  assert.equal(sameOpeningPlacementInput(candidate, [50, 0], 2, 7), false);
  assert.equal(sameOpeningPlacementInput(candidate, [50, 0], 1, 8), false);
});
