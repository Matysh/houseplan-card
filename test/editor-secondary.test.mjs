import assert from 'node:assert/strict';
import test from 'node:test';

import { EditorSecondaryController } from '../test-build/editor-secondary.js';

const host = {
  root: () => ({}),
  requestUpdate() {},
  async updateComplete() {},
  clearTip() {},
};

test('editor secondary context returns the current action result and rejects stale actions (#405)', async () => {
  const controller = new EditorSecondaryController(host);

  assert.equal(controller.runContext('current', 'current', () => 42), 42);

  const pending = Promise.resolve('finished');
  assert.equal(controller.runContext('current', 'current', () => pending), pending);
  assert.equal(await controller.runContext('current', 'current', () => pending), 'finished');

  let staleCalled = false;
  assert.equal(controller.runContext('old', 'current', () => {
    staleCalled = true;
    return 'unexpected';
  }), undefined);
  assert.equal(staleCalled, false);
});
