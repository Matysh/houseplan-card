import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { optimizePlans } from '../test-build/plan-optimizer.js';
import { checkOptimizeGeometry } from '../test-build/plan-geometry-preflight.js';
import { reconcileCoincidentPartitions } from '../test-build/coincident-partitions.js';
import { GRID_PITCH, GRID_STEP_N as S } from '../test-build/space-geometry.js';
import { wallIntervals } from '../test-build/wall-thickness.js';

const fixture = JSON.parse(readFileSync(
  new URL('./fixtures/276-coincident-partition.json', import.meta.url),
  'utf8',
));
const backendCandidate = JSON.parse(readFileSync(
  new URL('./fixtures/280-optimize-rehost-candidate.json', import.meta.url),
  'utf8',
));
const clone = (value) => structuredClone(value);

const optimize = (config) => optimizePlans(config, {});

test('issue 276 reconciles the anonymized 5 cm offset fixture without moving its door', () => {
  const input = clone(fixture);
  const before = clone(input);
  const result = optimize(input);
  assert.deepEqual(input, before, 'Optimize preview must not mutate the source');
  assert.equal(result.changed, true);
  assert.equal(result.report.partitionsReconciled, 1);
  assert.equal(result.report.openingsRehosted, 1);

  const space = result.config.spaces[0];
  assert.equal(space.partitions, undefined);
  assert.equal(space.openings.length, 1);
  assert.deepEqual(space.openings[0], {
    id: 'hosted-door', type: 'door',
    x: 121 / 240, y: 0.5, angle: -90, length: 0.2,
    contact: 'binary_sensor.test_door', lock: 'lock.test_door',
    invert: true, flip_h: true, future_field: { keep: true },
    host: { kind: 'wall', id: space.openings[0].host.id, t: 0.5 },
  });
  assert.ok(space.wall_segments.some((wall) => wall.id === space.openings[0].host.id),
    'the migrated opening is hosted by a stored contour wall');
  const intervals = wallIntervals(
    space.rooms, space.walls, [], S, 5, GRID_PITCH, 1,
  ).filter((interval) => interval.kind === 'shared');
  assert.equal(intervals.length, 2);
  assert.deepEqual(new Set(intervals.map((interval) => interval.cm)), new Set([20]));
  assert.equal(checkOptimizeGeometry(result.config).ok, true);
  assert.deepEqual(
    result.config,
    backendCandidate,
    'the frontend result must stay identical to the candidate proved by Python',
  );

  const second = optimize(result.config);
  assert.equal(second.changed, false);
  assert.equal(second.report.partitionsReconciled, 0);
  assert.equal(second.report.openingsRehosted, 0);
  assert.deepEqual(second.config, result.config);
});

test('issue 276 exact proof ignores endpoint direction and room order', () => {
  for (const reversePartition of [false, true]) {
    for (const reverseRooms of [false, true]) {
      const input = clone(fixture);
      const space = input.spaces[0];
      if (reversePartition) {
        [space.partitions[0].a, space.partitions[0].b] = [
          space.partitions[0].b, space.partitions[0].a,
        ];
        space.openings[0].host.t = 0.5;
      }
      if (reverseRooms) space.rooms.reverse();
      const result = optimize(input);
      assert.equal(result.report.partitionsReconciled, 1,
        `direction=${reversePartition}, rooms=${reverseRooms}`);
      assert.equal(result.report.openingsRehosted, 1);
      assert.equal(checkOptimizeGeometry(result.config).ok, true);
    }
  }
});

test('issue 276 rehosts three non-overlapping door/window/gate openings atomically', () => {
  const input = clone(fixture);
  const space = input.spaces[0];
  space.openings = [
    { id: 'hosted-door', type: 'door', x: 0, y: 0, angle: 0, length: 0.12,
      contact: 'binary_sensor.door', host: { kind: 'partition', id: 'redundant', t: 59 / 238 } },
    { id: 'hosted-window', type: 'window', x: 0, y: 0, angle: 0, length: 0.12,
      cover: 'cover.window', host: { kind: 'partition', id: 'redundant', t: 0.50 } },
    { id: 'hosted-gate', type: 'gate', x: 0, y: 0, angle: 0, length: 0.12,
      future_field: { keep: true }, host: { kind: 'partition', id: 'redundant', t: 179 / 238 } },
  ];

  const result = optimize(input);
  assert.equal(result.report.partitionsReconciled, 1);
  assert.equal(result.report.openingsRehosted, 3);
  const openings = result.config.spaces[0].openings;
  assert.deepEqual(openings.map((opening) => opening.id),
    ['hosted-door', 'hosted-window', 'hosted-gate']);
  assert.deepEqual(openings.map((opening) => opening.type), ['door', 'window', 'gate']);
  assert.ok(openings.every((opening) => opening.host?.kind === 'wall'));
  assert.equal(new Set(openings.map((opening) => opening.host.id)).size, 1);
  assert.ok(openings.every((opening) => opening.x === 121 / 240));
  assert.ok(openings[0].y < openings[1].y && openings[1].y < openings[2].y);
  assert.equal(openings[0].contact, 'binary_sensor.door');
  assert.equal(openings[1].cover, 'cover.window');
  assert.deepEqual(openings[2].future_field, { keep: true });
  assert.equal(checkOptimizeGeometry(result.config).ok, true);

  const second = optimize(result.config);
  assert.equal(second.changed, false);
  assert.equal(second.report.openingsRehosted, 0);
  assert.deepEqual(second.config, result.config);
});

