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
} from '../test-build/grid-scale.js';

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
