import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hostedOpeningIntervalsOverlap,
  materializePartitionOpening,
  partitionOpeningCut,
  partitionOpeningFace,
  partitionOpeningHasCompositeRoomWall,
  resolvePartitionOpening,
} from '../test-build/partition-openings.js';
import { cutPartitionBody, partitionBody } from '../test-build/physical-geometry.js';
import { physicalBodyParts } from '../test-build/physical-geometry.js';

const partition = { id: 'p1', a: [0, 0], b: [100, 0], cm: 15 };
const opening = (patch = {}) => ({
  id: 'o1', type: 'door', x: 0.5, y: 0, angle: 0, length: 0.3,
  host: { kind: 'partition', id: 'p1', t: 0.5 },
  ...patch,
});

test('explicit host resolves authoritative centre, angle, depth and compatibility projection', () => {
  const resolution = resolvePartitionOpening(opening(), [partition], 100, 5, 5);
  assert.equal(resolution.reason, null);
  assert.deepEqual(resolution.resolved.center, [50, 0]);
  assert.equal(resolution.resolved.length, 30);
  assert.equal(resolution.resolved.depth, 15);
  assert.deepEqual(materializePartitionOpening(
    { ...opening(), x: 9, y: 9, angle: 77 }, resolution.resolved, 100,
  ), { ...opening(), x: 0.5, y: 0, angle: 0 });
});

test('reversed host direction preserves directed t and canonical symbol angle', () => {
  const reversed = { ...partition, a: [100, 0], b: [0, 0] };
  const resolved = resolvePartitionOpening(opening({
    host: { kind: 'partition', id: 'p1', t: 0.25 },
  }), [reversed], 100, 5, 5).resolved;
  assert.deepEqual(resolved.center, [75, 0]);
  assert.equal(resolved.angle, 0);
  assert.equal(partitionOpeningFace(resolved, false).cm, 15);
  assert.equal(partitionOpeningFace(resolved, true).side, 1);
});

test('missing, out-of-range and too-short hosts fail dark', () => {
  assert.equal(resolvePartitionOpening(opening(), [], 100).reason, 'missing-partition');
  assert.equal(resolvePartitionOpening(opening({
    host: { kind: 'partition', id: 'p1', t: 2 },
  }), [partition], 100).reason, 'invalid-position');
  assert.equal(resolvePartitionOpening(opening({ length: 1.1 }), [partition], 100).reason,
    'does-not-fit');
});

test('partition body is split by its own full-depth slot only', () => {
  const body = partitionBody(partition.a, partition.b, partition.cm, 5, 5);
  const resolved = resolvePartitionOpening(opening(), [partition], 100, 5, 5).resolved;
  const pieces = cutPartitionBody(body, [partitionOpeningCut(resolved)]);
  assert.equal(pieces.length, 2);
  const ranges = pieces.map((piece) => [
    Math.min(...piece.map((point) => point[0])),
    Math.max(...piece.map((point) => point[0])),
  ]).sort((a, b) => a[0] - b[0]);
  assert.ok(ranges[0][1] <= 35 + 1e-6);
  assert.ok(ranges[1][0] >= 65 - 1e-6);
});

test('full-depth cut is stable for 1/15/100 cm and diagonal hosts', () => {
  for (const cm of [1, 15, 100]) {
    const diagonal = { id: 'p1', a: [0, 0], b: [100, 100], cm };
    const resolved = resolvePartitionOpening(opening(), [diagonal], 100, 5, 5).resolved;
    const body = partitionBody(diagonal.a, diagonal.b, cm, 5, 5);
    const pieces = cutPartitionBody(body, [partitionOpeningCut(resolved)]);
    assert.equal(pieces.length, 2, `${cm} cm diagonal host keeps two jamb bodies`);
  }
});