test('issue 276 fails closed when two hosted openings would overlap after rehost', () => {
  const input = clone(fixture);
  const space = input.spaces[0];
  space.openings = [
    { id: 'overlap-door', type: 'door', x: 0, y: 0, angle: 0, length: 0.2,
      host: { kind: 'partition', id: 'redundant', t: 0.45 } },
    { id: 'overlap-window', type: 'window', x: 0, y: 0, angle: 0, length: 0.2,
      host: { kind: 'partition', id: 'redundant', t: 0.55 } },
  ];
  const result = optimize(input);
  assert.equal(result.report.partitionsReconciled, 0);
  assert.equal(result.report.openingsRehosted, 0);
  assert.equal(result.config.spaces[0].partitions.length, 1);
  assert.deepEqual(result.config.spaces[0].openings.map((opening) => opening.id),
    ['overlap-door', 'overlap-window']);
  assert.ok(result.config.spaces[0].openings.every((opening) => opening.host?.id === 'redundant'));
});

test('issue 276 reconciliation is owned by explicit Optimize and called once per valid space', () => {
  const input = clone(fixture);
  const secondSpace = clone(input.spaces[0]);
  secondSpace.id = 'offset-shared-wall-second';
  input.spaces.push(secondSpace);
  let calls = 0;
  const instrumented = (...args) => {
    calls++;
    return reconcileCoincidentPartitions(...args);
  };
  const result = optimizePlans(input, {}, {}, {
    reconcileCoincidentPartitions: instrumented,
  });
  assert.equal(calls, 2, 'one explicit pass per valid space in one Optimize candidate');
  assert.equal(result.report.partitionsReconciled, 2);

  const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url));
  const sourceFiles = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && entry.name.endsWith('.ts')) sourceFiles.push(path);
    }
  };
  walk(sourceRoot);
  const owners = sourceFiles
    .filter((path) => readFileSync(path, 'utf8').includes('reconcileCoincidentPartitions'))
    .map((path) => relative(sourceRoot, path).replaceAll('\\', '/'))
    .sort();
  assert.deepEqual(owners, ['coincident-partitions.ts', 'plan-optimizer.ts'],
    'render/pointer modules must not import or invoke the Optimize-only pass');
});

test('issue 276 fails closed for an orphan host, overlap, column and unknown partition data', () => {
  const variants = [];

  const orphan = clone(fixture);
  orphan.spaces[0].openings[0].host.t = 2;
  variants.push(['invalid hosted opening', orphan]);

  const overlap = clone(fixture);
  overlap.spaces[0].openings.push({
    id: 'ordinary', type: 'door', x: 0.5041666666666667, y: 0.5,
    angle: 90, length: 0.2,
  });
  variants.push(['overlapping opening', overlap]);

  const column = clone(fixture);
  column.spaces[0].wall_columns = [{
    id: 'column', shape: 'circle', center: [0.5041666666666667, 0.5], cm: 20,
  }];
  variants.push(['overlapping column', column]);

  const futurePartition = clone(fixture);
  futurePartition.spaces[0].partitions[0].future_semantics = true;
  variants.push(['unknown partition data', futurePartition]);

  for (const [name, input] of variants) {
    const result = optimize(input);
    assert.equal(result.report.partitionsReconciled, 0, name);
    assert.equal(result.config.spaces[0].partitions.length, 1, name);
    assert.ok(result.config.spaces[0].openings[0].host, name);
  }
});

test('issue 296 removes a fully hidden saved chain before reconciling its partition', () => {
  const input = clone(fixture);
  input.spaces[0].room_drafts = [{
    id: 'hidden-draft',
    points: [[0.5041666666666667, 0.2], [0.5041666666666667, 0.8]],
    segments: [{ cm: 15 }],
  }];
  const result = optimize(input);
  assert.equal(result.report.removedDrafts, 0);
  assert.equal(result.report.redundantDraftsRemoved, 1);
  assert.equal(result.report.partitionsReconciled, 1);
  assert.equal(result.config.spaces[0].room_drafts, undefined);
  assert.equal(result.config.spaces[0].partitions, undefined);
});
