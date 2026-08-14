import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adoptVirtualLightServerSnapshot,
  applyVirtualLightEvent,
  reconcileVirtualLightSnapshot,
  virtualLightSnapshot,
  virtualLightWire,
} from '../test-build/virtual-light-state.js';

test('issue 107 runtime wire data is normalized and missing data defaults on', () => {
  const missing = virtualLightSnapshot(undefined, 7);
  assert.deepEqual(virtualLightWire(missing), { rev: 0, config_rev: 7, off: [] });
  const parsed = virtualLightSnapshot({
    rev: 4, config_rev: 7, off: ['b', 'a', 'a'],
  });
  assert.deepEqual(virtualLightWire(parsed), { rev: 4, config_rev: 7, off: ['a', 'b'] });
  const corrupt = virtualLightSnapshot({
    rev: 4, config_rev: 7, off: ['valid', '', 1],
  }, 7);
  assert.deepEqual(virtualLightWire(corrupt), { rev: 0, config_rev: 7, off: [] });
});

test('issue 107 events are monotonic and never optimistic', () => {
  const initial = virtualLightSnapshot({ rev: 2, config_rev: 7, off: [] });
  assert.equal(applyVirtualLightEvent(initial, { marker_id: 'lamp', on: false, rev: 2 }), initial);
  const off = applyVirtualLightEvent(initial, { marker_id: 'lamp', on: false, rev: 3 });
  assert.deepEqual(virtualLightWire(off), { rev: 3, config_rev: 7, off: ['lamp'] });
  const on = applyVirtualLightEvent(off, { marker_id: 'lamp', on: true, rev: 4 });
  assert.deepEqual(virtualLightWire(on), { rev: 4, config_rev: 7, off: [] });
});

test('issue 107 event-before-response ordering never rolls state back', () => {
  const afterEvent = virtualLightSnapshot({ rev: 5, config_rev: 7, off: ['lamp'] });
  const staleResponse = adoptVirtualLightServerSnapshot(
    afterEvent,
    { rev: 4, config_rev: 7, off: [] },
    7,
    true,
  );
  assert.equal(staleResponse, afterEvent);

  const currentResponse = adoptVirtualLightServerSnapshot(
    afterEvent,
    { rev: 5, config_rev: 7, off: ['lamp'] },
    7,
    true,
  );
  assert.deepEqual(virtualLightWire(currentResponse), {
    rev: 5, config_rev: 7, off: ['lamp'],
  });

  const oldBackend = adoptVirtualLightServerSnapshot(afterEvent, undefined, 7, false);
  assert.deepEqual(virtualLightWire(oldBackend), { rev: 0, config_rev: 7, off: [] });
});

test('issue 107 known config transitions preserve only still-eligible ids', () => {
  const current = virtualLightSnapshot({ rev: 5, config_rev: 10, off: ['keep', 'drop'] });
  const next = reconcileVirtualLightSnapshot(current, {
    markers: [
      { id: 'keep', binding: 'virtual', is_light: true, tap_action: 'toggle', hidden: true },
      { id: 'drop', binding: 'virtual', is_light: false, tap_action: 'toggle' },
    ],
  }, 11);
  assert.deepEqual(virtualLightWire(next), { rev: 5, config_rev: 11, off: ['keep'] });
});
