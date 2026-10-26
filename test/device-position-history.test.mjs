import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDevicePlacement,
  devicePlacement,
  sameDevicePlacement,
  devicePositionHistoryMatches,
} from '../test-build/device-position-history.js';

test('#1073 placement history refuses a changed source/related position but permits refreshed current contact proof', () => {
  const state={deviceId:'a',spaceId:'f1',placement:{x:.1,y:.2,s:'f1'},related:[{deviceId:'b',spaceId:'f1',placement:null}]};
  const layout={a:{x:.1,y:.2,s:'f1',contact_basis:{v:1,at:{x:.1,y:.2}}}};
  assert.equal(devicePositionHistoryMatches(layout,state),true);
  assert.equal(devicePositionHistoryMatches({a:{...layout.a,x:.9}},state),false);
  assert.equal(devicePositionHistoryMatches({...layout,b:{x:.3,y:.4,s:'f1'}},state),false);
  assert.equal(devicePositionHistoryMatches({a:{...layout.a,s:'other'}},state),false);
});

test('updates only placement and preserves zero and future sibling fields', () => {
  const original = {
    device: { s: 'floor-1', x: 0.1, y: 0.2, k: 0, future: { pinned: true } },
  };
  const next = applyDevicePlacement(original, 'device', {
    s: 'floor-2', x: 0.75, y: 0.5,
  });

  assert.deepEqual(next.device, {
    s: 'floor-2', x: 0.75, y: 0.5, k: 0, future: { pinned: true },
  });
  assert.deepEqual(original.device, {
    s: 'floor-1', x: 0.1, y: 0.2, k: 0, future: { pinned: true },
  });
  assert.notEqual(next, original);
  assert.notEqual(next.device, original.device);
});

test('legacy placement removes a newer space field without touching siblings', () => {
  const next = applyDevicePlacement({
    device: { s: 'floor-1', x: 0.1, y: 0.2, k: 3 },
  }, 'device', { x: 120, y: 240 });
  assert.deepEqual(next.device, { x: 120, y: 240, k: 3 });
  assert.deepEqual(devicePlacement(next, 'device'), { x: 120, y: 240 });
});

test('null restores auto-position by removing the complete persisted record', () => {
  const original = {
    device: { s: 'floor-1', x: 0.1, y: 0.2, k: 0, future: 'value' },
    other: { s: 'floor-1', x: 0.3, y: 0.4 },
  };
  const next = applyDevicePlacement(original, 'device', null);
  assert.equal('device' in next, false);
  assert.deepEqual(next.other, original.other);
  assert.equal(devicePlacement(next, 'device'), null);
});

test('missing delete is an identity no-op and placement equality includes space', () => {
  const layout = { other: { x: 1, y: 2 } };
  assert.equal(applyDevicePlacement(layout, 'missing', null), layout);
  assert.equal(sameDevicePlacement(null, null), true);
  assert.equal(sameDevicePlacement(null, { x: 1, y: 2 }), false);
  assert.equal(sameDevicePlacement({ x: 1, y: 2 }, { x: 1, y: 2 }), true);
  assert.equal(sameDevicePlacement(
    { s: 'a', x: 1, y: 2 }, { s: 'b', x: 1, y: 2 },
  ), false);
});
