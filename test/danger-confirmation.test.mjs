import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { HpConfirmController } from '../test-build/danger-confirm.js';

const request = (key = 'delete-space') => ({
  key,
  kind: 'destructive',
  title: 'Delete?',
  message: 'This cannot be undone.',
  confirmLabel: 'Delete',
  cancelLabel: 'Cancel',
});

test('danger confirmation resolves only the current token and clears its state', async () => {
  const changes = [];
  const controller = new HpConfirmController((state) => changes.push(state));
  const decision = controller.confirm(request());
  const token = controller.state.token;

  assert.equal(controller.resolve(token + 1, true), false, 'stale DOM decisions are ignored');
  assert.equal(controller.resolve(token, true), true);
  assert.equal(await decision, true);
  assert.equal(controller.state, null);
  assert.equal(changes.at(-1), null);
  assert.equal(controller.resolve(token, true), false, 'double activation is inert');
});

test('cancel is the safe default and replacement cancels the older request', async () => {
  const controller = new HpConfirmController(() => undefined);
  const first = controller.confirm(request('first'));
  const second = controller.confirm(request('second'));
  const secondToken = controller.state.token;

  assert.equal(await first, false);
  assert.equal(controller.cancel(), true);
  assert.equal(await second, false);
  assert.equal(controller.resolve(secondToken, true), false);
  assert.equal(controller.cancel(), false);
});

test('request text is snapshotted for the visible confirmation', async () => {
  const controller = new HpConfirmController(() => undefined);
  const mutable = request();
  const decision = controller.confirm(mutable);
  mutable.title = 'Changed after opening';
  assert.equal(controller.state.request.title, 'Delete?');
  assert.equal(Object.isFrozen(controller.state.request), true);
  controller.cancel();
  assert.equal(await decision, false);
});

test('all dangerous-action call sites use the shared confirmation contract', () => {
  const files = [
    '../src/houseplan-card.ts',
    '../src/houseplan-editor-runtime.ts',
    '../src/houseplan-onboarding-runtime.ts',
  ];
  const source = files.map((relative) => readFileSync(new URL(relative, import.meta.url), 'utf8')).join('\n');
  const nativeCalls = source.match(
    /(?:\bwindow\.confirm|\bglobalThis\.confirm|(?<![\w.])confirm)\s*\(/g,
  ) || [];
  const sharedCalls = source.match(/await this(?:\.host)?\._confirmDanger\s*\(\{/g) || [];

  assert.equal(nativeCalls.length, 0, 'native browser confirmation must not return');
  assert.equal(sharedCalls.length, 8, 'the reviewed inventory stays on the shared surface');
  for (const key of [
    'delete-draft', 'delete-draft-segment', 'remove-marker',
    'delete-plan', 'delete-space', 'unlock',
  ]) {
    assert.match(source, new RegExp(`key: '${key}'`));
  }
});
