// #780: the lazy LED chunk and its gate, judged by results (ТЗ §3, §5, §6,
// §13.1, §13.2; AC2, AC7, AC9, AC11, AC17 unit parts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ledAnchor, ledStripsByMarker } from '../test-build/led-strip-gate.js';
import { faceContext, ledFrame, ledStripView, stripRoom } from '../test-build/led-strip-runtime.js';
import { LED_FIELD_BANDS, LedFieldCache, buildFieldGeometry, falloffAt } from '../test-build/led-strip-field.js';
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

test('#784: the continuous field has enough bands to avoid visible gradient steps', () => {
  assert.ok(LED_FIELD_BANDS >= 32, `${LED_FIELD_BANDS} bands are visibly discrete on wide fields`);
  const fraction = 0.5;
  const band = Math.floor((1 - fraction) * LED_FIELD_BANDS);
  const midpoint = 1 - (band + 0.5) / LED_FIELD_BANDS;
  const exact = falloffAt(fraction);
  assert.ok(Math.abs(falloffAt(midpoint) - exact) / exact <= 0.1,
    `${LED_FIELD_BANDS} bands must approximate r/2 within 10%`);
});

const device = (extra = {}) => ({ id: 'm1', name: 'Kitchen LED', primary: 'light.led', space: 's', ...extra });
const strip = { id: 'a', points: [[0, 0], [1, 0]], marker: 'm1' };

