// #780: the lazy LED chunk and its gate, judged by results (ТЗ §3, §5, §6,
// §13.1, §13.2; AC2, AC7, AC9, AC11, AC17 unit parts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ledAnchor, ledStripsByMarker } from '../test-build/led-strip-gate.js';
import { faceContext, ledFrame, ledStripView, stripRoom } from '../test-build/led-strip-runtime.js';
import { LedFieldCache, buildFieldGeometry, falloffAt } from '../test-build/led-strip-field.js';
import { GLOW_FALLOFF } from '../test-build/glow-scene.js';
import { stripAnchor } from '../test-build/led-strip-geometry.js';

const space = (strips) => ({ id: 's', rooms: [], led_strips: strips });

test('ТЗ §13.1: only an active, bound strip with geometry is represented', () => {
  const map = ledStripsByMarker(space([
    { id: 'a', points: [[0, 0], [1, 0]], marker: 'm1' },
    { id: 'b', points: [[0, 0], [1, 0]], marker: 'm2', active: true },
    { id: 'c', points: [[0, 0], [1, 0]], marker: 'm3', active: false },
    { id: 'd', points: [[0, 0], [1, 0]], marker: null },
    { id: 'e', points: [[0, 0]], marker: 'm5' },
  ]));
  assert.deepEqual([...map.keys()].sort(), ['m1', 'm2']);
  assert.equal(ledStripsByMarker(space([])).size, 0);
  assert.equal(ledStripsByMarker(null).size, 0);
});

test('AC2: the gate anchor equals the geometry anchor (half length) in render units', () => {
  const cases = [
    [[0, 0], [10, 0], [10, 10]], [[0, 0], [4, 0]], [[0, 0], [9, 0], [9, 1]],
    [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]], [[0, 0], [0, 0], [4, 0], [4, 0]],
    [[1, 1], [1, 1]],
  ];
  for (const points of cases) {
    const reference = stripAnchor(points);
    const gate = ledAnchor(points, 100);
    assert.ok(Math.abs(gate.x - reference[0] * 100) < 1e-9 && Math.abs(gate.y - reference[1] * 100) < 1e-9,
      `${JSON.stringify(points)}: ${JSON.stringify(gate)} vs ${reference}`);
  }
});

test('ТЗ §3: the linear falloff is the shared GLOW_FALLOFF', () => {
  for (const [offset, value] of GLOW_FALLOFF) {
    assert.ok(Math.abs(falloffAt(offset / 100) - value) < 1e-12, `${offset}%`);
  }
  assert.equal(falloffAt(0), 1);
  assert.equal(falloffAt(1), 0);
  assert.equal(falloffAt(2), 0);
  // Monotonic: the field never brightens away from the strip.
  let previous = 1;
  for (let i = 0; i <= 100; i++) {
    const value = falloffAt(i / 100);
    assert.ok(value <= previous + 1e-12);
    previous = value;
  }
});

const device = (extra = {}) => ({ id: 'm1', name: 'Kitchen LED', primary: 'light.led', space: 's', ...extra });
const strip = { id: 'a', points: [[0, 0], [1, 0]], marker: 'm1' };

