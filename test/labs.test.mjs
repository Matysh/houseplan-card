import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ALPHA_STORAGE_KEY, LABS_FLAGS, hashSpace, resolveLabs, validLabsFlag,
  validLabsRegistry,
} from '../test-build/labs.js';

const resolve = (search = '', hash = '', storage = null, registry = LABS_FLAGS) =>
  resolveLabs({ search, hash }, storage, registry);

test('alpha capability registry is timeless and fails closed when malformed', () => {
  assert.equal(ALPHA_STORAGE_KEY, 'houseplan_card_alpha_v1');
  assert.equal(LABS_FLAGS.every(validLabsFlag), true);
  assert.deepEqual(LABS_FLAGS.map(({ id, issue }) => [id, issue]), [['iso', 89]]);
  assert.equal(LABS_FLAGS.some((flag) => 'since' in flag || 'expires' in flag), false);
  assert.equal(validLabsRegistry([LABS_FLAGS[0], { ...LABS_FLAGS[0] }]), false);
  const malformed = resolve('?hp_alpha=1', '', null, [
    LABS_FLAGS[0], { ...LABS_FLAGS[0] },
  ]);
  assert.equal(malformed.alpha, false);
  assert.deepEqual(malformed.active, []);
  assert.equal(malformed.persist, undefined);

  const source = readFileSync(new URL('../src/labs.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bsince\b|\bexpires\b|parseVersionCore|compareVersion/);
});

test('hp_alpha applies query before hash and the last recognised value wins', () => {
  assert.equal(resolve('?hp_alpha=1').alpha, true);
  assert.deepEqual(resolve('?hp_alpha=1').active, ['iso']);
  assert.equal(resolve('?hp_alpha=0').alpha, false);
  assert.equal(resolve('?hp_alpha=0&hp_alpha=1').alpha, true);
  assert.equal(resolve('?hp_alpha=1&hp_alpha=0').alpha, false);
  assert.equal(resolve('?hp_alpha=0', '#hp_alpha=1').alpha, true);
  assert.equal(resolve('?hp_alpha=1', '#hp_alpha=0').alpha, false);
  assert.equal(resolve('?hp_alpha=0', '#hp_alpha=1&hp_alpha=0&hp_alpha=1').alpha, true);
  assert.equal(resolve('?hp_alpha=1').persist, '1');
  assert.equal(resolve('?hp_alpha=0').persist, '0');
});

test('unknown alpha values fail closed for the current resolution without rewriting storage', () => {
  const unknown = resolve('?hp_alpha=on', '', '1');
  assert.equal(unknown.alpha, false);
  assert.deepEqual(unknown.active, []);
  assert.equal(unknown.persist, undefined);
  assert.equal(unknown.knownUrlOperation, false);

  const recognisedAfterUnknown = resolve('?hp_alpha=on&hp_alpha=1', '', '0');
  assert.equal(recognisedAfterUnknown.alpha, true);
  assert.equal(recognisedAfterUnknown.persist, '1');
});

test('hash parser keeps space routing alongside the alpha operation', () => {
  assert.equal(hashSpace('#hp_alpha=1&space=first%20floor'), 'first floor');
  assert.equal(hashSpace('#space=ground&hp_alpha=1'), 'ground');
  const result = resolve('', '#space=ground&hp_alpha=1');
  assert.equal(result.space, 'ground');
  assert.equal(result.alpha, true);
  assert.deepEqual(result.active, ['iso']);
});

test('only canonical alpha storage is read and legacy Labs inputs do not migrate', () => {
  assert.equal(resolve('', '', '1').alpha, true);
  assert.equal(resolve('', '', '0').alpha, false);
  for (const malformed of [undefined, null, '', 'true', ' 1', '["iso"]', '{bad']) {
    assert.equal(resolve('', '', malformed).alpha, false, String(malformed));
  }
  const legacyUrl = resolve('?hp-labs=iso', '#space=f1&hp-labs=iso', null);
  assert.equal(legacyUrl.alpha, false);
  assert.deepEqual(legacyUrl.active, []);
  assert.equal(legacyUrl.persist, undefined);
  assert.equal(legacyUrl.space, 'f1');
});

test('a reloaded alpha module replaces both browser location listeners', async () => {
  const previousWindow = globalThis.window;
  const listeners = new Map();
  const values = new Map([['houseplan_card_labs_v1', '["iso"]']]);
  const fakeWindow = {
    location: { search: '', hash: '' },
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
    addEventListener(type, listener) {
      const registered = listeners.get(type) ?? new Set();
      registered.add(listener);
      listeners.set(type, registered);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    dispatch(type) {
      for (const listener of [...(listeners.get(type) ?? [])]) listener({ type });
    },
  };

  try {
    globalThis.window = fakeWindow;
    const first = await import('../test-build/labs.js?listener-instance=first');
    const firstSnapshots = [];
    const unsubscribeFirst = first.subscribeLabs((value) => { firstSnapshots.push(value); });
    assert.equal(firstSnapshots[0].alpha, false, 'legacy storage must not migrate');

    fakeWindow.location.search = '?hp_alpha=1';
    fakeWindow.dispatch('popstate');
    assert.equal(firstSnapshots.at(-1).alpha, true);
    assert.equal(values.get(ALPHA_STORAGE_KEY), '1');
    assert.equal(fakeWindow.__hpAlpha, true);
    assert.deepEqual(fakeWindow.__hpLabs, ['iso']);

    const second = await import('../test-build/labs.js?listener-instance=second');
    let secondPublishes = 0;
    const unsubscribeSecond = second.subscribeLabs(() => { secondPublishes += 1; });
    const firstPublishes = firstSnapshots.length;

    assert.equal(listeners.get('hashchange')?.size, 1);
    assert.equal(listeners.get('popstate')?.size, 1);
    fakeWindow.dispatch('hashchange');
    fakeWindow.dispatch('popstate');
    assert.equal(firstSnapshots.length, firstPublishes,
      'the replaced module must not receive location events');
    assert.equal(secondPublishes, 3,
      'the current module receives initial, hash and popstate publishes');

    unsubscribeFirst();
    unsubscribeSecond();
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test('storage failures keep the current URL decision safe and usable', async () => {
  const previousWindow = globalThis.window;
  const listeners = new Map();
  const fakeWindow = {
    location: { search: '?hp_alpha=1', hash: '#space=f1' },
    localStorage: {
      getItem: () => { throw new Error('read denied'); },
      setItem: () => { throw new Error('write denied'); },
    },
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
  };
  try {
    globalThis.window = fakeWindow;
    const module = await import('../test-build/labs.js?storage-failure');
    let current;
    const unsubscribe = module.subscribeLabs((value) => { current = value; });
    assert.equal(current.alpha, true);
    assert.deepEqual(current.active, ['iso']);
    assert.equal(current.space, 'f1');
    unsubscribe();
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
