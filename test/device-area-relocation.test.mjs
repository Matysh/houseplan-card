import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAreaRelocationResolution,
  MARKER_AREA_SNAPSHOT_LIMIT,
  markerAreaSnapshotOf,
  removeMarkerAreaSnapshots,
  registryFollowingBinding,
  resolveAreaSnapshotCleanup,
  resolveDeviceAreaRelocations,
} from '../test-build/device-area-relocation.js';

const room = (id, area, x) => ({
  id, area, name: id,
  poly: [[x, 0], [x + 400, 0], [x + 400, 400], [x, 400]],
});
const model = [{
  id: 'floor', title: 'Floor', vb: [0, 0, 1000, 1000], bg: null,
  rooms: [room('left', 'area-a', 0), room('right', 'area-b', 500)],
  wall_segments: [], room_drafts: [], partitions: [], wall_columns: [],
}];
const device = (overrides = {}) => ({
  id: 'device-1', name: 'Lamp', model: '', area: 'area-b', space: 'floor',
  icon: 'mdi:lightbulb', entities: [], bindingKind: 'device', bindingRef: 'device-1',
  bindingStatus: { kind: 'active', enabledEntityIds: [], allEntityIds: [] },
  ...overrides,
});
const resolve = (overrides = {}) => resolveDeviceAreaRelocations({
  devices: [device()], model, layout: {}, snapshot: {}, authoritative: true,
  ...overrides,
});
const cleanup = (overrides = {}) => resolveAreaSnapshotCleanup({
  snapshot: {}, authoritative: true, revision: 1,
  registryDevices: { live: {} }, registryEntities: { 'sensor.live': {} },
  liveStates: {}, markers: [], previousCandidates: new Map(),
  ...overrides,
});

test('known Area transition relocates even a same-space dragged marker', () => {
  const result = resolve({
    layout: { 'device-1': { s: 'floor', x: 0.2, y: 0.2 } },
    snapshot: { 'device-1': { binding: 'device:device-1', area: 'area-a' } },
  });
  assert.deepEqual([...result.relocateIds], ['device-1']);
  assert.equal(result.decisions[0].reason, 'area-changed');
  assert.deepEqual(
    applyAreaRelocationResolution({}, result, result.relocateIds),
    { 'device-1': { binding: 'device:device-1', area: 'area-b' } },
  );
});

test('initial backfill relocates only a provably stale room or space', () => {
  const staleRoom = resolve({ layout: { 'device-1': { s: 'floor', x: 0.2, y: 0.2 } } });
  assert.equal(staleRoom.decisions[0].reason, 'backfill-stale-room');
  assert.equal(staleRoom.relocateIds.has('device-1'), true);

  const sameRoom = resolve({ layout: { 'device-1': { s: 'floor', x: 0.7, y: 0.2 } } });
  assert.equal(sameRoom.decisions[0].reason, 'backfill-same-room');
  assert.equal(sameRoom.relocateIds.size, 0);

  const crossSpace = resolve({ layout: { 'device-1': { s: 'other', x: 0.2, y: 0.2 } } });
  assert.equal(crossSpace.decisions[0].reason, 'backfill-cross-space');
  assert.equal(crossSpace.relocateIds.has('device-1'), true);
});

test('boundary, outside and area-less source are safe ambiguous baselines', () => {
  const areaLessRoom = {
    ...room('storage', undefined, 0),
    poly: [[0, 500], [400, 500], [400, 900], [0, 900]],
  };
  const modelWithAreaLess = [{
    ...model[0],
    rooms: [...model[0].rooms, areaLessRoom],
  }];
  for (const placement of [
    { s: 'floor', x: 0.4, y: 0.2 },
    { s: 'floor', x: 0.95, y: 0.8 },
    { x: 0.2, y: 0.2 },
  ]) {
    const result = resolve({ layout: { 'device-1': placement } });
    assert.equal(result.decisions[0].reason, 'backfill-ambiguous');
    assert.equal(result.relocateIds.size, 0);
  }
  const areaLess = resolve({
    model: modelWithAreaLess,
    layout: { 'device-1': { s: 'floor', x: 0.2, y: 0.7 } },
  });
  assert.equal(areaLess.decisions[0].reason, 'backfill-ambiguous');
  assert.equal(areaLess.relocateIds.size, 0);
});

