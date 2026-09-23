import test from 'node:test';
import assert from 'node:assert/strict';

import {
  dialogBaseline,
  dialogDirty,
  forgetDialogBaseline,
  rememberDialogBaseline,
  restoreDialogBaseline,
  stableKey,
} from '../test-build/editors/dialog-baseline.js';

test('warm transfer preserves clean and dirty meaning on a replacement host (#614)', () => {
  const oldHost = {};
  const newHost = {};
  const original = stableKey({ name: 'Kitchen', busy: false }, new Set(['busy']));
  const changed = stableKey({ name: 'Hall', busy: false }, new Set(['busy']));

  rememberDialogBaseline(oldHost, 'space', original);
  assert.equal(dialogDirty(oldHost, 'space', original), false);
  assert.equal(dialogDirty(oldHost, 'space', changed), true);

  restoreDialogBaseline(newHost, 'space', dialogBaseline(oldHost, 'space'));
  assert.equal(dialogDirty(newHost, 'space', original), false);
  assert.equal(dialogDirty(newHost, 'space', changed), true);
});

test('baseline transfer is isolated by dialog kind and can be explicitly forgotten (#614)', () => {
  const host = {};
  rememberDialogBaseline(host, 'settings', 'settings-v1');
  rememberDialogBaseline(host, 'marker', 'marker-v1');

  assert.equal(dialogBaseline(host, 'settings'), 'settings-v1');
  assert.equal(dialogBaseline(host, 'marker'), 'marker-v1');
  forgetDialogBaseline(host, 'marker');
  assert.equal(dialogBaseline(host, 'marker'), undefined);
  assert.equal(dialogDirty(host, 'marker', 'marker-v1'), true);
  assert.equal(dialogDirty(host, 'settings', 'settings-v1'), false);
});
