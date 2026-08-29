import assert from 'node:assert/strict';
import test from 'node:test';

import { ensureHarnessEditorRuntime } from '../demo/editor-runtime-compat.mjs';

test('a pre-lazy-editor baseline is already ready for the harness (#380)', async () => {
  assert.equal(await ensureHarnessEditorRuntime({}), true);
  assert.equal(await ensureHarnessEditorRuntime(null), true);
});

test('a lazy editor runtime is called with its card and must succeed (#380)', async () => {
  let owner = null;
  const card = {
    async _ensureEditorRuntime() {
      owner = this;
      return true;
    },
  };
  assert.equal(await ensureHarnessEditorRuntime(card), true);
  assert.equal(owner, card);

  assert.equal(await ensureHarnessEditorRuntime({
    async _ensureEditorRuntime() { return false; },
  }), false);
});

test('a broken lazy preload remains a hard harness failure (#380)', async () => {
  await assert.rejects(
    ensureHarnessEditorRuntime({
      async _ensureEditorRuntime() { throw new Error('chunk failed'); },
    }),
    /chunk failed/,
  );
});
