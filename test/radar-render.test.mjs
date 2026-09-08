import test from 'node:test';
import assert from 'node:assert/strict';

import { renderRadarLive } from '../test-build/radar-render.js';

const frame = (state) => ({
  marker_id: 'radar', targets: [], ranges: [],
  zones: [{ id: 'desk', state, polygon: [[.1, .1], [.3, .1], [.3, .3]] }],
});

test('known occupied radar zones render server-owned geometry only', () => {
  const occupied = renderRadarLive([frame(true)], { x: 0, y: 0, w: 1000, h: 1000 }, (p) => p);
  const zone = occupied.values[0].values[4][0];
  assert.match(zone.strings.join(''), /class="radar-zone"/);
  assert.equal(zone.values[0], 'desk');
  assert.equal(zone.values[1], '100,100 300,100 300,300');

  const empty = renderRadarLive([frame(false)], { x: 0, y: 0, w: 1000, h: 1000 }, (p) => p);
  assert.equal(empty, Symbol.for('lit-nothing'));
});
