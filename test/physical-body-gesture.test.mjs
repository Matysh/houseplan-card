import test from 'node:test';
import assert from 'node:assert/strict';
import { PhysicalBodyGestureRuntime } from '../test-build/physical-body-gesture.js';
import { CANVAS_LIMIT, NORM_W } from '../test-build/canvas-constants.js';
import {
  flushHouseplanPointerMove, queueHouseplanPointerMove,
} from '../test-build/pointer-move-queue.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8,
  `expected ${expected}, got ${actual}`);
const partition = (patch = {}) => ({ id: 'p', a: [100, 100], b: [300, 100], cm: 15, ...patch });
const column = (patch = {}) => ({ id: 'c', shape: 'square', center: [500, 500], cm: 30, angle: 0, ...patch });
const event = (x, y, patch = {}) => ({
  pointerId: 1, clientX: x, clientY: y, shiftKey: false, stopped: 0, prevented: 0,
  captures: [], currentCaptures: [],
  stopPropagation() { this.stopped++; }, preventDefault() { this.prevented++; },
  ...patch,
  get target() { return { setPointerCapture: (pid) => this.captures.push(pid) }; },
  get currentTarget() { return { setPointerCapture: (pid) => this.currentCaptures.push(pid) }; },
});

/** Unit port only; browser capture, paint and render counts are covered by the frozen native B. */
const harness = ({ partitions = [partition()], columns = [column()], openings = [], snapStep = 10 } = {}) => {
  const stored = {
    partitions: partitions.map((item) => ({ ...clone(item), a: item.a.map((n) => n / NORM_W),
      b: item.b.map((n) => n / NORM_W) })),
    wall_columns: columns.map((item) => ({ ...clone(item), center: item.center.map((n) => n / NORM_W) })),
    openings: clone(openings),
  };
  const calls = { selects: [], dialogs: [], commits: [], toasts: [], publications: [], snapshots: [] };
  let now = 0, hasSpace = true, hasStored = true;
  const queueTarget = {};
  const space = () => hasSpace ? {
    id: 's', title: 'S', vb: [0, 0, 1000, 1000], bg: null, rooms: [], wall_segments: [], stairs: [],
    partitions: stored.partitions.map((item) => ({ ...clone(item), a: item.a.map((n) => n * NORM_W),
      b: item.b.map((n) => n * NORM_W) })),
    wall_columns: stored.wall_columns.map((item) => ({ ...clone(item), center: item.center.map((n) => n * NORM_W) })),
  } : null;
  const port = {
    queueTarget, space, storedGeometry: () => hasStored ? stored : null,
    units: () => ({ cellCm: 5, gridPitch: 10 }),
    point: (ev) => [ev.planX ?? ev.clientX, ev.planY ?? ev.clientY],
    snap: (point) => point.map((n) => Math.round(n / snapStep) * snapStep),
    snapshot() { const snapshot = { spaceId: 's', rooms: [], plan_transform: {}, ...clone(stored) };
      calls.snapshots.push(snapshot); return snapshot; },
    commit: (key, before) => calls.commits.push({ key, before }),
    select: (value) => calls.selects.push(value), openDialog: (kind, id) => calls.dialogs.push({ kind, id }),
    toast: (key) => calls.toasts.push(key), publish: (phase) => calls.publications.push(phase), now: () => now,
  };
  return { owner: new PhysicalBodyGestureRuntime(port), port, stored, calls, queueTarget,
    time: (value) => { now = value; }, spacePresent: (value) => { hasSpace = value; },
    storedPresent: (value) => { hasStored = value; } };
};

test('#861 begin captures the event target, selects and owns a cloned transient base', () => {
  const h = harness(), down = event(200, 100);
  h.owner.begin(down, 'partition', 'p');
  assert.deepEqual(down.captures, [1]);
  assert.deepEqual(down.currentCaptures, []);
  assert.equal(down.stopped, 1);
  assert.deepEqual(h.calls.selects, [{ kind: 'partition', id: 'p' }]);
  assert.equal(h.owner.active, true);
  assert.equal(h.owner.owns(1), true);
  assert.equal(h.owner.owns(2), false);
  assert.deepEqual(h.owner.drag.base, partition());
  h.stored.partitions[0].a[0] = 0.9;
  assert.equal(h.owner.drag.base.a[0], 100, 'the gesture retains the begin snapshot');
  assert.equal(h.owner.drag.before, h.calls.snapshots[0]);
  assert.deepEqual(h.calls.publications, ['begin']);
  h.owner.cancel();
});

