import test from 'node:test';
import assert from 'node:assert/strict';

import {
  collectSpaceMarkerDependencies, createSpaceDeletionCandidate, spaceDeletionMessage,
} from '../test-build/space-deletion.js';

test('issue 244 space dependency count deduplicates all three reference paths', () => {
  const config = {
    spaces: [{ id: 'f1', rooms: [{ id: 'r1' }] }, { id: 'f2', rooms: [] }],
    markers: [
      { id: 'all', binding: 'virtual', space: 'f1', room_id: 'r1' },
      { id: 'room', binding: 'virtual', space: 'f2', room_id: 'r1' },
      { id: 'position', binding: 'virtual', space: 'f2' },
      { id: 'removed', binding: 'virtual', space: 'f1', room_id: 'r1', removed: true },
    ],
    settings: {},
  };
  const layout = {
    all: { s: 'f1' }, room: { s: 'f2' }, position: { s: 'f1' }, removed: { s: 'f1' },
  };
  assert.deepEqual(collectSpaceMarkerDependencies(config, layout, 'f1'), {
    markerIds: ['all', 'position', 'room'], count: 3, routeMarkerIds: [], routeCount: 0,
  });
  const blocked = createSpaceDeletionCandidate(config, layout, 'f1');
  assert.deepEqual(blocked.config, config);
  assert.deepEqual(blocked.layout, layout);
});

test('issue 244 successful delete removes owned layout and only tombstone placement fields', () => {
  const removed = {
    id: 'removed', binding: 'entity:light.old', removed: true,
    space: 'f1', room_id: 'r1', name: 'Kept', icon: 'mdi:lightbulb',
    pdfs: [{ name: 'Kept', url: '/local/kept.pdf' }],
  };
  const config = {
    spaces: [{ id: 'f1', rooms: [{ id: 'r1' }] }, { id: 'f2', rooms: [] }],
    markers: [removed], settings: {},
  };
  const layout = {
    removed: { s: 'f1', x: 0.2, y: 0.3 },
    rl_r1: { s: 'f1', x: 0.4, y: 0.5 },
    opaque: { s: 'f1', x: 0.6, y: 0.7 },
    kept: { s: 'f2', x: 0.1, y: 0.1 },
  };
  const result = createSpaceDeletionCandidate(config, layout, 'f1');

  assert.deepEqual(result.config.spaces.map((item) => item.id), ['f2']);
  assert.deepEqual(result.layout, { kept: layout.kept });
  assert.equal(result.config.markers[0].space, undefined);
  assert.equal(result.config.markers[0].room_id, undefined);
  assert.equal(result.config.markers[0].name, 'Kept');
  assert.deepEqual(result.config.markers[0].pdfs, removed.pdfs);
  assert.equal(config.markers[0].space, 'f1', 'input is immutable');
  assert.equal(layout.opaque.s, 'f1', 'layout input is immutable');
});

test('issue 244 deleting the last unoccupied space produces an explicit empty model', () => {
  const config = {
    spaces: [{ id: 'only', rooms: [{ id: 'room-only' }] }],
    markers: [],
    settings: { keep: true },
  };
  const result = createSpaceDeletionCandidate(config, {
    rl_room_only: { s: 'only', x: 0.5, y: 0.5 },
  }, 'only');
  assert.deepEqual(result.config.spaces, []);
  assert.deepEqual(result.config.settings, { keep: true });
  assert.deepEqual(result.layout, {});
});

