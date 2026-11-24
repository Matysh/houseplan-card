import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { IDBFactory, IDBDatabase } from 'fake-indexeddb';
import {
  createSession, importSession, installNetworkGuard, loadSession, MAX_SESSION_BYTES,
  parseSession, saveSession, serializeSession, sessionKey,
} from '../demo/ui-lab/session.mjs';

const identity = { datasetId: 'synthetic-sha256:one', productFingerprint: 'sha256:product-one' };
const fixture = JSON.parse(await readFile(new URL('../demo/ui-lab/fixture.json', import.meta.url), 'utf8'));
const initial = { config: fixture.config, layout: fixture.layout, states: fixture.states, virtualLightsOff: [] };
const makeStorage = () => {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key), data };
};

test('UI Lab synthetic fixture has no captured registry or host identity', () => {
  assert.ok(Object.keys(fixture.devices).every(id => /^(golden-|lab_)/.test(id)));
  assert.ok(Object.keys(fixture.entities).every(id => /^[a-z_]+\.(golden_|lab_)/.test(id)));
  assert.deepEqual(Object.keys(fixture).sort(), ['areas', 'config', 'devices', 'entities', 'layout', 'states']);
  assert.equal(fixture.config.spaces.length, 2);
  assert.equal(fixture.config.markers.find(marker => marker.id === 'lab_ceiling').tap_action, 'toggle');
});

test('session round-trip preserves config/layout/states and unknown compatible fields independently', () => {
  const snapshot = structuredClone(initial);
  snapshot.config.settings.future_field = { preserved: true };
  snapshot.layout.lab_ceiling.x = 0.33;
  snapshot.states['light.lab_ceiling'].state = 'off';
  snapshot.virtualLightsOff = ['lab_virtual'];
  const parsed = parseSession(serializeSession(identity, snapshot), identity);
  assert.deepEqual(parsed, snapshot);
  parsed.layout.lab_ceiling.x = 0.5;
  assert.equal(snapshot.layout.lab_ceiling.x, 0.33);
});

test('bad imports never replace the existing or historical session', () => {
  const storage = makeStorage();
  saveSession(storage, identity, initial);
  storage.setItem('houseplan-ui-lab:session:v1', 'historical-data');
  const previous = storage.getItem(sessionKey(identity));
  const envelope = createSession(identity, initial);
  const badInputs = [
    '{', 'null', '[]', '{}',
    JSON.stringify({ ...envelope, format: 'product-backup' }),
    JSON.stringify({ ...envelope, schema: 2 }),
    JSON.stringify({ ...envelope, datasetId: 'other-home' }),
    JSON.stringify({ ...envelope, productFingerprint: 'other-build' }),
    JSON.stringify({ ...envelope, snapshot: { ...initial, layout: [] } }),
    JSON.stringify({ ...envelope, snapshot: { ...initial, states: { bad: { state: 'on' } } } }),
    JSON.stringify({ ...envelope, snapshot: { ...initial, layout: { bad: { s: 'x', x: '0.5', y: 0 } } } }),
    JSON.stringify({ ...envelope, snapshot: { ...initial, virtualLightsOff: [1] } }),
    JSON.stringify(envelope).replace('"snapshot":{', '"snapshot":{"__proto__":{"polluted":true},'),
    ' '.repeat(MAX_SESSION_BYTES + 1),
  ];
  for (const text of badInputs) {
    assert.throws(() => importSession(storage, identity, text));
    assert.equal(storage.getItem(sessionKey(identity)), previous);
    assert.equal(storage.getItem('houseplan-ui-lab:session:v1'), 'historical-data');
  }
  assert.equal({}.polluted, undefined);
});

test('storage keys isolate datasets/builds and failed quota leaves previous value', () => {
  const storage = makeStorage();
  saveSession(storage, identity, initial);
  assert.deepEqual(loadSession(storage, identity), initial);
  for (const other of [{ ...identity, datasetId: 'other' }, { ...identity, productFingerprint: 'other' }]) {
    assert.notEqual(sessionKey(other), sessionKey(identity));
    assert.equal(loadSession(storage, other), null);
  }
  const previous = storage.getItem(sessionKey(identity));
  storage.setItem = () => { throw Error('QuotaExceededError'); };
  assert.throws(() => importSession(storage, identity, serializeSession(identity, initial)), /QuotaExceeded/);
  assert.equal(storage.getItem(sessionKey(identity)), previous);
});