test('#861 missing model or missing requested body cannot create a gesture', () => {
  const h = harness();
  h.spacePresent(false);
  const down = event(900, 900);
  h.owner.begin(down, 'partition', 'p');
  assert.equal(down.stopped, 0);
  assert.deepEqual(down.captures, []);
  h.spacePresent(true);
  h.owner.begin(down, 'partition', 'missing');
  assert.equal(h.owner.active, false);
  assert.deepEqual(h.calls.selects, []);
  assert.deepEqual(h.calls.publications, []);
});

test('#861 raw moves coalesce, stay render-only and flush before a foreign terminal check', async () => {
  const h = harness(), before = clone(h.stored);
  h.owner.begin(event(200, 100), 'partition', 'p');
  h.owner.move(event(211, 112));
  h.owner.move(event(226, 119));
  assert.deepEqual(h.owner.drag.delta, [0, 0]);
  assert.deepEqual(h.stored, before);
  assert.equal(h.calls.commits.length, 0);
  h.owner.end(event(900, 900, { pointerId: 9 }));
  assert.deepEqual(h.owner.drag.delta, [30, 20], 'foreign up still flushes the real pending move');
  assert.equal(h.owner.owns(1), true);
  assert.equal(h.calls.commits.length, 0);
  assert.deepEqual(h.stored, before);
  assert.deepEqual(h.calls.publications, ['begin', 'move']);
  h.owner.end(event(226, 119));
  await Promise.resolve();
  assert.deepEqual(h.calls.publications, ['begin', 'move', 'end']);
  assert.deepEqual(h.stored.partitions[0], partition({ a: [0.13, 0.12], b: [0.33, 0.12] }));
  assert.equal(h.calls.commits.length, 1);
  assert.equal(h.calls.commits[0].key, 'history.physical_move');
  assert.equal(h.calls.commits[0].before, h.calls.snapshots[0]);
  assert.equal(h.owner.active, false);
});

test('#861 the 5 CSS-pixel move threshold is inclusive and sticky, independent of plan scale', () => {
  for (const [dx, dy, moved] of [[4.999, 0, false], [3, 4, true]]) {
    const h = harness();
    h.owner.begin(event(200, 100), 'partition', 'p');
    h.owner.move(event(200 + dx, 100 + dy, { planX: 230, planY: 120 }));
    flushHouseplanPointerMove(h.queueTarget, 'physical');
    assert.equal(h.owner.drag.moved, moved);
    if (moved) {
      h.owner.move(event(200, 100));
      flushHouseplanPointerMove(h.queueTarget, 'physical');
      assert.equal(h.owner.drag.moved, true, 'returning to the origin does not turn a drag into a tap');
    }
    h.owner.end(event(200, 100));
    assert.equal(h.calls.commits.length, Number(moved));
    assert.equal(h.calls.dialogs.length, 0);
  }
});

test('#861 rigid partition release materialises hosted door/window coordinates only once', () => {
  const openings = ['door', 'window'].map((type, i) => ({
    id: type, type, x: 0.15 + i * 0.1, y: 0.1, angle: 0, length: 0.03,
    host: { kind: 'partition', id: 'p', t: 0.25 + i * 0.5 },
  }));
  openings.push({ id: 'other', type: 'door', x: 0.8, y: 0.8, angle: 90, length: 0.03,
    host: { kind: 'partition', id: 'another', t: 0.5 } });
  const h = harness({ openings }), before = clone(h.stored);
  h.owner.begin(event(200, 100), 'partition', 'p');
  h.owner.move(event(220, 130));
  flushHouseplanPointerMove(h.queueTarget, 'physical');
  assert.deepEqual(h.stored, before, 'held preview never writes canonical openings');
  h.owner.end(event(220, 130));
  assert.deepEqual(h.stored.partitions[0].a, [0.12, 0.13]);
  assert.deepEqual(h.stored.partitions[0].b, [0.32, 0.13]);
  for (let i = 0; i < 2; i++) {
    const opening = h.stored.openings[i];
    closeTo(opening.x, openings[i].x + 0.02);
    closeTo(opening.y, 0.13);
    assert.deepEqual(opening.host, openings[i].host);
    assert.equal(opening.angle, openings[i].angle);
    assert.equal(opening.length, openings[i].length);
    assert.equal(opening.type, openings[i].type);
  }
  assert.deepEqual(h.stored.openings[2], openings[2]);
  assert.equal(h.calls.commits.length, 1);
});