test('AC7: states — off white, on, unavailable without a field; radius 50 cm or the own one', () => {
  const base = { strip, defaultRadius: 10, cellCm: 5, gridPitch: 1, glow: true };
  const on = ledStripView({ ...base, device: device(), hass: { states: { 'light.led': { state: 'on' } } },
    candidate: { key: 's|m1', sourceEid: 'light.led', pos: { x: 0, y: 0 }, radius: 3, appearance: { c: '#ff0000', alpha: 0.5 } } });
  assert.equal(on.state, 'on');
  assert.deepEqual(on.appearance, { c: '#ff0000', alpha: 0.5 });
  assert.equal(on.radius, 10, 'the shared radius of ordinary sources does not apply: 50 cm default');
  const off = ledStripView({ ...base, device: device(), hass: { states: { 'light.led': { state: 'off' } } },
    candidate: { key: 's|m1', sourceEid: 'light.led', pos: { x: 0, y: 0 }, radius: 3, appearance: null } });
  assert.equal(off.state, 'off');
  for (const raw of ['unavailable', 'unknown']) {
    const view = ledStripView({ ...base, device: device(), hass: { states: { 'light.led': { state: raw } } },
      candidate: { key: 's|m1', sourceEid: 'light.led', pos: { x: 0, y: 0 }, radius: 3, appearance: { c: '#fff', alpha: 1 } } });
    assert.equal(view.state, 'unavailable', raw);
    assert.equal(view.appearance, null, `${raw}: no field`);
  }
  const own = ledStripView({ ...base, device: device({ marker: { glow_radius_cm: 100 } }),
    hass: { states: { 'light.led': { state: 'on' } } }, candidate: null });
  assert.equal(own.radius, 20, 'the personal radius wins (100 cm / 5 cm per cell)');
});

// A scene with one opaque square body [4,6]×[4,6] and a 10×10 room floor.
const body = [[4, 4], [6, 4], [6, 6], [4, 6]];
const floor = [[0, 0], [10, 0], [10, 10], [0, 10]];
const scene = {
  occluders: body.map((p, i) => [p[0], p[1], body[(i + 1) % 4][0], body[(i + 1) % 4][1]]),
  floor: [floor], fingerprint: 'f1', masonryGeometry: [], opaqueBodies: [body],
};
const polygons = [{ room: { id: 'r' }, poly: floor }];

test('ТЗ §6: every piece is clipped to what its own emitters see; a buried strip emits nothing', () => {
  const faces = faceContext(scene, 1e-6);
  const geometry = buildFieldGeometry({ points: [[1, 1], [9, 1]], radius: 2, scene, polygons, faces, spaceId: 's' });
  assert.ok(geometry, 'a free strip has a field');
  assert.equal(geometry.pieces.length, 4, 'an 8-unit segment with r = 2 makes four pieces');
  for (const piece of geometry.pieces) assert.equal(piece.clip, null, 'nothing within r: the bands are the bound');
  // Passing 0.5 below the body: the pieces near it are clipped to their own fans.
  const near = buildFieldGeometry({ points: [[0.5, 3.5], [9.5, 3.5]], radius: 1, scene, polygons, faces, spaceId: 's' });
  const clipped = near.pieces.filter((piece) => piece.clip);
  assert.ok(clipped.length >= 2 && clipped.length < near.pieces.length, `${clipped.length} of ${near.pieces.length}`);
  for (const piece of clipped) {
    assert.ok(piece.clip.length > 0);
    // No fan vertex lies inside the body: light never passes into or through it.
    for (const d of piece.clip) {
      for (const [, x, y] of d.matchAll(/[ML]([-\d.e]+) ([-\d.e]+)/g)) {
        assert.ok(!(+x > 4 + 1e-6 && +x < 6 - 1e-6 && +y > 4 + 1e-6 && +y < 6 - 1e-6), `${x},${y}`);
      }
    }
  }
  const buried = buildFieldGeometry({ points: [[4.5, 5], [5.5, 5]], radius: 2, scene, polygons, faces, spaceId: 's' });
  assert.equal(buried, null, 'entirely inside the body: no field');
});

test('AC17: the field cache is bounded, per space, and counts geometry rebuilds', () => {
  const cache = new LedFieldCache(3);
  cache.forSpace('a');
  for (let i = 0; i < 5; i++) cache.read(`k${i}`, () => ({ pieces: [], box: { x: 0, y: 0, w: 1, h: 1 } }));
  assert.equal(cache.size, 3);
  assert.equal(cache.recomputes, 5);
  cache.read('k4', () => { throw new Error('a hit must not rebuild'); });
  assert.equal(cache.recomputes, 5);
  cache.forSpace('b');
  assert.equal(cache.size, 0, 'another space frees the previous one');
});

