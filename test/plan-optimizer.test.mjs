import test from 'node:test';
import assert from 'node:assert/strict';

import {
  collapseIsolatedWallThicknessIslands, optimizePlans, PLAN_MODEL_VERSION,
} from '../test-build/plan-optimizer.js';
import { GRID_PITCH, GRID_STEP_N as S, NORM_W } from '../test-build/space-geometry.js';
import { wallKey } from '../test-build/wall-thickness.js';

const room = (id, x0, x1, openTo) => ({
  id,
  name: id,
  area: null,
  poly: [[x0, 0], [x1, 0], [x1, 1], [x0, 1]],
  ...(openTo ? { open_to: [openTo] } : {}),
});

const exactWall = (a, b, cm) => ({ key: wallKey(a, b, S), a, b, cm });

const microIntervalFixture = (length = S / 3, middleCm = 15, rightCm = 22) => {
  const x0 = 0.2, split = 0.5, x1 = 0.8, y = 0.2;
  return {
    rooms: [{ id: 'r1', poly: [[x0, y], [x1, y], [x1, 0.8], [x0, 0.8]] }],
    walls: [
      exactWall([x0, y], [split, y], 22),
      exactWall([split, y], [split + length, y], middleCm),
      exactWall([split + length, y], [x1, y], rightCm),
    ],
  };
};

test('Optimize collapses one isolated thickness micro-interval and is idempotent', () => {
  const fixture = microIntervalFixture();
  const config = {
    model_version: PLAN_MODEL_VERSION,
    spaces: [{
      id: 'micro', title: 'Micro', view_box: [0, 0, 1, 1], cell_cm: 5,
      rooms: fixture.rooms, walls: fixture.walls,
    }],
    markers: [], settings: {},
  };
  const before = JSON.parse(JSON.stringify(config));
  const first = optimizePlans(config, {});
  assert.deepEqual(config, before, 'preview must not mutate its input');
  assert.equal(first.changed, true);
  assert.equal(first.report.canonicalized, 1);
  assert.equal(first.report.wallsMerged, 2);
  assert.equal(first.config.spaces[0].walls.length, 1);
  assert.equal(first.config.spaces[0].walls[0].cm, 22);
  assert.deepEqual(first.config.spaces[0].walls[0].a, [0.2, 0.2]);
  assert.deepEqual(first.config.spaces[0].walls[0].b, [0.8, 0.2]);

  const second = optimizePlans(first.config, first.layout);
  assert.equal(second.changed, false);
  assert.equal(second.report.canonicalized, 0);
  assert.equal(second.report.wallsMerged, 0);
  assert.deepEqual(second.config, first.config);
});

test('micro-interval cleanup has a strict half-step boundary at both coordinate scales', () => {
  for (const length of [S / 3, S / 2, S / 2 + S / 100]) {
    const fixture = microIntervalFixture(length);
    const normalized = collapseIsolatedWallThicknessIslands(
      fixture.rooms, fixture.walls, [], S, 5, S, 1,
    );
    const normalizedMiddle = normalized.find((wall) => wall.a?.[0] === 0.5);
    assert.equal(normalizedMiddle?.cm, length < S / 2 ? 22 : 15, `normalized length=${length}`);

    const renderRooms = fixture.rooms.map((item) => ({
      ...item, poly: item.poly.map(([x, y]) => [x * NORM_W, y * NORM_W]),
    }));
    const rendered = collapseIsolatedWallThicknessIslands(
      renderRooms, fixture.walls, [], S, 5, GRID_PITCH, NORM_W,
    );
    const renderMiddle = rendered.find((wall) => wall.a?.[0] === 0.5);
    assert.equal(renderMiddle?.cm, length < S / 2 ? 22 : 15, `render length=${length}`);
  }
});

test('micro-interval cleanup preserves ambiguous and topological boundaries', () => {
  const unequal = microIntervalFixture(S / 3, 15, 20);
  assert.deepEqual(
    collapseIsolatedWallThicknessIslands(unequal.rooms, unequal.walls, [], S, 5, S),
    unequal.walls,
    'different neighbour thicknesses have no unambiguous replacement',
  );

  const overlapping = microIntervalFixture();
  overlapping.walls.splice(2, 0, { ...overlapping.walls[1], cm: 18 });
  assert.deepEqual(
    collapseIsolatedWallThicknessIslands(overlapping.rooms, overlapping.walls, [], S, 5, S),
    overlapping.walls,
    'conflicting exact owners of the same micro-interval are ambiguous',
  );

  const atVertex = microIntervalFixture();
  atVertex.rooms[0].poly.splice(1, 0, [0.5, 0.2]);
  assert.deepEqual(
    collapseIsolatedWallThicknessIslands(atVertex.rooms, atVertex.walls, [], S, 5, S),
    atVertex.walls,
    'a room vertex at the island endpoint is a topology boundary',
  );

  const atOpening = microIntervalFixture();
  const cut = [[0.45, 0.2, 0.5, 0.2]];
  assert.deepEqual(
    collapseIsolatedWallThicknessIslands(atOpening.rooms, atOpening.walls, cut, S, 5, S),
    atOpening.walls,
    'an open-cut endpoint at the island boundary blocks cleanup',
  );

  const chain = microIntervalFixture(S / 3, 15, 22);
  const y = 0.2, firstEnd = 0.5 + S / 3, secondEnd = firstEnd + S / 3;
  chain.walls = [
    exactWall([0.2, y], [0.5, y], 22),
    exactWall([0.5, y], [firstEnd, y], 15),
    exactWall([firstEnd, y], [secondEnd, y], 16),
    exactWall([secondEnd, y], [0.8, y], 22),
  ];
  assert.deepEqual(
    collapseIsolatedWallThicknessIslands(chain.rooms, chain.walls, [], S, 5, S),
    chain.walls,
    'a chain of different micro-intervals must not collapse cumulatively',
  );
});

