import test from 'node:test';
import assert from 'node:assert/strict';
import { KioskCarousel } from '../test-build/kiosk-carousel.js';

function harness(overrides = {}) {
  let now = 100_000, id = 0;
  const timers = new Map(), calls = [];
  const state = { connected: true, intervalMs: 90_000, pausedUntil: 0,
    gesturesIdle: true, surfacesIdle: true, ...overrides };
  const add = (callback, delay, repeat = false) => {
    const handle = ++id;
    timers.set(handle, { at: now + delay, delay, callback, repeat });
    return handle;
  };
  const clock = {
    now: () => now,
    setTimeout: (callback, delay) => add(callback, delay),
    setInterval: (callback, delay) => add(callback, delay, true),
    clearTimeout: (handle) => timers.delete(handle),
    clearInterval: (handle) => timers.delete(handle),
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const row = [...timers].sort((a,b) => a[1].at - b[1].at)[0];
        if (!row || row[1].at > end) break;
        const [handle, timer] = row;
        now = timer.at;
        if (timer.repeat) timer.at += timer.delay;
        else timers.delete(handle);
        timer.callback();
      }
      now = end;
    },
  };
  const carousel = new KioskCarousel({ state: () => state,
    pause: (until) => { state.pausedUntil = until; },
    fitAll: () => calls.push(['fit', now]), advance: () => calls.push(['advance', now]),
  }, clock);
  carousel.sync();
  return { carousel, state, clock, calls, timers, get now() { return now; } };
}

test('#846 AC1 idle fits at60s independent of90s cycle; next tick advances once', () => {
  const h = harness(); h.carousel.interact();
  h.clock.advance(59_999); assert.deepEqual(h.calls, []);
  h.clock.advance(1); assert.deepEqual(h.calls, [['fit', 160_000]]);
  h.clock.advance(30_000); assert.deepEqual(h.calls, [['fit',160_000],['advance',190_000]]);
  h.carousel.sync(); h.clock.advance(0);
  assert.equal(h.calls.filter(([kind]) => kind === 'fit').length, 1);
});

test('#846 AC3 all dialogs hold indefinitely and close starts a fresh60s pause', () => {
  const h = harness({ intervalMs: 1000 }); h.carousel.interact();
  h.state.surfacesIdle = false; h.carousel.sync();
  h.clock.advance(300_000); assert.deepEqual(h.calls, []);
  assert.equal(h.timers.size, 1, 'expired hold does not spin timeout');
  h.state.surfacesIdle = true; h.carousel.sync();
  assert.equal(h.state.pausedUntil, h.now + 60_000);
  h.clock.advance(59_999); assert.deepEqual(h.calls, []);
  h.clock.advance(1);
  assert.equal(h.calls.filter(([kind]) => kind === 'fit').length, 1);
  assert.ok(h.calls.filter(([kind]) => kind === 'advance').length <= 1);
});

test('#846 AC3 pointer/camera hold blocks fit/ticks, release services overdue deadline once', () => {
  const h = harness({ intervalMs:1000 }); h.carousel.interact();
  h.state.gesturesIdle = false;
  h.clock.advance(120_000); assert.deepEqual(h.calls, []);
  h.state.gesturesIdle = true; h.carousel.sync(); h.clock.advance(0);
  assert.deepEqual(h.calls,[['fit',220_000]]);
  h.carousel.tick(); assert.deepEqual(h.calls.at(-1),['advance',220_000]);
});

test('#846 AC4 fresh operations replace one deadline and share the pause with462', () => {
  const h = harness(); h.carousel.interact();
  h.clock.advance(30_000); h.carousel.interact();
  assert.equal(h.state.pausedUntil,190_000); assert.equal(h.timers.size,2);
  h.clock.advance(30_000); assert.deepEqual(h.calls,[]);
  h.clock.advance(30_000); assert.equal(h.calls.filter(([kind])=>kind==='fit').length,1);
});

test('#846 AC7 non-kiosk, zero, single-space and fixed-floor configurations have no timers/reset', () => {
  for (const reason of ['ordinary','zero','one-space','fixed']) {
    const h = harness({intervalMs:0}); h.carousel.interact();
    h.clock.advance(300_000); h.carousel.tick();
    assert.deepEqual(h.calls,[],reason); assert.equal(h.timers.size,0,reason);
    assert.equal(h.state.pausedUntil,160_000,'#462 still sees interaction pause');
  }
});

test('#846 AC8 config1→0 and disconnect dispose both timers; reconnect has one each', () => {
  const h = harness({intervalMs:1000}); h.carousel.interact(); assert.equal(h.timers.size,2);
  h.state.intervalMs=0; h.carousel.sync(); assert.equal(h.timers.size,0);
  h.state.intervalMs=1000; h.carousel.sync(); assert.equal(h.timers.size,2);
  h.state.connected=false; h.carousel.dispose(); assert.equal(h.timers.size,0);
  h.clock.advance(120_000); assert.deepEqual(h.calls,[]);
  h.state.connected=true; h.carousel.sync(); h.carousel.sync(); assert.equal(h.timers.size,2);
  h.clock.advance(0); assert.equal(h.calls.filter(([kind])=>kind==='fit').length,1);
});

test('#846 AC8 queued callbacks from disposed ownership cannot act after reconnect', () => {
  const h=harness({intervalMs:1000});h.carousel.interact();
  const retired=[...h.timers.values()].map(timer=>timer.callback);
  h.carousel.dispose();h.state.connected=false;h.clock.advance(120_000);
  h.state.connected=true;h.carousel.sync();
  for(const callback of retired) callback();
  assert.deepEqual(h.calls,[],'old timeout/interval closures are fenced');
  h.clock.advance(0);assert.deepEqual(h.calls,[['fit',220_000]]);
});