let storageCase = 0;
async function browserStorage(t, legacy = makeStorage()) {
  for (const [key, value] of Object.entries({ indexedDB: new IDBFactory(), localStorage: legacy })) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key]);
  }
  return import(`../demo/ui-lab/session.mjs?storage-case=${++storageCase}`);
}

test('IndexedDB saves a large session with full localStorage and preserves historical records', async t => {
  const legacy = makeStorage();
  legacy.setItem('houseplan-ui-lab:session:v1', 'historic-session');
  legacy.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); };
  const api = await browserStorage(t, legacy);
  const large = structuredClone(initial);
  large.config.settings.large_test_field = 'x'.repeat(2 * 1024 * 1024);
  await api.saveBrowserSession(identity, large);
  // A fresh module instance represents a newly opened page, with no RAM cache.
  const reloaded = await import(`../demo/ui-lab/session.mjs?reload=${storageCase}`);
  assert.deepEqual(await reloaded.loadBrowserSession(identity), large);
  assert.equal(legacy.getItem('houseplan-ui-lab:session:v1'), 'historic-session');
  assert.equal(legacy.getItem(sessionKey(identity)), null);
});

test('legacy session migrates unchanged; explicit reset does not resurrect it', async t => {
  const legacy = makeStorage();
  saveSession(legacy, identity, initial);
  const original = legacy.getItem(sessionKey(identity));
  const api = await browserStorage(t, legacy);
  assert.deepEqual(await api.loadBrowserSession(identity), initial);
  await api.resetBrowserSession(identity);
  assert.equal(await api.loadBrowserSession(identity), null);
  assert.equal(legacy.getItem(sessionKey(identity)), original, 'recoverable legacy copy remains');
  await api.saveBrowserSession(identity, initial);
  assert.deepEqual(await api.loadBrowserSession(identity), initial);
});

test('IndexedDB commit failure rejects without replacing a previously saved session', async t => {
  const api = await browserStorage(t);
  await api.saveBrowserSession(identity, initial);
  const transaction = IDBDatabase.prototype.transaction;
  let failWrite = true;
  t.mock.method(IDBDatabase.prototype, 'transaction', function (...args) {
    const tx = transaction.apply(this, args);
    if (failWrite && args[1] === 'readwrite') queueMicrotask(() => tx.abort());
    return tx;
  });
  const changed = structuredClone(initial);
  changed.layout.lab_ceiling.x = 0.91;
  await assert.rejects(api.saveBrowserSession(identity, changed));
  failWrite = false;
  assert.deepEqual(await api.loadBrowserSession(identity), initial);
  await assert.rejects(api.saveBrowserSession(identity, { ...initial, layout: [] }), /invalid/);
  assert.deepEqual(await api.loadBrowserSession(identity), initial);
});

test('IndexedDB captures ordered writes and isolates dataset/build identities', async t => {
  const api = await browserStorage(t);
  const changed = structuredClone(initial);
  const writes = [api.saveBrowserSession(identity, changed)];
  changed.layout.lab_ceiling.x = 0.41;
  writes.push(api.saveBrowserSession(identity, changed));
  changed.layout.lab_ceiling.x = 0.82;
  await Promise.all(writes);
  assert.equal((await api.loadBrowserSession(identity)).layout.lab_ceiling.x, 0.41);
  for (const other of [{ ...identity, datasetId: 'other' }, { ...identity, productFingerprint: 'other' }]) {
    assert.equal(await api.loadBrowserSession(other), null);
    await api.saveBrowserSession(other, initial);
    await api.resetBrowserSession(other);
  }
  assert.equal((await api.loadBrowserSession(identity)).layout.lab_ceiling.x, 0.41);
});

test('malformed legacy data is kept for recovery and never migrated as a valid session', async t => {
  const legacy = makeStorage();
  legacy.setItem(sessionKey(identity), '{broken');
  const api = await browserStorage(t, legacy);
  await assert.rejects(api.loadBrowserSession(identity), /invalid JSON/);
  assert.equal(legacy.getItem(sessionKey(identity)), '{broken');
  await api.resetBrowserSession(identity);
  assert.equal(await api.loadBrowserSession(identity), null);
});

