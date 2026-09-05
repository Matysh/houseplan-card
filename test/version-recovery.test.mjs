import test from 'node:test';
import assert from 'node:assert/strict';

import {
  VERSION_RECOVERY_CHECK_MS,
  VERSION_RELOAD_ATTEMPT_KEY,
  VersionRecoveryController,
  compareRuntimeVersions,
  fetchAuthoritativeConfig,
  isVersionReloadSafe,
  normalizeRuntimeVersion,
} from '../test-build/version-recovery.js';

class FakeClock {
  at = 10_000;
  nextId = 1;
  timers = new Map();
  setTimeout = (callback, delay) => {
    const id = this.nextId++;
    this.timers.set(id, { at: this.at + delay, callback });
    return id;
  };
  clearTimeout = (id) => this.timers.delete(id);
  advance(ms) {
    const end = this.at + ms;
    while (true) {
      const due = [...this.timers.entries()]
        .filter(([, timer]) => timer.at <= end)
        .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!due) break;
      this.at = due[1].at;
      this.timers.delete(due[0]);
      due[1].callback();
    }
    this.at = end;
  }
}

const allSafe = () => ({
  connected: true,
  initialFrameSettled: true,
  viewOnly: true,
  surfacesIdle: true,
  configWritesIdle: true,
  physicalWritesIdle: true,
  layoutWritesIdle: true,
  gesturesIdle: true,
  interactionPauseElapsed: true,
  baseZoom: true,
});