test('optimizePlans migrates, aligns and canonicalises idempotently', () => {
  const config = {
    spaces: [{
      id: 'f1', title: 'Floor', view_box: [0, 0, 1, 1], cell_cm: 5,
      plan_scale: 0.75,
      segments: [[0, 0, 1, 0]],
      rooms: [room('a', 0, 0.5, 'b'), room('b', 0.5, 1, 'a')],
      walls: [
        { key: wallKey([0, 0], [0.25, 0], S), a: [0, 0], b: [0.25, 0], cm: 20 },
        { key: wallKey([0.25, 0], [0.5, 0], S), a: [0.25, 0], b: [0.5, 0], cm: 20 },
      ],
      decor: [{
        id: 't1', kind: 'text', x: S / 3, y: S / 3,
        text: 'Now {}', entity: 'sensor.temp', attr: 'state', size: 'm',
      }, {
        id: 'l1', kind: 'line', x1: 0, y1: 0, x2: 1, y2: 0, width: 3,
      }],
    }],
    markers: [{
      id: 'm1', binding: 'virtual', display: 'ripple',
      vacuum: { trail: false },
    }],
    settings: {},
  };
  const layout = { m1: { s: 'f1', x: S / 3, y: S / 3 } };

  const first = optimizePlans(config, layout);
  assert.equal(first.changed, true);
  assert.equal(first.config.model_version, PLAN_MODEL_VERSION);
  assert.equal('segments' in first.config.spaces[0], false);
  assert.equal(first.config.markers[0].display, 'icon_ripple');
  assert.deepEqual(first.config.markers[0].vacuum, { trail_mode: 'never' });
  assert.equal(first.config.spaces[0].decor[0].text, 'Now {sensor.temp}');
  assert.equal(first.config.spaces[0].decor[0].size_cm, 24);
  assert.equal('scale' in first.config.spaces[0].decor[0], false);
  assert.equal(first.config.spaces[0].decor[1].width_cm, 3.6);
  assert.equal('width' in first.config.spaces[0].decor[1], false);
  assert.equal(first.config.spaces[0].plan_scale_x, 0.75);
  assert.equal(first.config.spaces[0].plan_scale_y, 0.75);
  assert.equal('plan_scale' in first.config.spaces[0], false);
  assert.equal('entity' in first.config.spaces[0].decor[0], false);
  assert.equal(first.config.spaces[0].open_spans.length, 1);
  assert.equal(first.config.spaces[0].walls.length, 1);
  assert.equal(first.layout.m1.x % S, 0);

  const second = optimizePlans(first.config, first.layout);
  assert.equal(second.changed, false);
  assert.deepEqual(second.config, first.config);
  assert.deepEqual(second.layout, first.layout);
});

test('legacy physical decor fields are clamped to the persisted schema', () => {
  const result = optimizePlans({
    spaces: [{
      id: 'f1', title: 'Floor', view_box: [0, 0, 1, 1], cell_cm: 1000,
      rooms: [],
      decor: [
        { id: 'wide', kind: 'line', x1: 0, y1: 0, x2: 1, y2: 0, width: 300 },
        { id: 'thin', kind: 'line', x1: 0, y1: 0, x2: 1, y2: 0, width: 0 },
        { id: 'huge', kind: 'text', x: 0, y: 0, text: 'X', scale: 20 },
      ],
    }],
    markers: [], settings: {},
  }, {});
  const [wide, thin, huge] = result.config.spaces[0].decor;
  assert.equal(wide.width_cm, 100);
  assert.equal(thin.width_cm, 0.1);
  assert.equal(huge.size_cm, 2000);
});

test('invalid legacy plan_scale is preserved instead of being counted as migrated', () => {
  const result = optimizePlans({
    model_version: PLAN_MODEL_VERSION,
    spaces: [{
      id: 'f1', title: 'Floor', view_box: [0, 0, 1, 1],
      plan_scale: 'broken', rooms: [],
    }],
    markers: [], settings: {},
  }, {});
  assert.equal(result.config.spaces[0].plan_scale, 'broken');
  assert.equal(result.report.migrated, 0);
});