test('#861 physical delta clamps the whole partition and column to the existing canvas extent', () => {
  const limit = CANVAS_LIMIT * NORM_W;
  for (const [kind, body, x, y, expected] of [
    ['partition', partition({ a: [limit - 20, -limit + 10], b: [limit - 5, -limit + 10] }),
      limit + 100, -limit - 100, [5, -10]],
    ['column', column({ center: [-limit + 5, limit - 5] }),
      -limit - 100, limit + 100, [-5, 5]],
  ]) {
    const h = harness({ partitions: kind === 'partition' ? [body] : [], columns: kind === 'column' ? [body] : [] });
    const start = kind === 'partition' ? body.a : body.center;
    h.owner.begin(event(...start), kind, body.id);
    h.owner.move(event(x, y));
    flushHouseplanPointerMove(h.queueTarget, 'physical');
    assert.deepEqual(h.owner.drag.delta, expected);
    h.owner.cancel();
  }
});

test('#861 duplicate column translation refuses without a write and a distinct placement commits', () => {
  for (const duplicate of [true, false]) {
    const h = harness({ columns: [column(), column({ id: 'other', center: [600, 500] })] });
    h.owner.begin(event(500, 500), 'column', 'c');
    h.owner.move(event(duplicate ? 600 : 610, 500));
    h.owner.end(event(duplicate ? 600 : 610, 500));
    assert.deepEqual(h.calls.toasts, duplicate ? ['toast.column_duplicate'] : []);
    assert.equal(h.calls.commits.length, duplicate ? 0 : 1);
    assert.deepEqual(h.stored.wall_columns[0].center, duplicate ? [0.5, 0.5] : [0.61, 0.5]);
    assert.equal(h.owner.active, false);
  }
});

const rotationPoint = (degrees, patch = {}) => event(
  500 + 100 * Math.cos(degrees * Math.PI / 180),
  500 + 100 * Math.sin(degrees * Math.PI / 180), patch,
);
const beginRotation = (h, ev = rotationPoint(0)) => h.owner.rotateBegin(ev, h.port.space().wall_columns[0]);

test('#861 rotation captures the target, uses the 5-degree step or Shift precision, and commits once', () => {
  for (const [shiftKey, expected] of [[false, 5], [true, 7.3]]) {
    const h = harness(), down = rotationPoint(0);
    beginRotation(h, down);
    assert.deepEqual(down.captures, [1]);
    assert.deepEqual(down.currentCaptures, []);
    assert.equal(down.prevented, 1);
    assert.deepEqual(h.calls.selects, [{ kind: 'column', id: 'c' }]);
    h.owner.rotateMove(rotationPoint(7.3, { shiftKey }));
    h.owner.rotateEnd(rotationPoint(7.3, { shiftKey }));
    closeTo(h.stored.wall_columns[0].angle, expected);
    assert.equal(h.calls.commits.length, 1);
    assert.equal(h.calls.commits[0].key, 'history.physical_edit');
    assert.equal(h.calls.commits[0].before, h.calls.snapshots[0]);
    assert.deepEqual(h.calls.publications, ['begin', 'move', 'end']);
    assert.equal(h.owner.active, false);
  }
});

test('#861 rotation movement uses the raw 0.5-degree threshold rather than snapped output', () => {
  for (const [degrees, moved] of [[0.49, false], [0.5, true]]) {
    const h = harness();
    // Zero-centred exact vectors avoid subtractive coordinate rounding at the threshold.
    h.stored.wall_columns[0].center = [0, 0];
    h.owner.rotateBegin(event(100, 0), h.port.space().wall_columns[0]);
    h.owner.rotateMove(event(100 * Math.cos(degrees * Math.PI / 180),
      100 * Math.sin(degrees * Math.PI / 180)));
    flushHouseplanPointerMove(h.queueTarget, 'physical-rotate');
    assert.equal(h.owner.rotation.moved, moved);
    assert.equal(h.owner.rotation.angle, 0, 'both raw values snap to zero');
    h.owner.rotateEnd(event(100, 0));
    assert.equal(h.calls.commits.length, Number(moved));
  }
});