function memoryStorage(initial = null) {
  const values = new Map();
  if (initial !== null) values.set(VERSION_RELOAD_ATTEMPT_KEY, initial);
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

function harness({ storage = memoryStorage(), safety = allSafe() } = {}) {
  const clock = new FakeClock();
  const events = [];
  let snapshot = safety;
  const controller = new VersionRecoveryController({
    clock,
    storage: () => storage,
    safety: () => snapshot,
    reload: () => events.push({ kind: 'reload', stored: storage?.values?.get(VERSION_RELOAD_ATTEMPT_KEY) }),
    changed: () => events.push({ kind: 'changed' }),
  });
  return {
    clock,
    storage,
    events,
    controller,
    setSafety: (value) => { snapshot = value; },
  };
}

const update = (controller, overrides = {}) => controller.update({
  frontendVersion: '1.72.0',
  backendVersion: '1.73.0',
  kiosk: false,
  reducedMotion: true,
  ...overrides,
});

test('versions are trimmed, exact and symmetric; malformed values stay unknown', () => {
  assert.equal(normalizeRuntimeVersion(' 1.72.0 '), '1.72.0');
  for (const value of [undefined, null, 1, '', '   ']) {
    assert.equal(normalizeRuntimeVersion(value), null);
  }
  assert.deepEqual(compareRuntimeVersions(' A ', 'A'), {
    kind: 'equal', frontend: 'A', backend: 'A',
  });
  assert.deepEqual(compareRuntimeVersions('A', 'B'), {
    kind: 'mismatch', frontend: 'A', backend: 'B',
  });
  assert.deepEqual(compareRuntimeVersions('B', 'A'), {
    kind: 'mismatch', frontend: 'B', backend: 'A',
  });
  assert.deepEqual(compareRuntimeVersions('A', ' '), { kind: 'unknown' });
});

test('a fulfilled config is adopted before a sibling request or later preparation fails', async () => {
  for (const response of [
    { integration_version: 'new-target' },
    {},
  ]) {
    let rejectSibling;
    let adoptedVersion = 'stale-target';
    const sibling = new Promise((_, reject) => { rejectSibling = reject; });
    const config = fetchAuthoritativeConfig(
      () => Promise.resolve(response),
      (value) => { adoptedVersion = normalizeRuntimeVersion(value.integration_version); },
    );
    const aggregate = Promise.all([config, sibling]);
    await config;
    const expected = response.integration_version || null;
    assert.equal(adoptedVersion, expected,
      'the individual config fulfillment sets or clears the runtime version');
    rejectSibling(new Error('layout or asset preparation failed'));
    await assert.rejects(aggregate, /layout or asset preparation failed/);
    assert.equal(adoptedVersion, expected,
      'an aggregate failure cannot restore a stale runtime version');
  }
});

test('every named kiosk safety category independently blocks reload', () => {
  const safe = allSafe();
  assert.equal(isVersionReloadSafe(safe), true);
  for (const key of Object.keys(safe)) {
    assert.equal(isVersionReloadSafe({ ...safe, [key]: false }), false, key);
  }
});

test('ordinary mode always shows the manual notice and never reloads itself', () => {
  const h = harness();
  update(h.controller);
  h.controller.connect();
  assert.equal(h.controller.relation.kind, 'mismatch');
  assert.equal(h.controller.banner?.phase, 'visible');
  assert.equal(h.controller.hasCurrentMismatchNotice, true);
  assert.equal(h.clock.timers.size, 0);
  h.clock.advance(VERSION_RECOVERY_CHECK_MS * 100);
  assert.equal(h.events.some((event) => event.kind === 'reload'), false);
  assert.equal(h.storage.values.size, 0, 'normal mode does not consume the kiosk attempt');
});

test('kiosk waits for a safe frame, marks the exact target before one reload, then falls back to banner', () => {
  const h = harness({ safety: { ...allSafe(), surfacesIdle: false } });
  update(h.controller, { kiosk: true });
  h.controller.connect();
  assert.equal(h.controller.banner, null, 'fresh kiosk mismatch stays quiet');
  assert.equal(h.clock.timers.size, 1);
  h.clock.advance(VERSION_RECOVERY_CHECK_MS * 3);
  assert.equal(h.events.some((event) => event.kind === 'reload'), false);
  assert.equal(h.clock.timers.size, 1, 'polling owns at most one timer');

  h.setSafety(allSafe());
  h.clock.advance(VERSION_RECOVERY_CHECK_MS);
  const reloads = h.events.filter((event) => event.kind === 'reload');
  assert.deepEqual(reloads, [{ kind: 'reload', stored: '1.73.0' }]);
  assert.equal(h.storage.values.get(VERSION_RELOAD_ATTEMPT_KEY), '1.73.0');
  assert.equal(h.controller.banner?.phase, 'visible');
  assert.equal(h.clock.timers.size, 0);
  h.clock.advance(VERSION_RECOVERY_CHECK_MS * 10);
  assert.equal(h.events.filter((event) => event.kind === 'reload').length, 1);
});

test('the same target is once per tab across cards and alternating frontend versions', () => {
  const storage = memoryStorage();
  const first = harness({ storage });
  update(first.controller, { kiosk: true, frontendVersion: 'old-A', backendVersion: 'target-B' });
  first.controller.connect();
  first.clock.advance(VERSION_RECOVERY_CHECK_MS);
  assert.equal(first.events.filter((event) => event.kind === 'reload').length, 1);

  const second = harness({ storage });
  update(second.controller, { kiosk: true, frontendVersion: 'old-C', backendVersion: 'target-B' });
  second.controller.connect();
  assert.equal(second.controller.banner?.backend, 'target-B');
  assert.equal(second.clock.timers.size, 0);
  second.clock.advance(VERSION_RECOVERY_CHECK_MS * 5);
  assert.equal(second.events.some((event) => event.kind === 'reload'), false);

  update(second.controller, { kiosk: true, frontendVersion: 'old-C', backendVersion: 'target-D' });
  assert.equal(second.controller.banner, null, 'a new backend target gets a fresh quiet attempt');
  second.clock.advance(VERSION_RECOVERY_CHECK_MS);
  assert.equal(second.events.filter((event) => event.kind === 'reload').length, 1);
  assert.equal(storage.values.get(VERSION_RELOAD_ATTEMPT_KEY), 'target-D');
});

test('a second card losing the claim observes the stored target and does not reload', () => {
  const storage = memoryStorage();
  const h = harness({ storage });
  update(h.controller, { kiosk: true });
  h.controller.connect();
  // Another controller/tab card wins between the initial read and safe tick.
  storage.setItem(VERSION_RELOAD_ATTEMPT_KEY, '1.73.0');
  h.clock.advance(VERSION_RECOVERY_CHECK_MS);
  assert.equal(h.events.some((event) => event.kind === 'reload'), false);
  assert.equal(h.controller.banner?.phase, 'visible');
  assert.equal(h.clock.timers.size, 0);
});

test('session storage provider/get/set failures are manual-only and never loop', () => {
  const cases = [
    () => { throw new Error('getter denied'); },
    () => ({ getItem: () => { throw new Error('read denied'); }, setItem: () => undefined }),
    () => ({ getItem: () => null, setItem: () => { throw new Error('write denied'); } }),
  ];
  for (const provider of cases) {
    const clock = new FakeClock();
    let reloads = 0;
    const controller = new VersionRecoveryController({
      clock,
      storage: provider,
      safety: allSafe,
      reload: () => reloads++,
      changed: () => undefined,
    });
    update(controller, { kiosk: true });
    controller.connect();
    if (!controller.banner) clock.advance(VERSION_RECOVERY_CHECK_MS);
    assert.equal(reloads, 0);
    assert.equal(controller.banner?.phase, 'visible');
    assert.equal(clock.timers.size, 0);
  }
});

test('a synchronous navigation failure keeps the claimed target manual-only', () => {
  const clock = new FakeClock();
  const storage = memoryStorage();
  const controller = new VersionRecoveryController({
    clock,
    storage: () => storage,
    safety: allSafe,
    reload: () => { throw new Error('navigation denied'); },
    changed: () => undefined,
  });
  update(controller, { kiosk: true });
  controller.connect();
  assert.doesNotThrow(() => clock.advance(VERSION_RECOVERY_CHECK_MS));
  assert.equal(storage.values.get(VERSION_RELOAD_ATTEMPT_KEY), '1.73.0');
  assert.equal(controller.banner?.phase, 'visible');
  assert.equal(clock.timers.size, 0);
});

test('equal/unknown and disconnect cancel timers; reconnect re-reads shared session state', () => {
  const h = harness();
  update(h.controller, { kiosk: true });
  h.controller.connect();
  assert.equal(h.clock.timers.size, 1);
  update(h.controller, { kiosk: true, backendVersion: '1.72.0' });
  assert.equal(h.controller.relation.kind, 'equal');
  assert.equal(h.clock.timers.size, 0);

  update(h.controller, { kiosk: true, backendVersion: ' ' });
  assert.equal(h.controller.relation.kind, 'unknown');
  assert.equal(h.clock.timers.size, 0);

  update(h.controller, { kiosk: true });
  assert.equal(h.clock.timers.size, 1);
  h.controller.disconnect();
  assert.equal(h.clock.timers.size, 0);
  h.storage.setItem(VERSION_RELOAD_ATTEMPT_KEY, '1.73.0');
  h.controller.connect();
  assert.equal(h.controller.banner?.phase, 'visible');
  assert.equal(h.clock.timers.size, 0);
});

test('banner exit is token-safe and reduced motion removes it immediately', () => {
  const h = harness();
  update(h.controller, { reducedMotion: false });
  h.controller.connect();
  const shown = h.controller.banner;
  assert.equal(shown?.phase, 'visible');
  update(h.controller, { backendVersion: '1.72.0', reducedMotion: false });
  const leaving = h.controller.banner;
  assert.equal(leaving?.phase, 'leaving');
  h.controller.finishBannerExit(shown.token);
  assert.equal(h.controller.banner?.phase, 'leaving', 'stale animation cannot remove a newer phase');
  h.controller.finishBannerExit(leaving.token);
  assert.equal(h.controller.banner, null);

  update(h.controller, { backendVersion: '1.73.0', reducedMotion: true });
  assert.equal(h.controller.banner?.phase, 'visible');
  update(h.controller, { backendVersion: '1.72.0', reducedMotion: true });
  assert.equal(h.controller.banner, null);
});
