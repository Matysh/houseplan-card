import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  canonicalImportRoot, repairSpaceReferences,
} from '../test-build/space-reference-repair.js';

const lineageFixture = JSON.parse(readFileSync(
  new URL('./fixtures/import-id-lineage.json', import.meta.url), 'utf8',
));

const space = (id, rooms = []) => ({
  id, title: id, cell_cm: 5, view_box: [0, 0, 1, 1], rooms,
});
const room = (id, area = null) => ({ id, name: id, area, x: 0, y: 0, w: 1, h: 1 });
const emptyOwnerReport = {
  orphanRoomLabelsRemoved: 0,
  orphanDevicePositionsRemoved: 0,
  orphanGroupPositionsRemoved: 0,
  liveMissingPositionsRemoved: 0,
  removedPositions: [],
  liveMissingPositions: [],
  unverifiedPositions: [],
  registryAuthoritative: false,
};

test('issue 265 Python/TypeScript lineage fixture stays strict and bounded', () => {
  for (const item of lineageFixture.cases) {
    assert.deepEqual(canonicalImportRoot(item.prefix, item.value), {
      root: item.root, layers: item.layers, bounded: item.bounded,
    });
  }
  for (const item of lineageFixture.generated) {
    let value = item.seed;
    for (let index = 0; index < item.wraps; index++) {
      value = `${item.prefix}_${value}_deadbeef`;
    }
    assert.deepEqual(canonicalImportRoot(item.prefix, value), {
      root: item.root, layers: item.layers, bounded: item.bounded,
    });
  }
});

test('issue 265 Optimize resolves an import-of-import lineage without guessing', () => {
  const importedSpace = 'space_space_f1_deadbeef_cafebabe';
  const importedRoom = 'room_room_living_0123abcd_deadbeef';
  const result = repairSpaceReferences({
    spaces: [space(importedSpace, [room(importedRoom)])],
    markers: [{
      id: 'vac', binding: 'device:vac', space: 'space_f1_11111111',
      room_id: 'room_living_22222222',
      vacuum: { segment_map: { 12: 'room_living_33333333' } },
    }],
    settings: {},
  }, { vac: { s: 'space_f1_11111111', x: 0.2, y: 0.3 } });

  assert.equal(result.config.markers[0].space, importedSpace);
  assert.equal(result.config.markers[0].room_id, importedRoom);
  assert.equal(result.config.markers[0].vacuum.segment_map[12], importedRoom);
  assert.equal(result.layout.vac.s, importedSpace);
});

test('issue 252 detaches a live marker but preserves its stale coordinates until explicit cleanup', () => {
  const marker = {
    id: 'washer', binding: 'entity:sensor.washer', space: 'gone', room_id: 'gone_room',
    name: 'Washer', icon: 'mdi:washing-machine', tap_action: 'more-info',
    pdfs: [{ name: 'Manual', url: '/local/manual.pdf' }],
  };
  const input = { spaces: [space('home')], markers: [marker], settings: {} };
  const layout = { washer: { s: 'gone', x: 0.25, y: 0.5, k: 1.2 } };
  const result = repairSpaceReferences(input, layout);

  assert.equal(result.changed, true);
  assert.equal(result.report.markersDetached, 1);
  assert.equal(result.report.spaceRefsRemapped, 0);
  assert.equal(result.config.markers[0].space, undefined);
  assert.equal(result.config.markers[0].room_id, undefined);
  assert.deepEqual(result.layout.washer, { s: 'gone', x: 0.25, y: 0.5, k: 1.2 });
  assert.equal(result.report.positionsUnresolved, 1);
  assert.deepEqual(result.report.liveMissingPositions, [{
    id: 'washer', spaceId: 'gone', kind: 'device', name: 'Washer',
  }]);
  assert.equal(result.config.markers[0].binding, marker.binding);
  assert.equal(result.config.markers[0].icon, marker.icon);
  assert.deepEqual(result.config.markers[0].pdfs, marker.pdfs);
  assert.equal(input.markers[0].space, 'gone', 'config input is immutable');
  assert.deepEqual(layout.washer, { s: 'gone', x: 0.25, y: 0.5, k: 1.2 }, 'layout input is immutable');
});

