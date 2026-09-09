import assert from 'node:assert/strict';
import test from 'node:test';
import { nothing } from 'lit';

import { SummaryPanelPresentation } from '../test-build/summary-panel-presentation.js';
import { LoadedSummaryPanelRuntime } from '../test-build/summary-panel-runtime-loaded.js';
import { summaryLocalKey } from '../test-build/summary-panel.js';

const flushFinished = async () => { await Promise.resolve(); await Promise.resolve(); };

function animationEnvironment(t) {
  let now = 0;
  let timerId = 0;
  const timers = new Map();
  const listeners = new Set();
  const animations = [];
  const events = [];
  t.mock.method(globalThis, 'setTimeout', (callback, delay) => {
    const id = ++timerId;
    timers.set(id, { callback, delay, at: now + delay });
    return id;
  });
  t.mock.method(globalThis, 'clearTimeout', (id) => timers.delete(id));
  const media = {
    matches: false,
    addEventListener(kind, listener) { assert.equal(kind, 'change'); listeners.add(listener); },
    removeEventListener(kind, listener) { assert.equal(kind, 'change'); listeners.delete(listener); },
  };
  const view = {
    matchMedia(query) { assert.equal(query, '(prefers-reduced-motion: reduce)'); return media; },
    getComputedStyle(element) {
      events.push('snapshot');
      return { ...element.currentStyle };
    },
  };
  const element = {
    ownerDocument: { defaultView: view },
    currentStyle: { opacity: '1', translate: 'none' },
    scrollTop: 73,
    animate(frames, options) {
      events.push('animate');
      let resolve;
      let reject;
      const animation = {
        frames, options, element: this, cancellations: 0,
        finished: new Promise((yes, no) => { resolve = yes; reject = no; }),
        finish() { resolve(); },
        reject() { reject(new Error('Animation cancelled')); },
        cancel() { events.push('cancel'); this.cancellations++; },
      };
      animations.push(animation);
      return animation;
    },
  };
  return {
    timers, listeners, animations, events, media, view, element,
    motion(matches) {
      media.matches = matches;
      for (const listener of [...listeners]) listener({ matches });
    },
    advance(ms) {
      const target = now + ms;
      while (true) {
        const due = [...timers.entries()].filter(([, timer]) => timer.at <= target)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        now = due[1].at;
        timers.delete(due[0]);
        due[1].callback();
      }
      now = target;
    },
  };
}

function presentationFixture(t) {
  const env = animationEnvironment(t);
  let repaints = 0;
  const presentation = new SummaryPanelPresentation(() => repaints++);
  t.after(() => presentation.reset());
  return { ...env, presentation, repaints: () => repaints };
}

for (const [side, offset] of [['right', '18px 0px'], ['bottom', '0px 18px']]) {
  test(`#505 ${side} entry/exit own one 190ms animation and preserve the mounted exit`, async (t) => {
    const f = presentationFixture(t);
    const p = f.presentation;
    assert.deepEqual([p.phase, p.mounted, p.interactive], ['hidden', false, false]);
    p.sync(true, side);
    assert.deepEqual([p.phase, p.mounted, p.interactive], ['entering', true, true]);
    p.updated(f.element);
    const enter = f.animations[0];
    assert.deepEqual(enter.frames, [
      { opacity: '0', translate: offset }, { opacity: '1', translate: '0px 0px' },
    ]);
    assert.deepEqual(enter.options, { duration: 190, easing: 'ease', fill: 'both' });
    assert.equal(f.timers.size, 1);
    assert.equal(f.listeners.size, 1);
    enter.finish();
    await flushFinished();
    assert.deepEqual([p.phase, p.mounted, p.interactive], ['visible', true, true]);
    assert.equal(enter.cancellations, 1, 'the filled WAAPI effect is released after committing phase');
    assert.equal(f.timers.size, 0);
    assert.equal(f.listeners.size, 0);

    p.sync(false, side);
    assert.deepEqual([p.phase, p.mounted, p.interactive], ['exiting', true, false],
      'off immediately removes interaction but retains the same subtree');
    p.updated(f.element);
    const exit = f.animations[1];
    assert.deepEqual(exit.frames, [
      { opacity: '1', translate: 'none' }, { opacity: '0', translate: offset },
    ]);
    assert.equal(exit.element, enter.element);
    assert.equal(p.mounted, true, 'rendering/starting exit is not completion');
    exit.finish();
    await flushFinished();
    assert.deepEqual([p.phase, p.mounted, p.interactive], ['hidden', false, false]);
    assert.equal(f.timers.size, 0);
    assert.equal(f.listeners.size, 0);
  });
}

