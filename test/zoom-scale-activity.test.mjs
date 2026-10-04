import assert from 'node:assert/strict';
import test from 'node:test';
import { ZoomScaleActivity, ZOOM_SCALE_QUIET_MS } from '../test-build/zoom-scale-activity.js';
import { interpolateCameraState } from '../test-build/viewport-transition.js';

const view = (w = 100, h = 80, x = 0, y = 0) => ({ w, h, x, y });

function runtime() {
  let time = 0, sequence = 0;
  const pending = new Map(), changes = [];
  const clock = {
    setTimeout(callback, delay) {
      const id = ++sequence;
      pending.set(id, { callback, at: time + delay });
      return id;
    },
    clearTimeout(id) { pending.delete(id); },
  };
  const activity = new ZoomScaleActivity((active) => changes.push({ active, at: time }), clock);
  const advance = (duration) => {
    const end = time + duration;
    for (;;) {
      const next = [...pending].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > end) break;
      time = next[1].at;
      pending.delete(next[0]);
      next[1].callback();
    }
    time = end;
  };
  return { activity, pending, changes, advance };
}

test('only real scale changes activate the 160 ms paint lease', () => {
  assert.equal(ZOOM_SCALE_QUIET_MS, 160);
  const r = runtime();
  assert.equal(r.activity.change(view(), view()), false, 'clamped/no-op zoom');
  assert.equal(r.activity.change(view(), view(100, 80, 17, -23)), false, 'pan');
  assert.equal(r.pending.size, 0);
  assert.deepEqual(r.changes, []);
  assert.equal(r.activity.change(view(), view(50, 40)), true);
  assert.equal(r.activity.active, true);
  assert.equal(r.pending.size, 1);
  r.advance(159);
  assert.equal(r.activity.active, true);
  r.advance(1);
  assert.equal(r.activity.active, false);
  assert.equal(r.pending.size, 0);
  assert.deepEqual(r.changes, [{ active: true, at: 0 }, { active: false, at: 160 }]);
});

test('either extent may change, including a small genuine scale step', () => {
  for (const after of [view(99, 80), view(100, 79), view(100 + 1e-10, 80)]) {
    const r = runtime();
    assert.equal(r.activity.change(view(), after), true);
    r.activity.dispose();
  }
});

test('centre-only real camera interpolation does not mistake arithmetic roundoff for zoom', () => {
  for (const factor of [0.001, 1, 1000]) {
    const r = runtime();
    const from = { zoom: 1, viewBox: view(100 * factor, 80 * factor) };
    const to = { zoom: 1, viewBox: view(100 * factor, 80 * factor, 30, -20) };
    let previous = from;
    for (const progress of [0, 0.01, 0.25, 0.5, 0.75, 0.99, 1]) {
      const frame = interpolateCameraState(from, to, progress);
      assert.equal(r.activity.change(previous.viewBox, frame.viewBox), false,
        `centre-only factor=${factor}, progress=${progress}`);
      previous = frame;
    }
    assert.equal(r.pending.size, 0);
    assert.deepEqual(r.changes, []);
  }
});

test('invalid current or target extents never start the lease', () => {
  for (const dimension of ['w', 'h']) for (const value of [NaN, Infinity, -Infinity, 0, -1]) {
    for (const invalidBefore of [false, true]) {
      const r = runtime(), invalid = { ...view(), [dimension]: value };
      assert.equal(r.activity.change(invalidBefore ? invalid : view(), invalidBefore ? view() : invalid), false);
      assert.equal(r.pending.size, 0);
      assert.deepEqual(r.changes, []);
    }
  }
});

test('each scale step renews one timer without repeating the coarse mutation', () => {
  const r = runtime();
  r.activity.change(view(), view(50, 40));
  const stale = [...r.pending.values()][0].callback;
  r.advance(100);
  r.activity.change(view(50, 40), view(25, 20));
  assert.equal(r.pending.size, 1);
  stale();
  assert.equal(r.activity.active, true, 'a cancelled callback cannot end the newer zoom');
  r.advance(159);
  assert.equal(r.activity.active, true);
  r.advance(1);
  assert.deepEqual(r.changes, [{ active: true, at: 0 }, { active: false, at: 260 }]);
});

test('pan, no-op and invalid updates do not extend an existing zoom', () => {
  const r = runtime();
  r.activity.change(view(), view(50, 40));
  r.advance(100);
  r.activity.change(view(50, 40), view(50, 40, 50, 50));
  r.activity.change(view(50, 40), view(50, 40));
  r.activity.change(view(50, 40), view(NaN, 40));
  r.advance(60);
  assert.equal(r.activity.active, false);
  assert.equal(r.changes.at(-1).at, 160);
});

test('independent owners keep independent deadlines', () => {
  const a = runtime(), b = runtime();
  a.activity.change(view(), view(50, 40));
  b.advance(80);
  b.activity.change(view(), view(50, 40));
  a.advance(160);
  b.advance(80);
  assert.equal(a.activity.active, false);
  assert.equal(b.activity.active, true);
  b.advance(80);
  assert.equal(b.activity.active, false);
});

for (const method of ['reset', 'dispose']) {
  test(`${method} cancels work and rejects stale callbacks across the next lifecycle`, () => {
    const r = runtime();
    r.activity.change(view(), view(50, 40));
    const stale = [...r.pending.values()][0].callback;
    r.advance(20);
    r.activity[method]();
    assert.equal(r.activity.active, false);
    assert.equal(r.pending.size, 0);
    stale();
    assert.deepEqual(r.changes, [{ active: true, at: 0 }, { active: false, at: 20 }]);
    r.activity[method]();
    r.activity.change(view(), view(25, 20));
    stale();
    assert.equal(r.activity.active, true);
    assert.equal(r.pending.size, 1);
    r.advance(160);
    assert.deepEqual(r.changes.slice(2), [{ active: true, at: 20 }, { active: false, at: 180 }]);
  });
}

test('100 scale frames retain just one callback and restore after the final frame', () => {
  const r = runtime();
  for (let i = 0; i < 100; i++) {
    r.activity.change(view(200 - i, 80), view(199 - i, 80 + i + 1));
    assert.equal(r.pending.size, 1);
    if (i < 99) r.advance(16);
  }
  assert.deepEqual(r.changes, [{ active: true, at: 0 }]);
  r.advance(159);
  assert.equal(r.activity.active, true);
  r.advance(1);
  assert.equal(r.changes.at(-1).at, 99 * 16 + 160);
  assert.equal(r.pending.size, 0);
});

test('paused pinch and instantaneous reduced-motion steps need no terminal event', () => {
  const r = runtime();
  r.activity.change(view(), view(50, 40));
  r.advance(160); // Fingers may still be down; no pointerup is required.
  assert.equal(r.activity.active, false);
  r.activity.change(view(50, 40), view(25, 20));
  assert.equal(r.activity.active, true);
  r.advance(160);
  assert.equal(r.activity.active, false);
  assert.equal(r.pending.size, 0);
});