test('#861 rotation canonicalises angles and foreign pointerup only flushes the legitimate queued move', () => {
  const h = harness({ columns: [column({ angle: 85 })] });
  beginRotation(h);
  h.owner.rotateMove(rotationPoint(7));
  h.owner.rotateEnd(rotationPoint(7, { pointerId: 2 }));
  assert.equal(h.owner.owns(1), true);
  assert.equal(h.owner.rotation.angle, 0, '85 + 7 snaps to 90, represented as zero');
  assert.equal(h.calls.commits.length, 0);
  assert.equal(h.stored.wall_columns[0].angle, 85);
  h.owner.rotateEnd(rotationPoint(7));
  assert.equal(h.stored.wall_columns[0].angle, 0);
  assert.equal(h.calls.commits.length, 1);
});

test('#861 rotation ignores circles/missing space and refuses a duplicate square placement', () => {
  const h = harness({ columns: [column(), column({ id: 'other', angle: 10 })] });
  h.owner.rotateBegin(rotationPoint(0), column({ shape: 'circle' }));
  assert.equal(h.owner.rotation, null);
  h.spacePresent(false);
  h.owner.rotateBegin(rotationPoint(0), column());
  assert.equal(h.owner.rotation, null);
  h.spacePresent(true);
  beginRotation(h);
  h.owner.rotateMove(rotationPoint(8));
  h.owner.rotateEnd(rotationPoint(8));
  assert.deepEqual(h.calls.toasts, ['toast.column_duplicate']);
  assert.equal(h.stored.wall_columns[0].angle, 0);
  assert.equal(h.calls.commits.length, 0);
});

test('#861 foreign raw moves never change another pointer owner', async () => {
  const h = harness();
  h.owner.begin(event(200, 100), 'partition', 'p');
  beginRotation(h, rotationPoint(0, { pointerId: 2 }));
  h.owner.move(event(300, 200, { pointerId: 9 }));
  h.owner.rotateMove(rotationPoint(20, { pointerId: 9 }));
  await Promise.resolve();
  assert.deepEqual(h.owner.drag.delta, [0, 0]);
  assert.equal(h.owner.rotation.angle, 0);
  assert.deepEqual(h.calls.publications, ['begin', 'begin']);
  h.owner.cancel();
});

test('#861 missing stored/model after a move clears transient state without committing', () => {
  for (const mode of ['stored', 'space']) for (const rotate of [false, true]) {
    const h = harness();
    if (rotate) { beginRotation(h); h.owner.rotateMove(rotationPoint(10)); }
    else { h.owner.begin(event(200, 100), 'partition', 'p'); h.owner.move(event(220, 100)); }
    if (mode === 'stored') h.storedPresent(false); else h.spacePresent(false);
    if (rotate) h.owner.rotateEnd(rotationPoint(10)); else h.owner.end(event(220, 100));
    assert.equal(h.owner.active, false);
    assert.equal(h.calls.commits.length, 0);
  }
});

const tap = (h, kind = 'partition', id = 'p', ev = event(200, 100)) => {
  h.owner.begin(ev, kind, id); h.owner.end(ev);
};

test('#861 double tap includes 360 ms, excludes later/different targets, and clears the pair', () => {
  for (const delay of [360, 361]) {
    const h = harness();
    tap(h); h.time(delay); tap(h);
    assert.equal(h.calls.dialogs.length, delay === 360 ? 1 : 0);
    h.time(delay + 1); tap(h);
    assert.equal(h.calls.dialogs.length, 1, 'the third tap starts a fresh pair after a double tap');
    assert.equal(h.calls.commits.length, 0);
  }
  const h = harness();
  tap(h); h.time(100); tap(h, 'column', 'c', event(500, 500));
  assert.deepEqual(h.calls.dialogs, []);
});

test('#861 overlap cycling has strict lower/inclusive upper time and inclusive distance boundaries', () => {
  for (const [delay, distance, cycles] of [[380, 0, false], [381, 10, true], [1200, 0, true],
    [1201, 0, false], [420, 10.001, false]]) {
    const h = harness({ columns: [column({ center: [200, 100] })] });
    tap(h);
    h.time(delay);
    h.owner.begin(event(200 + distance, 100), 'partition', 'p');
    assert.deepEqual(h.calls.selects.at(-1), cycles ? { kind: 'column', id: 'c' }
      : { kind: 'partition', id: 'p' }, `${delay}ms/${distance}px`);
    h.owner.cancel();
  }
});

