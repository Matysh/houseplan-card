import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LABS_FLAGS, hashSpace, liveLabsFlags, parseVersionCore, resolveLabs, validLabsFlag,
  validLabsRegistry,
} from '../test-build/labs.js';

const resolve = (search = '', hash = '', storage = null, version = '1.62.0') =>
  resolveLabs({ search, hash }, storage, version);

test('registry metadata and numeric-core lifetime fail closed', () => {
  assert.equal(LABS_FLAGS.every(validLabsFlag), true);
  assert.deepEqual(parseVersionCore('1.65.0-beta.1'), [1, 65, 0]);
  assert.equal(liveLabsFlags('1.64.9').has('iso'), true);
  assert.equal(liveLabsFlags('1.65.0-beta.1').has('iso'), false);
  assert.equal(liveLabsFlags('1.65.0').has('iso'), false);
  assert.equal(liveLabsFlags('not-a-version').size, 0);
  assert.equal(validLabsFlag({ ...LABS_FLAGS[0], since: '1.65.0' }), false);
  assert.equal(validLabsRegistry([LABS_FLAGS[0], { ...LABS_FLAGS[0] }]), false);
  assert.equal(liveLabsFlags('1.62.0', [LABS_FLAGS[0], { ...LABS_FLAGS[0] }]).size, 0);
  assert.deepEqual(resolveLabs(
    { search: '?hp-labs=iso', hash: '' }, '["iso"]', '1.62.0',
    [LABS_FLAGS[0], { ...LABS_FLAGS[0] }],
  ).active, []);
});

test('URL operations are ordered query then hash with off and removal semantics', () => {
  assert.deepEqual(resolve('?hp-labs=off,iso').active, ['iso']);
  assert.deepEqual(resolve('?hp-labs=iso,-iso').active, []);
  assert.deepEqual(resolve('?hp-labs=-iso', '', '["iso"]').active, []);
  assert.deepEqual(resolve('?hp-labs=iso', '#hp-labs=-iso').active, []);
  assert.deepEqual(resolve('?hp-labs=off&hp-labs=iso').active, ['iso']);
  assert.deepEqual(resolve('?hp-labs=iso', '#hp-labs=off,iso').active, ['iso']);
});

test('unknown operations do not rewrite storage and expired flags cannot revive', () => {
  const unknown = resolve('?hp-labs=unknown', '', '["iso"]');
  assert.deepEqual(unknown.active, ['iso']);
  assert.equal(unknown.persist, undefined);
  assert.equal(unknown.knownUrlOperation, false);
  const expired = resolve('?hp-labs=iso', '', '["iso"]', '1.65.0-beta.1');
  assert.deepEqual(expired.active, []);
  assert.equal(expired.persist, '[]');
});

test('hash parser shares space and labs grammar with percent encoding', () => {
  assert.equal(hashSpace('#hp-labs=iso&space=first%20floor'), 'first floor');
  assert.equal(hashSpace('#space=ground&hp-labs=iso'), 'ground');
  const result = resolve('', '#space=ground&hp-labs=iso');
  assert.equal(result.space, 'ground');
  assert.deepEqual(result.active, ['iso']);
});

test('malformed and unavailable storage are safe', () => {
  assert.deepEqual(resolve('', '', '{bad').active, []);
  assert.deepEqual(resolve('?hp-labs=iso', '', undefined).active, ['iso']);
});

test('a reloaded Labs module replaces both browser location listeners', async () => {
  const previousWindow = globalThis.window;
  const listeners = new Map();
  const fakeWindow = {
    location: { search: '', hash: '' },
    localStorage: {
      getItem: () => null,
      setItem: () => {},
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
    let firstPublishes = 0;
    const unsubscribeFirst = first.subscribeLabs('1.62.0', () => { firstPublishes += 1; });

    const second = await import('../test-build/labs.js?listener-instance=second');
    let secondPublishes = 0;
    const unsubscribeSecond = second.subscribeLabs('1.62.0', () => { secondPublishes += 1; });

    assert.equal(listeners.get('hashchange')?.size, 1);
    assert.equal(listeners.get('popstate')?.size, 1);

    fakeWindow.dispatch('hashchange');
    fakeWindow.dispatch('popstate');
    assert.equal(firstPublishes, 1, 'the replaced module must not receive location events');
    assert.equal(secondPublishes, 3, 'the current module receives initial, hash and popstate publishes');

    unsubscribeFirst();
    unsubscribeSecond();
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
