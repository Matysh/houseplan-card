import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyInboxVisibility, bindingCandidates, buildDeviceInbox, effectiveInboxSelection,
  filterDeviceInbox, inboxVisibilityAllowed, selectableInboxRows,
} from '../test-build/device-inbox.js';

const active = { kind: 'active', enabledEntityIds: [], allEntityIds: [] };
const labels = {
  device: 'device', z2mGroup: ' group', group: 'group', helper: 'helper', entity: 'entity',
};

function dev(id, binding, over = {}) {
  const [bindingKind, bindingRef] = binding.split(':');
  return {
    id, name: id, model: '', area: 'living', space: 'f1', icon: 'mdi:lamp',
    entities: [], allEntities: [], bindingKind, bindingRef, bindingStatus: active, ...over,
  };
}

test('catalog classifies exact bindings without merging a removed parent and live child', () => {
  const markers = [
    { id: 'parent', binding: 'device:d1', removed: true, hidden: true },
    { id: 'child', binding: 'entity:sensor.child', hidden: false },
    { id: 'hidden', binding: 'device:d2', hidden: true },
  ];
  const devices = [
    dev('child', 'entity:sensor.child', { marker: markers[1] }),
    dev('hidden', 'device:d2', { marker: markers[2], hidden: true, userHidden: true }),
    dev('auto', 'device:d3'),
  ];
  const candidates = [
    { value: 'device:d1', label: 'Parent', sub: 'device', kind: 'device', ref: 'd1', areaId: '', model: '' },
    { value: 'device:d4', label: 'Available', sub: 'device', kind: 'device', ref: 'd4', areaId: '', model: '' },
  ];
  const rows = buildDeviceInbox({
    devices, markers, candidates,
    statuses: new Map(candidates.map((candidate) => [candidate.value, active])),
    newDeviceIds: new Set(['auto']), showHiddenOnPlan: false,
  });
  assert.equal(rows.find((row) => row.binding === 'device:d1').category, 'readd');
  assert.equal(rows.find((row) => row.binding === 'entity:sensor.child').category, 'on_plan');
  assert.equal(rows.find((row) => row.binding === 'device:d2').category, 'hidden');
  assert.equal(rows.find((row) => row.binding === 'device:d2').canFind, false);
  assert.equal(rows.find((row) => row.binding === 'device:d3').isNew, true);
  assert.equal(rows.find((row) => row.binding === 'device:d4').category, 'available');
});

test('HA status overlays lifecycle and ghost mode only enables Find', () => {
  const marker = { id: 'd1', binding: 'device:d1', hidden: true };
  const disabled = {
    kind: 'ha_disabled', reason: 'device', enabledEntityIds: [], allEntityIds: ['switch.d1'],
  };
  const device = dev('d1', 'device:d1', {
    marker, hidden: true, userHidden: true, bindingStatus: disabled,
  });
  const base = {
    devices: [device], markers: [marker], candidates: [],
    statuses: new Map([['device:d1', disabled]]), newDeviceIds: new Set(),
  };
  const hidden = buildDeviceInbox({ ...base, showHiddenOnPlan: false })[0];
  const ghost = buildDeviceInbox({ ...base, showHiddenOnPlan: true })[0];
  assert.equal(hidden.category, 'hidden');
  assert.equal(hidden.status.kind, 'ha_disabled');
  assert.equal(hidden.canShow, false);
  assert.equal(hidden.canFind, false);
  assert.equal(ghost.canFind, true);
  assert.equal(ghost.canShow, false);
});

test('shared eligibility searches the full entity list beyond the former 200-row cap', () => {
  const entities = {};
  const states = {};
  for (let index = 0; index < 260; index++) {
    const id = `sensor.entity_${String(index).padStart(3, '0')}`;
    entities[id] = { entity_id: id, platform: 'demo', device_id: `d${index}` };
    states[id] = { state: String(index), attributes: { friendly_name: `Entity ${index}` } };
  }
  const candidates = bindingCandidates({
    hass: { devices: {}, entities, states }, devices: [], markers: [], showEntities: true, labels,
  });
  assert.equal(candidates.length, 260);
  const rows = buildDeviceInbox({
    devices: [], markers: [], candidates,
    statuses: new Map(candidates.map((candidate) => [candidate.value, active])),
    newDeviceIds: new Set(), showHiddenOnPlan: false,
  });
  const found = filterDeviceInbox(rows, 'available', 'entity_259');
  assert.equal(found.length, 1);
  assert.equal(found[0].binding, 'entity:sensor.entity_259');
});

