import test from 'node:test';
import assert from 'node:assert/strict';

import { invalidDefaultFloor } from '../test-build/card-editor-validation.js';

const spaces = [{ value: 'home', label: 'Home' }];

test('issue 244 default_floor warning waits for authoritative spaces and preserves raw id', () => {
  const config = { type: 'custom:houseplan-card', default_floor: 'gone', kiosk: true };
  assert.equal(invalidDefaultFloor(config, null, false), null);
  assert.equal(invalidDefaultFloor(config, [], false), null);
  assert.equal(invalidDefaultFloor(config, spaces, true), 'gone');
  assert.equal(config.default_floor, 'gone');
  assert.equal(config.kiosk, true);
});

test('issue 244 default_floor warning is absent for empty and valid values', () => {
  assert.equal(invalidDefaultFloor({}, spaces, true), null);
  assert.equal(invalidDefaultFloor({ default_floor: '' }, spaces, true), null);
  assert.equal(invalidDefaultFloor({ default_floor: 'home' }, spaces, true), null);
});