test('computed junction patches cannot bridge a hosted slot', () => {
  // Ветка упирается в СЕРЕДИНУ пролёта p1: оба узловых патча T-стыка лежат в
  // полосе перегородки (x∈[42.5,57.5], y∈[-7.5,0]) и целиком накрываются
  // слотом проёма по умолчанию (t=0.5, длина 30 → x∈[35,65]). Прежняя
  // фикстура вела ветку в конец p1 — её патч жил вне хоста (x>100), контрольная
  // точка [92,0] была вне патча при любом поведении кода, и тест не умел
  // падать (#188).
  const space = {
    partitions: [partition, { id: 'branch', a: [50, 0], b: [50, 60], cm: 15 }],
    room_drafts: [], wall_columns: [],
  };
  const resolved = resolvePartitionOpening(opening(), [partition], 100, 5, 5).resolved;
  const pointIn = (point, body) => {
    let inside = false;
    for (let i = 0, j = body.length - 1; i < body.length; j = i++) {
      const a = body[i], b = body[j];
      if (((a[1] > point[1]) !== (b[1] > point[1]))
          && point[0] < ((b[0] - a[0]) * (point[1] - a[1]))
            / ((b[1] - a[1]) || 1e-12) + a[0]) inside = !inside;
    }
    return inside;
  };
  const probes = [[47, -3], [53, -3]];

  // Контроль фальсифицируемости: без разреза те же патчи обязаны мостить
  // слот. Если геометрия фикстуры перестанет их порождать, краснеет этот
  // контроль, а не молча обесценивается проверка ниже.
  const uncut = physicalBodyParts(space, 5, 5, 0.001);
  for (const probe of probes) {
    assert.equal(uncut.patches.some((body) => pointIn(probe, body)), true,
      `uncut junction patch must cover ${JSON.stringify(probe)}`);
  }

  const cut = physicalBodyParts(space, 5, 5, 0.001, [partitionOpeningCut(resolved)]);
  for (const probe of probes) {
    assert.equal(cut.patches.some((body) => pointIn(probe, body)), false,
      `cut junction patch must not bridge the slot at ${JSON.stringify(probe)}`);
  }
});

test('composite cut requires exact collinearity and full interval coverage', () => {
  const resolved = resolvePartitionOpening(opening(), [partition], 100, 5, 5).resolved;
  const interval = (patch = {}) => ({
    roomId: 'r', a: [0, 0], b: [100, 0], key: 'wall',
    kind: 'outer', cm: 15, open: false, half: 7.5, ...patch,
  });
  assert.equal(partitionOpeningHasCompositeRoomWall(resolved, [interval()], 0.01), true);
  assert.equal(partitionOpeningHasCompositeRoomWall(
    resolved, [interval({ a: [0, 1], b: [100, 1] })], 0.01,
  ), false);
  assert.equal(partitionOpeningHasCompositeRoomWall(
    resolved, [interval({ a: [0, 0], b: [40, 0] })], 0.01,
  ), false);
  assert.equal(partitionOpeningHasCompositeRoomWall(
    resolved, [interval({ a: [50, -50], b: [50, 50] })], 0.01,
  ), false);
  assert.equal(partitionOpeningHasCompositeRoomWall(resolved, [
    interval({ a: [0, 0], b: [50, 0] }),
    interval({ a: [50, 0], b: [100, 0] }),
  ], 0.01), true, 'adjacent atomic room intervals jointly cover the opening');
  assert.equal(partitionOpeningHasCompositeRoomWall(resolved, [
    interval({ a: [0, 0], b: [49, 0] }),
    interval({ a: [51, 0], b: [100, 0] }),
  ], 0.01), false, 'a real coverage gap is not a composite wall');
});

test('overlap reservation is scoped to one explicit host', () => {
  const first = resolvePartitionOpening(opening(), [partition], 100).resolved;
  const overlapping = resolvePartitionOpening(opening({
    id: 'o2', host: { kind: 'partition', id: 'p1', t: 0.6 },
  }), [partition], 100).resolved;
  const clear = resolvePartitionOpening(opening({
    id: 'o3', length: 0.1, host: { kind: 'partition', id: 'p1', t: 0.9 },
  }), [partition], 100).resolved;
  assert.equal(hostedOpeningIntervalsOverlap(first, [overlapping]), true);
  assert.equal(hostedOpeningIntervalsOverlap(first, [clear]), false);
});
