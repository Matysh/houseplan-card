import test from 'node:test';
import assert from 'node:assert/strict';

import {
  selectActiveSpaceModel, selectSpaceModelById,
} from '../test-build/space-model-selection.js';

const spaces = [
  { id: 'ground', rooms: ['living'] },
  { id: 'upper', rooms: ['bedroom'] },
];

test('active selection preserves the active-or-first legacy contract', () => {
  assert.equal(selectActiveSpaceModel(spaces, 'upper'), spaces[1]);
  assert.equal(selectActiveSpaceModel(spaces, 'stale'), spaces[0]);
  assert.equal(selectActiveSpaceModel(spaces, null), spaces[0]);
});

test('an empty model has no invented space', () => {
  assert.equal(selectActiveSpaceModel([], 'ground'), undefined);
  assert.equal(selectActiveSpaceModel([], null), undefined);
});

test('explicit id selection never falls back to another space', () => {
  assert.equal(selectSpaceModelById(spaces, 'upper'), spaces[1]);
  assert.equal(selectSpaceModelById(spaces, 'stale'), undefined);
  assert.equal(selectSpaceModelById(spaces, null), undefined);
  assert.equal(selectSpaceModelById([], 'ground'), undefined);
});