test('model version bookkeeping does not claim a data migration', () => {
  const result = optimizePlans({
    model_version: PLAN_MODEL_VERSION - 1,
    spaces: [], markers: [], settings: {},
  }, {});
  assert.equal(result.changed, false);
  assert.equal(result.config.model_version, PLAN_MODEL_VERSION - 1);
  assert.equal(result.report.modelTo, PLAN_MODEL_VERSION - 1);
  assert.equal(result.report.migrated, 0);
});

test('optimizer never downgrades a model from a newer client', () => {
  const future = PLAN_MODEL_VERSION + 1;
  const result = optimizePlans({
    model_version: future,
    spaces: [], markers: [], settings: {},
  }, {});
  assert.equal(result.changed, false);
  assert.equal(result.config.model_version, future);
  assert.equal(result.report.modelTo, future);
});

test('legacy filled shapes receive the canonical fill fields', () => {
  const result = optimizePlans({
    model_version: PLAN_MODEL_VERSION,
    spaces: [{
      id: 'f1', title: 'Floor', view_box: [0, 0, 1, 1], rooms: [],
      decor: [{
        id: 'r1', kind: 'rect', x: 0, y: 0, w: 0.2, h: 0.2,
        color: '#123456', fill: true,
      }],
    }],
    markers: [], settings: {},
  }, {});
  assert.equal(result.config.spaces[0].decor[0].fill_color, '#123456');
  assert.equal(result.config.spaces[0].decor[0].fill_opacity, 0.25);
});

test('optimizer removes legacy self-control without inventing a light source', () => {
  const result = optimizePlans({
    model_version: PLAN_MODEL_VERSION - 1,
    spaces: [],
    markers: [{
      id: 'hood', binding: 'entity:switch.hood',
      controls: ['switch.hood', 'input_boolean.legacy', 'light.mirror', 'light.mirror'],
    }],
    settings: {},
  }, {});
  assert.deepEqual(result.config.markers[0].controls, [
    'input_boolean.legacy', 'light.mirror', 'light.mirror',
  ]);
  assert.equal(result.config.markers[0].is_light, undefined);
  assert.equal(result.config.model_version, PLAN_MODEL_VERSION);
  assert.equal(result.report.migrated, 1);
});

test('optimizer repairs legacy cell_cm values into the server schema range', () => {
  const result = optimizePlans({
    spaces: [
      { id: 'high', title: 'High', view_box: [0, 0, 1, 1], cell_cm: 5000, rooms: [] },
      { id: 'low', title: 'Low', view_box: [0, 0, 1, 1], cell_cm: 0.01, rooms: [] },
      { id: 'bad', title: 'Bad', view_box: [0, 0, 1, 1], cell_cm: 'NaN', rooms: [] },
      { id: 'zero', title: 'Zero', view_box: [0, 0, 1, 1], cell_cm: 0, rooms: [] },
      { id: 'null', title: 'Null', view_box: [0, 0, 1, 1], cell_cm: null, rooms: [] },
      { id: 'negative', title: 'Negative', view_box: [0, 0, 1, 1], cell_cm: -2, rooms: [] },
    ],
    markers: [], settings: {},
  }, {});
  assert.deepEqual(result.config.spaces.map((space) => space.cell_cm), [1000, 0.1, 5, 5, 5, 5]);
  assert.equal(result.report.migrated, 6);
});

test('optimizer separates legacy Glow from data fill without losing explicit booleans', () => {
  const result = optimizePlans({
    spaces: [{
      id: 'legacy', title: 'Legacy', view_box: [0, 0, 1, 1],
      settings: { fill_mode: 'glow', glow_enabled: false, future: 'kept' },
      rooms: [
        { ...room('a', 0, 0.5), settings: { fill_mode: 'glow', future: 1 } },
        { ...room('b', 0.5, 1), settings: { fill_mode: 'glow', glow: false } },
      ],
    }],
    markers: [], settings: {},
  }, {});
  const space = result.config.spaces[0];
  assert.equal(space.settings.fill_mode, 'none');
  assert.equal(space.settings.glow_enabled, false);
  assert.equal(space.settings.future, 'kept');
  assert.deepEqual(space.rooms[0].settings, { future: 1, glow: true });
  assert.deepEqual(space.rooms[1].settings, { glow: false });
  assert.equal(result.report.migrated, 3);
  assert.equal(result.report.glowSpacesMigrated, 1);
  assert.equal(result.report.glowRoomsMigrated, 2);
  const again = optimizePlans(result.config, result.layout);
  assert.equal(again.changed, false);
});

test('optimizer canonicalises only an explicitly stored square-column angle', () => {
  const result = optimizePlans({
    spaces: [{
      id: 'f1', title: 'Floor', view_box: [0, 0, 1, 1], rooms: [],
      wall_columns: [
        { id: 'implicit', shape: 'square', center: [0.2, 0.2], cm: 30 },
        { id: 'explicit', shape: 'square', center: [0.4, 0.4], cm: 30, angle: 95 },
      ],
    }],
    markers: [], settings: {},
  }, {});
  const [implicit, explicit] = result.config.spaces[0].wall_columns;
  assert.equal('angle' in implicit, false);
  assert.equal(explicit.angle, 5);
});
