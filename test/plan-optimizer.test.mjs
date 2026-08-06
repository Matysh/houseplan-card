import test from 'node:test';
import assert from 'node:assert/strict';

import { optimizePlans, PLAN_MODEL_VERSION } from '../test-build/plan-optimizer.js';
import { GRID_STEP_N as S } from '../test-build/space-geometry.js';
import { wallKey } from '../test-build/wall-thickness.js';

const room = (id, x0, x1, openTo) => ({
  id,
  name: id,
  area: null,
  poly: [[x0, 0], [x1, 0], [x1, 1], [x0, 1]],
  ...(openTo ? { open_to: [openTo] } : {}),
});

test('optimizePlans migrates, aligns and canonicalises idempotently', () => {
  const config = {
    spaces: [{
      id: 'f1', title: 'Floor', view_box: [0, 0, 1, 1], cell_cm: 5,
      segments: [[0, 0, 1, 0]],
      rooms: [room('a', 0, 0.5, 'b'), room('b', 0.5, 1, 'a')],
      walls: [
        { key: wallKey([0, 0], [0.25, 0], S), a: [0, 0], b: [0.25, 0], cm: 20 },
        { key: wallKey([0.25, 0], [0.5, 0], S), a: [0.25, 0], b: [0.5, 0], cm: 20 },
      ],
      decor: [{
        id: 't1', kind: 'text', x: S / 3, y: S / 3,
        text: 'Now {}', entity: 'sensor.temp', attr: 'state', size: 'm',
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
  assert.equal(first.config.spaces[0].decor[0].scale, 1);
  assert.equal('entity' in first.config.spaces[0].decor[0], false);
  assert.equal(first.config.spaces[0].open_spans.length, 1);
  assert.equal(first.config.spaces[0].walls.length, 1);
  assert.equal(first.layout.m1.x % S, 0);

  const second = optimizePlans(first.config, first.layout);
  assert.equal(second.changed, false);
  assert.deepEqual(second.config, first.config);
  assert.deepEqual(second.layout, first.layout);
});
