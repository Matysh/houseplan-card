import test from 'node:test';
import assert from 'node:assert/strict';
import { HaPlanHost, haPlanHost } from '../test-build/ha-plan-host.js';
import { hostAuthorityKey, once } from '../test-build/plan-host.js';

const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const source = (extra = {}) => ({ user: { id: 'a', is_admin: true }, states: {}, callWS: async () => ({}), ...extra });
const command = { type: 'houseplan/config/get' };

test('#1392 opaque authority keeps original transport/user identity and multi-card reuse', () => {
  const connection = {}, fallback = {};
  assert.equal(hostAuthorityKey(connection, 'a', fallback), hostAuthorityKey(connection, 'a', {}));
  assert.notEqual(hostAuthorityKey(connection, 'a', fallback), hostAuthorityKey(connection, 'b', fallback));
  const callWS = async () => ({});
  assert.equal(new HaPlanHost(source({ callWS })).authorityKey, new HaPlanHost(source({ callWS })).authorityKey);
});

test('#1392 ordinary ticks retain write authority and lend state/registry rows', async () => {
  const pending = deferred(), callWS = () => pending.promise, states = {};
  const host = new HaPlanHost(source({ callWS, states }));
  const key = host.authorityKey, write = host.writeAuthorityRevision, revision = host.environmentRevision;
  const response = host.request(command);
  host.update(source({ callWS, states }));
  assert.equal(host.authorityKey, key);
  assert.equal(host.writeAuthorityRevision, write);
  assert.ok(host.environmentRevision > revision);
  assert.equal(host.environment.states, states);
  assert.equal(host.environment.registry.authoritative, false);
  pending.resolve({ config: {} });
  assert.deepEqual(await response, { config: {} });
});

for (const kind of ['connection', 'user', 'permissions']) test(`#1392 ${kind} A→B→A cannot revive an awaited response`, async () => {
  const pending = deferred(), a = {}, b = {}, raw = source({ connection: a, callWS: () => pending.promise });
  const host = new HaPlanHost(raw), result = host.request(command), initial = host.authorityKey;
  if (kind === 'connection') raw.connection = b;
  if (kind === 'user') raw.user.id = 'b';
  if (kind === 'permissions') raw.user.is_admin = false;
  host.update(raw);
  if (kind === 'connection') raw.connection = a;
  if (kind === 'user') raw.user.id = 'a';
  if (kind === 'permissions') raw.user.is_admin = true;
  host.update(raw);
  assert.equal(host.authorityKey, initial);
  pending.resolve({ config: {} });
  await assert.rejects(result, { code: 'context-changed' });
});

test('#1392 presentation bridge has only four read-only fields, never auth or transport', () => {
  const raw = source({ language: 'en', auth: { data: { access_token: 'private-fixture' } }, connection: {},
    localize(key) { assert.equal(this, raw); return key; } });
  const host = new HaPlanHost(raw), bridge = host.environment.presentation;
  assert.deepEqual(Object.keys(bridge).sort(), ['language', 'locale', 'localize', 'themes']);
  for (const key of ['states', 'user', 'connection', 'callWS', 'callService', 'fetchWithAuth', 'auth']) assert.equal(key in bridge, false);
  assert.equal(Object.isFrozen(bridge), true);
  assert.equal(bridge.localize('key'), 'key');
  assert.ok(!JSON.stringify(host.environment).includes('private-fixture'));
});

test('#1392 environment leases are independent and idempotent for the same callback', () => {
  const raw = source(), host = new HaPlanHost(raw); let calls = 0;
  const receive = () => { calls++; }, one = host.subscribeEnvironment(receive), two = host.subscribeEnvironment(receive);
  host.update(raw); assert.equal(calls, 2);
  one(); one(); host.update(raw); assert.equal(calls, 3);
  two(); host.update(raw); assert.equal(calls, 3);
});

test('#1392 a same-connection reconnect is not a foreign authority, but offline dispatch is refused', async () => {
  let calls = 0; const connection = { connected: true }, raw = source({ connection, callWS: async () => { calls++; return {}; } });
  const host = new HaPlanHost(raw), key = host.authorityKey, revision = host.writeAuthorityRevision;
  connection.connected = false; host.update(raw);
  await assert.rejects(host.request(command), { code: 'not_ready' });
  connection.connected = true; host.update(raw);
  assert.equal(host.authorityKey, key); assert.equal(host.writeAuthorityRevision, revision);
  await host.request(command); assert.equal(calls, 1);
});