test('#505 reversal snapshots current progress before cancellation; old completions cannot settle it', async (t) => {
  const f = presentationFixture(t);
  const p = f.presentation;
  p.sync(true, 'right');
  p.updated(f.element);
  const enter = f.animations[0];
  const enterTimeout = [...f.timers.values()][0].callback;
  f.element.currentStyle = { opacity: '0.37', translate: '11.34px 0px' };
  f.events.length = 0;
  p.sync(false, 'right');
  p.updated(f.element);
  const exit = f.animations[1];
  const exitTimeout = [...f.timers.values()][0].callback;
  assert.deepEqual(f.events, ['snapshot', 'cancel', 'animate']);
  assert.deepEqual(exit.frames[0], f.element.currentStyle,
    'a partial enter must not jump to full opacity before exiting');
  assert.equal(enter.cancellations, 1);

  f.element.currentStyle = { opacity: '0.21', translate: '14.22px 0px' };
  p.sync(true, 'right');
  p.updated(f.element);
  const newest = f.animations[2];
  assert.deepEqual(newest.frames[0], f.element.currentStyle);
  assert.equal(newest.element, enter.element, 'reverse in place, never replace the subtree');
  assert.equal(exit.cancellations, 1);
  assert.equal(f.timers.size, 1);
  assert.equal(f.listeners.size, 1);
  enter.finish();
  exit.finish();
  enterTimeout();
  exitTimeout();
  await flushFinished();
  assert.equal(p.phase, 'entering', 'neither old promise nor old timeout may settle the latest run');
  assert.equal(f.repaints(), 0);
  assert.equal(f.timers.size, 1);
  newest.finish();
  await flushFinished();
  assert.equal(p.phase, 'visible');
  assert.equal(f.repaints(), 1);
  assert.equal(f.timers.size, 0);
  assert.equal(f.listeners.size, 0);
});

test('#505 ordinary updates keep the animation, live node and scroll position intact', (t) => {
  const f = presentationFixture(t);
  f.presentation.sync(true, 'bottom');
  f.presentation.updated(f.element);
  const timer = [...f.timers.keys()][0];
  for (let index = 0; index < 12; index++) {
    f.presentation.sync(true, 'bottom');
    f.presentation.updated(f.element);
  }
  assert.equal(f.animations.length, 1);
  assert.equal(f.animations[0].cancellations, 0);
  assert.deepEqual([...f.timers.keys()], [timer]);
  assert.equal(f.listeners.size, 1);
  assert.equal(f.element.scrollTop, 73);
});

test('#505 reset releases resources and stale callbacks cannot revive or remove a fresh identity', async (t) => {
  const f = presentationFixture(t);
  const p = f.presentation;
  p.sync(true, 'right');
  p.updated(f.element);
  const old = f.animations[0];
  const staleTimeout = [...f.timers.values()][0].callback;
  const staleMedia = [...f.listeners][0];
  p.reset();
  assert.deepEqual([p.phase, p.mounted, p.interactive], ['hidden', false, false]);
  assert.equal(old.cancellations, 1);
  assert.equal(f.timers.size, 0);
  assert.equal(f.listeners.size, 0);
  old.finish();
  staleTimeout();
  staleMedia({ matches: true });
  await flushFinished();
  assert.equal(p.phase, 'hidden');
  assert.equal(f.repaints(), 0, 'disconnected identity must not receive an asynchronous repaint');

  p.sync(true, 'bottom');
  p.updated(f.element);
  assert.equal(p.phase, 'entering', 'reset forgets the old anchor instead of settling a false direction change');
  assert.deepEqual(f.animations[1].frames[0], { opacity: '0', translate: '0px 18px' });
  staleTimeout();
  await flushFinished();
  assert.equal(p.phase, 'entering');
  assert.equal(f.timers.size, 1);
});