test('#784/AC7: states — off white, on, unavailable without a field; radius 30 cm or the own one', () => {
  const base = { strip, defaultRadius: 6, cellCm: 5, gridPitch: 1, glow: true };
  const on = ledStripView({ ...base, device: device(), hass: { states: { 'light.led': { state: 'on' } } },
    candidate: { key: 's|m1', sourceEid: 'light.led', pos: { x: 0, y: 0 }, radius: 3, appearance: { c: '#ff0000', alpha: 0.5 } } });
  assert.equal(on.state, 'on');
  assert.deepEqual(on.appearance, { c: '#ff0000', alpha: 0.5 });
  assert.equal(on.radius, 6, 'the shared radius of ordinary sources does not apply: 30 cm default');
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
const pieceFans = (piece) => typeof piece.clip === 'string'
  ? piece.clip.match(/M[^M]+/g)?.map((d) => d.trim()) ?? [] : piece.clip;

test('ТЗ §6: every piece is clipped to what its own emitters see; a buried strip emits nothing', () => {
  const faces = faceContext(scene, 1e-6);
  const geometry = buildFieldGeometry({ points: [[1, 1], [9, 1]], radius: 2, scene, polygons, faces, spaceId: 's' });
  assert.ok(geometry, 'a free strip has a field');
  assert.equal(geometry.pieces.length, 4, 'an 8-unit segment with r = 2 makes four pieces');
  assert.equal((geometry.d.match(/M/g) || []).length, 1,
    'visibility/cache pieces do not split the painted path');
  for (const piece of geometry.pieces) {
    assert.ok(piece.sourceCount >= 2, 'free pieces retain filled visibility fans for the shared clip');
    assert.ok(pieceFans(piece).every((d) => /\bA2 2\b/.test(d) && !/\bL/.test(d)),
      'an unobstructed fan is an exact SVG disc, not a visible polygon');
  }
  // Passing 0.5 below the body: the pieces near it are clipped to their own fans.
  const near = buildFieldGeometry({ points: [[0.5, 3.5], [9.5, 3.5]], radius: 1, scene, polygons, faces, spaceId: 's' });
  const clipped = near.pieces.filter((piece) => /\bL/.test(piece.clip));
  assert.ok(clipped.length >= 2 && clipped.length < near.pieces.length, `${clipped.length} of ${near.pieces.length}`);
  for (const piece of clipped) {
    assert.ok(piece.clip.length > 0);
    assert.ok(/\bA1 1\b/.test(piece.clip),
      'unblocked parts of a clipped fan retain exact circular arcs');
    // No fan vertex lies inside the body: light never passes into or through it.
    for (const d of pieceFans(piece)) {
      for (const [, x, y] of d.matchAll(/[ML]([-\d.e]+) ([-\d.e]+)/g)) {
        assert.ok(!(+x > 4 + 1e-6 && +x < 6 - 1e-6 && +y > 4 + 1e-6 && +y < 6 - 1e-6), `${x},${y}`);
      }
    }
  }
  const buried = buildFieldGeometry({ points: [[4.5, 5], [5.5, 5]], radius: 2, scene, polygons, faces, spaceId: 's' });
  assert.equal(buried, null, 'entirely inside the body: no field');
});

test('#784: a corner and a closed strip remain one painted path', () => {
  const faces = faceContext(scene, 1e-6);
  const corner = buildFieldGeometry({ points: [[1, 1], [9, 1], [9, 9]], radius: 2,
    scene, polygons, faces, spaceId: 's' });
  assert.ok(corner && corner.pieces.length > 1);
  assert.equal((corner.d.match(/M/g) || []).length, 1);
  assert.match(corner.d, /L9 1 L9 9$/);
  const closed = buildFieldGeometry({ points: [[1, 1], [3, 1], [3, 3], [1, 3], [1, 1]], radius: 1,
    scene, polygons, faces, spaceId: 's' });
  assert.ok(closed);
  assert.equal((closed.d.match(/M/g) || []).length, 1);
  assert.match(closed.d, / Z$/);
});

test('#785: a mixed free/wall polyline keeps visibility for every piece', () => {
  const faces = faceContext(scene, 1e-6);
  const mixed = buildFieldGeometry({ points: [[1, 1], [8, 1], [10, 1], [10, 7]], radius: 2,
    scene, polygons, faces, spaceId: 's' });
  assert.ok(mixed && mixed.pieces.length > 3);
  assert.equal(mixed.pieces.every((piece) => piece.clip.length > 0), true,
    'free pieces use filled discs and blocked pieces use visibility polygons');
  assert.equal(mixed.pieces.some((piece) => piece.sourceCount >= 4), true,
    'the long free run retains several overlapping visibility discs');
});

test('#786: reversing a free strip keeps two equally smooth circular end fans', () => {
  const freeScene = { ...scene, occluders: [], fingerprint: 'free' };
  const forward = buildFieldGeometry({ points: [[1, 2], [9, 3]], radius: 2,
    scene: freeScene, polygons, faces: null, spaceId: 's' });
  const reverse = buildFieldGeometry({ points: [[9, 3], [1, 2]], radius: 2,
    scene: freeScene, polygons, faces: null, spaceId: 's' });
  for (const geometry of [forward, reverse]) {
    assert.ok(geometry);
    const fans = geometry.pieces.flatMap(pieceFans);
    assert.ok(fans.length >= 2);
    assert.ok(fans.every((d) => (d.match(/\bA2 2\b/g) || []).length === 2));
    assert.ok(fans.every((d) => !/\bL/.test(d)), 'no order-dependent polygon chord at either end');
  }
});

// A free fan's centre follows from its exact two-arc disc. This checks the
// generated coverage, not the sampler's implementation or a source regex.
const discCenters = (geometry, radius) => geometry.pieces.flatMap(pieceFans).map((d) => {
  const start = /^M([-\d.e]+) ([-\d.e]+) A/.exec(d);
  assert.ok(start, `expected a free-space disc: ${d}`);
  return [Number(start[1]) + radius, Number(start[2])];
});
const hasCenter = (centers, point, epsilon = 1e-4) =>
  centers.some((center) => Math.hypot(center[0] - point[0], center[1] - point[1]) < epsilon);

// Sample the emitted circular SVG arcs and measure the resulting ring. The
// sign is an observable geometry property: nonzero clipping unions rings of
// the same winding, but subtracts a negative disc from a positive blocked fan.
const fanSignedArea = (d) => {
  const tokens = d.match(/[MLAZ]|-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g);
  const points = [];
  let i = 0;
  while (i < tokens.length) {
    const command = tokens[i++];
    if (command === 'M' || command === 'L') {
      points.push([Number(tokens[i++]), Number(tokens[i++])]);
    } else if (command === 'A') {
      const radius = Number(tokens[i++]);
      assert.equal(Number(tokens[i++]), radius, 'the field uses circular arcs');
      i++; // axis rotation does not affect a circle
      const large = Number(tokens[i++]), sweep = Number(tokens[i++]);
      const end = [Number(tokens[i++]), Number(tokens[i++])];
      const start = points.at(-1), dx = (start[0] - end[0]) / 2, dy = (start[1] - end[1]) / 2;
      const distance2 = dx * dx + dy * dy;
      if (distance2 < 1e-20) continue;
      const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, (radius * radius - distance2) / distance2));
      const center = [(start[0] + end[0]) / 2 + k * dy, (start[1] + end[1]) / 2 - k * dx];
      const a = Math.atan2(start[1] - center[1], start[0] - center[0]);
      const b = Math.atan2(end[1] - center[1], end[0] - center[0]);
      let delta = ((b - a) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
      if (!sweep) delta -= 2 * Math.PI;
      const steps = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 24)));
      for (let step = 1; step < steps; step++) {
        const angle = a + delta * step / steps;
        points.push([center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle)]);
      }
      points.push(end);
    } else assert.equal(command, 'Z');
  }
  return points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length];
    return area + point[0] * next[1] - point[1] * next[0];
  }, 0) / 2;
};

