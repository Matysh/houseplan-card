import assert from 'node:assert/strict';
import test from 'node:test';
import { readSummaryPreference, summaryPreferenceKey } from '../test-build/summary-panel-identity.js';
import { summaryLocalKey } from '../test-build/summary-panel.js';
import { summaryRecoveryRequested } from '../test-build/view-runtimes.js';

function browser() {
  const old = Object.getOwnPropertyDescriptor(globalThis, 'location');
  const location = { pathname: '/houseplan' };
  Object.defineProperty(globalThis, 'location', { configurable: true, value: location });
  return { location, restore() {
    if (old) Object.defineProperty(globalThis, 'location', old);
    else delete globalThis.location;
  } };
}

function panel(previousRoute = false, user = 'alice', prefix = '/houseplan') {
  const root = { localName: 'ha-panel-resolver', children: [] };
  if (previousRoute) root.children.push({ localName: 'ha-panel-lovelace', parentNode: root, children: [] });
  let parent = root;
  for (const localName of ['ha-panel-custom', 'houseplan-panel', 'main', 'houseplan-card']) {
    const child = { localName, parentNode: parent, children: [] };
    parent.children.push(child); parent = child;
  }
  return Object.assign(parent, { panelHost: true, panelRoutePrefix: prefix,
    hass: { user: user ? { id: user } : undefined }, ownerDocument: {} });
}

function storage(entries = []) {
  const values = new Map(entries);
  return { values, get length() { return values.size; }, key: i => [...values.keys()][i] ?? null,
    getItem: key => values.get(key) ?? null };
}
const saved = (show) => ({ version: 1, show, icon_scale: 1.4, font_scale: 0.8 });
const legacyKey = (index = 0, fields = {}) => summaryLocalKey({ userId: 'alice', path: '/houseplan', host: 'panel',
  slot: `ha-panel-resolver/ha-panel-custom:${index}/houseplan-panel:0/main:0/houseplan-card:0`, ...fields });

test('#1286 a full panel remount after another HA route retains its preference key', () => {
  const env = browser();
  try {
    const first = summaryPreferenceKey(panel());
    const returned = summaryPreferenceKey(panel(true));
    assert.equal(returned, first);
    for (const show of [true, false]) {
      const store = storage([[first, JSON.stringify(saved(show))]]);
      assert.deepEqual(readSummaryPreference(panel(true), store), saved(show));
    }
  } finally { env.restore(); }
});

test('#1286 a retained panel keeps its route namespace while HA visits another page', () => {
  const env = browser();
  try {
    const host = panel();
    const before = summaryPreferenceKey(host);
    env.location.pathname = '/lovelace/home';
    assert.equal(summaryPreferenceKey(host), before);
    assert.notEqual(summaryPreferenceKey(panel(false, 'bob')), before);
    assert.notEqual(summaryPreferenceKey(panel(false, 'alice', '/other-plan')), before);
    assert.equal(summaryPreferenceKey(panel(false, '')), null);
  } finally { env.restore(); }
});

test('#1286 an unambiguous legacy panel preference survives a different resolver layout without writes', () => {
  const env = browser();
  try {
    for (const show of [true, false]) {
      const old = JSON.stringify(saved(show));
      const store = storage([[legacyKey(), old]]);
      assert.deepEqual(readSummaryPreference(panel(true), store), saved(show));
      assert.deepEqual([...store.values], [[legacyKey(), old]], 'reading must not migrate or delete browser data');
    }
  } finally { env.restore(); }
});

test('#1286 canonical Off wins; conflicting legacy choices are not guessed or erased', () => {
  const env = browser();
  try {
    const host = panel();
    const store = storage([[legacyKey(), JSON.stringify(saved(true))], [legacyKey(1), JSON.stringify(saved(false))]]);
    assert.equal(readSummaryPreference(host, store), null);
    assert.equal(store.values.size, 2);
    store.values.set(summaryPreferenceKey(host), JSON.stringify(saved(false)));
    assert.deepEqual(readSummaryPreference(host, store), saved(false));
    store.values.delete(summaryPreferenceKey(host));
    store.values.set(legacyKey(1), JSON.stringify(saved(true)));
    assert.deepEqual(readSummaryPreference(host, store), saved(true), 'identical historical choices are unambiguous');
  } finally { env.restore(); }
});

test('#1286 legacy recovery never adopts a different user, route, Lovelace card or future record', () => {
  const env = browser();
  try {
    const store = storage([
      [legacyKey(0, { userId: 'bob' }), JSON.stringify(saved(true))],
      [legacyKey(0, { path: '/other-plan' }), JSON.stringify(saved(true))],
      [legacyKey(0, { host: 'lovelace' }), JSON.stringify(saved(true))],
      [legacyKey(0, { slot: 'masonry-v2:0' }), JSON.stringify(saved(true))],
      [legacyKey(), JSON.stringify({ ...saved(true), version: 2 })],
      [legacyKey(2), '{broken'],
    ]);
    assert.equal(readSummaryPreference(panel(), store), null);
    const host = panel(false, '');
    store.values.set(legacyKey(), JSON.stringify(saved(true)));
    assert.equal(readSummaryPreference(host, store), null);
    host.hass.user = { id: 'alice' };
    assert.deepEqual(readSummaryPreference(host, store), saved(true), 'late identity reads the saved choice, not a default write');
  } finally { env.restore(); }
});

test('#1286 forbidden storage stays a visible caller error rather than a reported persistent success', () => {
  const env = browser();
  try {
    assert.throws(() => readSummaryPreference(panel(), { getItem() { throw Error('denied'); } }), /denied/);
  } finally { env.restore(); }
});

test('#1286 cold-runtime recovery uses the same inherited and canonical choice', () => {
  const env = browser();
  try {
    const store = storage([[legacyKey(), JSON.stringify(saved(true))]]);
    const host = panel(true);
    Object.assign(host, { _mode: 'view', _settings: {}, narrow: false,
      ownerDocument: { defaultView: { localStorage: store } } });
    assert.equal(summaryRecoveryRequested(host), true);
    store.values.set(summaryPreferenceKey(host), JSON.stringify(saved(false)));
    assert.equal(summaryRecoveryRequested(host), false);
  } finally { env.restore(); }
});