test('explicit placement, virtual markers and composite groups never follow registry Area', () => {
  const explicitArea = device({ marker: {
    id: 'device-1', binding: 'device:device-1', area: 'area-a',
  } });
  const explicitRoom = device({ marker: {
    id: 'device-1', binding: 'device:device-1', area: null, space: 'floor', room_id: 'left',
  } });
  const composite = device({
    id: 'lg_light.group', bindingKind: 'entity', bindingRef: 'light.group', marker: undefined,
  });
  const directEntity = device({
    id: 'entity-marker', bindingKind: 'entity', bindingRef: 'sensor.one',
    marker: { id: 'entity-marker', binding: 'entity:sensor.one' },
  });
  const removed = device({ marker: {
    id: 'device-1', binding: 'device:device-1', removed: true,
  } });
  const unverified = device({ bindingStatus: {
    kind: 'unverified', enabledEntityIds: [], allEntityIds: [],
  } });
  const disabled = device({ bindingStatus: {
    kind: 'ha_disabled', enabledEntityIds: [], allEntityIds: [],
  } });
  assert.equal(registryFollowingBinding(explicitArea), null);
  assert.equal(registryFollowingBinding(explicitRoom), null);
  assert.equal(registryFollowingBinding(composite), null);
  assert.equal(registryFollowingBinding(directEntity), 'entity:sensor.one');
  assert.equal(registryFollowingBinding(removed), null);
  assert.equal(registryFollowingBinding(unverified), null);
  assert.equal(registryFollowingBinding(disabled), 'device:device-1');
});

test('direct saved entity markers relocate, while ineligible entries are cleaned', () => {
  const directEntity = device({
    id: 'entity-marker', bindingKind: 'entity', bindingRef: 'sensor.one',
    marker: { id: 'entity-marker', binding: 'entity:sensor.one' },
  });
  const result = resolve({
    devices: [directEntity],
    layout: { 'entity-marker': { s: 'floor', x: 0.2, y: 0.2 } },
    snapshot: { 'entity-marker': { binding: 'entity:sensor.one', area: 'area-a' } },
  });
  assert.equal(result.relocateIds.has('entity-marker'), true);

  const cleanup = resolve({
    devices: [device({ marker: {
      id: 'device-1', binding: 'device:device-1', removed: true,
    } })],
    snapshot: { 'device-1': { binding: 'device:device-1', area: 'area-a' } },
  });
  assert.equal(cleanup.decisions[0].removeSnapshot, true);
  assert.deepEqual(applyAreaRelocationResolution(
    { 'device-1': { binding: 'device:device-1', area: 'area-a' } }, cleanup,
  ), {});
});

test('a new marker without saved layout establishes a silent baseline', () => {
  const result = resolve();
  assert.equal(result.decisions[0].reason, 'new-without-layout');
  assert.equal(result.relocateIds.size, 0);
  assert.deepEqual(applyAreaRelocationResolution({}, result), {
    'device-1': { binding: 'device:device-1', area: 'area-b' },
  });
});

test('rebind establishes a new baseline instead of inventing an Area transition', () => {
  const rebound = device({ bindingRef: 'device-2' });
  const previous = { 'device-1': { binding: 'device:device-1', area: 'area-a' } };
  const result = resolve({
    devices: [rebound],
    snapshot: previous,
  });
  assert.equal(result.relocateIds.size, 0);
  assert.equal(result.decisions[0].reason, 'new-without-layout');
  assert.deepEqual(applyAreaRelocationResolution(previous, result), {
    'device-1': { binding: 'device:device-2', area: 'area-b' },
  });
});

test('unresolved duplicate Area and non-authoritative registry are no-ops', () => {
  const duplicate = [{ ...model[0], rooms: [...model[0].rooms, room('duplicate', 'area-b', 0)] }];
  assert.equal(resolve({ model: duplicate }).decisions[0].reason, 'target-unresolved');
  assert.deepEqual(resolve({ authoritative: false }), { decisions: [], relocateIds: new Set() });
});

