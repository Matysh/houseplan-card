import test from 'node:test';
import assert from 'node:assert/strict';
import { WallNodeEditor } from '../test-build/wall-node-editor.js';
import { applyNodeMove, prepareNodeMove, structuralWallNodes } from '../test-build/wall-node-move.js';

function setup() {
  const cfg = { model_version: 10, spaces: [{ id: 'f', rooms: [], wall_segments: [],
    partitions: [{ id: 'w', a: [0, 0], b: [1, 0], cm: 0 }] }], markers: [], settings: {} };
  const context = { enabled: true, api: true, space: 'f', revision: 1 };
  const capture = new Set();
  const stage = { style: {}, setPointerCapture: p => capture.add(p),
    hasPointerCapture: p => capture.has(p), releasePointerCapture: p => capture.delete(p) };
  const window = new EventTarget(), toasts = [], writes = [], recorded = [];
  const frames = new Map(); let frameId = 0, autoFrames = true;
  const flushFrame = () => { const ready = [...frames.values()]; frames.clear(); for (const run of ready) run(0); };
  window.requestAnimationFrame = run => { const id = ++frameId; frames.set(id, run);
    if (autoFrames) setImmediate(() => { const task = frames.get(id); frames.delete(id); task?.(0); });
    return id; };
  window.cancelAnimationFrame = id => frames.delete(id);
  const listeners = new Set(), add = window.addEventListener.bind(window), remove = window.removeEventListener.bind(window);
  window.addEventListener = (type, listener) => { if (type === 'pagehide') listeners.add(listener); add(type, listener); };
  window.removeEventListener = (type, listener) => { if (type === 'pagehide') listeners.delete(listener); remove(type, listener); };
  let paintResolve, paint = Promise.resolve(), fail = false, retireOnWrite = false, validPreview = true;
  const changes = [], validations = [];
  const port = { context: () => context, config: () => cfg,
    screenPoint: ev => [ev.clientX, ev.clientY], unitsPerPixel: () => 0.0001,
    stage: () => stage, root: () => ({ querySelectorAll: () => [] }),
    document: { defaultView: window, createElementNS: () => ({ style: {}, classList: { add() {} }, appendChild() {} }) },
    text: key => key, toast: text => toasts.push(text),
    changed: () => changes.push([editor.busy, recorded.length]),
    validate: (...args) => { validations.push(args); return validPreview; }, paintOpportunity: () => paint,
    write: async h => {
      writes.push(h); if (fail) throw new Error('refused');
      if (retireOnWrite) { context.revision++; editor.paint(); }
      const nodes = structuralWallNodes(h.beforeSpace), node = nodes.find(n => n.point.every((v, i) => v === h.intent.point[i]));
      const r = applyNodeMove(prepareNodeMove(h.beforeSpace, node, nodes), h.intent.target, h.intent.axis);
      return { ...cfg, spaces: [r.space] };
    }, record: (...args) => recorded.push(args), historyFailed: () => {} };
  const editor = new WallNodeEditor(port);
  const ev = (type, x = 0, y = 0, patch = {}) => ({ type, pointerId: 1, pointerType: 'mouse',
    isPrimary: true, button: 0, detail: 1, clientX: x, clientY: y, composedPath: () => [stage],
    preventDefault() {}, stopImmediatePropagation() {}, ...patch });
  return { cfg, context, capture, editor, ev, writes, recorded, toasts, window, listeners, changes, validations, frames,
    holdFrames: () => { autoFrames = false; }, flushFrame,
    refusePreview: () => { validPreview = false; },
    holdPaint: () => { paint = new Promise(resolve => { paintResolve = resolve; }); },
    finishPaint: () => paintResolve(), refuse: () => { fail = true; }, retireAtWrite: () => { retireOnWrite = true; } };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('native event turns share one frame and repeated snapped positions reuse the candidate', async () => {
  const s = setup(); s.holdFrames(); s.editor.guardEvent(s.ev('pointerdown'));
  for (const x of [.2, .25, .3]) {
    s.editor.guardEvent(s.ev('pointermove', x, .3)); await settle();
  }
  assert.equal(s.frames.size, 1); assert.equal(s.validations.length, 0);
  s.flushFrame();
  assert.deepEqual(s.editor.preview.sp.partitions[0].a, [.3, .3]);
  assert.equal(s.validations.length, 1);
  const candidate = s.editor.preview.sp, paints = s.changes.length;
  for (let i = 0; i < 5; i++) {
    s.editor.guardEvent(s.ev('pointermove', .30001, .30001)); s.flushFrame();
  }
  assert.equal(s.editor.preview.sp, candidate); assert.equal(s.validations.length, 1);
  assert.equal(s.changes.length, paints); s.editor.dispose();
});

test('sub-epsilon free-axis changes cannot retarget a previously proved candidate', async () => {
  const s = setup(); s.holdFrames(); s.editor.guardEvent(s.ev('pointerdown'));
  s.editor.guardEvent(s.ev('pointermove', 1, .3)); s.flushFrame();
  const original = s.editor.preview.sp;
  s.editor.guardEvent(s.ev('pointermove', 1, .3000000009)); s.flushFrame();
  assert.notEqual(s.editor.preview.sp, original);
  assert.equal(s.validations.length, 2, 'the new free-axis coordinate receives its own proof');
  assert.deepEqual(s.editor.preview.sp.partitions[0].a, [1, .3], 'ordinary canonical geometry policy still applies');
  s.editor.guardEvent(s.ev('pointerup')); await settle();
  assert.deepEqual(s.writes[0].intent.target, [1, .3000000009]);
  s.editor.dispose();
});

test('pending frame release flushes the newest target and cannot run again after commit', async () => {
  const s = setup(); s.holdFrames(); s.editor.guardEvent(s.ev('pointerdown'));
  s.editor.guardEvent(s.ev('pointermove', .2, .3)); await settle();
  s.editor.guardEvent(s.ev('pointermove', .4, .3)); await settle();
  assert.equal(s.validations.length, 0);
  s.editor.guardEvent(s.ev('pointerup')); await settle(); s.flushFrame();
  assert.equal(s.frames.size, 0); assert.equal(s.writes.length, 1);
  assert.deepEqual(s.writes[0].intent.target, [.4, .3]);
  assert.equal(s.validations.filter(v => !v[2]).length, 1);
  assert.equal(s.recorded.length, 1); s.editor.dispose();
});

test('a guide-only change paints without computing a candidate and a repeated refusal stays refused', async () => {
  const s = setup(); s.holdFrames(); s.editor.guardEvent(s.ev('pointerdown'));
  const capturedPaints = s.changes.length;
  s.editor.guardEvent(s.ev('pointermove', 0, .0001)); s.flushFrame();
  assert.equal(s.validations.length, 0); assert.equal(s.editor.preview, null);
  assert.equal(s.changes.length, capturedPaints + 1, 'origin axis guide was painted');
  s.refusePreview(); s.editor.guardEvent(s.ev('pointermove', .25, .3)); s.flushFrame();
  assert.equal(s.editor.invalid, 'invalid'); const candidate = s.editor.preview.sp;
  s.editor.guardEvent(s.ev('pointermove', .25001, .30001)); s.flushFrame();
  assert.equal(s.validations.length, 1); assert.equal(s.editor.preview.sp, candidate);
  assert.equal(s.editor.invalid, 'invalid');
  s.editor.guardEvent(s.ev('pointerup')); await settle();
  assert.equal(s.writes.length, 0); assert.equal(s.recorded.length, 0); s.editor.dispose();
});

test('X keeps the first unambiguous carrier even when later native events precede the frame', () => {
  const s = setup(); s.holdFrames();
  s.cfg.spaces[0].partitions = [
    { id: 'h', a: [-1, 0], b: [1, 0], cm: 0 },
    { id: 'v', a: [0, -1], b: [0, 1], cm: 0 },
  ];
  s.editor.guardEvent(s.ev('pointerdown'));
  s.editor.guardEvent(s.ev('pointermove', .25, .001));
  s.editor.guardEvent(s.ev('pointermove', .1, .3));
  s.flushFrame();
  assert.equal(s.editor.invalid, null);
  const walls = s.editor.preview.sp.partitions;
  assert.deepEqual(walls.find(w => w.id === 'h'), s.cfg.spaces[0].partitions[0]);
  assert.ok(walls.filter(w => w.id !== 'h').every(w => w.a[1] === 0 || w.b[1] === 0));
  assert.ok(walls.some(w => w.a[0] === .1 || w.b[0] === .1)); s.editor.dispose();
});

test('pending frames retire on cancel, context changes and disposal without a late candidate', () => {
  for (const terminal of ['cancel', 'revision', 'floor', 'permission', 'dispose', 'pointercancel', 'lostpointercapture']) {
    const s = setup(); s.holdFrames(); s.editor.guardEvent(s.ev('pointerdown'));
    s.editor.guardEvent(s.ev('pointermove', .25, .3));
    if (terminal === 'cancel') s.editor.cancel();
    else if (terminal === 'dispose') s.editor.dispose();
    else if (terminal === 'revision') s.context.revision++;
    else if (terminal === 'floor') s.context.space = 'other';
    else if (terminal === 'permission') s.context.enabled = false;
    else s.editor.guardEvent(s.ev(terminal));
    s.flushFrame();
    assert.equal(s.frames.size, 0); assert.equal(s.editor.dragging, false);
    assert.equal(s.editor.preview, null); assert.equal(s.validations.length, 0);
    assert.equal(s.writes.length, 0); assert.equal(s.recorded.length, 0); s.editor.dispose();
  }
});

test('queued release flushes the last move and waits for paint before any write/history', async () => {
  const s = setup(); s.holdPaint();
  assert.equal(s.editor.guardEvent(s.ev('pointerdown')), true);
  s.editor.guardEvent(s.ev('pointermove', 0.25, 0.3));
  s.editor.guardEvent(s.ev('pointerup'));
  assert.deepEqual(s.editor.preview.sp.partitions[0].a, [0.25, 0.3]);
  assert.deepEqual(s.cfg.spaces[0].partitions[0].a, [0, 0]);
  assert.equal(s.writes.length, 0); assert.equal(s.recorded.length, 0);
  s.finishPaint(); await settle();
  assert.equal(s.writes.length, 1); assert.equal(s.recorded.length, 1);
  assert.equal(s.editor.dragging, false); assert.equal(s.capture.size, 0);
  s.editor.dispose();
});

test('cancel or disposal while the final paint awaits prevents the write and history', async () => {
  for (const terminal of ['cancel', 'dispose']) {
    const s = setup(); s.holdPaint(); s.editor.guardEvent(s.ev('pointerdown'));
    s.editor.guardEvent(s.ev('pointermove', .25, .3)); s.editor.guardEvent(s.ev('pointerup'));
    s.editor[terminal](); s.finishPaint(); await settle();
    assert.equal(s.writes.length, 0); assert.equal(s.recorded.length, 0);
    assert.equal(s.editor.preview, null); assert.equal(s.capture.size, 0); s.editor.dispose();
  }
});

test('a delivered retired frame cannot flush a newer gesture', () => {
  const s = setup(); s.holdFrames(); s.editor.guardEvent(s.ev('pointerdown'));
  s.editor.guardEvent(s.ev('pointermove', .2, .3));
  const retired = [...s.frames.values()][0]; s.editor.cancel();
  s.editor.guardEvent(s.ev('pointerdown')); s.editor.guardEvent(s.ev('pointermove', .4, .3));
  retired(0);
  assert.equal(s.validations.length, 0); assert.equal(s.frames.size, 1);
  s.flushFrame(); assert.deepEqual(s.editor.preview.sp.partitions[0].a, [.4, .3]);
  assert.equal(s.validations.length, 1); s.editor.dispose();
});

test('own revision adoption before history record still refreshes the enabled Undo toolbar', async () => {
  const s = setup(); s.retireAtWrite();
  s.editor.guardEvent(s.ev('pointerdown')); s.editor.guardEvent(s.ev('pointermove', 0.25, 0.3));
  s.editor.guardEvent(s.ev('pointerup')); await settle();
  assert.equal(s.recorded.length, 1); assert.equal(s.editor.busy, false);
  assert.deepEqual(s.changes.at(-1), [false, 1]); s.editor.dispose();
});
test('cancel kills queued move, release and delayed activation; new down re-arms', async () => {
  const s = setup();
  s.editor.guardEvent(s.ev('pointerdown'));
  s.editor.guardEvent(s.ev('pointermove', 0.25, 0.3));
  assert.equal(s.editor.cancel(), true);
  s.editor.guardEvent(s.ev('pointerup')); await settle();
  assert.equal(s.editor.preview, null); assert.equal(s.writes.length, 0);
  assert.equal(s.editor.guardEvent(s.ev('click')), true);
  assert.equal(s.editor.guardEvent(s.ev('pointerdown')), true);
  assert.equal(s.capture.size, 1); s.editor.dispose();
});
test('last invalid candidate cannot commit the previous valid preview', async () => {
  const s = setup(); s.editor.guardEvent(s.ev('pointerdown'));
  s.editor.guardEvent(s.ev('pointermove', 0.25, 0.3)); await settle();
  assert.ok(s.editor.preview);
  s.editor.guardEvent(s.ev('pointermove', 5001, 5002));
  s.editor.guardEvent(s.ev('pointerup')); await settle();
  assert.equal(s.writes.length, 0); assert.equal(s.recorded.length, 0);
  assert.equal(s.editor.dragging, false); s.editor.dispose();
});

test('retired node tail blocks only compatible stage clicks, not keyboard or toolbar activation', async () => {
  for (const commit of [false, true]) {
    const s = setup(); s.editor.guardEvent(s.ev('pointerdown'));
    s.editor.guardEvent(s.ev('pointermove', .25, .3));
    if (commit) { s.editor.guardEvent(s.ev('pointerup')); await settle(); } else s.editor.cancel();
    assert.equal(s.editor.guardEvent(s.ev('click', 0, 0, { detail: 0 })), false, 'keyboard click inside stage');
    assert.equal(s.editor.guardEvent(s.ev('click', 0, 0, { composedPath: () => [{ toolbar: true }] })), false,
      'unrelated toolbar click outside stage');
    assert.equal(s.editor.guardEvent(s.ev('click')), true, 'late compatible click still suppressed');
    assert.equal(s.writes.length, Number(commit)); assert.equal(s.recorded.length, Number(commit));
    s.editor.dispose();
  }
});
test('external revision while final paint awaits wins, without restoring frozen config', async () => {
  const s = setup(); s.holdPaint(); s.editor.guardEvent(s.ev('pointerdown'));
  s.editor.guardEvent(s.ev('pointermove', 0.25, 0.3)); s.editor.guardEvent(s.ev('pointerup'));
  s.cfg.spaces[0].partitions[0].a = [0.5, 0.5]; s.context.revision++;
  s.finishPaint(); await settle();
  assert.equal(s.writes.length, 0); assert.deepEqual(s.cfg.spaces[0].partitions[0].a, [0.5, 0.5]);
  s.editor.dispose();
});

test('a paint after context adoption cancels before touching detached live groups', () => {
  for (const change of ['disabled', 'space', 'revision', 'api']) {
    const s = setup(); s.editor.guardEvent(s.ev('pointerdown'));
    if (change === 'disabled') s.context.enabled = false;
    if (change === 'space') s.context.space = 'other';
    if (change === 'revision') s.context.revision++;
    if (change === 'api') s.context.api = false;
    // The fake root deliberately has no querySelector: reaching DOM construction
    // instead of retiring the stale session fails, even without a browser.
    assert.doesNotThrow(() => s.editor.paint());
    assert.equal(s.editor.dragging, false); assert.equal(s.capture.size, 0);
    assert.equal(s.writes.length, 0); s.editor.dispose();
  }
});
for (const terminal of ['pointercancel', 'lostpointercapture', 'second-pointer', 'pagehide', 'floor', 'permission']) {
  test(`${terminal} aborts without a write/history entry and clears capture`, async () => {
    const s = setup(); s.editor.guardEvent(s.ev('pointerdown'));
    s.editor.guardEvent(s.ev('pointermove', 0.25, 0.3)); await settle();
    if (terminal === 'second-pointer') s.editor.guardEvent(s.ev('pointerdown', 0, 0, { pointerId: 2, pointerType: 'touch' }));
    else if (terminal === 'pagehide') s.window.dispatchEvent(new Event('pagehide'));
    else if (terminal === 'floor' || terminal === 'permission') {
      if (terminal === 'floor') s.context.space = 'another'; else s.context.enabled = false;
      s.editor.render();
    } else s.editor.guardEvent(s.ev(terminal));
    s.editor.guardEvent(s.ev('pointerup')); await settle();
    assert.equal(s.writes.length, 0); assert.equal(s.recorded.length, 0);
    assert.equal(s.capture.size, 0); assert.equal(s.editor.preview, null); s.editor.dispose();
  });
}
test('disabled capability and touch fail closed; unchanged click writes nothing', async () => {
  const s = setup(); s.context.api = false;
  assert.equal(s.editor.guardEvent(s.ev('pointerdown')), true);
  assert.equal(s.capture.size, 0); assert.deepEqual(s.toasts, ['node_move_update_required']);
  s.context.api = true;
  assert.equal(s.editor.guardEvent(s.ev('pointerdown', 0, 0, { pointerType: 'touch' })), false);
  s.editor.guardEvent(s.ev('pointerdown')); s.editor.guardEvent(s.ev('pointerup')); await settle();
  assert.equal(s.writes.length, 0); assert.equal(s.recorded.length, 0); s.editor.dispose();
});
test('refused server write leaves no optimistic geometry for the next writer', async () => {
  const s = setup(); s.refuse(); const baseline = structuredClone(s.cfg);
  s.editor.guardEvent(s.ev('pointerdown')); s.editor.guardEvent(s.ev('pointermove', 0.25, 0.3));
  s.editor.guardEvent(s.ev('pointerup')); await settle();
  assert.equal(s.writes.length, 1); assert.equal(s.recorded.length, 0); assert.deepEqual(s.cfg, baseline);
  assert.equal(s.editor.busy, false); assert.equal(s.editor.preview, null); s.editor.dispose();
});
test('100 accepted/cancelled gestures leave one listener and no transient state; disposal removes it', async () => {
  const s = setup(); assert.equal(s.listeners.size, 1);
  for (let i = 0; i < 100; i++) {
    s.editor.guardEvent(s.ev('pointerdown')); s.editor.guardEvent(s.ev('pointermove', .25, .3));
    if (i % 2) s.editor.guardEvent(s.ev('pointerup')); else s.editor.cancel();
    await settle();
    assert.equal(s.listeners.size, 1); assert.equal(s.capture.size, 0);
    assert.equal(s.editor.preview, null); assert.equal(s.editor.cache, null);
    assert.equal(s.editor.touched.length, 0); assert.equal(s.editor.liveRoots.length, 0);
    assert.equal(s.editor.sourceGhost, null); assert.equal(s.editor.sourceCoverage, null);
  }
  assert.equal(s.writes.length, 50); s.editor.dispose(); assert.equal(s.listeners.size, 0);
});