test('issue 244 exact import signatures repair the full reference graph and are idempotent', () => {
  const importedSpace = 'space_f1_deadbeef';
  const importedRoom = 'room_living_cafebabe';
  const input = {
    spaces: [space(importedSpace, [room(importedRoom, 'living_area')])],
    markers: [{
      id: 'vac', binding: 'device:vac', space: 'f1', room_id: 'living',
      vacuum: { segment_map: { 12: 'living' } },
    }],
    settings: {},
  };
  const layout = {
    vac: { s: 'f1', x: 0.25, y: 0.5, k: 1.25 },
    rl_living: { s: 'f1', x: 0.5, y: 0.5 },
  };
  const result = repairSpaceReferences(input, layout);

  assert.equal(result.config.markers[0].space, importedSpace);
  assert.equal(result.config.markers[0].room_id, importedRoom);
  assert.deepEqual(result.config.markers[0].vacuum.segment_map, { 12: importedRoom });
  assert.deepEqual(result.layout.vac, { s: importedSpace, x: 0.25, y: 0.5, k: 1.25 });
  assert.deepEqual(result.layout[`rl_${importedRoom}`], { s: importedSpace, x: 0.5, y: 0.5 });
  assert.equal(result.layout.rl_living, undefined);
  assert.deepEqual(result.report, {
    spaceRefsRemapped: 1,
    roomRefsRemapped: 3,
    positionsRemapped: 2,
    markersDetached: 0,
    positionsUnresolved: 0,
    nestedRefsUnresolved: 0,
    deadSpaceIds: [],
    ...emptyOwnerReport,
  });

  const again = repairSpaceReferences(result.config, result.layout);
  assert.equal(again.changed, false);
  assert.deepEqual(again.report, {
    spaceRefsRemapped: 0,
    roomRefsRemapped: 0,
    positionsRemapped: 0,
    markersDetached: 0,
    positionsUnresolved: 0,
    nestedRefsUnresolved: 0,
    deadSpaceIds: [],
    ...emptyOwnerReport,
  });
});

test('issue 252 Area remap never transplants or silently deletes old coordinates', () => {
  const input = {
    spaces: [space('ground', [room('utility', 'utility_area')])],
    markers: [{
      id: 'washer', binding: 'device:washer', space: 'gone', room_id: 'old_utility',
    }],
    settings: {},
  };
  const result = repairSpaceReferences(input, {
    washer: { s: 'gone', x: 0.9, y: 0.9 },
  }, { effectiveAreaByMarker: { washer: 'utility_area' } });

  assert.equal(result.config.markers[0].space, 'ground');
  assert.equal(result.config.markers[0].room_id, 'utility');
  assert.deepEqual(result.layout.washer, { s: 'gone', x: 0.9, y: 0.9 });
  assert.equal(result.report.positionsUnresolved, 1);
  assert.equal(result.report.liveMissingPositions.length, 1);
  assert.equal(result.report.spaceRefsRemapped, 1);
  assert.equal(result.report.roomRefsRemapped, 1);
  assert.equal(result.report.markersDetached, 0);
});

test('issue 244 ambiguous, truncated and malformed signatures are never guessed', () => {
  const longId = 'x'.repeat(36);
  const input = {
    spaces: [
      space('home'),
      space('space_f1_11111111'), space('space_f1_22222222'),
      space(`space_${longId}_33333333`),
      space('space_bad_UPPERHEX'),
    ],
    markers: [
      { id: 'ambiguous', binding: 'virtual', space: 'f1' },
      { id: 'long', binding: 'virtual', space: longId },
      { id: 'bad', binding: 'virtual', space: 'bad' },
      { id: 'removed', binding: 'virtual', space: 'f1', removed: true },
    ],
    settings: {},
  };
  const result = repairSpaceReferences(input, {});

  assert.equal(result.config.markers[0].space, undefined);
  assert.equal(result.config.markers[1].space, undefined);
  assert.equal(result.config.markers[2].space, undefined);
  assert.equal(result.config.markers[3].space, 'f1', 'removed tombstone is preserved');
  assert.equal(result.report.markersDetached, 3);
  assert.deepEqual(result.report.deadSpaceIds, []);
});