test('#788: free discs and wall-limited fans have additive winding in a shared clip', () => {
  const geometry = buildFieldGeometry({ points: [[0.5, 3.5], [9.5, 3.5]], radius: 1,
    scene, polygons, faces: faceContext(scene, 1e-6), spaceId: 's' });
  const fans = geometry.pieces.flatMap(pieceFans);
  assert.ok(fans.some((d) => d.includes(' L')), 'fixture includes blocked fans');
  assert.ok(fans.some((d) => !d.includes(' L')), 'fixture includes free discs');
  for (const fan of fans) assert.ok(fanSignedArea(fan) > 0, 'all subpaths add coverage instead of cancelling it');
});

test('#788: a wall crossing the radius contributes exact circle-intersection events', () => {
  const wallScene = { ...scene, occluders: [[595, 100, 595, 700]], fingerprint: 'long-wall' };
  const geometry = buildFieldGeometry({ points: [[350, 350], [585, 450]], radius: 50,
    scene: wallScene, polygons: [], faces: null, spaceId: 's' });
  const endpointFan = geometry.pieces.flatMap(pieceFans).at(-1);
  // The true endpoint is (585,450), 10 units from the wall. Its disc meets
  // that wall at y=450±sqrt(50²−10²), not at an arbitrary 30-degree ray.
  const intersections = [...endpointFan.matchAll(/(?:[ML]|A[-\d.e]+ [-\d.e]+ \d \d \d )595 ([-\d.e]+)/g)]
    .map((match) => Number(match[1]));
  for (const y of [450 - Math.sqrt(2400), 450 + Math.sqrt(2400)]) {
    assert.ok(intersections.some((at) => Math.abs(at - y) < 1e-4), `missing wall/radius event at y=${y}`);
  }
});

test('#788: a residual run retains the true free endpoint in both directions', () => {
  const freeScene = { ...scene, occluders: [], fingerprint: 'free-endpoints' };
  for (const radius of [0.2, 2, 20]) {
    for (const angle of [0, 0.37, 1.2]) {
      const points = [[0, 0], [1.245 * radius * Math.cos(angle), 1.245 * radius * Math.sin(angle)]];
      for (const path of [points, [...points].reverse()]) {
        const geometry = buildFieldGeometry({ points: path, radius, scene: freeScene,
          polygons: [], faces: null, spaceId: 's' });
        const centers = discCenters(geometry, radius);
        for (const endpoint of points) {
          assert.ok(hasCenter(centers, endpoint), `r=${radius}, angle=${angle}: missing endpoint ${endpoint}`);
        }
      }
    }
  }
});