test('orphan cleanup uses full registry evidence instead of the presentation roster', () => {
  const snapshot = {
    orphan: { binding: 'device:orphan', area: 'area-a' },
    'canonical-device-id': { binding: 'device:device-row', area: 'area-a' },
  };
  const live = cleanup({
    snapshot,
    registryDevices: { orphan: {}, 'device-row': {} },
  });
  assert.deepEqual(live.removeIds, new Set());
  assert.deepEqual(live.candidates, new Map());
  assert.equal(live.needsConfirmationRefresh, false);
  const result = resolve({ devices: [], snapshot, cleanupSnapshotIds: live.removeIds });
  assert.deepEqual(applyAreaRelocationResolution(snapshot, result), {
    orphan: snapshot.orphan,
    'canonical-device-id': snapshot['canonical-device-id'],
  });
});

test('empty registry namespaces never confirm destructive snapshot cleanup', () => {
  const snapshot = {
    dev: { binding: 'device:gone', area: 'area-a' },
    ent: { binding: 'entity:sensor.gone', area: 'area-a' },
  };
  const previousCandidates = new Map([
    ['device:gone', 1], ['entity:sensor.gone', 1],
  ]);
  const result = cleanup({
    snapshot, revision: 2, registryDevices: {}, registryEntities: {},
    previousCandidates,
  });
  assert.deepEqual(result.removeIds, new Set());
  assert.deepEqual(result.candidates, previousCandidates);
  assert.equal(result.needsConfirmationRefresh, false);
});

test('exact live entity state preserves registry-less snapshot provenance', () => {
  for (const state of ['on', 'unavailable', 'unknown']) {
    const snapshot = { ent: { binding: 'entity:sensor.yaml', area: 'area-a' } };
    const result = cleanup({
      snapshot,
      registryEntities: { 'sensor.other': {} },
      liveStates: { 'sensor.yaml': { state } },
      previousCandidates: new Map([['entity:sensor.yaml', 0]]),
    });
    assert.deepEqual(result.removeIds, new Set(), state);
    assert.deepEqual(result.candidates, new Map(), state);
  }
});

test('a live saved marker preserves matching id or binding but a tombstone does not', () => {
  const snapshot = {
    byId: { binding: 'device:old-binding', area: 'area-a' },
    byBinding: { binding: 'device:marker-binding', area: 'area-a' },
    removed: { binding: 'device:removed', area: 'area-a' },
  };
  const first = cleanup({
    snapshot,
    markers: [
      { id: 'byId', binding: 'device:new-binding' },
      { id: 'another-id', binding: 'device:marker-binding' },
      { id: 'removed', binding: 'device:removed', removed: true },
    ],
  });
  assert.deepEqual(first.candidates, new Map([['device:removed', 1]]));
  const second = cleanup({
    snapshot, revision: 2, previousCandidates: first.candidates,
    markers: [
      { id: 'byId', binding: 'device:new-binding' },
      { id: 'another-id', binding: 'device:marker-binding' },
      { id: 'removed', binding: 'device:removed', removed: true },
    ],
  });
  assert.deepEqual(second.removeIds, new Set(['removed']));
});

test('snapshot cleanup requires two distinct non-empty authoritative revisions', () => {
  const snapshot = {
    orphan: { binding: 'device:orphan', area: 'area-a' },
    keep: { binding: 'device:keep', area: 'area-a' },
  };
  const first = cleanup({ snapshot, registryDevices: { keep: {} }, revision: 7 });
  assert.deepEqual(first.removeIds, new Set());
  assert.deepEqual(first.candidates, new Map([['device:orphan', 7]]));
  assert.equal(first.needsConfirmationRefresh, true);

  const repeated = cleanup({
    snapshot, registryDevices: { keep: {} }, revision: 7,
    previousCandidates: first.candidates,
  });
  assert.deepEqual(repeated.removeIds, new Set());
  assert.equal(repeated.needsConfirmationRefresh, false);

  const confirmed = cleanup({
    snapshot, registryDevices: { keep: {} }, revision: 8,
    previousCandidates: repeated.candidates,
  });
  assert.deepEqual(confirmed.removeIds, new Set(['orphan']));
  const resolution = resolve({
    devices: [], snapshot, cleanupSnapshotIds: confirmed.removeIds,
  });
  assert.deepEqual(applyAreaRelocationResolution(snapshot, resolution), {
    keep: snapshot.keep,
  });
});

