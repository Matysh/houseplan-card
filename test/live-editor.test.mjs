import assert from 'node:assert/strict';
import test from 'node:test';

import {
  disposeHouseplanEditor,
  routeHouseplanEditorUpdate,
} from '../test-build/live-editor.js';
import {
  cancelHouseplanPointerMove,
  flushHouseplanPointerMove,
  queueHouseplanPointerMove,
} from '../test-build/pointer-move-queue.js';

test('editor live routing keeps pointerdown and terminal changes reactive', () => {
  const beforeRaf = globalThis.requestAnimationFrame;
  const beforeCancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = () => 17;
  globalThis.cancelAnimationFrame = () => {};
  const host = {
    isConnected: true,
    _mode: 'plan',
    _physicalDrag: { moved: false },
  };
  try {
    assert.equal(routeHouseplanEditorUpdate(host, '_physicalDrag', null), false);
    assert.equal(routeHouseplanEditorUpdate(host, '_physicalDrag', { moved: false }), true);
    host._physicalDrag = null;
    assert.equal(routeHouseplanEditorUpdate(host, '_physicalDrag', { moved: true }), false);
    assert.equal(routeHouseplanEditorUpdate(host, '_toast', ''), false);
  } finally {
    disposeHouseplanEditor(host);
    globalThis.requestAnimationFrame = beforeRaf;
    globalThis.cancelAnimationFrame = beforeCancel;
  }
});

test('pointer-following editor hover routes while View remains reactive', () => {
  const beforeRaf = globalThis.requestAnimationFrame;
  const beforeCancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = () => 21;
  globalThis.cancelAnimationFrame = () => {};
  const host = { isConnected: true, _mode: 'plan' };
  try {
    assert.equal(routeHouseplanEditorUpdate(host, '_cursorPt', null), true);
    host._mode = 'view';
    assert.equal(routeHouseplanEditorUpdate(host, '_cursorPt', [1, 2]), false);
  } finally {
    disposeHouseplanEditor(host);
    globalThis.requestAnimationFrame = beforeRaf;
    globalThis.cancelAnimationFrame = beforeCancel;
  }
});

test('pointer move queue is RAF-coalesced, last-wins and flushable', () => {
  const beforeRaf = globalThis.requestAnimationFrame;
  const beforeCancel = globalThis.cancelAnimationFrame;
  const callbacks = new Map();
  const cancelled = [];
  let nextId = 0;
  globalThis.requestAnimationFrame = (callback) => {
    const id = ++nextId;
    callbacks.set(id, callback);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => {
    cancelled.push(id);
    callbacks.delete(id);
  };
  const host = {};
  const seen = [];
  try {
    queueHouseplanPointerMove(host, 'drag', () => seen.push(1));
    queueHouseplanPointerMove(host, 'drag', () => seen.push(2));
    assert.equal(callbacks.size, 1);
    const [[id, callback]] = callbacks;
    callbacks.delete(id);
    callback();
    assert.deepEqual(seen, [2]);

    queueHouseplanPointerMove(host, 'drag', () => seen.push(3));
    flushHouseplanPointerMove(host, 'drag');
    assert.deepEqual(seen, [2, 3]);
    assert.equal(cancelled.length, 1);

    queueHouseplanPointerMove(host, 'drag', () => seen.push(4));
    cancelHouseplanPointerMove(host, 'drag');
    assert.deepEqual(seen, [2, 3]);
    assert.equal(cancelled.length, 2);
  } finally {
    disposeHouseplanEditor(host);
    globalThis.requestAnimationFrame = beforeRaf;
    globalThis.cancelAnimationFrame = beforeCancel;
  }
});