test('default two-floor scene is portable, self-contained and uses demonstration identities', async () => {
  const data = await readFile(new URL('../demo/ui-lab/default-plan/fixture.json', import.meta.url), 'utf8');
  const scene = JSON.parse(data);
  assert.deepEqual(scene.config.spaces.map(s => s.title), ['Ground floor', '2nd floor']);
  assert.equal(scene.config.spaces.reduce((count, s) => count + s.rooms.length, 0), 16);
  assert.equal(scene.config.markers.length, 195);
  assert.ok(Object.keys(scene.devices).every(id => id.startsWith('lab_')));
  assert.ok(Object.keys(scene.entities).every(id => /^[a-z_]+\.lab_/.test(id)));
  assert.ok(scene.config.markers.every(m => m.binding === 'virtual' || /^(device:lab_|entity:[a-z_]+\.lab_)/.test(m.binding)));
  assert.doesNotMatch(data, /https?:\/\/|0x[0-9a-f]{16}|192\.168\.|access_token|api_key/i);
  for (const [id, entity] of Object.entries(scene.entities)) {
    assert.equal(entity.entity_id, id);
    if (entity.device_id) assert.ok(scene.devices[entity.device_id], id);
  }
  for (const position of Object.values(scene.layout)) assert.ok(scene.config.spaces.some(s => s.id === position.s));
  for (const asset of scene.assets) {
    const bytes = await readFile(new URL(`../demo/ui-lab/default-plan/assets/${asset.asset_id}.png`, import.meta.url));
    const { createHash } = await import('node:crypto');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.asset_id);
  }
  parseSession(serializeSession(identity, { config: scene.config, layout: scene.layout, states: scene.states, virtualLightsOff: scene.virtualLightsOff }), identity);
});

function fakeWindow() {
  const events = new Map(), requests = [], opens = [], xhr = [];
  class Xhr { open(...args) { xhr.push(args); } }
  const win = {
    location: { href: 'http://localhost:8891/', origin: 'http://localhost:8891' },
    fetch: (...args) => { requests.push(args); return Promise.resolve('ok'); },
    open: (...args) => { opens.push(args); return 'window'; },
    XMLHttpRequest: Xhr, navigator: { serviceWorker: { register: () => Promise.resolve('worker') } },
    document: { addEventListener: (name, fn) => events.set(name, fn) }, addEventListener() {},
  };
  return { win, events, requests, opens, xhr };
}

test('network isolation allows only local static reads and blocks writes and transports', async () => {
  const { win, requests, xhr } = fakeWindow();
  const safety = installNetworkGuard(win);
  assert.equal(await win.fetch('/fixture.json'), 'ok');
  assert.equal(await win.fetch('/assets/houseplan-panel.js', { method: 'HEAD' }), 'ok');
  for (const [url, options] of [['https://example.test/api'], ['//other.test/a'], ['data:text/plain,hi'], ['/api', { method: 'POST' }]]) {
    await assert.rejects(win.fetch(url, options));
  }
  await assert.rejects(win.fetch({ url: 'http://localhost:8891/api', method: 'PUT' }));
  assert.equal(requests.length, 2);
  new win.XMLHttpRequest().open('GET', '/fixture.json');
  assert.throws(() => new win.XMLHttpRequest().open('GET', 'https://example.test/api'));
  assert.throws(() => new win.XMLHttpRequest().open('POST', '/api'));
  assert.equal(xhr.length, 1);
  assert.throws(() => new win.WebSocket('ws://localhost:8891/api'));
  assert.throws(() => new win.EventSource('/events'));
  assert.equal(win.navigator.sendBeacon('https://example.test', 'data'), false);
  await assert.rejects(win.navigator.serviceWorker.register('/worker.js'));
  assert.ok(safety.blocked.length >= 10);
});

test('external and javascript navigation is blocked, local JSON download remains usable', () => {
  const { win, events, opens } = fakeWindow();
  installNetworkGuard(win);
  assert.equal(win.open('https://example.test/'), null);
  assert.equal(win.open('javascript:alert(1)'), null);
  assert.equal(win.open('/'), 'window');
  assert.equal(opens.length, 1);
  const click = (href, download = '') => {
    let prevented = false;
    events.get('click')({ composedPath: () => [{ tagName: 'A', href, download }], preventDefault: () => { prevented = true; } });
    return prevented;
  };
  assert.equal(click('https://example.test/'), true);
  assert.equal(click('javascript:alert(1)'), true);
  assert.equal(click('blob:http://localhost:8891/session', 'session.json'), false);
  assert.equal(click('blob:https://example.test/session', 'session.json'), true);
  assert.equal(click('http://localhost:8891/'), false);
});
