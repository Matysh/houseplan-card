import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createSpaceCopyCandidate, newSpaceCopySeed, nextSpaceCopyTitle, SpaceCopyError,
} from '../test-build/space-copy.js';
import { optimizePlans } from '../test-build/plan-optimizer.js';
import { makeLargeHouseFixture } from '../demo/fixtures/large-house.mjs';

const fixture = () => ({
  model_version: 9,
  spaces: [
    { id: 'before', title: 'Before', rooms: [], wall_segments: [], view_box: [0, 0, 1, 1] },
    {
      id: 'source', title: 'First floor', view_box: [0.1, 0.2, 0.7, 0.6], cell_cm: 1,
      rooms: [{ id: 'room', name: 'Kitchen', poly: [[0, 0], [1, 0], [1, 1]] }],
      wall_segments: [
        { id: 'wall-a', a: [0, 0], b: [1, 0], cm: 20, owners: ['room'] },
        { id: 'wall-b', a: [1, 0], b: [1, 1], cm: 0, owners: ['room'] },
      ],
      partitions: [{ id: 'part-a', a: [0.5, 0], b: [0.5, 1], cm: 10, style: { keep: true } }],
      openings: [
        {
          id: 'door', type: 'door', x: 0.25, y: 0, angle: 0, length: 0.2,
          host: { kind: 'wall', id: 'wall-a', t: 0.25 },
          contact: 'binary_sensor.door', lock: 'lock.door', invert: true,
        },
        {
          id: 'passage', type: 'passage', x: 0.5, y: 0.6, angle: 90, length: 0.3,
          host: { kind: 'partition', id: 'part-a', t: 0.6 }, flip_h: true,
        },
      ],
      decor: [{ id: 'decor-a', kind: 'rect', x: 0.2, y: 0.3, style: { color: '#123456' } }],
      wall_columns: [{ id: 'column-a', x: 0.7, y: 0.8, cm: 20, shape: 'square' }],
      room_drafts: [{ id: 'draft-a', path: [[0, 0], [0.2, 0.2]] }],
      open_spans: [{ a: [0, 0], b: [0.1, 0] }],
      walls: [{ key: 'legacy', cm: 15 }],
      settings: { show_names: false, nested: { keep: true } },
      zero_wall_style: 'solid',
      plan_url: '/api/houseplan/plan/source.svg', plan_aspect: 1.5,
      plan_x: 0.1, plan_y: 0.2, plan_scale: 1.2,
      plan_scale_x: -1, plan_scale_y: 0.9, plan_angle: 12,
      future_room_bound_field: { must_not_copy: true },
    },
    { id: 'after', title: 'After', rooms: [], wall_segments: [], view_box: [0, 0, 1, 1] },
  ],
  markers: [{ id: 'device', space: 'source', room_id: 'room', vacuum: { map_routes: [{ space: 'source' }] } }],
  settings: { global: true },
});

test('#456 chooses the first free numbered copy title', () => {
  const spaces = [{ title: 'Floor' }, { title: 'Floor (2)' }, { title: 'Floor (4)' }];
  assert.equal(nextSpaceCopyTitle(' Floor ', spaces, 'Space'), 'Floor (3)');
  assert.equal(nextSpaceCopyTitle('', [{ title: 'Space (2)' }], 'Space'), 'Space (3)');
});