test('opening, searching and filtering are pure', () => {
  const marker = { id: 'd1', binding: 'device:d1', hidden: false };
  const input = {
    devices: [dev('d1', 'device:d1', { marker })], markers: [marker], candidates: [],
    statuses: new Map([['device:d1', active]]), newDeviceIds: new Set(), showHiddenOnPlan: false,
  };
  const before = JSON.stringify({ markers: input.markers, devices: input.devices });
  const rows = buildDeviceInbox(input);
  filterDeviceInbox(rows, 'on_plan', 'd1');
  assert.equal(JSON.stringify({ markers: input.markers, devices: input.devices }), before);
});

test('full lifecycle matrix keeps intent category separate from HA status and reasons', () => {
  const disabled = { kind: 'ha_disabled', reason: 'device', enabledEntityIds: [], allEntityIds: [] };
  const orphaned = { kind: 'orphaned', reason: 'entity', enabledEntityIds: [], allEntityIds: [] };
  const unverified = { kind: 'unverified', enabledEntityIds: [], allEntityIds: [] };
  const markers = [
    { id: 'hfiltered', binding: 'device:filtered', hidden: true },
    { id: 'hidden-disabled', binding: 'device:hidden-disabled', hidden: true, name: 'Hidden disabled' },
    { id: 'orphan', binding: 'entity:sensor.orphan', hidden: false },
    { id: 'unknown', binding: 'entity:sensor.unknown', hidden: false },
    { id: 'missing-tombstone', binding: 'device:gone', removed: true, hidden: true },
  ];
  const devices = [
    dev('auto', 'device:auto'),
    dev('group', 'entity:light.room_group', { model: 'Light group' }),
    dev('filtered', 'device:filtered', { marker: markers[0], hidden: true, userHidden: true }),
    dev('hidden-disabled', 'device:hidden-disabled', {
      marker: markers[1], hidden: true, userHidden: true, bindingStatus: disabled,
    }),
  ];
  const candidates = [
    { value: 'device:available', label: 'Available', sub: 'device', kind: 'device', ref: 'available', areaId: 'living', model: '' },
    { value: 'device:no-room', label: 'No room', sub: 'device', kind: 'device', ref: 'no-room', areaId: '', model: '' },
    { value: 'entity:sensor.child', label: 'Child', sub: 'entity', kind: 'entity', ref: 'sensor.child', areaId: 'living', model: '', parentDeviceId: 'auto' },
  ];
  const statuses = new Map([
    ...candidates.map((candidate) => [candidate.value, active]),
    ['device:hidden-disabled', disabled], ['entity:sensor.orphan', orphaned],
    ['entity:sensor.unknown', unverified],
  ]);
  const rows = buildDeviceInbox({
    devices, markers, candidates, statuses, newDeviceIds: new Set(['auto']),
    showHiddenOnPlan: false, spaceByArea: { living: 'f1' },
    reasonByBinding: { 'device:filtered': 'excluded_integration' },
  });
  const row = (binding) => rows.find((item) => item.binding === binding);
  assert.equal(row('device:auto').category, 'on_plan');
  assert.equal(row('device:auto').reason, 'visible_auto');
  assert.equal(row('device:auto').isNew, true);
  assert.equal(row('entity:light.room_group').category, 'on_plan');
  assert.equal(row('device:filtered').category, 'hidden');
  assert.equal(row('device:filtered').reason, 'excluded_integration');
  assert.equal(row('device:hidden-disabled').category, 'hidden');
  assert.equal(row('device:hidden-disabled').status.kind, 'ha_disabled');
  assert.equal(row('entity:sensor.orphan').category, 'on_plan');
  assert.equal(row('entity:sensor.orphan').status.kind, 'orphaned');
  assert.equal(row('entity:sensor.unknown').status.kind, 'unverified');
  assert.equal(row('device:available').category, 'available');
  assert.equal(row('device:no-room').reason, 'no_bound_room');
  assert.equal(row('entity:sensor.child').reason, 'represented_by_parent');
  assert.equal(row('device:gone'), undefined);
});

