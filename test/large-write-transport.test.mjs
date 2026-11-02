/** Transport fakes prove framing/fences only; server ACL/CAS/durability need real HA. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sendHouseplanWrite, WS_DIRECT_LIMIT_BYTES, STRUCTURAL_UPLOAD_LIMIT_BYTES, STRUCTURAL_UPLOAD_PATH,
} from '../test-build/large-write-transport.js';

const TYPE = 'houseplan/config/set', DIGEST = 'a'.repeat(64);
const purposes = [
  TYPE, 'houseplan/plan/optimize', 'houseplan/plan/optimize_undo',
  'houseplan/wall/node_move', 'houseplan/wall/node_delete', 'houseplan/marker/copy',
  'houseplan/marker/history', 'houseplan/layout/set', 'houseplan/layout/update',
];
const live = { isCurrent: () => true };
const reply = purpose => ({ token: 'opaque-owned-once', sha256: DIGEST, purpose, expires_at: new Date(Date.now() + 120000).toISOString() });
const response = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
function atBytes(size, extra = {}, char = 'x') {
  const message = { type: TYPE, ...extra, padding: '' }, remaining = size - Buffer.byteLength(JSON.stringify(message));
  assert.ok(remaining >= 0);
  const width = Buffer.byteLength(char);
  message.padding = char.repeat(Math.floor(remaining / width)) + 'x'.repeat(remaining % width);
  assert.equal(Buffer.byteLength(JSON.stringify(message)), size);
  return message;
}
const large = extra => atBytes(WS_DIRECT_LIMIT_BYTES + 1, extra);
function fake() {
  const calls = { ws: [], upload: [] }, result = { config_rev: 12, unchanged: true };
  const hass = {
    connection: {}, user: { id: 'owner' },
    async callWS(message) { assert.equal(this, hass); calls.ws.push(message); return result; },
    async fetchWithAuth(path, init) {
      assert.equal(this, hass); calls.upload.push({ path, init });
      return response(reply(JSON.parse(init.body).type));
    },
  };
  return { hass, calls, result };
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const isCode = code => failure => failure?.code === code;

test('small write keeps same WS command/result and drops only its transport id', async () => {
  const { hass, calls, result } = fake();
  const message = { id: 999, type: TYPE, config: { name: 'Дом' }, expected_rev: 11 };
  assert.equal(await sendHouseplanWrite(hass, message, live), result);
  assert.deepEqual(calls.ws, [{ type: TYPE, config: { name: 'Дом' }, expected_rev: 11 }]);
  assert.equal(calls.upload.length, 0);
  assert.equal(message.id, 999, 'input is not mutated');
});

test('exact 3 MiB UTF-8 boundary is direct; a byte above uploads even for short Cyrillic strings', async () => {
  for (const char of ['x', 'я']) for (const extra of [0, 1]) {
    const { hass, calls } = fake(), message = atBytes(WS_DIRECT_LIMIT_BYTES + extra, {}, char);
    if (char === 'я') assert.ok(JSON.stringify(message).length < WS_DIRECT_LIMIT_BYTES);
    await sendHouseplanWrite(hass, message, live);
    assert.equal(calls.upload.length, extra);
    assert.equal(calls.ws.length, 1);
    if (extra) assert.equal(Buffer.byteLength(calls.upload[0].init.body), WS_DIRECT_LIMIT_BYTES + 1);
  }
});

test('large write uploads full detached JSON to fixed auth route and commits only token/type/exact controls', async () => {
  const { hass, calls, result } = fake();
  const message = large({
    action: 'apply', direction: 'undo', space_id: 'floor-2',
    expected_rev: 7, expected_config_rev: 8, expected_layout_rev: 9,
    config: { graph: 'private-synthetic' }, before_space: { geometry: 'snapshot' },
  });
  message.id = 901;
  assert.equal(await sendHouseplanWrite(hass, message, live), result);
  const { path, init } = calls.upload[0];
  assert.equal(path, STRUCTURAL_UPLOAD_PATH);
  assert.equal(path, '/api/houseplan/structural/upload');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['content-type'], 'application/json');
  assert.equal(init.headers.authorization, undefined);
  const uploaded = JSON.parse(init.body), { id, ...expected } = message;
  assert.deepEqual(uploaded, expected);
  assert.deepEqual(calls.ws, [{
    type: TYPE, upload_token: 'opaque-owned-once', upload_sha256: DIGEST,
    expected_rev: 7, expected_config_rev: 8, expected_layout_rev: 9,
    direction: 'undo', action: 'apply', space_id: 'floor-2',
  }]);
  assert.equal(message.config.graph, 'private-synthetic');
});

test('all nine supported large writer purposes retain the same registered command', async () => {
  for (const type of purposes) {
    const { hass, calls } = fake();
    await sendHouseplanWrite(hass, large({ type, action: 'apply', direction: 'redo' }), live);
    assert.equal(JSON.parse(calls.upload[0].init.body).type, type);
    assert.equal(calls.ws[0].type, type);
    assert.equal(calls.ws[0].direction, 'redo');
    assert.equal(calls.ws[0].action, 'apply');
  }
});

test('unknown purposes, already-staged references and non-JSON payloads fail before any network', async () => {
  for (const message of [
    { type: 'houseplan/marker/history/retain' }, { type: 'light/turn_on' },
    { type: TYPE, upload_token: 'foreign' }, { type: TYPE, upload_sha256: DIGEST },
    { type: TYPE, value: 1n }, Object.assign({ type: TYPE }, { toJSON() { return null; } }),
  ]) {
    const { hass, calls } = fake();
    await assert.rejects(sendHouseplanWrite(hass, message, live), isCode('invalid_payload'));
    assert.equal(calls.upload.length + calls.ws.length, 0);
  }
});

test('32 MiB complete JSON is allowed; byte over limit is refused before HTTP or WS', async () => {
  for (const excess of [0, 1]) {
    const { hass, calls } = fake(), message = atBytes(STRUCTURAL_UPLOAD_LIMIT_BYTES + excess);
    if (excess) await assert.rejects(sendHouseplanWrite(hass, message, live), isCode('too_large'));
    else await sendHouseplanWrite(hass, message, live);
    assert.equal(calls.upload.length, excess ? 0 : 1);
    assert.equal(calls.ws.length, excess ? 0 : 1);
  }
});

test('upload reply purpose/digest/token/UTC expiry must be valid before any compact commit', async () => {
  for (const change of [
    { purpose: 'houseplan/plan/optimize' }, { sha256: 'not-a-digest' }, { token: '' },
    { token: 'x'.repeat(513) }, { expires_at: 'not-an-ISO-date' },
    { expires_at: new Date(Date.now() - 1000).toISOString() },
  ]) {
    const { hass, calls } = fake();
    hass.fetchWithAuth = async () => response({ ...reply(TYPE), ...change });
    await assert.rejects(sendHouseplanWrite(hass, large(), live), failure => ['invalid_upload', 'upload_expired'].includes(failure.code));
    assert.equal(calls.ws.length, 0);
  }
  const { hass, calls } = fake();
  hass.fetchWithAuth = async () => response({ ...reply(TYPE), expires_at: reply(TYPE).expires_at.replace('Z', '+00:00') });
  await sendHouseplanWrite(hass, large(), live);
  assert.equal(calls.ws.length, 1);
});

test('large transport works without crypto.subtle and never reads a raw access token', async t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });
  t.after(() => previous ? Object.defineProperty(globalThis, 'crypto', previous) : delete globalThis.crypto);
  const { hass, calls } = fake();
  Object.defineProperty(hass, 'auth', { get() { throw Error('raw auth must not be read'); } });
  await sendHouseplanWrite(hass, large(), live);
  assert.equal(calls.ws[0].upload_sha256, DIGEST, 'server digest is echoed, not invented by the client');
});

test('callApi fallback uses HA JSON/auth API and a detached payload; missing auth API never falls back to oversized WS', async () => {
  const { hass, calls } = fake(), api = [];
  delete hass.fetchWithAuth;
  hass.callApi = async function(method, path, payload) {
    assert.equal(this, hass); api.push({ method, path, payload }); return reply(payload.type);
  };
  Object.defineProperty(hass, 'auth', { get() { throw Error('no bearer fallback'); } });
  const message = large();
  await sendHouseplanWrite(hass, message, live);
  assert.equal(api[0].method, 'POST');
  assert.equal(api[0].path, 'houseplan/structural/upload');
  assert.deepEqual(api[0].payload, message);
  assert.notEqual(api[0].payload, message);
  assert.equal(calls.ws.length, 1);
  delete hass.callApi;
  await assert.rejects(sendHouseplanWrite(hass, large(), live), isCode('upload_unavailable'));
  assert.equal(calls.ws.length, 1, 'no second/large WS request');
});

test('HTTP auth/resource/domain/parse errors do not send a WS commit or retry', async () => {
  for (const [status, data, code] of [
    [401, { error: 'anything' }, 'unauthorized'], [403, {}, 'unauthorized'],
    [413, {}, 'too_large'], [409, { error: 'structural_upload_busy' }, 'structural_upload_busy'],
    [404, {}, 'upload_unavailable'],
  ]) {
    const { hass, calls } = fake();
    hass.fetchWithAuth = async () => response(data, status);
    await assert.rejects(sendHouseplanWrite(hass, large(), live), isCode(code));
    assert.equal(calls.ws.length, 0);
  }
  const { hass, calls } = fake();
  hass.fetchWithAuth = async () => new Response('not-json', { status: 500 });
  await assert.rejects(sendHouseplanWrite(hass, large(), live), isCode('upload_failed'));
  assert.equal(calls.ws.length, 0);
});

test('connection, user and live-generation changes during upload never reach WS commit', async () => {
  for (const change of ['connection', 'user', 'generation']) {
    const { hass, calls } = fake(), upload = deferred();
    let current = true;
    hass.fetchWithAuth = () => upload.promise;
    const pending = sendHouseplanWrite(hass, large(), { isCurrent: () => current });
    if (change === 'connection') hass.connection = {};
    if (change === 'user') hass.user.id = 'foreign';
    if (change === 'generation') current = false;
    upload.resolve(response(reply(TYPE)));
    await assert.rejects(pending, isCode('context-changed'));
    assert.equal(calls.ws.length, 0);
  }
});

test('stale JSON response and caller mutation cannot substitute the upload purpose or CAS', async () => {
  const { hass, calls } = fake(), json = deferred();
  let current = true;
  hass.fetchWithAuth = async () => ({ ok: true, status: 200, json: () => json.promise });
  const stale = sendHouseplanWrite(hass, large(), { isCurrent: () => current });
  await tick(); current = false; json.resolve(reply(TYPE));
  await assert.rejects(stale, isCode('context-changed'));
  assert.equal(calls.ws.length, 0);

  const other = fake(), upload = deferred(), message = large({ expected_rev: 11, direction: 'undo' });
  other.hass.fetchWithAuth = () => upload.promise;
  const pending = sendHouseplanWrite(other.hass, message, live);
  message.expected_rev = 999; message.type = 'houseplan/plan/optimize'; message.direction = 'redo';
  upload.resolve(response(reply(TYPE)));
  await pending;
  assert.equal(other.calls.ws[0].type, TYPE);
  assert.equal(other.calls.ws[0].expected_rev, 11);
  assert.equal(other.calls.ws[0].direction, 'undo');
});

test('small and staged WS responses/errors are fenced; current server errors keep their identity', async () => {
  for (const message of [{ type: TYPE }, large()]) {
    const { hass } = fake(), ws = deferred();
    hass.callWS = () => ws.promise;
    const pending = sendHouseplanWrite(hass, message, live);
    await tick(); hass.user.id = 'foreign'; ws.resolve({ config_rev: 'foreign-response' });
    await assert.rejects(pending, isCode('context-changed'));
  }
  const { hass } = fake(), refusal = { code: 'revision_conflict', message: 'unchanged server error' };
  hass.callWS = async () => { throw refusal; };
  await assert.rejects(sendHouseplanWrite(hass, { type: TYPE }, live), failure => failure === refusal);
  const deferredWS = deferred();
  hass.callWS = () => deferredWS.promise;
  const pending = sendHouseplanWrite(hass, { type: TYPE }, live);
  hass.connection = {}; deferredWS.reject(refusal);
  await assert.rejects(pending, isCode('context-changed'));
});

test('abort before send or during HTTP/WS cannot adopt a response or replay a commit', async () => {
  const initial = fake(), already = new AbortController(); already.abort();
  await assert.rejects(sendHouseplanWrite(initial.hass, { type: TYPE }, { ...live, signal: already.signal }), { name: 'AbortError' });
  assert.equal(initial.calls.ws.length + initial.calls.upload.length, 0);
  const { hass, calls } = fake(), controller = new AbortController(), upload = deferred();
  hass.fetchWithAuth = (path, init) => { assert.equal(init.signal, controller.signal); return upload.promise; };
  const pending = sendHouseplanWrite(hass, large(), { ...live, signal: controller.signal });
  controller.abort(); upload.resolve(response(reply(TYPE)));
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(calls.ws.length, 0);
  const after = fake(), ws = deferred(), abortWS = new AbortController();
  after.hass.callWS = () => ws.promise;
  const final = sendHouseplanWrite(after.hass, { type: TYPE }, { ...live, signal: abortWS.signal });
  abortWS.abort(); ws.resolve({});
  await assert.rejects(final, { name: 'AbortError' });
});

test('callApi completion/rejection is also fenced and never logs/adopts an old auth error', async () => {
  const { hass, calls } = fake(), api = deferred();
  delete hass.fetchWithAuth; hass.callApi = () => api.promise;
  let generation = true;
  const pending = sendHouseplanWrite(hass, large(), { isCurrent: () => generation });
  generation = false; api.reject({ status_code: 403, body: { error: 'unauthorized' } });
  await assert.rejects(pending, isCode('context-changed'));
  assert.equal(calls.ws.length, 0);
  hass.callApi = async () => { throw { status_code: 409, body: { error: 'structural_upload_busy' } }; };
  await assert.rejects(sendHouseplanWrite(hass, large(), live), isCode('structural_upload_busy'));
});

test('a malformed oversized control field cannot re-expand the compact token into an oversized WS frame', async () => {
  const { hass, calls } = fake();
  const message = { type: TYPE, space_id: 'x'.repeat(WS_DIRECT_LIMIT_BYTES), before_space: {} };
  await assert.rejects(sendHouseplanWrite(hass, message, live), isCode('too_large'));
  assert.equal(calls.upload.length, 1);
  assert.equal(calls.ws.length, 0, 'no fallback or over-limit token frame');
});
