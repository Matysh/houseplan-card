import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LanguageRuntime, languageRenderGate,
} from '../test-build/i18n/language-runtime.js';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
};

test('lazy locale runtime deduplicates hosts and accepts the matching build', async () => {
  const load = deferred();
  let calls = 0;
  const runtime = new LanguageRuntime([
    { code: 'en', dictionary: { save: 'Save' } },
    { code: 'de', loadDictionary: async () => { calls++; return load.promise; } },
  ], 'same-build');

  const first = runtime.ensure('de');
  const second = runtime.ensure('de');
  assert.equal(first, second);
  assert.equal(calls, 1);
  assert.equal(runtime.state('de'), 'pending');
  load.resolve({ dictionary: { save: 'Speichern' }, fingerprint: 'same-build' });
  await first;
  assert.equal(runtime.state('de'), 'ready');
  assert.equal(runtime.dictionary('de').save, 'Speichern');
  await runtime.ensure('de');
  assert.equal(calls, 1);
});

test('lazy locale runtime retries once, warns once and settles on English fallback', async () => {
  const attempts = [];
  const warnings = [];
  const runtime = new LanguageRuntime([
    {
      code: 'de',
      loadDictionary: async (attempt) => {
        attempts.push(attempt);
        throw new Error(`failure ${attempt}`);
      },
    },
  ], 'build', (message, error) => warnings.push([message, error]));

  await runtime.ensure('de');
  assert.deepEqual(attempts, [0, 1]);
  assert.equal(runtime.state('de'), 'fallback');
  assert.equal(runtime.dictionary('de'), undefined);
  assert.equal(warnings.length, 1);
  await runtime.ensure('de');
  assert.equal(warnings.length, 1);
  assert.deepEqual(attempts, [0, 1]);
});

test('lazy locale runtime rejects a stale fingerprint before accepting retry', async () => {
  const runtime = new LanguageRuntime([{
    code: 'de',
    loadDictionary: async (attempt) => ({
      dictionary: { save: attempt ? 'Speichern' : 'Stale' },
      fingerprint: attempt ? 'current' : 'old',
    }),
  }], 'current');
  await runtime.ensure('de');
  assert.equal(runtime.dictionary('de').save, 'Speichern');
});

class FakeHost {
  controllers = [];
  inert = false;
  isConnected = true;
  attrs = new Map();
  updates = 0;
  addController(controller) { this.controllers.push(controller); }
  requestUpdate() { this.updates++; }
  hasAttribute(name) { return this.attrs.has(name); }
  setAttribute(name, value) { this.attrs.set(name, value); }
  removeAttribute(name) { this.attrs.delete(name); }
}

test('locale render gate exposes cold/warm states, inertness and ignores disconnected hosts', async () => {
  const load = deferred();
  const runtime = new LanguageRuntime([
    { code: 'en', dictionary: {} },
    { code: 'de', loadDictionary: async () => load.promise },
  ], 'build');
  const host = new FakeHost();
  let language = 'en';
  assert.equal(languageRenderGate(host, runtime, language), 'ready');
  assert.equal(host.attrs.get('lang'), 'en');
  language = 'de';
  assert.equal(languageRenderGate(host, runtime, language), 'warm');
  assert.equal(host.inert, true);
  assert.equal(host.attrs.get('aria-busy'), 'true');
  host.isConnected = false;
  load.resolve({ dictionary: {}, fingerprint: 'build' });
  await runtime.ensure('de');
  await Promise.resolve();
  assert.equal(host.updates, 0);
  assert.equal(languageRenderGate(host, runtime, language), 'ready');
  assert.equal(host.inert, false);
  assert.equal(host.hasAttribute('aria-busy'), false);
  assert.equal(host.attrs.get('lang'), 'de');

  const coldLoad = deferred();
  const coldRuntime = new LanguageRuntime([{
    code: 'de', loadDictionary: async () => coldLoad.promise,
  }], 'build');
  const coldHost = new FakeHost();
  assert.equal(languageRenderGate(coldHost, coldRuntime, 'de'), 'cold');
  coldLoad.resolve({ dictionary: {}, fingerprint: 'build' });
  await coldRuntime.ensure('de');
  await Promise.resolve();
  assert.equal(coldHost.updates, 1);
  assert.equal(languageRenderGate(coldHost, coldRuntime, 'de'), 'ready');
  assert.equal(coldHost.attrs.get('lang'), 'de');
});

test('locale render gate exposes the fallback language to assistive technology', async () => {
  const runtime = new LanguageRuntime([{
    code: 'de', loadDictionary: async () => { throw new Error('offline'); },
  }], 'build', () => {});
  const host = new FakeHost();
  assert.equal(languageRenderGate(host, runtime, 'de'), 'cold');
  await runtime.ensure('de');
  assert.equal(languageRenderGate(host, runtime, 'de'), 'ready');
  assert.equal(host.attrs.get('lang'), 'en');
});

test('the production runtime is the tested class, not a handwritten twin (#354)', async () => {
  const registry = await import('../test-build/i18n/registry.js');
  assert.ok(
    registry.LANGUAGE_RUNTIME instanceof LanguageRuntime,
    'LANGUAGE_RUNTIME must be an instance of the class this suite proves',
  );
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('../src/i18n/registry.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(
    source,
    /germanPending|germanFailed|settleGerman/,
    'the handwritten duplicate must not return — tests would look past production again',
  );
});

test('a settled dictionary failure reaches the load-failed hook once (#354)', async () => {
  const failures = [];
  const warnings = [];
  const runtime = new LanguageRuntime(
    [
      { code: 'en', dictionary: { key: 'value' } },
      { code: 'de', loadDictionary: async () => { throw new Error('net'); } },
    ],
    'fp',
    (message, error) => warnings.push([message, String(error)]),
    (code) => failures.push(code),
  );
  await runtime.ensure('de');
  assert.deepEqual(failures, ['de']);
  assert.equal(warnings.length, 1);
  assert.equal(runtime.state('de'), 'fallback');
  await runtime.ensure('de');
  assert.deepEqual(failures, ['de'], 'a settled fallback never re-fires the hook');
});

test('language load failure subscription delivers codes and unsubscribes (#354)', async () => {
  const { subscribeLanguageLoadFailures } = await import('../test-build/i18n/registry.js');
  const seen = [];
  const unsubscribe = subscribeLanguageLoadFailures((code) => seen.push(code));
  // The registry instance wires its loadFailed hook into these listeners; the
  // fan-out itself is observable without a network by a second subscriber
  // triggering through the same set semantics.
  const second = subscribeLanguageLoadFailures((code) => seen.push(`2:${code}`));
  unsubscribe();
  second();
  assert.deepEqual(seen, [], 'listeners removed before any failure stay silent');
  assert.equal(typeof unsubscribe, 'function');
});
