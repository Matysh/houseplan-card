import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';

import { optimizePlans } from '../test-build/plan-optimizer.js';
import {
  applySafeResize, clampSafeResize, resolveSafeResize,
} from '../test-build/resize.js';
import { GRID_PITCH, NORM_W } from '../test-build/space-geometry.js';
import { thicknessCmAt, wallCmToUnits } from '../test-build/wall-thickness.js';

const source = JSON.parse(readFileSync(
  new URL('./fixtures/281-resize-outer-partitions.json', import.meta.url), 'utf8',
));
const expected = JSON.parse(readFileSync(
  new URL('./fixtures/281-resize-outer-candidate.json', import.meta.url), 'utf8',
));
const clone = (value) => structuredClone(value);

const resizeInputs = (space) => ({
  rooms: space.rooms.map((room) => ({
    id: room.id,
    poly: room.poly.map(([x, y]) => [x * NORM_W, y * NORM_W]),
  })),
  openings: (space.openings || []).map((opening) => ({
    id: opening.id,
    x: opening.x * NORM_W,
    y: opening.y * NORM_W,
    length: opening.length * NORM_W,
    angle: opening.angle,
    hosted: !!opening.host,
  })),
  obstacles: (space.partitions || []).map((partition) => ({
    kind: 'segment',
    a: partition.a.map((value) => value * NORM_W),
    b: partition.b.map((value) => value * NORM_W),
    half: wallCmToUnits(partition.cm, space.cell_cm, GRID_PITCH) / 2,
  })),
});

const options = (obstacles) => ({
  minDim: wallCmToUnits(30, 5, GRID_PITCH),
  eps: GRID_PITCH * 0.05,
  step: GRID_PITCH,
  movingHalf: wallCmToUnits(20, 5, GRID_PITCH) / 2,
  obstacles,
});

test('issue 281 Optimize removes exact outer duplicates and rehosts their windows', () => {
  const input = clone(source);
  const before = clone(input);
  const result = optimizePlans(input, {});
  assert.deepEqual(input, before, 'Optimize preview must stay immutable');
  assert.equal(result.report.partitionsReconciled, 3);
  assert.equal(result.report.openingsRehosted, 2);
  assert.deepEqual(result.config, expected);
  assert.ok(result.config.spaces[0].openings.every((opening) => opening.host?.kind === 'wall'));
  const second = optimizePlans(result.config, result.layout);
  assert.equal(second.changed, false);
  assert.deepEqual(second.config, result.config);
});

test('issue 281 disables the old zero-range handle and enables it after Optimize', () => {
  const before = resizeInputs(source.spaces[0]);
  const blocked = resolveSafeResize(
    before.rooms, before.openings, 'left', 1, options(before.obstacles),
  );
  assert.deepEqual(blocked, { enabled: false, reason: 'duplicate-physical-wall' });

  const optimized = optimizePlans(clone(source), {}).config.spaces[0];
  const after = resizeInputs(optimized);
  const opts = options(after.obstacles);
  const resolution = resolveSafeResize(after.rooms, after.openings, 'left', 1, opts);
  assert.equal(resolution.enabled, true);
  const plan = resolution.plan;
  assert.equal(clampSafeResize(
    after.rooms, after.openings, plan, GRID_PITCH, GRID_PITCH, opts,
  ), GRID_PITCH);
  assert.equal(clampSafeResize(
    after.rooms, after.openings, plan, -GRID_PITCH, GRID_PITCH, opts,
  ), -GRID_PITCH);
  const moved = applySafeResize(after.rooms, after.openings, plan, GRID_PITCH);
  assert.deepEqual(Object.keys(moved.polys).sort(), ['left', 'right']);
  assert.ok(Object.values(moved.polys).every((poly) => poly.length === 4));
});

test('issue 281 leaves unsafe outer duplicates as hard stops', () => {
  const variants = [];
  const unknown = clone(source);
  unknown.spaces[0].partitions[0].future_semantics = true;
  variants.push(unknown);
  const overlap = clone(source);
  overlap.spaces[0].openings.push({
    id: 'ordinary-overlap', type: 'window',
    x: 0.25, y: 0, angle: 0, length: 0.2,
  });
  variants.push(overlap);

  for (const input of variants) {
    const result = optimizePlans(input, {});
    assert.ok(
      result.config.spaces[0].partitions?.some((partition) => partition.id === 'top-left'),
      'unsafe outer partition must remain explicit',
    );
  }
});

test('issue 296 removes a shorter outer duplicate which is entirely hidden', () => {
  const partial = clone(source);
  partial.spaces[0].partitions[0].b = [0.4, 0];
  const result = optimizePlans(partial, {});
  assert.equal(result.config.spaces[0].partitions
    ?.some((partition) => partition.id === 'top-left') ?? false, false);
});

test('issue 281 private exact fixture has no enabled zero-range handle', (t) => {
  const path = 'C:\\Temp\\44.json';
  if (!existsSync(path)) return t.skip('private #281 fixture is not present');
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const previous = raw.payload?.config || raw.config || raw;
  const optimized = optimizePlans(previous, {}).config.spaces[0];
  const inputs = resizeInputs(optimized);
  const openings = inputs.openings;
  const obstacles = inputs.obstacles;
  let enabled = 0;
  let zeroRange = 0;
  let target = null;
  for (const room of inputs.rooms) {
    for (let edge = 0; edge < room.poly.length; edge++) {
      const a = room.poly[edge], b = room.poly[(edge + 1) % room.poly.length];
      const cm = thicknessCmAt(optimized.walls, a, b, 1 / 240, NORM_W) || 15;
      const opts = {
        minDim: wallCmToUnits(30, optimized.cell_cm, GRID_PITCH),
        eps: GRID_PITCH * 0.05,
        step: GRID_PITCH,
        movingHalf: wallCmToUnits(cm, optimized.cell_cm, GRID_PITCH) / 2,
        obstacles,
      };
      const resolution = resolveSafeResize(inputs.rooms, openings, room.id, edge, opts);
      if (!resolution.enabled) continue;
      enabled++;
      const negative = clampSafeResize(
        inputs.rooms, openings, resolution.plan, -GRID_PITCH, GRID_PITCH, opts,
      );
      const positive = clampSafeResize(
        inputs.rooms, openings, resolution.plan, GRID_PITCH, GRID_PITCH, opts,
      );
      if (negative === 0 && positive === 0) zeroRange++;
      const configA = a.map((value) => value / NORM_W);
      const configB = b.map((value) => value / NORM_W);
      if ([configA, configB].every((point) =>
        Math.abs(point[0] - 0.4) < 1e-8
        && point[1] >= -0.208333334 && point[1] <= 1.266666668)) {
        target = { negative, positive };
      }
    }
  }
  assert.equal(zeroRange, 0, `${zeroRange}/${enabled} enabled handles cannot move`);
  assert.ok(target && target.negative < 0 && target.positive > 0,
    'the reported shared wall must move at least one step both ways');
});