test('#861 candidate signature changes reset cycling; target fallback still selects a thin body', () => {
  const h = harness({ columns: [column({ center: [200, 100] })] });
  tap(h); h.time(420);
  h.stored.wall_columns = [];
  h.owner.begin(event(200, 100), 'partition', 'p');
  assert.deepEqual(h.calls.selects.at(-1), { kind: 'partition', id: 'p' });
  h.owner.cancel(); h.time(900);
  h.owner.begin(event(900, 900), 'partition', 'p');
  assert.equal(h.owner.drag.id, 'p', 'actual hit target is retained even outside the computed body');
  h.owner.cancel();
});

test('#861 cancel removes both gesture queues, publishes once and leaves unrelated card work intact', async () => {
  const h = harness(), before = clone(h.stored);
  h.owner.begin(event(200, 100), 'partition', 'p'); beginRotation(h);
  h.owner.move(event(220, 120)); h.owner.rotateMove(rotationPoint(10));
  let unrelated = 0;
  queueHouseplanPointerMove(h.queueTarget, 'unrelated', () => unrelated++);
  h.owner.cancel();
  assert.equal(h.owner.active, false);
  assert.equal(h.owner.owns(1), false);
  await Promise.resolve();
  assert.deepEqual(h.calls.publications, ['begin', 'begin', 'end']);
  assert.deepEqual(h.stored, before);
  assert.equal(h.calls.commits.length, 0);
  assert.equal(unrelated, 1);
});

test('#861 state-only resetMove preserves rotation, while reset clears both without queue/publication effects', () => {
  const h = harness();
  h.owner.begin(event(200, 100), 'partition', 'p'); beginRotation(h);
  const rotation = h.owner.rotation, publications = [...h.calls.publications];
  let pending = 0;
  queueHouseplanPointerMove(h.queueTarget, 'physical', () => pending++);
  queueHouseplanPointerMove(h.queueTarget, 'physical-rotate', () => pending++);
  h.owner.resetMove();
  assert.equal(h.owner.drag, null);
  assert.equal(h.owner.rotation, rotation);
  assert.equal(h.owner.active, true);
  h.owner.reset();
  assert.equal(h.owner.active, false);
  assert.deepEqual(h.calls.publications, publications);
  flushHouseplanPointerMove(h.queueTarget, 'physical');
  flushHouseplanPointerMove(h.queueTarget, 'physical-rotate');
  assert.equal(pending, 2, 'state-only reset is not queue cancellation');
});

test('#861 resets/cancel retain last-tap and overlap-cycle timing rather than inventing lifecycle resets', () => {
  for (const reset of ['resetMove', 'reset', 'cancel']) {
    const h = harness();
    tap(h); h.owner[reset](); h.time(360); tap(h);
    assert.equal(h.calls.dialogs.length, 1, reset);
    const overlap = harness({ columns: [column({ center: [200, 100] })] });
    tap(overlap); overlap.owner[reset](); overlap.time(420);
    overlap.owner.begin(event(200, 100), 'partition', 'p');
    assert.deepEqual(overlap.calls.selects.at(-1), { kind: 'column', id: 'c' }, reset);
    overlap.owner.cancel();
  }
});

test('#861 pointer queue uses the supplied card identity and the established physical keys', () => {
  const h = harness(), other = {};
  let replaced = 0, foreign = 0;
  h.owner.begin(event(200, 100), 'partition', 'p');
  queueHouseplanPointerMove(h.queueTarget, 'physical', () => replaced++);
  queueHouseplanPointerMove(other, 'physical', () => foreign++);
  h.owner.move(event(220, 100));
  flushHouseplanPointerMove(h.queueTarget, 'physical');
  assert.deepEqual(h.owner.drag.delta, [20, 0]);
  assert.equal(replaced, 0, 'same card/key was coalesced, not a separate owner queue');
  assert.equal(foreign, 0);
  flushHouseplanPointerMove(other, 'physical');
  assert.equal(foreign, 1);
  h.owner.cancel();
});
