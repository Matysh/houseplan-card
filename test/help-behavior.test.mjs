import assert from 'node:assert/strict';
import test from 'node:test';
import {
  helpHasContent,
  helpScrollShouldDismiss,
} from '../test-build/help-behavior.js';

test('help is absent unless both visible copy and an accessible name exist', () => {
  assert.equal(helpHasContent('Explanation', 'More information'), true);
  assert.equal(helpHasContent('   ', 'More information'), false);
  assert.equal(helpHasContent('Explanation', ''), false);
  assert.equal(helpHasContent(null, 'More information'), false);
});

test('only scrolling the owning dialog outside the floating surface dismisses help', () => {
  assert.equal(helpScrollShouldDismiss(true, true), false);
  assert.equal(helpScrollShouldDismiss(true, false), false);
  assert.equal(helpScrollShouldDismiss(false, true), true);
  assert.equal(helpScrollShouldDismiss(false, false), false);
});