test('issue 244 deleting the last occupied space detaches placement but preserves markers', () => {
  const config = {
    spaces: [{ id: 'only', rooms: [{ id: 'room-only' }] }],
    markers: [
      {
        id: 'direct', binding: 'virtual', space: 'only', room_id: 'room-only',
        name: 'Direct', icon: 'mdi:lightbulb', actions: [{ tap: 'more-info' }],
      },
      {
        id: 'room', binding: 'entity:sensor.room', space: 'legacy', room_id: 'room-only',
        name: 'Room', removed: true,
      },
      { id: 'position', binding: 'entity:sensor.position', name: 'Position' },
      { id: 'unrelated', binding: 'virtual', space: 'legacy', name: 'Unrelated' },
    ],
    settings: { keep: true },
  };
  const layout = {
    direct: { s: 'only', x: 0.1, y: 0.2 },
    position: { s: 'only', x: 0.3, y: 0.4 },
    rl_room_only: { s: 'only', x: 0.5, y: 0.6 },
  };
  const result = createSpaceDeletionCandidate(config, layout, 'only');

  assert.equal(result.dependencies.count, 2);
  assert.deepEqual(result.config.spaces, []);
  assert.deepEqual(result.layout, {});
  assert.deepEqual(result.config.markers.map((marker) => ({
    id: marker.id, space: marker.space, room: marker.room_id, name: marker.name,
  })), [
    { id: 'direct', space: undefined, room: undefined, name: 'Direct' },
    { id: 'room', space: undefined, room: undefined, name: 'Room' },
    { id: 'position', space: undefined, room: undefined, name: 'Position' },
    { id: 'unrelated', space: 'legacy', room: undefined, name: 'Unrelated' },
  ]);
  assert.equal(result.config.markers[0].icon, 'mdi:lightbulb');
  assert.deepEqual(result.config.markers[0].actions, [{ tap: 'more-info' }]);
  assert.equal(config.markers[0].space, 'only', 'input config is immutable');
  assert.equal(layout.direct.s, 'only', 'input layout is immutable');
});

// --- #162: карты робота, назначенные удаляемому пространству -----------------

const routeCfg = () => ({
  spaces: [{ id: 'floor1', rooms: [] }, { id: 'floor2', rooms: [] }],
  markers: [{
    id: 'robot', space: 'floor1',
    vacuum: {
      source: 'camera.robot',
      map_routes: [
        { id: 'r1', source: 'camera.robot', map_id: 'm1', space: 'floor1', calibration: [1, 0, 0, 0, 1, 0] },
        { id: 'r2', source: 'camera.robot', map_id: 'm2', space: 'floor2', calibration: [2, 0, 0, 0, 2, 0] },
      ],
    },
  }],
});

test('#162 удаление пространства считает чужие карты роботов отдельно', () => {
  const report = collectSpaceMarkerDependencies(routeCfg(), {}, 'floor2');
  assert.deepEqual(report.markerIds, [], 'док робота живёт на другом этаже и удалению не мешает');
  assert.deepEqual(report.routeMarkerIds, ['robot']);
  assert.equal(report.routeCount, 1);
});

test('#162 маркер В удаляемом пространстве не считается дважды', () => {
  const report = collectSpaceMarkerDependencies(routeCfg(), {}, 'floor1');
  assert.deepEqual(report.markerIds, ['robot']);
  assert.deepEqual(report.routeMarkerIds, [], 'он уже в блокирующем списке');
});

test('#162 удаление уносит только свои маршруты, док и соседние карты целы', () => {
  const { config } = createSpaceDeletionCandidate(routeCfg(), {}, 'floor2');
  const marker = config.markers[0];
  assert.equal(marker.space, 'floor1', 'док остался на своём этаже');
  assert.deepEqual(marker.vacuum.map_routes.map((r) => r.id), ['r1']);
  assert.equal(marker.vacuum.source, 'camera.robot', 'корневой источник не тронут');
});

test('#162 легаси-калибровка удалением пространства не трогается', () => {
  const cfg = {
    spaces: [{ id: 'floor1', rooms: [] }, { id: 'floor2', rooms: [] }],
    markers: [{ id: 'robot', space: 'floor1', vacuum: { source: 'camera.robot', calibration: { m1: [1, 0, 0, 0, 1, 0] } } }],
  };
  const { config } = createSpaceDeletionCandidate(cfg, {}, 'floor2');
  assert.deepEqual(config.markers[0].vacuum.calibration, { m1: [1, 0, 0, 0, 1, 0] });
});

test('#162 текст подтверждения называет число карт, а без них не меняется', () => {
  const base = 'Пространство будет удалено.';
  const template = 'Также будет снято сопоставление карт роботов: {count}.';
  assert.equal(spaceDeletionMessage(base, template, 0), base);
  assert.equal(spaceDeletionMessage(base, template, 2),
    'Пространство будет удалено. Также будет снято сопоставление карт роботов: 2.');
});