test('#788: acute outer turns retain their vertex fan independently of sampling cuts', () => {
  const freeScene = { ...scene, occluders: [], fingerprint: 'acute-vertices' };
  for (const sign of [-1, 1]) {
    const points = [[0, 0], [2.1, 0], [0.2, sign * 0.55], [2.4, sign * 0.8]];
    for (const path of [points, [...points].reverse()]) {
      const geometry = buildFieldGeometry({ points: path, radius: 2, scene: freeScene,
        polygons: [], faces: null, spaceId: 's' });
      const centers = discCenters(geometry, 2);
      for (const vertex of points) assert.ok(hasCenter(centers, vertex), `missing turn ${vertex}`);
    }
  }
});

test('#788: reversing and rotating a closed path preserves the complete visibility fan set', () => {
  const freeScene = { ...scene, occluders: [], fingerprint: 'stable-samples' };
  const vertices = [[0.13, 0.29], [8.37, 1.26], [8.9, 6.31], [0.32, 7.19]];
  const fanSet = (points) => {
    const geometry = buildFieldGeometry({ points, radius: 2, scene: freeScene,
      polygons: [], faces: null, spaceId: 's' });
    return [...new Set(geometry.pieces.flatMap(pieceFans))].sort();
  };
  const reference = fanSet([...vertices, vertices[0]]);
  for (let offset = 0; offset < vertices.length; offset++) {
    const rotated = [...vertices.slice(offset), ...vertices.slice(0, offset)];
    for (const path of [rotated, [...rotated].reverse()]) {
      assert.deepEqual(fanSet([...path, path[0]]), reference);
    }
  }
});

test('#788: radius-sized visibility runs keep the full wall-opening normal context', () => {
  const freeScene = { ...scene, occluders: [], fingerprint: 'opening-context' };
  const faces = {
    faces: [{ a: [0, 0], b: [3, 0] }, { a: [5, 0], b: [8, 0] }],
    inside: ([x, y]) => y < 0 && (x <= 3 || x >= 5),
    epsilon: 0.001,
  };
  for (const points of [[[0, 0], [8, 0]], [[8, 0], [0, 0]]]) {
    const geometry = buildFieldGeometry({ points, radius: 1, scene: freeScene,
      polygons: [], faces, spaceId: 's' });
    const centers = discCenters(geometry, 1);
    const inOpening = centers.filter(([x]) => x > 3 && x < 5);
    assert.ok(inOpening.length > 0);
    assert.ok(inOpening.every(([, y]) => Math.abs(y - faces.epsilon) < 1e-6),
      'a cache/run boundary cannot put emitters back on the unshifted wall axis');
  }
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

test('#784/AC9: the frame gives every strip the 30 cm default, not the shared radius; unbound strips have no view', () => {
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
  assert.ok(Math.abs(frame.views[0].radius - (30 / 5) * (1000 / 240)) < 1e-9, `radius ${frame.views[0].radius}`);
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
  cache.read('k1', () => ({ d: 'M0 0 L1 1', pieces: [{ clip: 'M0 0 Z M1 1 Z', sourceCount: 2 }], box: { x: 0, y: 0, w: 1, h: 1 } }));
  cache.read('k2', () => null);
  assert.deepEqual(ledFieldStats(owner), { visibility: 2, sources: 2, visibilityPaths: 1, pathChars: 22, recomputes: 2 });
  releaseLedField(owner);
  assert.deepEqual(ledFieldStats(owner), { visibility: 0, sources: 0, visibilityPaths: 0, pathChars: 0, recomputes: 0 });
  assert.notEqual(ledFieldCache(owner), cache, 'a new mount starts a new cache');
});
