/** The target must consume the data, not merely tolerate unknown JSON keys. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { convertEasy } from '../scripts/sh3d-convert/easy.mjs';
import { spaceDisplayOf } from '../test-build/logic.js';
import { northDegOf, sunRaysOn } from '../test-build/sun.js';
import { planRect } from '../test-build/space-geometry.js';

test('#937 actual HP consumers read imported light/compass settings and backdrop placement', () => {
  const source = { type: 'custom:easy-floorplan-card', width: 600, height: 400, north: 90, sunlight: true,
    image: '/local/plan.png', walls: [{ x1: 0, y1: 0, x2: 600, y2: 0 }],
    items: [{ entity: 'light.room', x: 300, y: 200, glow: true }] };
  const space = convertEasy(JSON.stringify(source)).documents[0].payload.config.spaces[0];
  assert.equal(spaceDisplayOf(space).glow, true);
  assert.equal(northDegOf({ north_deg: 270 }, space.settings), 90);
  assert.equal(sunRaysOn({ sun_rays: false }, space.settings), true);
  const rect = planRect(space, 1), wall = space.partitions[0];
  assert(Math.abs(rect.x - wall.a[0]) < 1e-8);
  assert(Math.abs(rect.y - wall.a[1]) < 1e-8);
  assert(Math.abs(rect.w / rect.h - 1.5) < 1e-8);
  delete source.north; delete source.sunlight;
  const defaults = convertEasy(JSON.stringify(source)).documents[0].payload.config.spaces[0];
  assert.equal(northDegOf({ north_deg: 270 }, defaults.settings), 0);
  assert.equal(sunRaysOn({ sun_rays: true }, defaults.settings), false,
    'source default OFF must not accidentally inherit the target installation’s ON');
});