// ---- #618: batch Hide/Show -------------------------------------------------

function batchFixture() {
  const disabled = { kind: 'ha_disabled', reason: 'device', enabledEntityIds: [], allEntityIds: [] };
  const orphaned = { kind: 'orphaned', reason: 'entity', enabledEntityIds: [], allEntityIds: [] };
  const unverified = { kind: 'unverified', enabledEntityIds: [], allEntityIds: [] };
  const markers = [
    { id: 'explicit', binding: 'device:explicit', hidden: false, name: 'Explicit', icon: 'mdi:fan' },
    { id: 'hstub', binding: 'device:stub', hidden: true },
    { id: 'manual', binding: 'device:manual', hidden: true, name: 'Manual' },
    { id: 'hidden-off', binding: 'device:hidden-off', hidden: true },
    { id: 'orphan', binding: 'entity:sensor.orphan', hidden: false },
    { id: 'unknown', binding: 'entity:sensor.unknown', hidden: false },
  ];
  const devices = [
    dev('auto', 'device:auto', { isNew: true }),
    dev('explicit', 'device:explicit', { marker: markers[0] }),
    dev('stub', 'device:stub', { marker: markers[1], hidden: true, userHidden: true }),
    dev('manual', 'device:manual', { marker: markers[2], hidden: true, userHidden: true }),
    dev('hidden-off', 'device:hidden-off', {
      marker: markers[3], hidden: true, userHidden: true, bindingStatus: disabled,
    }),
    dev('lg_sensor.temp', 'entity:sensor.temp'),
  ];
  const candidates = [
    { value: 'device:available', label: 'Available', sub: 'device', kind: 'device', ref: 'available', areaId: 'living', model: '' },
  ];
  const statuses = new Map([
    ['device:available', active], ['entity:sensor.orphan', orphaned], ['entity:sensor.unknown', unverified],
  ]);
  const rows = buildDeviceInbox({
    devices, markers, candidates, statuses, newDeviceIds: new Set(['auto']),
    showHiddenOnPlan: false, spaceByArea: { living: 'f1' },
  });
  return { markers, rows };
}

test('issue 618: only active rows of On plan / Hidden are selectable', () => {
  const { rows } = batchFixture();
  const keys = (list) => list.map((row) => row.key).sort();
  assert.deepEqual(keys(selectableInboxRows(filterDeviceInbox(rows, 'on_plan', ''))),
    ['device:auto', 'device:explicit', 'entity:sensor.temp']);
  assert.deepEqual(keys(selectableInboxRows(filterDeviceInbox(rows, 'hidden', ''))),
    ['device:manual', 'device:stub']);
  assert.deepEqual(selectableInboxRows(filterDeviceInbox(rows, 'available', '')), []);
  // Inactive HA statuses are listed but never selectable.
  for (const binding of ['entity:sensor.orphan', 'entity:sensor.unknown', 'device:hidden-off']) {
    const row = rows.find((item) => item.binding === binding);
    assert.ok(row, binding);
    assert.equal(inboxVisibilityAllowed(row.category, row.status), false, binding);
    assert.equal(row.canHide || row.canShow, false, binding);
  }
  // Single-row buttons read the same predicate.
  for (const row of rows) {
    assert.equal(row.canHide || row.canShow, inboxVisibilityAllowed(row.category, row.status), row.key);
  }
  assert.equal(inboxVisibilityAllowed('available', active), false);
  assert.equal(inboxVisibilityAllowed('readd', active), false);
});

test('issue 618: Select all counts the whole filtered set, not the Show more page', () => {
  const devices = [];
  for (let index = 0; index < 150; index++) {
    devices.push(dev(`d${index}`, `device:d${index}`, { name: `Lamp ${index}` }));
  }
  devices.push(dev('fan', 'device:fan', { name: 'Fan' }));
  const rows = buildDeviceInbox({
    devices, markers: [], candidates: [], statuses: new Map(),
    newDeviceIds: new Set(['d1', 'd2']), showHiddenOnPlan: false,
  });
  assert.equal(selectableInboxRows(filterDeviceInbox(rows, 'on_plan', '')).length, 151);
  assert.equal(selectableInboxRows(filterDeviceInbox(rows, 'on_plan', 'lamp')).length, 150);
  assert.equal(selectableInboxRows(filterDeviceInbox(rows, 'on_plan', '', true)).length, 2);
});

