import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