test('#456 copies the complete allowed physical surface without room or device ownership', () => {
  const input = fixture();
  const before = structuredClone(input);
  const result = createSpaceCopyCandidate(input, 'source', '  My copy  ', 'seed');
  const copy = result.space;

  assert.deepEqual(input, before, 'preview must be immutable');
  assert.deepEqual(result.config.spaces.map((space) => space.id), ['before', 'source', 'sseed', 'after']);
  assert.equal(copy.title, 'My copy');
  assert.deepEqual(copy.rooms, []);
  assert.deepEqual(copy.wall_segments, []);
  assert.deepEqual(copy.partitions.map(({ id, a, b, cm }) => ({ id, a, b, cm })), [
    { id: 'cwseed0', a: [0, 0], b: [1, 0], cm: 20 },
    { id: 'cwseed1', a: [1, 0], b: [1, 1], cm: 0 },
    { id: 'cpseed2', a: [0.5, 0], b: [0.5, 1], cm: 10 },
  ]);
  assert.equal(Object.hasOwn(copy.partitions[2], 'style'), false, 'unknown wall metadata is not copied');
  assert.deepEqual(copy.openings.map((opening) => ({
    id: opening.id, host: opening.host, contact: opening.contact, lock: opening.lock,
  })), [
    { id: 'coseed3', host: { kind: 'partition', id: 'cwseed0', t: 0.25 }, contact: undefined, lock: undefined },
    { id: 'coseed4', host: { kind: 'partition', id: 'cpseed2', t: 0.6 }, contact: undefined, lock: undefined },
  ]);
  assert.equal(copy.openings[0].invert, true);
  assert.equal(copy.openings[1].flip_h, true);
  assert.equal(copy.decor[0].id, 'cdseed5');
  assert.equal(copy.wall_columns[0].id, 'ccseed6');
  for (const key of [
    'settings', 'zero_wall_style', 'cell_cm', 'view_box', 'plan_url', 'plan_aspect',
    'plan_x', 'plan_y', 'plan_scale', 'plan_scale_x', 'plan_scale_y', 'plan_angle',
  ]) assert.deepEqual(copy[key], before.spaces[1][key], key);
  for (const key of ['room_drafts', 'open_spans', 'walls', 'future_room_bound_field']) {
    assert.equal(Object.hasOwn(copy, key), false, key);
  }
  assert.deepEqual(result.config.markers, before.markers, 'markers and vacuum routes stay untouched');
  assert.deepEqual(result.config.settings, before.settings, 'global settings stay untouched');

  copy.settings.nested.keep = false;
  copy.decor[0].style.color = '#ffffff';
  assert.equal(input.spaces[1].settings.nested.keep, true, 'settings are deep-copied');
  assert.equal(input.spaces[1].decor[0].style.color, '#123456', 'decor is deep-copied');
});

test('#456 rejects missing and unknown opening hosts instead of losing an opening', () => {
  const missing = fixture();
  delete missing.spaces[1].openings[0].host;
  assert.throws(
    () => createSpaceCopyCandidate(missing, 'source', 'Copy', 'seed'),
    (error) => error instanceof SpaceCopyError && error.code === 'opening_host_missing',
  );

  const unknown = fixture();
  unknown.spaces[1].openings[0].host.id = 'gone';
  assert.throws(
    () => createSpaceCopyCandidate(unknown, 'source', 'Copy', 'seed'),
    (error) => error instanceof SpaceCopyError && error.code === 'opening_host_unknown',
  );
});

test('#456 enforces backend collection boundaries before producing a candidate', () => {
  const atSpaceLimit = fixture();
  atSpaceLimit.spaces.push(...Array.from({ length: 47 }, (_, index) => ({
    id: `extra-${index}`, title: `Extra ${index}`, rooms: [], wall_segments: [], view_box: [0, 0, 1, 1],
  })));
  assert.throws(
    () => createSpaceCopyCandidate(atSpaceLimit, 'source', 'Copy', 'seed'),
    (error) => error instanceof SpaceCopyError && error.code === 'spaces_limit',
  );

  const tooManyWalls = fixture();
  tooManyWalls.spaces[1].wall_segments = Array.from({ length: 2001 }, (_, index) => ({
    id: `w-${index}`, a: [index / 3000, 0], b: [index / 3000, 1], cm: 10,
  }));
  tooManyWalls.spaces[1].openings = [];
  tooManyWalls.spaces[1].partitions = [];
  assert.throws(
    () => createSpaceCopyCandidate(tooManyWalls, 'source', 'Copy', 'seed'),
    (error) => error instanceof SpaceCopyError && error.code === 'partitions_limit',
  );
});

test('#456 generated seeds are bounded, deterministic at the test seam and title-free', () => {
  assert.equal(newSpaceCopySeed(123456789, 0.5), '21i3v94zsow');
  assert.match(newSpaceCopySeed(), /^[a-z0-9]+$/);
});

test('#456 the large-house floor keeps every wall and opening after Optimize', () => {
  const fixture = makeLargeHouseFixture();
  const optimized = optimizePlans(fixture.config, fixture.layout);
  const source = optimized.config.spaces[0];
  const result = createSpaceCopyCandidate(
    optimized.config, source.id, `${source.title} copy`, 'large',
  );
  assert.equal(result.space.rooms.length, 0);
  assert.equal(result.space.wall_segments.length, 0);
  assert.equal(
    result.space.partitions.length,
    source.wall_segments.length + (source.partitions?.length || 0),
  );
  assert.equal(result.space.openings.length, source.openings.length);
  assert.ok(result.space.openings.every((opening) => opening.host.kind === 'partition'));
});
