import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NO_ROUTE_KIOSK, normalizeRouteKiosk, sameRouteKiosk,
  resolveRouteFloor, resolvePresentationFloor, presentationRouteOwner,
} from '../test-build/route-kiosk.js';
import { parseRouteKiosk } from '../test-build/panel-route-kiosk.js';
import { resolveFixedFloor } from '../test-build/initial-load.js';
import { configReloadContext } from '../test-build/config-reload-authority.js';

test('#1103 path and query aliases produce the same one-based intent without consuming foreign parameters', () => {
  const search = '?other=a%26b&hpspace=02&hpkiosk=1&other=second';
  assert.deepEqual(parseRouteKiosk('', search), { enabled: true, position: 2 });
  assert.deepEqual(parseRouteKiosk('/kiosk/2', ''), parseRouteKiosk('/', search));
  assert.equal(search, '?other=a%26b&hpspace=02&hpkiosk=1&other=second');
  for (const path of ['/kiosk', '/kiosk/']) {
    assert.deepEqual(parseRouteKiosk(path, '?hpspace=3&hpkiosk=0'), { enabled: true, position: null });
  }
  assert.deepEqual(parseRouteKiosk('/kiosk/2/', '?hpspace=3&hpkiosk=0'), { enabled: true, position: 2 });
  assert.deepEqual(parseRouteKiosk('/kiosk/%32', ''), { enabled: true, position: 2 });
});

test('#1103 query enablement is exact and repeated own parameters use their first value', () => {
  for (const search of ['', '?hpspace=2', '?hpkiosk=', '?hpkiosk=0', '?hpkiosk=true',
    '?Hpkiosk=1', '?hpkioskExtra=1', '?hpkiosk=0&hpkiosk=1']) {
    assert.deepEqual(parseRouteKiosk('', search), NO_ROUTE_KIOSK, search);
  }
  assert.deepEqual(parseRouteKiosk('', '?hpkiosk=1&hpkiosk=0&hpspace=2&hpspace=3'), { enabled: true, position: 2 });
});

test('#1103 malformed positions fall back to all, while unknown subpaths do not enable kiosk', () => {
  for (const value of ['', '0', '-1', '1.5', 'text', '%20%31', '1e2', '9007199254740992', '%zz']) {
    assert.deepEqual(parseRouteKiosk('', '?hpkiosk=1&hpspace=' + value), { enabled: true, position: null }, value);
    if (value) assert.deepEqual(parseRouteKiosk('/kiosk/' + value, ''), { enabled: true, position: null }, value);
  }
  for (const path of ['/kioskfoo', '/kiosk/2/extra', '/kiosk//', '/other']) {
    assert.deepEqual(parseRouteKiosk(path, '?hpkiosk=1&hpspace=2'), NO_ROUTE_KIOSK, path);
  }
});

test('#1103 runtime normalization copies caller intent and removes inactive/invalid positions', () => {
  const input = { enabled: true, position: 2 };
  const captured = normalizeRouteKiosk(input);
  input.position = 3;
  assert.equal(captured.position, 2);
  assert.ok(sameRouteKiosk(captured, { enabled: true, position: 2 }));
  assert.ok(!sameRouteKiosk(captured, input));
  for (const position of [0, -1, 1.5, Infinity, NaN, '2']) {
    assert.deepEqual(normalizeRouteKiosk({ enabled: true, position }), { enabled: true, position: null });
  }
  assert.deepEqual(normalizeRouteKiosk({ enabled: false, position: 2 }), NO_ROUTE_KIOSK);
});

test('#1103 position resolution waits for authority and follows the actual order, including live reorder and deletion', () => {
  const ids = ['z-last-name', 'a-first-name', 'middle'];
  assert.deepEqual(resolveRouteFloor(2, ids, false), { kind: 'pending', value: 2 });
  assert.deepEqual(resolveRouteFloor(2, [], false), { kind: 'pending', value: 2 });
  assert.equal(resolveRouteFloor(2, ids, true).id, 'a-first-name');
  assert.equal(resolveRouteFloor(2, ['middle', 'z-last-name', 'a-first-name'], true).id, 'z-last-name');
  assert.deepEqual(resolveRouteFloor(2, ['middle'], true), { kind: 'absent' });
  assert.deepEqual(resolveRouteFloor(null, [], false), { kind: 'absent' });
  assert.deepEqual(resolveRouteFloor(2, [], true), { kind: 'absent' });
  assert.equal(resolveFixedFloor({ hasFloor: true, floor: 2, spaceIds: ids.slice(0, 2) }).kind, 'invalid');
  assert.equal(resolveFixedFloor({ hasFloor: true, floor: 0, spaceIds: ids }).id, ids[0]);
  assert.equal(resolvePresentationFloor({ enabled: true, position: 2 }, ids, true, false, undefined).id, ids[1]);
  assert.equal(resolvePresentationFloor(null, ids, false, true, 0).kind, 'pending');
  assert.equal(resolvePresentationFloor(null, ids, false, true, ids[1]).id, ids[1]);
  assert.equal(resolvePresentationFloor(null, ids, false, true, 'missing').kind, 'pending');
  assert.equal(resolvePresentationFloor(null, ids, true, true, 'missing').kind, 'invalid');
  assert.equal(resolvePresentationFloor(null, ids, false, true, -1).kind, 'invalid');
  assert.equal(resolvePresentationFloor(null, ids, false, false, undefined).kind, 'absent');
});

test('#1103 panel internal paths retain read authority; other panels/users/connections and dashboard routes remain separate', () => {
  const previous = globalThis.location;
  const connection = {}, hass = { connection, user: { id: 'a' } };
  try {
    globalThis.location = { pathname: '/houseplan/kiosk/2' };
    const before = configReloadContext({ panelHost: true, hass });
    globalThis.location.pathname = '/houseplan/kiosk/3';
    assert.deepEqual(configReloadContext({ panelHost: true, hass }), before);
    assert.equal(configReloadContext({ hass }).route, '/houseplan/kiosk/3');
    assert.equal(presentationRouteOwner('/houseplan2/kiosk', true), '/houseplan2');
    globalThis.location.pathname = '/config';
    assert.notDeepEqual(configReloadContext({ panelHost: true, hass }), before);
    globalThis.location.pathname = '/houseplan';
    assert.notDeepEqual(configReloadContext({ panelHost: true, hass: { connection, user: { id: 'b' } } }), before);
    assert.notEqual(configReloadContext({ panelHost: true, hass: { connection: {}, user: { id: 'a' } } }).connection, before.connection);
  } finally { globalThis.location = previous; }
});
