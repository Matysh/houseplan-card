import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  NEAR_AXIS_MAX_DEGREES,
  NEAR_AXIS_MAX_SLOPE,
  classifyNearAxisSegment,
  repairNearAxisRoomWalls,
  snapNearAxisEndpoint,
} from '../test-build/near-axis.js';
import { optimizePlans } from '../test-build/plan-optimizer.js';
import { MULTI_WALL_NEAR_ORTHOGONAL_MAX_DEGREES } from '../test-build/wall-thickness.js';
import { nearAxisProfile } from '../scripts/model-invariants.mjs';

const fixture = JSON.parse(readFileSync(
  new URL('./fixtures/279-near-orthogonal-junction.json', import.meta.url), 'utf8',
));
const clone = (value) => JSON.parse(JSON.stringify(value));
const sourceOf = (file) => readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');

test('#290 authoring, Optimize and renderer use one near-axis threshold source', () => {
  const renderer = sourceOf('wall-thickness.ts');
  const authoring = sourceOf('houseplan-card.ts');
  const optimizer = sourceOf('plan-optimizer.ts');

  assert.match(renderer, /import \{ NEAR_AXIS_MAX_DEGREES \} from '\.\/near-axis';/);
  assert.match(renderer,
    /export const MULTI_WALL_NEAR_ORTHOGONAL_MAX_DEGREES = NEAR_AXIS_MAX_DEGREES;/);
  assert.match(authoring, /import \{ snapNearAxisEndpoint \} from '\.\/near-axis';/);
  assert.match(authoring, /snapNearAxisEndpoint\(/);
  assert.match(optimizer, /import \{ repairNearAxisRoomWalls \} from '\.\/near-axis';/);
  assert.match(optimizer, /repairNearAxisRoomWalls\(space\)/);
});

test('#290 near-axis boundary is shared, inclusive and bounded', () => {
  assert.equal(NEAR_AXIS_MAX_DEGREES, 0.25);
  assert.equal(MULTI_WALL_NEAR_ORTHOGONAL_MAX_DEGREES, NEAR_AXIS_MAX_DEGREES);
  assert.equal(classifyNearAxisSegment([0, 0], [316, 0]), null);
  assert.equal(classifyNearAxisSegment([0, 0], [316, 1])?.axis, 'horizontal');
  assert.equal(classifyNearAxisSegment([0, 0], [316, 2]), null);
  assert.equal(classifyNearAxisSegment([0, 0], [1, NEAR_AXIS_MAX_SLOPE])?.axis, 'horizontal');
  assert.equal(classifyNearAxisSegment([0, 0], [1, NEAR_AXIS_MAX_SLOPE * 1.000001]), null);
  assert.equal(classifyNearAxisSegment([0, 0], [1, Math.tan(Math.PI / 6)]), null);
  assert.equal(classifyNearAxisSegment([0, 0], [1, 316])?.axis, 'vertical');
  assert.equal(classifyNearAxisSegment([1, 316], [0, 0])?.axis, 'vertical');
});

test('#290 Walls rule moves only the free endpoint', () => {
  assert.deepEqual(snapNearAxisEndpoint([10, 20], [326, 21]), [326, 20]);
  assert.deepEqual(snapNearAxisEndpoint([10, 20], [11, 336]), [10, 336]);
  assert.deepEqual(snapNearAxisEndpoint([10, 20], [326, 22]), [326, 22]);
  assert.deepEqual(snapNearAxisEndpoint([10, 20], [110, 120]), [110, 120]);
});

test('#290 repairs a duplicated 316x1 physical wall once without mutating input', () => {
  const input = clone(fixture);
  const before = JSON.stringify(input);
  const result = repairNearAxisRoomWalls(input);
  assert.equal(JSON.stringify(input), before);
  assert.equal(result.report.wallsStraightened, 1);
  assert.equal(result.report.wallsStraightenSkipped, 0);
  assert.ok(Math.abs(result.report.maxStraightenShift - 1 / 240) < 1e-9);
  const north = result.space.rooms.find((room) => room.id === 'north-west');
  const south = result.space.rooms.find((room) => room.id === 'south-west');
  assert.deepEqual(north.poly[1], south.poly[0]);
  assert.deepEqual(north.poly[2], south.poly[3]);
  assert.equal(north.poly[1][1], north.poly[2][1]);
});

test('#290 repairs saved drafts and independent partitions but preserves true diagonals', () => {
  const input = {
    rooms: [],
    room_drafts: [{
      id: 'draft', points: [[0, 0], [316, 1], [316, 20]],
      segments: [{ cm: 15 }, { cm: 15 }],
    }],
    partitions: [
      { id: 'near', a: [0, 100], b: [316, 101], cm: 15 },
      { id: 'diagonal', a: [0, 200], b: [100, 300], cm: 15 },
    ],
  };
  const result = repairNearAxisRoomWalls(input);
  assert.equal(result.report.wallsStraightened, 2);
  assert.equal(result.space.room_drafts[0].points.length, 3);
  assert.equal(result.space.room_drafts[0].segments.length, 2);
  assert.equal(result.space.room_drafts[0].points[0][1], result.space.room_drafts[0].points[1][1]);
  assert.equal(result.space.partitions[0].a[1], result.space.partitions[0].b[1]);
  assert.deepEqual(result.space.partitions[1], input.partitions[1]);
});

test('#290 skips a repair that would no longer fit a hosted opening', () => {
  const input = {
    rooms: [],
    partitions: [{ id: 'host', a: [0, 0], b: [316, 1], cm: 15 }],
    openings: [{
      id: 'opening',
      length: 316.001,
      host: { kind: 'partition', id: 'host', t: 0.5 },
    }],
  };
  const result = repairNearAxisRoomWalls(input);
  assert.equal(result.report.wallsStraightened, 0);
  assert.equal(result.report.wallsStraightenSkipped, 1);
  assert.deepEqual(result.space.partitions, input.partitions);
});

test('#290 Optimize reports physical count, exact max centimetres and is idempotent', () => {
  const config = { spaces: [{ id: 'floor', title: 'Floor', ...clone(fixture) }] };
  const first = optimizePlans(config, {});
  assert.equal(first.report.wallsStraightened, 1);
  assert.equal(first.report.wallsStraightenSkipped, 0);
  assert.ok(Math.abs(first.report.maxStraightenShiftCm - 1) < 1e-6);
  assert.equal(first.report.maxStraightenSpace, 'floor');
  assert.equal(first.changed, true);
  const second = optimizePlans(first.config, first.layout);
  assert.equal(second.changed, false);
  assert.equal(second.report.wallsStraightened, 0);
  assert.equal(second.report.maxStraightenShiftCm, 0);
});

test('#290 Optimize reduces the tracked real-plan near-axis profile and stays idempotent', () => {
  for (const file of ['real-plan-first-floor.json', 'real-plan-second-floor.json']) {
    const { space } = JSON.parse(readFileSync(
      new URL(`./fixtures/${file}`, import.meta.url), 'utf8',
    ));
    const config = { spaces: [clone(space)] };
    const before = nearAxisProfile(config);
    const first = optimizePlans(config, {});
    const after = nearAxisProfile(first.config);
    const second = optimizePlans(first.config, first.layout);

    assert.equal(after.total, before.total - first.report.wallsStraightened, file);
    assert.equal(after.total <= before.total, true, file);
    assert.equal(second.report.wallsStraightened, 0, file);
    assert.equal(nearAxisProfile(second.config).total, after.total, file);
  }
  const { space } = JSON.parse(readFileSync(
    new URL('./fixtures/real-plan-second-floor.json', import.meta.url), 'utf8',
  ));
  const config = { spaces: [clone(space)] };
  const before = nearAxisProfile(config);
  const repaired = optimizePlans(config, {});
  assert.equal(before.total, 1);
  assert.equal(repaired.report.wallsStraightened, 1);
  assert.equal(nearAxisProfile(repaired.config).total, 0);
});
