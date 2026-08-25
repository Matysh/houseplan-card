import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GRID_IMPERIAL_CELL_CM,
  GRID_VISUAL_REFERENCE_CELL_CM,
  gridCellFieldToCm,
  gridCellFieldValue,
  gridVisualScale,
  gridVisualUnits,
  newSpaceCellCm,
  wallThickHoverHalfUnits,
} from '../test-build/grid-scale.js';

const GRID_PITCH = 1000 / 240;

test('visual scale preserves the 5 cm reference and follows physical equivalence', () => {
  assert.equal(GRID_VISUAL_REFERENCE_CELL_CM, 5);
  assert.equal(gridVisualScale(5), 1);
  for (const cellCm of [1, 2.54, 10, 25]) {
    assert.equal(gridVisualScale(cellCm), 5 / cellCm);
    assert.equal(gridVisualUnits(2.5, cellCm), 2.5 * (5 / cellCm));
  }
});

test('invalid visual-scale inputs retain the legacy 5 cm appearance', () => {
  for (const value of [NaN, Infinity, -Infinity, 0, -1, undefined, null, '', '1', 'not-a-number']) {
    assert.equal(gridVisualScale(value), 1);
  }
});

test('wall-thickness hover uses the exact physical wall width at every cell scale (#303)', () => {
  assert.equal(wallThickHoverHalfUnits(50, 30, GRID_PITCH), (50 / 30) * GRID_PITCH / 2);
  assert.equal(wallThickHoverHalfUnits(12.5, 5, GRID_PITCH), GRID_PITCH * 1.25);
  assert.equal(wallThickHoverHalfUnits(3, 5, GRID_PITCH) * 2, 2.5);
});

test('zero-thickness hover keeps the reference look and one physical width (#303)', () => {
  const atFive = wallThickHoverHalfUnits(0, 5, GRID_PITCH);
  const atThirty = wallThickHoverHalfUnits(0, 30, GRID_PITCH);
  assert.equal(atFive * 2, GRID_PITCH * 3);
  assert.equal((atFive * 2 / GRID_PITCH) * 5, 15);
  assert.ok(Math.abs((atThirty * 2 / GRID_PITCH) * 30 - 15) < 1e-12);
});

test('wall-thickness hover treats invalid thickness and cell size as safe fallbacks (#303)', () => {
  const zero = wallThickHoverHalfUnits(0, 5, GRID_PITCH);
  for (const cm of [-1, NaN, Infinity, -Infinity]) {
    assert.equal(wallThickHoverHalfUnits(cm, 5, GRID_PITCH), zero);
  }
  for (const cellCm of [0, -1, NaN, Infinity, -Infinity]) {
    assert.equal(wallThickHoverHalfUnits(0, cellCm, GRID_PITCH), zero);
  }
  assert.equal(wallThickHoverHalfUnits(50, 0, GRID_PITCH), 5 * GRID_PITCH);
  assert.equal(wallThickHoverHalfUnits(50, 30, NaN), 0);
});

test('new-space defaults use one centimetre or exactly one inch', () => {
  assert.equal(newSpaceCellCm(false), 1);
  assert.equal(newSpaceCellCm(true), GRID_IMPERIAL_CELL_CM);
  assert.equal(GRID_IMPERIAL_CELL_CM, 2.54);
});

test('imperial field projection is readable while canonical values stay available', () => {
  assert.equal(gridCellFieldValue(2.54, true), '1');
  assert.equal(gridCellFieldValue(1, false), '1');
  assert.equal(gridCellFieldValue(5, true), '1.968504');
  assert.equal(gridCellFieldToCm(1, true), 2.54);
  assert.equal(gridCellFieldToCm(1.25, true), 3.175);
  assert.equal(gridCellFieldToCm(1.25, false), 1.25);
});