test('#505 immediate boundaries and direction changes cancel old effects without replay', async (t) => {
  const f = presentationFixture(t);
  const p = f.presentation;
  p.sync(true, 'right');
  p.updated(f.element);
  const old = f.animations[0];
  p.sync(true, 'bottom');
  p.updated(f.element);
  assert.deepEqual([p.phase, p.mounted, p.interactive], ['visible', true, true]);
  assert.equal(f.animations.length, 1);
  assert.equal(old.cancellations, 1);
  assert.equal(f.timers.size, 0);
  assert.equal(f.listeners.size, 0);
  old.finish();
  await flushFinished();
  assert.equal(f.repaints(), 0);

  p.sync(false, 'bottom');
  p.updated(f.element);
  const exit = f.animations[1];
  p.sync(false, 'bottom', true);
  assert.equal(p.phase, 'hidden');
  assert.equal(exit.cancellations, 1);
  assert.equal(f.timers.size, 0);
  p.sync(true, 'bottom', true);
  p.updated(f.element);
  assert.equal(p.phase, 'visible');
  assert.equal(f.animations.length, 2, 'immediate on must not animate on the next updated call');
});

test('#505 reduced motion settles both directions and removes transition listeners immediately', async (t) => {
  const f = presentationFixture(t);
  const p = f.presentation;
  f.motion(true);
  p.sync(true, 'right');
  p.updated(f.element);
  assert.equal(p.phase, 'visible');
  p.sync(false, 'right');
  p.updated(f.element);
  assert.equal(p.phase, 'hidden');
  assert.equal(f.animations.length, 0);
  assert.equal(f.timers.size, 0);
  assert.equal(f.listeners.size, 0);

  f.motion(false);
  for (const wanted of [true, false]) {
    p.sync(wanted, 'right');
    p.updated(f.element);
    const running = f.animations.at(-1);
    f.motion(true);
    assert.equal(p.phase, wanted ? 'visible' : 'hidden');
    assert.equal(running.cancellations, 1);
    assert.equal(f.timers.size, 0);
    assert.equal(f.listeners.size, 0);
    const afterSettling = f.repaints();
    running.finish();
    await flushFinished();
    assert.equal(f.repaints(), afterSettling);
    f.motion(false);
  }
});

test('#505 a rejected/cancelled animation still cleans up at the bounded safety deadline', async (t) => {
  const f = presentationFixture(t);
  const p = f.presentation;
  p.sync(true, 'right', true);
  p.updated(f.element);
  p.sync(false, 'right');
  p.updated(f.element);
  const exit = f.animations[0];
  const timeout = [...f.timers.values()][0];
  assert.ok(timeout.delay >= 190 && timeout.delay <= 300);
  exit.reject();
  await flushFinished();
  f.advance(timeout.delay - 1);
  assert.equal(p.phase, 'exiting');
  assert.equal(p.interactive, false);
  f.advance(1);
  assert.equal(p.phase, 'hidden');
  assert.equal(f.repaints(), 1);
  assert.equal(f.timers.size, 0);
  assert.equal(f.listeners.size, 0);
  f.advance(1000);
  assert.equal(f.repaints(), 1, 'cleanup is one-shot, not a permanent animation loop');
});

