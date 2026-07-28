import test from 'node:test';
import assert from 'node:assert/strict';
import { ContentSigner, SIGN_INFLIGHT_MS, SIGN_BACKOFF_MIN_MS } from '../test-build/signing.js';
import { SIGN_TTL_MS, SIGN_REFRESH_MS } from '../test-build/logic.js';

const URL_A = '/api/houseplan/content/plans/_/f1.tok.svg';
const URL_B = '/api/houseplan/content/files/m1/manual.pdf';
const tick = () => new Promise((r) => setTimeout(r, 45)); // > the 30 ms batch timer

/** hass whose sign call is resolved/rejected by hand. */
function makeHass() {
  const calls = [];
  const hass = {
    callWS(m) {
      let settle;
      const p = new Promise((res, rej) => { settle = { res, rej }; });
      calls.push({ paths: m.paths, ...settle });
      return p;
    },
  };
  return { hass, calls };
}

function signer(now = () => Date.now()) {
  let updates = 0;
  const s = new ContentSigner(() => { updates++; }, now);
  return { s, updates: () => updates };
}

test('R4-2: renders during one unresolved request do not multiply it', async () => {
  const { hass, calls } = makeHass();
  const { s } = signer();
  for (let i = 0; i < 6; i++) assert.equal(s.display(hass, URL_A), '');
  await tick();
  assert.equal(calls.length, 1, 'one batched request');
  // more renders while it is still in flight
  for (let i = 0; i < 5; i++) s.display(hass, URL_A);
  await tick();
  assert.equal(calls.length, 1, 'still one: the url is in flight');
  assert.deepEqual(s.inFlightUrls, [URL_A]);

  calls[0].res({ urls: { [URL_A]: URL_A + '?authSig=OK' } });
  await tick();
  assert.equal(s.display(hass, URL_A), URL_A + '?authSig=OK');
  assert.equal(calls.length, 1, 'a resolved signature starts no extra request');
  assert.deepEqual(s.inFlightUrls, []);
});

test('R4-2: a rejection frees the url but backs off before retrying', async () => {
  let t = 1_000_000;
  const { hass, calls } = makeHass();
  const { s } = signer(() => t);
  s.display(hass, URL_A);
  await tick();
  calls[0].rej(new Error('socket'));
  await tick();
  assert.deepEqual(s.inFlightUrls, [], 'released, not wedged');

  s.display(hass, URL_A);
  await tick();
  assert.equal(calls.length, 1, 'the very next render must not retry');

  t += SIGN_BACKOFF_MIN_MS + 1;
  s.display(hass, URL_A);
  await tick();
  assert.equal(calls.length, 2, 'retried once the backoff has passed');

  // the second failure waits longer than the first
  calls[1].rej(new Error('socket'));
  await tick();
  t += SIGN_BACKOFF_MIN_MS + 1;
  s.display(hass, URL_A);
  await tick();
  assert.equal(calls.length, 2, 'backoff doubled');
  t += SIGN_BACKOFF_MIN_MS * 2;
  s.display(hass, URL_A);
  await tick();
  assert.equal(calls.length, 3);

  calls[2].res({ urls: { [URL_A]: URL_A + '?authSig=OK' } });
  await tick();
  assert.equal(s.display(hass, URL_A), URL_A + '?authSig=OK');
});

test('R4-2: a request that never settles stops blocking after the timeout', async () => {
  let t = 1_000_000;
  const { hass, calls } = makeHass();
  const { s } = signer(() => t);
  s.display(hass, URL_A);
  await tick();
  assert.equal(calls.length, 1);

  t += SIGN_INFLIGHT_MS - 1;
  s.display(hass, URL_A);
  await tick();
  assert.equal(calls.length, 1, 'still presumed in flight');

  t += 2;
  s.display(hass, URL_A);
  await tick();
  assert.equal(calls.length, 2, 'presumed lost — asked again');

  // the FIRST promise finally answers: it must not resurrect a stale in-flight
  calls[0].res({ urls: { [URL_A]: URL_A + '?authSig=LATE' } });
  await tick();
  assert.deepEqual(s.inFlightUrls, [URL_A], 'only the second attempt is in flight');
});

test('signatures age: fresh, aging, expired', async () => {
  let t = 1_000_000;
  const { hass, calls } = makeHass();
  const { s } = signer(() => t);
  s.display(hass, URL_A);
  await tick();
  calls[0].res({ urls: { [URL_A]: URL_A + '?authSig=ONE' } });
  await tick();

  assert.equal(s.display(hass, URL_A), URL_A + '?authSig=ONE');
  assert.equal(calls.length, 1, 'a fresh signature asks for nothing');

  t += SIGN_REFRESH_MS + 1; // aging: keep rendering, fetch a replacement
  assert.equal(s.display(hass, URL_A), URL_A + '?authSig=ONE');
  await tick();
  assert.equal(calls.length, 2);

  t += SIGN_TTL_MS; // expired: rendering it would 401
  assert.equal(s.display(hass, URL_A), '');
  assert.equal(s.entries[URL_A], undefined, 'the dead entry is dropped');
});

