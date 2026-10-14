import test from 'node:test';
import assert from 'node:assert/strict';
import { nonCarouselKiosk, kioskPlacementKey, saveKioskViewport, takeKioskViewport } from '../test-build/kiosk-viewport-recovery.js';

const camera = { space: 'f2', zoom: 2.4, view: { x: 10, y: 20, w: 400, h: 300 } };
function storage() { const map = new Map(); return { map, getItem: k => map.get(k) ?? null,
  setItem: (k, v) => map.set(k, v), removeItem: k => map.delete(k) }; }

test('#894 only a kiosk without a running carousel can recover an enlarged view', () => {
  for (const cycle of [undefined, 0, -1]) assert.equal(nonCarouselKiosk(cycle, false, 2), true);
  assert.equal(nonCarouselKiosk(10, false, 2), false);
  assert.equal(nonCarouselKiosk(10, false, 1), true);
  assert.equal(nonCarouselKiosk(10, true, 2), true);
  assert.equal(nonCarouselKiosk(0, false, 0), false);
});
test('#894 one-shot memo retains camera, never consumes another placement or old zoom keys', () => {
  const s = storage(); s.setItem('houseplan_card_zoom_v1', 'keep');
  assert.equal(saveKioskViewport(s, 'first', camera, 1000), true);
  assert.equal(takeKioskViewport(s, 'second', 1001), null);
  assert.deepEqual(takeKioskViewport(s, 'first', 1001), camera);
  assert.equal(takeKioskViewport(s, 'first', 1002), null);
  assert.equal(s.getItem('houseplan_card_zoom_v1'), 'keep');
});
test('#894 malformed, expired, future and unavailable memo fail closed', () => {
  const s = storage();
  for (const value of [null, {}, { ...camera, zoom: Infinity }, { ...camera, view: { ...camera.view, w: 0 } }])
    assert.equal(saveKioskViewport(s, 'own', value, 1000), false);
  for (const raw of ['{', JSON.stringify({ at: 0, viewport: camera }), JSON.stringify({ at: 999999999, viewport: camera })]) {
    s.setItem('own', raw); assert.equal(takeKioskViewport(s, 'own', 700000), null);
    assert.equal(s.getItem('own'), null);
  }
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  assert.equal(saveKioskViewport(blocked, 'own', camera), false);
  assert.equal(takeKioskViewport(blocked, 'own'), null);
});
test('#894 real DOM placement path separates siblings and route/config/account contexts', () => {
  const doc = { children: [], nodeType: 9 };
  const parent = { children: [], nodeType: 1, parentNode: doc, localName: 'div' }; doc.children.push(parent);
  const card = () => ({ isConnected: true, parentNode: parent, ownerDocument: doc, localName: 'houseplan-card' });
  const a = card(), b = card(); parent.children.push(a, b);
  const key = kioskPlacementKey(a, '/home', 'cfg', 'user'); assert.ok(key);
  assert.notEqual(key, kioskPlacementKey(b, '/home', 'cfg', 'user'));
  assert.notEqual(key, kioskPlacementKey(a, '/else', 'cfg', 'user'));
  assert.notEqual(key, kioskPlacementKey(a, '/home', 'other', 'user'));
  assert.notEqual(key, kioskPlacementKey(a, '/home', 'cfg', 'other'));
  assert.equal(kioskPlacementKey({ ...a, isConnected: false }, '/home', 'cfg', 'user'), null);
});