test('issue 244 preserves unresolved layout and nested calibration while reporting it', () => {
  const input = {
    spaces: [space('home', [room('living')])],
    markers: [{
      id: 'vac', binding: 'device:vac', space: 'home',
      vacuum: { segment_map: { 12: 'unknown_room' } },
    }],
    settings: {},
  };
  const layout = { opaque_owner: { s: 'gone', x: 0.2, y: 0.3 } };
  const result = repairSpaceReferences(input, layout);

  assert.equal(result.changed, false);
  assert.deepEqual(result.config.markers[0].vacuum.segment_map, { 12: 'unknown_room' });
  assert.deepEqual(result.layout, layout);
  assert.equal(result.report.nestedRefsUnresolved, 1);
  assert.equal(result.report.positionsUnresolved, 1);
  assert.deepEqual(result.report.unverifiedPositions, [{
    id: 'opaque_owner', spaceId: 'gone', kind: 'unknown', name: '', reason: 'unknown_owner',
  }]);
  assert.deepEqual(result.report.deadSpaceIds, ['gone']);
});

test('issue 244 a valid original space id prevents signature remap', () => {
  const input = {
    spaces: [space('f1'), space('space_f1_deadbeef')],
    markers: [{ id: 'm', binding: 'virtual', space: 'f1' }],
    settings: {},
  };
  const result = repairSpaceReferences(input, { m: { s: 'f1', x: 0.5, y: 0.5 } });
  assert.equal(result.changed, false);
  assert.equal(result.config.markers[0].space, 'f1');
  assert.equal(result.report.spaceRefsRemapped, 0);
});

test('issue 244 removed tombstones accept only an exact signature map', () => {
  const input = {
    spaces: [space('space_f1_deadbeef', [room('room_living_cafebabe')])],
    markers: [
      { id: 'exact', binding: 'virtual', removed: true, space: 'f1', room_id: 'living' },
      { id: 'guess', binding: 'virtual', removed: true, space: 'other', room_id: 'other-room' },
    ],
    settings: {},
  };
  const result = repairSpaceReferences(input, {
    exact: { s: 'f1', x: 0.2, y: 0.3 },
    guess: { s: 'other', x: 0.4, y: 0.5 },
  }, { effectiveAreaByMarker: { guess: 'any-area' } });

  assert.equal(result.config.markers[0].space, 'space_f1_deadbeef');
  assert.equal(result.config.markers[0].room_id, 'room_living_cafebabe');
  assert.deepEqual(result.layout.exact, { s: 'space_f1_deadbeef', x: 0.2, y: 0.3 });
  assert.equal(result.config.markers[1].space, 'other');
  assert.equal(result.config.markers[1].room_id, 'other-room');
  assert.equal(result.layout.guess, undefined);
  assert.equal(result.report.orphanDevicePositionsRemoved, 1);
});

test('issue 244 large valid reference graph stays unchanged in one indexed pass', () => {
  const spaces = Array.from({ length: 120 }, (_, index) => (
    space(`space-${index}`, [room(`room-${index}`, `area-${index}`)])
  ));
  const markers = Array.from({ length: 2400 }, (_, index) => ({
    id: `marker-${index}`,
    binding: `device:marker-${index}`,
    space: `space-${index % spaces.length}`,
    room_id: `room-${index % spaces.length}`,
  }));
  const layout = Object.fromEntries(markers.map((marker, index) => [
    marker.id,
    { s: marker.space, x: (index % 100) / 100, y: ((index * 7) % 100) / 100 },
  ]));

  const result = repairSpaceReferences({ spaces, markers, settings: {} }, layout);
  assert.equal(result.changed, false);
  assert.deepEqual(result.report.deadSpaceIds, []);
  assert.equal(result.report.positionsUnresolved, 0);
  assert.equal(result.config.markers.length, markers.length);
  assert.equal(Object.keys(result.layout).length, markers.length);
});

