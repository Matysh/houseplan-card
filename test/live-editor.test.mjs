import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  commitHouseplanEditor,
  disposeHouseplanEditor,
  routeHouseplanEditorUpdate,
  whenHouseplanEditorSettled,
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
  const host = { isConnected: true, _mode: 'plan', _cursorPt: [1, 2] };
  try {
    assert.equal(routeHouseplanEditorUpdate(host, '_cursorPt', null), true);
    const previous = host._cursorPt;
    host._cursorPt = null;
    assert.equal(routeHouseplanEditorUpdate(host, '_cursorPt', previous), false);
    host._cursorPt = [1, 2];
    host._mode = 'view';
    assert.equal(routeHouseplanEditorUpdate(host, '_cursorPt', [1, 2]), false);
  } finally {
    disposeHouseplanEditor(host);
    globalThis.requestAnimationFrame = beforeRaf;
    globalThis.cancelAnimationFrame = beforeCancel;
  }
});

test('pointer move queue is event-turn coalesced, last-wins and flushable', async () => {
  const host = {};
  const seen = [];
  try {
    queueHouseplanPointerMove(host, 'drag', () => seen.push(1));
    queueHouseplanPointerMove(host, 'drag', () => seen.push(2));
    assert.deepEqual(seen, []);
    await Promise.resolve();
    assert.deepEqual(seen, [2]);

    queueHouseplanPointerMove(host, 'drag', () => seen.push(3));
    flushHouseplanPointerMove(host, 'drag');
    assert.deepEqual(seen, [2, 3]);
    await Promise.resolve();
    assert.deepEqual(seen, [2, 3]);

    queueHouseplanPointerMove(host, 'drag', () => seen.push(4));
    cancelHouseplanPointerMove(host, 'drag');
    await Promise.resolve();
    assert.deepEqual(seen, [2, 3]);
  } finally {
    disposeHouseplanEditor(host);
  }
});

test('live editor settlement waits for paint and releases on commit or dispose', async () => {
  const beforeRaf = globalThis.requestAnimationFrame;
  const beforeCancel = globalThis.cancelAnimationFrame;
  const frames = new Map();
  let nextFrame = 1;
  globalThis.requestAnimationFrame = (callback) => {
    const id = nextFrame++;
    frames.set(id, callback);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  const root = { querySelector: () => null, querySelectorAll: () => [] };
  const host = { isConnected: true, _mode: 'plan', renderRoot: root, _cursorPt: [0, 0] };
  const runFrame = () => {
    const [id, callback] = frames.entries().next().value || [];
    assert.ok(id, 'a live frame is scheduled');
    frames.delete(id);
    callback(0);
  };
  try {
    assert.equal(routeHouseplanEditorUpdate(host, '_cursorPt', null), true);
    const first = whenHouseplanEditorSettled(host);
    let firstDone = false;
    void first.then(() => { firstDone = true; });
    await Promise.resolve();
    assert.equal(firstDone, false, 'settlement cannot run ahead of the live paint');
    runFrame();
    await first;
    assert.equal(firstDone, true);

    const previousCursor = host._cursorPt;
    host._cursorPt = null;
    assert.equal(routeHouseplanEditorUpdate(host, '_cursorPt', previousCursor), false,
      'terminal hover null must reconcile the settled layer through Lit');
    assert.equal(frames.size, 0, 'terminal hover null does not leave a live frame');

    host._cursorPt = [1, 2];
    assert.equal(routeHouseplanEditorUpdate(host, '_cursorPt', [1, 2]), true);
    host._cursorPt = [2, 3];
    assert.equal(routeHouseplanEditorUpdate(host, '_cursorPt', [2, 3]), true);
    assert.equal(frames.size, 1, 'coalesced updates own one frame');
    const coalesced = whenHouseplanEditorSettled(host);
    runFrame();
    await coalesced;

    host._cursorPt = [3, 4];
    assert.equal(routeHouseplanEditorUpdate(host, '_cursorPt', [2, 3]), true);
    const committed = whenHouseplanEditorSettled(host);
    commitHouseplanEditor(host);
    await committed;
    assert.equal(frames.size, 0, 'a complete Lit commit cancels its superseded live frame');

    host._cursorPt = [4, 5];
    assert.equal(routeHouseplanEditorUpdate(host, '_cursorPt', [3, 4]), true);
    const disposed = whenHouseplanEditorSettled(host);
    disposeHouseplanEditor(host);
    await disposed;
    assert.equal(frames.size, 0, 'dispose leaves no frame or waiter behind');
  } finally {
    disposeHouseplanEditor(host);
    globalThis.requestAnimationFrame = beforeRaf;
    globalThis.cancelAnimationFrame = beforeCancel;
  }
});

test('live editor browser smokes use the explicit settlement contract', () => {
  for (const name of ['smoke_furniture.mjs', 'smoke_decor.mjs', 'smoke_decor_text.mjs']) {
    const source = readFileSync(new URL(`../demo/${name}`, import.meta.url), 'utf8');
    const helper = source.match(/const settleLive = ([^;]+);/)?.[0] || '';
    assert.match(helper, /_whenLiveEditorSettled\(\)/, `${name}: explicit contract`);
    assert.doesNotMatch(helper, /requestAnimationFrame|setTimeout|sleep|Promise\.resolve/,
      `${name}: no timing heuristic`);
  }
});
