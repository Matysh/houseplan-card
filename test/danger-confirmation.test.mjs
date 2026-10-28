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
  assert.equal(controller.state, null, 'authority retires synchronously');
  assert.equal(changes.at(-1), null, 'presentation retirement is published synchronously');
  assert.equal(await decision, true);
  assert.equal(controller.state, null);
  assert.equal(changes.at(-1), null);
  assert.equal(controller.resolve(token, true), false, 'double activation is inert');
});

test('accepted confirmation coalesces retirement with the resumed owner update', async () => {
  let confirmation = null, busy = false, pending = false;
  const frames = [];
  // Model the host's microtask-batched reactive update. The real controller
  // drives retirement; its real Promise resumes an owner that marks work busy.
  const requestUpdate = () => {
    if (pending) return;
    pending = true;
    queueMicrotask(() => {
      pending = false;
      frames.push({ confirmation: confirmation !== null, busy });
    });
  };
  const controller = new HpConfirmController(state => {
    confirmation = state;
    requestUpdate();
  });
  const decision = controller.confirm(request('remove-marker'));
  const token = controller.state.token;
  const owner = (async () => {
    if (await decision) {
      assert.equal(controller.state, null, 'resumed work never sees old authority');
      assert.equal(confirmation, null, 'retirement was already published');
      busy = true;
      requestUpdate();
    }
  })();
  await Promise.resolve();
  assert.deepEqual(frames, [{ confirmation: true, busy: false }]);
  frames.length = 0;

  assert.equal(controller.resolve(token, true), true);
  assert.equal(confirmation, null, 'publication is not deferred to a later task');
  assert.equal(busy, false, 'owner continuation cannot run synchronously');
  await owner;
  assert.deepEqual(frames, [{ confirmation: false, busy: true }],
    'no intervening full host frame closes only confirmation before owner work');
});
test('cancel is the safe default and replacement cancels the older request', async () => {
  const controller = new HpConfirmController(() => undefined);
  const first = controller.confirm(request('first'));
  const firstToken = controller.state.token;
  const second = controller.confirm(request('second'));
  const secondToken = controller.state.token;
  assert.notEqual(secondToken, firstToken);
  assert.equal(controller.resolve(firstToken, true), false, 'retired token cannot accept its replacement');
  assert.equal(controller.state.token, secondToken, 'replacement is current synchronously');

  assert.equal(await first, false);
  assert.equal(controller.cancel(), true);
  assert.equal(controller.state, null, 'cancel retires current authority synchronously');
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
    '../src/marker-deletion.ts',
    '../src/decor-image-editor.ts',
    '../src/houseplan-onboarding-runtime.ts',
  ];
  const source = files.map((relative) => readFileSync(new URL(relative, import.meta.url), 'utf8')).join('\n');
  const nativeCalls = source.match(
    /(?:\bwindow\.confirm|\bglobalThis\.confirm|(?<![\w.])confirm)\s*\(/g,
  ) || [];
  const sharedCalls = source.match(/await (?:this(?:\.host)?|host)\._confirmDanger\s*\(\{/g) || [];

  assert.equal(nativeCalls.length, 0, 'native browser confirmation must not return');
  assert.equal(sharedCalls.length, 9, '#931 panel Delete uses the same confirmation and cleanup without a fabricated dialog');
  for (const key of [
    'remove-marker', 'remove-markers', 'delete-plan', 'delete-space', 'unlock', 'close-support-busy',
  ]) {
    assert.match(source, new RegExp(`key: '${key}'`));
  }
  assert.match(source, /key: `delete-decor-asset:\$\{asset\.asset_id\}`/);
});
