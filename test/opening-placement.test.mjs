import test from 'node:test';
import assert from 'node:assert/strict';
import {
  openingPlacementPreset,
  openingPlacementTargets,
  passagePlacementPreviewGeometry,
  resolveOpeningPlacement,
  resolveOpeningPlacementResult,
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
  assert.deepEqual(openingPlacementPreset('passage', 3), {
    type: 'passage', lengthCm: 90, flipH: false, flipV: false, revision: 3,
  });
  assert.equal(openingPlacementPreset('gate', 3).lengthCm, 300);
});

test('partition placement reserves its physical half-width at both endpoints', () => {
  const hosted = interval({
    partitionHost: { kind: 'partition', id: 'p1' },
    half: 10,
  });
  const left = resolve({ pointer: [0, 0], intervals: [hosted] });
  const right = resolve({ pointer: [100, 0], intervals: [hosted] });
  assert.equal(left.x, 25);
  assert.equal(left.host.t, 0.25);
  assert.equal(left.measure.labels[0].distance, 10);
  assert.equal(right.x, 75);
  assert.equal(right.host.t, 0.75);
  assert.equal(right.measure.labels[1].distance, 10);
});

test('a partition shorter than opening plus both jambs reports a typed block', () => {
  const result = resolveOpeningPlacementResult({
    pointer: [24.5, 0],
    preset: openingPlacementPreset('door', 1),
    geometryRevision: 7,
    renderedLength: 30,
    intervals: [interval({
      b: [49, 0], half: 10,
      partitionHost: { kind: 'partition', id: 'short' },
    })],
    baseTolerance: 4,
    bodyPointerPadding: 2,
    gridStep: 10,
  });
  assert.equal(result.candidate, null);
  assert.equal(result.jambBlockedTarget.partitionHost.id, 'short');
  assert.equal(result.jambBlockedTarget.physicalHalfWidth, 10);
});

test('room-wall placement keeps its zero-jamb endpoint contract', () => {
  const candidate = resolve({ pointer: [0, 0], intervals: [interval({ half: 10 })] });
  assert.equal(candidate.x, 15);
  assert.equal(candidate.measure.labels[0].distance, 0);
});

test('passage preview geometry follows the resolved length and standard wall depth', () => {
  const geometry = passagePlacementPreviewGeometry({
    renderedLength: 90,
    target: { physicalHalfWidth: 7.5 },
  }, 10);
  assert.deepEqual(geometry, {
    rect: { x: -45, y: -7.5, width: 90, height: 15 },
    boundaries: [
      { x1: -45, y1: -9.3, x2: -45, y2: 9.3 },
      { x1: 45, y1: -9.3, x2: 45, y2: 9.3 },
    ],
  });
});

test('passage preview wall depth changes only its rect height and boundary span', () => {
  const geometry = passagePlacementPreviewGeometry({
    renderedLength: 90,
    target: { physicalHalfWidth: 12.5 },
  }, 10);
  assert.deepEqual(geometry.rect, { x: -45, y: -12.5, width: 90, height: 25 });
  assert.deepEqual(geometry.boundaries, [
    { x1: -45, y1: -14.3, x2: -45, y2: 14.3 },
    { x1: 45, y1: -14.3, x2: 45, y2: 14.3 },
  ]);
});

test('passage preview preserves boundary marks when physical wall depth is zero', () => {
  const geometry = passagePlacementPreviewGeometry({
    renderedLength: 60,
    target: { physicalHalfWidth: 0 },
  }, 5);
  assert.deepEqual(geometry.rect, { x: -30, y: 0, width: 60, height: 0 });
  const boundaryHalf = 5 * 0.18;
  assert.deepEqual(geometry.boundaries, [
    { x1: -30, y1: -boundaryHalf, x2: -30, y2: boundaryHalf },
    { x1: 30, y1: -boundaryHalf, x2: 30, y2: boundaryHalf },
  ]);
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

test('a coincident room wall and one partition choose the explicit partition host', () => {
  const candidate = resolve({
    intervals: [
      interval({ roomId: 'room' }),
      interval({ roomId: '', key: 'partition:p1', partitionHost: { kind: 'partition', id: 'p1' } }),
    ],
  });
  assert.deepEqual(candidate.host, { kind: 'partition', id: 'p1', t: 0.5 });
});

test('a collinear composite chooses its partition host when endpoints differ', () => {
  const candidate = resolve({
    pointer: [50, 0],
    intervals: [
      interval({ roomId: 'room', a: [0, 0], b: [100, 0] }),
      interval({ roomId: '', a: [20, 0], b: [80, 0], key: 'partition:p1',
        partitionHost: { kind: 'partition', id: 'p1' } }),
    ],
  });
  assert.deepEqual(candidate.host, { kind: 'partition', id: 'p1', t: 0.5 });
});

test('a crossing partition tie is rejected instead of choosing by key', () => {
  assert.equal(resolve({
    pointer: [50, 0],
    intervals: [
      interval({ roomId: 'room', a: [0, 0], b: [100, 0] }),
      interval({ roomId: '', a: [50, -50], b: [50, 50], key: 'partition:p1',
        partitionHost: { kind: 'partition', id: 'p1' } }),
    ],
  }), null);
});

test('two coincident independent hosts are rejected as ambiguous', () => {
  assert.equal(resolve({ intervals: [
    interval({ partitionHost: { kind: 'partition', id: 'p1' } }),
    interval({ partitionHost: { kind: 'partition', id: 'p2' } }),
  ] }), null);
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
