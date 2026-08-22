import test from 'node:test';
import assert from 'node:assert/strict';

import {
  collectSpaceMarkerDependencies, createSpaceDeletionCandidate,
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
    markerIds: ['all', 'position', 'room'], count: 3,
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