test('#505 absent render nodes defer work, while missing animation APIs settle without timers', (t) => {
  const f = presentationFixture(t);
  const p = f.presentation;
  p.sync(true, 'right');
  p.updated(null);
  assert.equal(p.phase, 'entering');
  assert.equal(f.animations.length, 0);
  assert.equal(f.timers.size, 0);
  p.updated(f.element);
  assert.equal(f.animations.length, 1, 'the first committed node receives the pending enter');
  p.reset();

  for (const element of [
    { ownerDocument: { defaultView: null } },
    { ownerDocument: { defaultView: f.view } },
  ]) {
    p.sync(true, 'right');
    p.updated(element);
    assert.equal(p.phase, 'visible');
    p.sync(false, 'right');
    p.updated(element);
    assert.equal(p.phase, 'hidden');
    assert.equal(f.timers.size, 0);
    assert.equal(f.listeners.size, 0);
  }
});

function runtimeFixture(t) {
  const f = animationEnvironment(t);
  const previous = {
    location: Object.getOwnPropertyDescriptor(globalThis, 'location'),
    localStorage: Object.getOwnPropertyDescriptor(globalThis, 'localStorage'),
  };
  const values = new Map();
  const writes = [];
  const path = { pathname: '/dashboard/home' };
  Object.defineProperty(globalThis, 'location', { configurable: true, value: path });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { writes.push([key, value]); values.set(key, value); },
  } });
  const key = summaryLocalKey({ userId: 'alice', path: path.pathname, host: 'panel', slot: 'houseplan-card' });
  const saved = JSON.stringify({ version: 1, show: true, icon_scale: 1.85, font_scale: 1.35 });
  values.set(key, saved);
  const host = {
    localName: 'houseplan-card', parentNode: null,
    panelHost: true, narrow: false, _kiosk: false, _mode: 'view',
    hass: { user: { id: 'alice', is_admin: true }, states: {}, config: {} },
    _config: {}, _canManageConfiguration: true,
    _settings: { summary_panel: { version: 1, title: 'Test', show_on_mobile: true, blocks: [] } },
    _kioskScale: { icon: 1, font: 1 }, _space: '',
    _stageEl: { clientWidth: 1024, clientHeight: 768, getBoundingClientRect: () => ({ top: 0 }) },
    ownerDocument: { defaultView: f.view, visibilityState: 'visible',
      createElement: () => ({ dataset: {}, textContent: '' }) },
    renderRoot: { adoptedStyleSheets: [], firstChild: null,
      querySelector: (selector) => selector === '.summary-overlay' ? f.element : null,
      insertBefore: () => undefined },
    requestUpdate: () => undefined,
    isConnected: true,
  };
  f.element.ownerDocument = host.ownerDocument;
  const runtime = new LoadedSummaryPanelRuntime(host);
  // Data loading is independent of presentation and already covered by the
  // metrics suite. Prevent unrelated dynamic-import continuations in this clock.
  t.mock.method(runtime, 'ensureMetrics', () => undefined);
  runtime.connect();
  runtime.updated();
  assert.notEqual(runtime.renderPanel(), nothing);
  runtime.updated();
  assert.equal(runtime.presentation.phase, 'entering');
  t.after(() => {
    runtime.disconnect();
    for (const [name, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  return { ...f, runtime, host, path, values, writes, key, saved };
}

const hardBoundaries = {
  'editor entry': ({ host, runtime }) => { host._mode = 'plan'; runtime.renderPanel(); },
  'too-small stage': ({ host, runtime }) => { host._stageEl.clientWidth = 120; runtime.resized(); runtime.renderPanel(); },
  'mobile policy': ({ host, runtime }) => { host.narrow = true; host._settings.summary_panel.show_on_mobile = false; runtime.renderPanel(); },
  'future schema': ({ host, runtime }) => { host._settings.summary_panel.version = 2; runtime.renderPanel(); },
  'user identity': ({ host, runtime }) => { host.hass.user.id = 'bob'; runtime.willUpdate(); },
  'permission identity': ({ host, runtime }) => { host._canManageConfiguration = false; runtime.willUpdate(); },
  'host identity': ({ host, runtime }) => { host.panelHost = false; runtime.willUpdate(); },
  'kiosk identity': ({ host, runtime }) => { host._kiosk = true; runtime.willUpdate(); },
  'route identity': ({ path, runtime }) => { path.pathname = '/dashboard/other'; runtime.willUpdate(); },
  'route leave': ({ runtime }) => runtime.leaveRoute(),
  disconnect: ({ runtime }) => runtime.disconnect(),
};

for (const [name, boundary] of Object.entries(hardBoundaries)) {
  test(`#505 runtime ${name} synchronously removes presentation and invalidates pending completion`, async (t) => {
    const f = runtimeFixture(t);
    const old = f.animations[0];
    const staleTimeout = [...f.timers.values()][0].callback;
    boundary(f);
    assert.equal(f.runtime.presentation.phase, 'hidden');
    assert.equal(f.runtime.presentation.mounted, false);
    assert.equal(old.cancellations, 1);
    assert.equal(f.timers.size, 0);
    assert.equal(f.listeners.size, 0);
    old.finish();
    staleTimeout();
    await flushFinished();
    assert.equal(f.runtime.presentation.phase, 'hidden');
    assert.equal(f.writes.length, 0, 'temporary eligibility and teardown never persist local intent');
    assert.equal(f.values.get(f.key), f.saved, 'both unrelated scales and saved show survive cleanup');
  });
}

test('#505 hidden document settles latest intent and returning does not replay motion', async (t) => {
  const f = runtimeFixture(t);
  const p = f.runtime.presentation;
  f.host.ownerDocument.visibilityState = 'hidden';
  f.runtime.visibility('hidden');
  assert.equal(p.phase, 'visible', 'document hiding settles the existing on intent');
  assert.equal(f.animations[0].cancellations, 1);
  assert.equal(f.timers.size, 0);
  assert.equal(f.listeners.size, 0);
  f.runtime.local = { ...f.runtime.local, show: false };
  assert.equal(f.runtime.renderPanel(), nothing);
  assert.equal(p.phase, 'hidden');
  f.runtime.local = { ...f.runtime.local, show: true };
  f.runtime.renderPanel();
  f.runtime.updated();
  assert.equal(p.phase, 'visible');
  f.host.ownerDocument.visibilityState = 'visible';
  f.runtime.visibility('visible');
  f.runtime.renderPanel();
  f.runtime.updated();
  assert.equal(f.animations.length, 1, 'no old enter replays on foregrounding');
  f.animations[0].finish();
  await flushFinished();
  assert.equal(p.phase, 'visible');
  assert.equal(f.writes.length, 0);
});

test('#505 runtime anchor change settles in place and an ineligible panel can enter afresh', async (t) => {
  const f = runtimeFixture(t);
  const p = f.runtime.presentation;
  f.host._stageEl.clientWidth = 700;
  f.host._stageEl.clientHeight = 1000;
  f.runtime.resized();
  f.runtime.renderPanel();
  f.runtime.updated();
  assert.equal(p.phase, 'visible');
  assert.equal(f.animations.length, 1);
  assert.equal(f.animations[0].cancellations, 1);
  f.host._stageEl.clientWidth = 100;
  f.runtime.resized();
  assert.equal(f.runtime.renderPanel(), nothing);
  assert.equal(p.phase, 'hidden');
  f.host._stageEl.clientWidth = 700;
  f.runtime.resized();
  f.runtime.renderPanel();
  f.runtime.updated();
  assert.equal(p.phase, 'entering');
  assert.deepEqual(f.animations[1].frames[0], { opacity: '0', translate: '0px 18px' });
  f.animations[0].finish();
  await flushFinished();
  assert.equal(p.phase, 'entering');
  assert.equal(f.writes.length, 0);
});