test('issue 252 removes only proven room, device and group orphans and is idempotent', () => {
  const removedMarkers = Array.from({ length: 3 }, (_, index) => ({
    id: `removed-device-${index}`, binding: 'virtual', removed: true, space: 'deleted-floor',
  }));
  const roomLabels = Object.fromEntries(Array.from({ length: 32 }, (_, index) => [
    `rl_deleted-room-${index}`, { s: 'deleted-floor', x: 0.1, y: 0.2 },
  ]));
  const devicePositions = Object.fromEntries(removedMarkers.map((marker) => [
    marker.id, { s: 'deleted-floor', x: 0.3, y: 0.4 },
  ]));
  const layout = {
    ...roomLabels,
    ...devicePositions,
    'lg_light.deleted_one': { s: 'deleted-floor', x: 0.5, y: 0.6 },
    'lg_light.deleted_two': { s: 'deleted-floor', x: 0.7, y: 0.8 },
  };
  const config = {
    spaces: [space('home', [room('living')])], markers: removedMarkers, settings: {},
  };
  const result = repairSpaceReferences(config, layout, {
    ownerRoster: { authoritative: true, deviceIds: [], entityIds: [] },
  });

  assert.equal(result.changed, true);
  assert.equal(Object.keys(result.layout).length, 0);
  assert.equal(result.report.orphanRoomLabelsRemoved, 32);
  assert.equal(result.report.orphanDevicePositionsRemoved, 3);
  assert.equal(result.report.orphanGroupPositionsRemoved, 2);
  assert.equal(result.report.positionsUnresolved, 0);
  assert.deepEqual(result.report.deadSpaceIds, []);
  assert.deepEqual(layout, {
    ...roomLabels,
    ...devicePositions,
    'lg_light.deleted_one': { s: 'deleted-floor', x: 0.5, y: 0.6 },
    'lg_light.deleted_two': { s: 'deleted-floor', x: 0.7, y: 0.8 },
  }, 'preview must not mutate the source layout');

  const again = repairSpaceReferences(result.config, result.layout, {
    ownerRoster: { authoritative: true, deviceIds: [], entityIds: [] },
  });
  assert.equal(again.changed, false);
  assert.equal(again.report.orphanRoomLabelsRemoved, 0);
  assert.equal(again.report.orphanDevicePositionsRemoved, 0);
  assert.equal(again.report.orphanGroupPositionsRemoved, 0);
});

test('issue 252 preserves live owners by default and removes only them after explicit opt-in', () => {
  const config = {
    spaces: [space('home', [room('living')])],
    markers: [{ id: 'virtual-live', binding: 'virtual', name: 'Hall note' }],
    settings: { known_devices: ['auto-live'] },
  };
  const layout = {
    'virtual-live': { s: 'gone', x: 0.1, y: 0.2 },
    'auto-live': { s: 'gone', x: 0.3, y: 0.4 },
    'lg_light.live': { s: 'gone', x: 0.5, y: 0.6 },
    rl_living: { s: 'gone', x: 0.7, y: 0.8 },
  };
  const context = {
    ownerRoster: {
      authoritative: true,
      deviceIds: ['auto-live'],
      entityIds: ['light.live'],
      names: {
        'virtual-live': 'Hall note',
        'auto-live': 'Washing machine',
        'lg_light.live': 'Living lights',
      },
    },
  };

  const kept = repairSpaceReferences(config, layout, context);
  assert.deepEqual(kept.layout, layout);
  assert.equal(kept.report.positionsUnresolved, 4);
  assert.equal(kept.report.liveMissingPositions.length, 4);
  assert.deepEqual(kept.report.liveMissingPositions.map((item) => item.name).sort(), [
    'Hall note', 'Living lights', 'Washing machine', 'living',
  ].sort());
  assert.equal(kept.report.orphanDevicePositionsRemoved, 0);

  const removed = repairSpaceReferences(config, layout, {
    ...context, removeLiveMissingPositions: true,
  });
  assert.deepEqual(removed.layout, {});
  assert.equal(removed.report.liveMissingPositionsRemoved, 4);
  assert.equal(removed.report.orphanRoomLabelsRemoved, 1);
  assert.equal(removed.report.orphanDevicePositionsRemoved, 2);
  assert.equal(removed.report.orphanGroupPositionsRemoved, 1);
  assert.equal(removed.report.positionsUnresolved, 0);
});

