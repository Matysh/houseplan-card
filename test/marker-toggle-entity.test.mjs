import test from 'node:test';
import assert from 'node:assert/strict';
import { toggleEntityWriteFields } from '../test-build/marker-toggle-entity.js';

test('issue 178: untouched toggle entity preserves absence, null and stale literals', () => {
  assert.deepEqual(toggleEntityWriteFields({
    touched: false, originalHas: false, original: undefined, value: '',
  }), {});
  assert.deepEqual(toggleEntityWriteFields({
    touched: false, originalHas: true, original: null, value: '',
  }), { toggle_entity: null });
  assert.deepEqual(toggleEntityWriteFields({
    touched: false, originalHas: true, original: 'switch.removed', value: 'switch.removed',
  }), { toggle_entity: 'switch.removed' });
});

test('issue 178: touched selection writes an exact id and Auto restores absence', () => {
  assert.deepEqual(toggleEntityWriteFields({
    touched: true, originalHas: false, original: undefined, value: 'switch.child_lock',
  }), { toggle_entity: 'switch.child_lock' });
  assert.deepEqual(toggleEntityWriteFields({
    touched: true, originalHas: true, original: 'switch.child_lock', value: '',
  }), {});
});