test('issue 618: effective selection keeps only still-selectable keys in row order', () => {
  const { rows } = batchFixture();
  const selectable = selectableInboxRows(filterDeviceInbox(rows, 'on_plan', ''));
  const chosen = effectiveInboxSelection(
    ['entity:sensor.orphan', 'device:explicit', 'device:gone', 'device:auto'], selectable,
  );
  assert.deepEqual(chosen.map((row) => row.key), ['device:auto', 'device:explicit']);
  assert.deepEqual(effectiveInboxSelection(undefined, selectable), []);
  assert.deepEqual(effectiveInboxSelection([], selectable), []);
});

test('issue 618: Hide/Show keeps settings, keeps automatic stubs and creates exact-id stubs', () => {
  const { markers, rows } = batchFixture();
  const row = (binding) => rows.find((item) => item.binding === binding);
  const newId = () => { throw new Error('device/entity bindings never need a random id'); };

  const hidden = applyInboxVisibility(markers,
    [row('device:explicit'), row('device:auto'), row('entity:sensor.temp')], true, newId);
  assert.equal(hidden.changed, 3);
  const byBinding = (list, binding) => list.filter((marker) => marker.binding === binding && !marker.removed);
  assert.deepEqual(byBinding(hidden.markers, 'device:explicit'),
    [{ id: 'explicit', binding: 'device:explicit', hidden: true, name: 'Explicit', icon: 'mdi:fan' }]);
  assert.deepEqual(byBinding(hidden.markers, 'device:auto'),
    [{ id: 'auto', binding: 'device:auto', hidden: true }]);
  assert.deepEqual(byBinding(hidden.markers, 'entity:sensor.temp'),
    [{ id: 'lg_sensor.temp', binding: 'entity:sensor.temp', hidden: true }]);

  const shown = applyInboxVisibility(markers, [row('device:stub'), row('device:manual')], false, newId);
  assert.equal(shown.changed, 2);
  // The automatic stub survives with hidden:false — the anti-reseed guard.
  assert.deepEqual(byBinding(shown.markers, 'device:stub'),
    [{ id: 'hstub', binding: 'device:stub', hidden: false }]);
  assert.deepEqual(byBinding(shown.markers, 'device:manual'),
    [{ id: 'manual', binding: 'device:manual', hidden: false, name: 'Manual' }]);
  // Untouched markers are carried over as-is.
  assert.deepEqual(byBinding(shown.markers, 'device:hidden-off'), [markers[3]]);

  // Show without a live marker is a no-op, exactly like the single action.
  const noop = applyInboxVisibility(markers, [{ binding: 'device:nothing' }], false, newId);
  assert.equal(noop.changed, 0);
  assert.deepEqual(noop.markers, markers);
  // Inputs are never mutated.
  assert.deepEqual(markers, batchFixture().markers);
});

test('issue 618: a batch equals the fold of single-row actions and never duplicates a binding', () => {
  const { markers, rows } = batchFixture();
  const row = (binding) => rows.find((item) => item.binding === binding);
  const newId = () => 'unused';
  const cases = [
    { hidden: true, list: [row('device:auto'), row('device:explicit'), row('entity:sensor.temp')] },
    { hidden: false, list: [row('device:stub'), row('device:manual')] },
  ];
  // A corrupted config with two live markers for one binding plus a tombstone.
  const dirty = [
    ...markers,
    { id: 'explicit-dup', binding: 'device:explicit', hidden: false },
    { id: 'old-auto', binding: 'device:auto', removed: true, hidden: true },
  ];
  for (const base of [markers, dirty]) {
    for (const { hidden, list } of cases) {
      const batch = applyInboxVisibility(base, list, hidden, newId);
      let fold = base;
      let changed = 0;
      for (const single of list) {
        const step = applyInboxVisibility(fold, [single], hidden, newId);
        fold = step.markers;
        changed += step.changed;
      }
      assert.equal(JSON.stringify(batch.markers), JSON.stringify(fold));
      assert.equal(batch.changed, changed);
      for (const single of list) {
        const live = batch.markers.filter((marker) => marker.binding === single.binding && !marker.removed);
        assert.equal(live.length, 1, single.binding);
        assert.equal(live[0].hidden, hidden, single.binding);
      }
    }
  }
});