test('binding recovery clears absence evidence and a later loss starts over', () => {
  const snapshot = { orphan: { binding: 'device:orphan', area: 'area-a' } };
  const first = cleanup({ snapshot, revision: 10 });
  const recovered = cleanup({
    snapshot, revision: 11, registryDevices: { live: {}, orphan: {} },
    previousCandidates: first.candidates,
  });
  assert.deepEqual(recovered.candidates, new Map());
  assert.deepEqual(recovered.removeIds, new Set());
  const lostAgain = cleanup({
    snapshot, revision: 12, previousCandidates: recovered.candidates,
  });
  assert.deepEqual(lostAgain.candidates, new Map([['device:orphan', 12]]));
  assert.deepEqual(lostAgain.removeIds, new Set());
  assert.equal(lostAgain.needsConfirmationRefresh, true);
});

test('limited frames and runtime reset do not confirm an earlier absence', () => {
  const snapshot = { orphan: { binding: 'device:orphan', area: 'area-a' } };
  const first = cleanup({ snapshot, revision: 20 });
  const limited = cleanup({
    snapshot, revision: 21, authoritative: false,
    previousCandidates: first.candidates,
  });
  assert.deepEqual(limited.removeIds, new Set());
  assert.deepEqual(limited.candidates, first.candidates);
  const remounted = cleanup({ snapshot, revision: 22, previousCandidates: new Map() });
  assert.deepEqual(remounted.removeIds, new Set());
  assert.deepEqual(remounted.candidates, new Map([['device:orphan', 22]]));
});

test('non-authoritative registry preserves orphan snapshots', () => {
  const snapshot = { orphan: { binding: 'device:orphan', area: 'area-a' } };
  const result = resolve({ devices: [], snapshot, authoritative: false });
  assert.deepEqual(result, { decisions: [], relocateIds: new Set() });
  assert.deepEqual(applyAreaRelocationResolution(snapshot, result), snapshot);
});

test('failed delete does not advance relocation provenance', () => {
  const previous = { 'device-1': { binding: 'device:device-1', area: 'area-a' } };
  const result = resolve({ snapshot: previous });
  assert.deepEqual(applyAreaRelocationResolution(previous, result), previous);
});

test('defensive snapshot reader drops malformed entries without poisoning valid ones', () => {
  assert.deepEqual(markerAreaSnapshotOf({
    good: { binding: 'entity:sensor.good', area: 'kitchen' },
    bad: { binding: 'virtual', area: 'kitchen' },
    empty: { binding: 'device:x', area: '' },
  }), { good: { binding: 'entity:sensor.good', area: 'kitchen' } });
});

test('defensive snapshot reader keeps the newest entries when over its limit', () => {
  const source = Object.fromEntries(Array.from(
    { length: MARKER_AREA_SNAPSHOT_LIMIT + 2 },
    (_, index) => [`entry-${index}`, { binding: `device:${index}`, area: 'area-a' }],
  ));
  const snapshot = markerAreaSnapshotOf(source);
  assert.equal(Object.keys(snapshot).length, MARKER_AREA_SNAPSHOT_LIMIT);
  assert.equal(Object.hasOwn(snapshot, 'entry-0'), false);
  assert.equal(Object.hasOwn(snapshot, 'entry-1'), false);
  assert.deepEqual(snapshot['entry-2'], { binding: 'device:2', area: 'area-a' });
  assert.deepEqual(snapshot[`entry-${MARKER_AREA_SNAPSHOT_LIMIT + 1}`], {
    binding: `device:${MARKER_AREA_SNAPSHOT_LIMIT + 1}`, area: 'area-a',
  });
});

test('marker deletion and rebind cleanup remove only their own lifecycle entries', () => {
  const source = {
    keep: { binding: 'device:keep', area: 'living' },
    deleted: { binding: 'device:deleted', area: 'hall' },
    rebound: { binding: 'entity:sensor.old', area: 'kitchen' },
  };
  assert.deepEqual(removeMarkerAreaSnapshots(source, ['deleted', 'rebound']), {
    keep: source.keep,
  });
  assert.equal(Object.hasOwn(source, 'deleted'), true, 'helper must not mutate config input');
});
