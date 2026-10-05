// #794: execute the real static-card teardown without a detached Lit render or
// a browser CSS transition being able to clean up / finish the old lifecycle.
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { ledRuntime } from '../test-build/led-strip-gate.js';
import { hasLedField, ledFieldCache, ledFieldStats } from '../test-build/led-strip-field.js';

const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
globalThis.window = { customCards: [] };
after(() => {
  if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
  else delete globalThis.window;
});
// Lit's Node entry supplies its own HTMLElement/customElements shim. No custom
// class or copied method substitutes for the production disconnectedCallback.
const { HouseplanSpaceCard } = await import('../test-build/space-card.js');

async function loaded(read) {
  await new Promise(resolve => { if (read(resolve)) resolve(); });
  const module = read(() => {});
  assert.ok(module, 'the production lazy slot must be installed, not just imported');
  return module;
}
const runtime = await loaded(ready => ledRuntime('disconnect-witness', ready));
await loaded(ready => runtime.ledField('disconnect-witness', ready));

function clock() {
  let sequence = 0;
  const frames = new Map(), timers = new Map();
  const win = {
    requestAnimationFrame(cb) { const id = ++sequence; frames.set(id, cb); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    setTimeout(cb, delay) { const id = ++sequence; timers.set(id, { cb, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    matchMedia: () => ({ matches: false }),
  };
  return { win, frames, timers,
    frame() { for (const [id, cb] of [...frames]) { frames.delete(id); cb(0); } },
  };
}

function fixture(scheduler) {
  let connected = true, updates = 0;
  const card = new HouseplanSpaceCard();
  // Only browser-owned properties are supplied. The actual constructor owns
  // every private field; the LED owner is read, never replaced or pre-cleared.
  Object.defineProperties(card, {
    ownerDocument: { value: { defaultView: scheduler.win } },
    isConnected: { get: () => connected },
  });
  const owner = card._glowRuntimeState;
  const floor = [[0, 0], [1000, 0], [1000, 1000], [0, 1000]];
  const input = {
    space: { id: 's', vb: [0, 0, 1000, 1000], rooms: [{ id: 'room', poly: floor }],
      led_strips: [{ id: 'strip', marker: 'lamp', points: [[0.2, 0.2], [0.4, 0.2]] }] },
    devices: [{ id: 'lamp', name: 'LED', primary: 'light.led', entities: ['light.led'], space: 's',
      marker: { id: 'lamp', binding: 'device:lamp', room_id: 'room' } }],
    defaultColor: '#ffd27b', paletteAlpha: 0.7, cellCm: 5, gridPitch: 1000 / 240, iconPct: 3.4,
    glowFor: () => true, inRoom: () => true, live: true, perUnit: 1,
    scene: { floor: [floor], occluders: [], fingerprint: 'empty-room', masonryGeometry: [], opaqueBodies: [] },
    bodies: { masonryGeometry: [], opaqueBodies: [] },
    owner, ready: () => { updates++; }, isConnected: () => card.isConnected,
  };
  return { card, owner,
    get updates() { return updates; },
    connect(value) { connected = value; },
    render(state = 'on') {
      return runtime.renderStaticLed({ ...input,
        hass: { states: { 'light.led': { state, attributes: {} } } },
      });
    },
    disconnect() { connected = false; card.disconnectedCallback(); },
  };
}

const emptyStats = { visibility: 0, sources: 0, visibilityPaths: 0, pathChars: 0, recomputes: 0 };

for (const phase of ['entering', 'visible', 'leaving']) {
  test(`#794: real space-card disconnect releases ${phase} LED state before any render`, t => {
    const scheduler = clock();
    globalThis.window = scheduler.win;
    const subject = fixture(scheduler), neighbour = fixture(scheduler);
    t.after(() => { subject.disconnect(); neighbour.disconnect(); });
    subject.render();
    assert.equal(hasLedField(subject.owner), true);
    const oldCache = ledFieldCache(subject.owner);
    assert.ok(ledFieldStats(subject.owner).sources > 0, 'populate real field geometry, not a synthetic cache entry');
    if (phase !== 'entering') scheduler.frame();
    if (phase === 'leaving') subject.render('off');
    const oldFrames = [...scheduler.frames.values()];
    const subjectFrameIds = [...scheduler.frames.keys()];
    const subjectTimerIds = [...scheduler.timers.keys()];
    neighbour.render();
    const neighbourCache = ledFieldCache(neighbour.owner);
    const neighbourStats = ledFieldStats(neighbour.owner);

    subject.disconnect();
    // Synchronous boundary: neither Lit/renderStaticLed nor a rAF/timer has run
    // since the actual callback. A connection guard alone is insufficient.
    assert.equal(hasLedField(subject.owner), false, 'disconnect itself must discard the retained LED lifecycle');
    assert.deepEqual(ledFieldStats(subject.owner), emptyStats);
    assert.ok(subjectFrameIds.every(id => !scheduler.frames.has(id)), 'cancel this owner\'s entering frames');
    assert.ok(subjectTimerIds.every(id => !scheduler.timers.has(id)), 'cancel this owner\'s fade/feather timers');
    assert.equal(hasLedField(neighbour.owner), true, 'another card still owns its field');
    assert.equal(ledFieldCache(neighbour.owner), neighbourCache);
    assert.deepEqual(ledFieldStats(neighbour.owner), neighbourStats);

    subject.connect(true);
    const pending = scheduler.frames.size;
    subject.render();
    const freshCache = ledFieldCache(subject.owner);
    assert.notEqual(freshCache, oldCache, 'reconnect must get a fresh owner cache');
    assert.equal(scheduler.frames.size, pending + 1, 'the same strip starts a fresh entering lifecycle');
    const updates = subject.updates;
    for (const callback of oldFrames) callback();
    assert.equal(subject.updates, updates, 'old entry frames cannot update the reconnected owner');
    assert.equal(ledFieldCache(subject.owner), freshCache, 'old entry frames cannot discard the new cache');
    assert.equal(scheduler.frames.size, pending + 1, 'old entry frames cannot consume the new entry');
    scheduler.frame();
    assert.equal(subject.updates, updates + 1, 'only the fresh entry frame requests the update');
  });
}

test('#794 negative case: a disconnected connection guard leaves the old LED lifecycle reusable', t => {
  const scheduler = clock();
  globalThis.window = scheduler.win;
  const subject = fixture(scheduler);
  t.after(() => subject.disconnect());
  subject.render();
  const oldCache = ledFieldCache(subject.owner);
  subject.connect(false); // Deliberately no owner teardown: normal executable control, not a source mutation.
  scheduler.frame();
  assert.equal(subject.updates, 0, 'the connection guard suppresses late updates even without disposal');
  assert.equal(hasLedField(subject.owner), true, 'no updates does not mean the lifecycle was released');
  assert.ok(ledFieldStats(subject.owner).sources > 0);
  subject.connect(true);
  subject.render();
  assert.equal(ledFieldCache(subject.owner), oldCache, 'the old cache survives without disconnect cleanup');
  assert.equal(scheduler.frames.size, 0, 'reusing the settled old entry is not a fresh lifecycle');
});