test('issue 252 fails closed for limited registry and unknown future layout owners', () => {
  const config = {
    spaces: [space('home')], markers: [], settings: { known_devices: ['known-old-device'] },
  };
  const layout = {
    'known-old-device': { s: 'gone', x: 0.1, y: 0.2 },
    'lg_light.maybe': { s: 'gone', x: 0.3, y: 0.4 },
    'future_widget:one': { s: 'gone', x: 0.5, y: 0.6 },
  };

  const limited = repairSpaceReferences(config, layout, {
    ownerRoster: { authoritative: false, deviceIds: [], entityIds: [] },
    removeLiveMissingPositions: true,
  });
  assert.deepEqual(limited.layout, layout);
  assert.equal(limited.report.unverifiedPositions.length, 3);
  assert.equal(limited.report.positionsUnresolved, 3);
  assert.deepEqual(limited.report.unverifiedPositions.map((item) => item.reason).sort(), [
    'registry_unavailable', 'registry_unavailable', 'unknown_owner',
  ].sort());

  const authoritative = repairSpaceReferences(config, layout, {
    ownerRoster: { authoritative: true, deviceIds: [], entityIds: [] },
  });
  assert.equal(authoritative.layout['known-old-device'], undefined);
  assert.equal(authoritative.layout['lg_light.maybe'], undefined);
  assert.deepEqual(authoritative.layout['future_widget:one'], layout['future_widget:one']);
  assert.equal(authoritative.report.orphanDevicePositionsRemoved, 1);
  assert.equal(authoritative.report.orphanGroupPositionsRemoved, 1);
  assert.equal(authoritative.report.unverifiedPositions.length, 1);
});

// #869 AC2: старые `grp_<id области>` (v1.0–v1.4.x) — свой вид только для
// объяснения. Статус «не проверено» и отсутствие удаления — при любом реестре и
// при включённом «Убрать старые позиции»; маркеры и устройства проверяются раньше.
test('#869 AC2 legacy grp_* records get their own kind and are never removed', () => {
  const opaque = '601413c5793c698f73b8af0a0b93cac6';
  const config = {
    spaces: [space('home')],
    markers: [
      { id: 'grp_marker', binding: 'virtual', space: 'home', name: 'Group-like marker' },
      { id: 'grp_retired', binding: 'virtual', removed: true, space: 'gone', name: 'Retired' },
    ],
    settings: {},
  };
  const layout = {
    grp_detskaia_elina: { s: 'f2', x: 0.25, y: 0.25 },
    grp_detskaia_maiia: { s: 'f2', x: 0.5, y: 0.5 },
    [opaque]: { s: 'smrnf8s7x', x: 0.75, y: 0.75 },
    grp_marker: { s: 'gone', x: 0.1, y: 0.1 },
    grp_retired: { s: 'gone', x: 0.2, y: 0.2 },
    grp_alive_floor: { s: 'home', x: 0.3, y: 0.3 },
  };
  const roster = (authoritative) => ({ authoritative, deviceIds: [], entityIds: [], names: {} });
  for (const context of [
    {},
    { ownerRoster: roster(false) },
    { ownerRoster: roster(false), removeLiveMissingPositions: true },
    { ownerRoster: roster(true) },
    { ownerRoster: roster(true), removeLiveMissingPositions: true },
  ]) {
    const label = JSON.stringify(context);
    const result = repairSpaceReferences(config, layout, context);
    for (const key of ['grp_detskaia_elina', 'grp_detskaia_maiia', opaque, 'grp_alive_floor']) {
      assert.deepEqual(result.layout[key], layout[key], `${label}: ${key} stays byte-for-byte`);
    }
    assert.deepEqual(result.report.unverifiedPositions, [
      { id: 'grp_detskaia_elina', spaceId: 'f2', kind: 'legacy_group', name: '', reason: 'legacy_group' },
      { id: 'grp_detskaia_maiia', spaceId: 'f2', kind: 'legacy_group', name: '', reason: 'legacy_group' },
      { id: opaque, spaceId: 'smrnf8s7x', kind: 'unknown', name: '', reason: 'unknown_owner' },
    ], label);
    // A marker id wins over the prefix: a device, exactly as before.
    assert.deepEqual(result.report.liveMissingPositions.map((item) => [item.id, item.kind]),
      [['grp_marker', 'device']], label);
    assert.ok(result.report.removedPositions.some((item) => item.id === 'grp_retired'
      && item.kind === 'device'), `${label}: a removed marker is still proven absent`);
    // Only records of missing spaces reach the block — the basis of «you can leave them».
    for (const item of result.report.unverifiedPositions) {
      assert.equal(config.spaces.some((sp) => sp.id === item.spaceId), false, `${label}: ${item.id}`);
    }
    assert.equal(result.report.registryAuthoritative, context.ownerRoster?.authoritative === true, label);
  }
});