test('#1392 an obsolete asynchronous subscription is released and cannot deliver A→B→A data', async () => {
  const pending = deferred(); let forward, removes = 0, deliveries = 0;
  const connection = { subscribeEvents(receive) { forward = receive; return pending.promise; } };
  const raw = source({ connection }), host = new HaPlanHost(raw);
  const result = host.subscribe('houseplan_layout_updated', () => { deliveries++; });
  raw.connection = {}; host.update(raw); raw.connection = connection; host.update(raw);
  forward({ data: { rev: 3 } }); assert.equal(deliveries, 0);
  pending.resolve(() => { removes++; });
  await assert.rejects(result, { code: 'context-changed' });
  assert.equal(removes, 1);
});

test('#1392 an adopted subscription disposer retires callbacks exactly once', async () => {
  let forward, removes = 0, deliveries = 0;
  const connection = { subscribeEvents: async receive => { forward = receive; return () => { removes++; }; } };
  const host = new HaPlanHost(source({ connection }));
  const release = await host.subscribe('houseplan_layout_updated', () => { deliveries++; });
  forward({ data: {} }); release(); release(); forward({ data: {} });
  assert.equal(removes, 1); assert.equal(deliveries, 1);
});

test('#1392 authenticated JSON keeps HA receiver and structured HTTP errors', async () => {
  const raw = source({ async fetchWithAuth(path, init) {
    assert.equal(this, raw); assert.equal(path, '/api/houseplan/structural/upload');
    assert.equal(JSON.parse(init.body).type, command.type);
    return new Response('not JSON', { status: 413 });
  } });
  await assert.rejects(new HaPlanHost(raw).http.postJson('/api/houseplan/structural/upload', command), { code: 'too_large' });
});

test('#1392 JSON fallback stays authenticated callApi, not raw bearer fetch', async () => {
  const raw = source({ async callApi(method, path, value) {
    assert.equal(this, raw); assert.equal(method, 'POST');
    assert.equal(path, 'houseplan/structural/upload'); assert.deepEqual(value, command);
    return { token: 'fixture' };
  } });
  assert.deepEqual(await new HaPlanHost(raw).http.postJson('/api/houseplan/structural/upload', command), { token: 'fixture' });
  await assert.rejects(new HaPlanHost(source()).http.postJson('/api/houseplan/structural/upload', command), { code: 'upload_unavailable' });
});

test('#1392 file-upload bearer fallback is private and refuses foreign HTTP paths', async t => {
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async (path, init) => {
    requests++; assert.equal(path, '/api/houseplan/upload');
    assert.equal(init.headers.get('authorization'), 'Bearer private-fixture');
    return new Response('{}');
  });
  const host = new HaPlanHost(source({ auth: { data: { access_token: 'private-fixture' } } }));
  await host.http.request('/api/houseplan/upload', { method: 'POST' });
  await assert.rejects(host.http.request('https://foreign.invalid/upload'), { code: 'invalid_payload' });
  await assert.rejects(host.http.request('/api/houseplan/../../auth'), { code: 'invalid_payload' });
  assert.equal(requests, 1);
});

test('#1392 callApi cancellation cannot yield a successful upload result', async () => {
  const pending = deferred(), controller = new AbortController(); let calls = 0;
  const host = new HaPlanHost(source({ callApi() { calls++; return pending.promise; } }));
  const result = host.http.postJson('/api/houseplan/structural/upload', command, controller.signal);
  controller.abort(); pending.resolve({ token: 'fixture' });
  await assert.rejects(result, { name: 'AbortError' });
  await assert.rejects(host.http.postJson('/api/houseplan/structural/upload', command, controller.signal), { name: 'AbortError' });
  assert.equal(calls, 1);
});

test('#1392 compatibility lookups synchronize changed state without duplicate no-op ticks', () => {
  const raw = source(), host = haPlanHost(raw), revision = host.environmentRevision;
  assert.equal(haPlanHost(raw), host); assert.equal(host.environmentRevision, revision);
  raw.states = { 'light.fixture': { state: 'on', attributes: {} } };
  assert.equal(haPlanHost(raw).environment.states, raw.states);
  assert.equal(host.environmentRevision, revision + 1);
});

test('#1392 once retires its lease even if transport cleanup throws', () => {
  let calls = 0; const release = once(() => { calls++; throw new Error('cleanup'); });
  assert.throws(release, /cleanup/); release(); assert.equal(calls, 1);
});