test('a non-content url is passed straight through, nothing is signed', async () => {
  const { hass, calls } = makeHass();
  const { s } = signer();
  assert.equal(s.display(hass, '/local/plan.png'), '/local/plan.png');
  assert.equal(s.display(hass, ''), '');
  assert.equal(s.display(hass, null), '');
  await tick();
  assert.equal(calls.length, 0);
});

test('legacy urls are normalised before signing', async () => {
  const { hass, calls } = makeHass();
  const { s } = signer();
  s.display(hass, '/houseplan_files/plans/f1.svg');
  await tick();
  assert.deepEqual(calls[0].paths, ['/api/houseplan/content/plans/_/f1.svg']);
});

test('resign prunes to the referenced set and gives everything a fresh chance', async () => {
  let t = 1_000_000;
  const { hass, calls } = makeHass();
  const { s } = signer(() => t);
  s.display(hass, URL_A);
  s.display(hass, URL_B);
  await tick();
  calls[0].res({ urls: { [URL_A]: URL_A + '?s=1', [URL_B]: URL_B + '?s=1' } });
  await tick();
  assert.equal(Object.keys(s.entries).length, 2);

  s.resign(hass, new Set([URL_A]));
  await tick();
  assert.deepEqual(Object.keys(s.entries), [URL_A], 'the unreferenced url is dropped');
  assert.deepEqual(calls[1].paths, [URL_A]);
});

test('dispose(): a late answer neither renders nor throws, start() revives it', async () => {
  const { hass, calls } = makeHass();
  const { s, updates } = signer();
  s.display(hass, URL_A);
  await tick();
  s.dispose();
  calls[0].res({ urls: { [URL_A]: URL_A + '?authSig=LATE' } });
  await tick();
  assert.equal(updates(), 0, 'no re-render after teardown');

  s.start(() => hass, () => new Set([URL_A]));
  s.display(hass, URL_A);
  await tick();
  assert.equal(calls.length, 2, 'a reconnected card asks again');
  calls[1].res({ urls: { [URL_A]: URL_A + '?authSig=NEW' } });
  await tick();
  assert.equal(updates(), 1);
  assert.equal(s.display(hass, URL_A), URL_A + '?authSig=NEW');
  s.dispose();
});

test('R5-1: an empty but successful answer still backs off', async () => {
  let t = 1_000_000;
  const { hass, calls } = makeHass();
  const { s, updates } = signer(() => t);
  s.display(hass, URL_A);
  await tick();
  calls[0].res({ urls: {} }); // the backend skipped the path it could not sign
  await tick();
  assert.equal(updates(), 0, 'nothing was signed, so nothing to re-render for');

  for (let i = 0; i < 5; i++) { s.display(hass, URL_A); await tick(); }
  assert.equal(calls.length, 1, 'five renders, still one request');

  t += SIGN_BACKOFF_MIN_MS + 1;
  s.display(hass, URL_A);
  await tick();
  assert.equal(calls.length, 2, 'retried after the backoff');
});

test('R5-1: a partial answer backs off only the path that is missing', async () => {
  let t = 1_000_000;
  const { hass, calls } = makeHass();
  const { s } = signer(() => t);
  s.display(hass, URL_A);
  s.display(hass, URL_B);
  await tick();
  assert.deepEqual(calls[0].paths.sort(), [URL_B, URL_A].sort());

  calls[0].res({ urls: { [URL_A]: URL_A + '?authSig=OK' } }); // B was skipped
  await tick();
  assert.equal(s.display(hass, URL_A), URL_A + '?authSig=OK');
  assert.equal(s.display(hass, URL_B), '');
  await tick();
  assert.equal(calls.length, 1, 'the missing path is in backoff, not re-asked');

  t += SIGN_BACKOFF_MIN_MS + 1;
  s.display(hass, URL_A);
  s.display(hass, URL_B);
  await tick();
  assert.deepEqual(calls[1].paths, [URL_B], 'only the missing path is retried');

  calls[1].res({ urls: { [URL_B]: URL_B + '?authSig=OK' } });
  await tick();
  assert.equal(s.display(hass, URL_B), URL_B + '?authSig=OK');
  t += SIGN_BACKOFF_MIN_MS * 8;
  s.display(hass, URL_B);
  await tick();
  assert.equal(calls.length, 2, 'a success clears the backoff state, no stray retry');
});

test('R5-1: a key we never asked for is ignored', async () => {
  const { hass, calls } = makeHass();
  const { s } = signer();
  s.display(hass, URL_A);
  await tick();
  calls[0].res({ urls: { [URL_A]: URL_A + '?authSig=OK', '/api/houseplan/content/files/x/evil.pdf': 'nope' } });
  await tick();
  assert.deepEqual(Object.keys(s.entries), [URL_A]);
});