test('AC9: the frame gives every strip the 50 cm default, not the shared radius; unbound strips have no view', () => {
  const lamp = { id: 'm1', name: 'Lamp', primary: 'light.led', entities: ['light.led'], space: 's', marker: { id: 'm1', binding: 'device:m1' } };
  const frame = ledFrame({
    space: { id: 's', vb: [0, 0, 1000, 1000], rooms: [], led_strips: [
      { id: 'a', points: [[0.1, 0.1], [0.4, 0.1]], marker: 'm1' },
      { id: 'b', points: [[0.1, 0.3], [0.4, 0.3]], marker: null },
    ] },
    devices: [lamp],
    hass: { states: { 'light.led': { state: 'on', attributes: {} } } },
    defaultColor: '#ffd27b', paletteAlpha: 0.7, cellCm: 5, gridPitch: 1000 / 240, iconPct: 3.4,
    scene: null, polygons: [], glowFor: () => true, inRoom: () => false, showHidden: false,
  });
  assert.equal(frame.views.length, 1, 'the unbound strip is not a View strip');
  assert.ok(Math.abs(frame.views[0].radius - (50 / 5) * (1000 / 240)) < 1e-9, `radius ${frame.views[0].radius}`);
});

test('AC2/r1 M2: an explicit valid room_id wins over the anchor room; a stale one falls back', () => {
  const rooms = [{ id: 'A' }, { id: 'B' }];
  const inA = (point, room) => room.id === 'A' && point[0] < 500;
  const frameWith = (roomId) => ledFrame({
    space: { id: 's', vb: [0, 0, 1000, 1000], rooms, led_strips: [
      // Anchor (half length) at x = 250: geometrically inside A.
      { id: 'a', points: [[0.1, 0.1], [0.4, 0.1]], marker: 'm1' },
    ] },
    devices: [{ id: 'm1', name: 'Lamp', primary: 'light.led', entities: ['light.led'], space: 's',
      marker: { id: 'm1', binding: 'device:m1', ...(roomId === undefined ? {} : { room_id: roomId }) } }],
    hass: { states: { 'light.led': { state: 'on', attributes: {} } } },
    defaultColor: '#ffd27b', paletteAlpha: 0.7, cellCm: 5, gridPitch: 1000 / 240, iconPct: 3.4,
    scene: null, polygons: [], glowFor: (room) => room.id === 'B', inRoom: inA, showHidden: false,
  });
  assert.equal(frameWith(undefined).views[0].glow, false, 'no room_id: the anchor room A decides (Glow off)');
  assert.equal(frameWith('B').views[0].glow, true, 'explicit room_id B wins over the geometric A');
  assert.equal(frameWith('Z').views[0].glow, false, 'a stale room_id falls back to the geometry');
  assert.equal(stripRoom(rooms, 'B', [250, 100], inA)?.id, 'B');
  assert.equal(stripRoom(rooms, null, [250, 100], inA)?.id, 'A');
  assert.equal(stripRoom(rooms, null, null, inA), undefined);
});

test('AC17/r1 M5: a released owner retains nothing; the stats count visibility entries and fans', async () => {
  const { ledFieldCache, ledFieldStats, releaseLedField } = await import('../test-build/led-strip-field.js');
  const owner = {};
  const cache = ledFieldCache(owner);
  cache.forSpace('a');
  cache.read('k1', () => ({ pieces: [{ d: 'M0 0', clip: ['M0 0 Z', 'M1 1 Z'] }, { d: 'M1 1', clip: null }], box: { x: 0, y: 0, w: 1, h: 1 } }));
  cache.read('k2', () => null);
  assert.deepEqual(ledFieldStats(owner), { visibility: 2, sources: 2, recomputes: 2 });
  releaseLedField(owner);
  assert.deepEqual(ledFieldStats(owner), { visibility: 0, sources: 0, recomputes: 0 });
  assert.notEqual(ledFieldCache(owner), cache, 'a new mount starts a new cache');
});
