// #788: camera renders reuse tube geometry without freezing live state or edits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ledFrameFor, ledStripePath, releaseLed } from '../test-build/led-strip-runtime.js';
import { LED_THICKNESS_D, pathD, visibleStripPath } from '../test-build/led-strip-geometry.js';

const strip = () => ({ id: 'led', marker: 'lamp', points: [[2, 1], [6, 1], [6, 4]] });
const wallFaces = () => ({
  faces: [{ a: [0, 1], b: [10, 1] }],
  inside: ([x, y]) => x > 0 && x < 10 && y < 1,
  epsilon: 1e-5,
});
const fresh = (shape, faces, diameter) => {
  const t = LED_THICKNESS_D * diameter;
  const path = visibleStripPath(shape.points, faces, t / 2);
  return { t, path, d: pathD(path) };
};

test('#788: repeated camera reads skip tube classification and reuse identical SVG geometry', () => {
  const shape = strip(), faces = wallFaces();
  let classifications = 0;
  faces.near = () => { classifications++; return faces.faces; };
  const cached = ledStripePath(shape, faces, 4);
  assert.equal(classifications, 1);
  for (let step = 0; step < 100; step++) assert.equal(ledStripePath(shape, faces, 4), cached);
  assert.equal(classifications, 1, 'camera reads must not rerun face classification');
  assert.deepEqual(cached, fresh(shape, faces, 4), 'cached outline and hit geometry equal the uncached derivation');
});

test('#788: face context, epsilon, diameter and exact point edits invalidate the tube cache', () => {
  const shape = strip();
  let faces = wallFaces(), diameter = 4;
  let previous = ledStripePath(shape, faces, diameter);
  const changed = () => {
    const value = ledStripePath(shape, faces, diameter);
    assert.notEqual(value, previous);
    assert.deepEqual(value, fresh(shape, faces, diameter));
    previous = value;
  };
  diameter = 8;
  changed();
  faces = null;
  changed();
  faces = wallFaces();
  changed();
  faces.epsilon *= 2;
  changed();
  shape.points[1][0] = 7;
  changed();
  shape.points = [[1, 2], [8, 2], [8, 5]];
  changed();
  shape.points.push([9, 6]);
  changed();
  const replacement = { ...shape, points: shape.points.map((point) => [...point]) };
  assert.notEqual(ledStripePath(replacement, faces, diameter), previous, 'same id in a new frame owns a new weak cache key');
});

const ownerFixture = () => ({
  isConnected: true,
  _renderDevices: [{ id: 'lamp', name: 'Lamp', primary: 'light.led', entities: ['light.led'],
    space: 's', marker: { id: 'lamp', binding: 'device:lamp' } }],
  _renderPlanHass: { states: { 'light.led': { state: 'on', attributes: {} } } },
  _fillColors: { glow_light: { c: '#ffd27b', a: 0.7 } },
  _cellCm: 5, _gridPitch: 1000 / 240, _config: { icon_size: 3.4 },
  _mode: 'view', _showAll: false,
  _pointInRoom: () => false,
});
const spaceFixture = () => ({ id: 's', vb: [0, 0, 1000, 1000], rooms: [],
  led_strips: [{ id: 'led', marker: 'lamp', points: [[0.1, 0.1], [0.4, 0.1]] }] });

test('#788: new HA frames keep live state and evict the old frame geometry; disconnect releases it', () => {
  const owner = ownerFixture(), space = spaceFixture();
  const first = ledFrameFor(owner, space, true);
  const firstStrip = first.views[0].strip;
  const firstPath = ledStripePath(firstStrip, first.faces, first.d);
  assert.equal(ledFrameFor(owner, space, true), first, 'unchanged camera inputs reuse the frame');
  assert.equal(ledStripePath(firstStrip, first.faces, first.d), firstPath);
  owner._renderPlanHass = { states: { 'light.led': { state: 'off', attributes: {} } } };
  const second = ledFrameFor(owner, space, true);
  assert.notEqual(second, first);
  assert.equal(second.views[0].state, 'off', 'geometry caching must not freeze the device state');
  assert.notEqual(ledStripePath(firstStrip, first.faces, first.d), firstPath, 'old frame entry was explicitly evicted');
  const secondStrip = second.views[0].strip;
  const secondPath = ledStripePath(secondStrip, second.faces, second.d);
  assert.deepEqual(secondPath, firstPath, 'state changes preserve the physical tube');
  releaseLed(owner);
  assert.notEqual(ledStripePath(secondStrip, second.faces, second.d), secondPath, 'disconnect explicitly evicts current frame entries');
});
