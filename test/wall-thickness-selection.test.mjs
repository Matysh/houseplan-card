import test from 'node:test';
import assert from 'node:assert/strict';
import { wallThicknessSelection } from '../test-build/wall-thickness-selection.js';
import { drawWallPreviewD } from '../test-build/wall-thickness.js';

// Import the real lazy renderer without constructing browser-owned controls.
globalThis.window ??= {};
const { HouseplanEditorRuntime } = await import('../test-build/houseplan-editor-runtime.js');

const a = [200, 150], b = [700, 150], pitch = 5;
const room = { id: 'room', name: 'Room', area: null, poly: [a, b, [700, 500], [200, 500]] };
const space = { id: 'floor', rooms: [room], partitions: [{ id: 'partition', a, b, cm: 20 }] };
const walls = [{ key: '', a: [.2, .15], b: [.7, .15], cm: 15 }];
const target = { a, b, roomId: 'room', source: { kind: 'room' } };
const resolve = (s = space, d = target, cell = 5, w = walls, owner = 'floor') =>
  wallThicknessSelection(s, owner, d, w, [], 1 / 240, cell, pitch);

test('current room/partition source retains physical positive widths at every cell scale', () => {
  for (const cell of [1, 5, 30]) {
    assert.deepEqual(resolve(space, { ...target, value: '99' }, cell),
      { d: drawWallPreviewD([a, b], 15 / cell * pitch / 2, false), open: false });
    assert.deepEqual(resolve(space, { ...target, source: { kind: 'partition', id: 'partition' } }, cell),
      { d: drawWallPreviewD([a, b], 20 / cell * pitch / 2, false), open: false });
  }
});
test('zero owner retains the existing visual minimum, not a new positive wall width', () => {
  for (const cell of [1, 5, 30]) {
    assert.equal(resolve(space, target, cell, []).d,
      drawWallPreviewD([a, b], pitch * 1.5 * 5 / cell, false));
    const zero = { ...space, partitions: [{ id: 'partition', a, b, cm: 0 }] };
    assert.equal(resolve(zero, { ...target, source: { kind: 'partition', id: 'partition' } }, cell).d,
      drawWallPreviewD([a, b], pitch * 1.5 * 5 / cell, false));
  }
});
test('target absence, foreign floor and unresolvable room span fail closed without cursor fallback', () => {
  assert.equal(resolve(space, target, 5, walls, 'another'), null);
  assert.equal(resolve({ ...space, rooms: [] }), null);
  assert.equal(resolve(space, { ...target, roomId: 'other' }), null);
  assert.equal(resolve(space, { ...target, a: [201, 150] }), null);
  assert.equal(resolve(space, { ...target, source: { kind: 'partition', id: 'missing' } }), null);
  assert.equal(resolve({ ...space, partitions: [] }, { ...target, source: { kind: 'partition', id: 'partition' } }), null);
  assert.ok(resolve()); // unchanged valid control next to negative probes
});
test('partition identity resolves its current geometry, never stale opening endpoints or field value', () => {
  const moved = { ...space, partitions: [{ id: 'partition', a: [100, 600], b: [900, 600], cm: 25 }] };
  assert.deepEqual(resolve(moved, { ...target, value: '100', source: { kind: 'partition', id: 'partition' } }),
    { d: drawWallPreviewD([[100, 600], [900, 600]], 12.5, false), open: false });
});
test('reversed current room span resolves; malformed physical owner fails closed', () => {
  assert.deepEqual(resolve(space, { ...target, a: b, b: a }), resolve());
  for (const cm of [NaN, -1, 101]) {
    const bad = { ...space, partitions: [{ id: 'partition', a, b, cm }] };
    assert.equal(resolve(bad, { ...target, source: { kind: 'partition', id: 'partition' } }), null);
  }
});

test('#917 actual renderer rejects a retained dialog/cache outside the wall-thickness tool', () => {
  const before = structuredClone({ space, target, walls });
  const host = {
    _wallDialog: target, _markup: true, _tool: 'wallthick', _cfgEpoch: 1,
    _spaceModel: () => space, _spaceWalls: walls, _openCuts: () => [],
    _wallKeyPitch: 1 / 240, _cellCm: 5, _gridPitch: pitch,
    _wallThickHover: { d: 'stale cursor shape', open: false },
  };
  const receiver = { host, wallThickSpace: 'floor', wallThickSelectionCache: null };
  const render = () => HouseplanEditorRuntime.prototype._renderWallThickUi.call(receiver);
  const expected = resolve();
  for (const tool of ['select', 'draw']) {
    host._tool = 'wallthick';
    const valid = render();
    assert.ok(valid.strings.join('').includes('wallthick-hover'));
    assert.ok(valid.values.includes('wallthick-selected hp-editor-only-layer'));
    assert.ok(valid.values.includes(expected.d), 'positive control uses current resolved wall');
    assert.ok(receiver.wallThickSelectionCache, 'negative control starts with a populated cache');
    host._tool = tool;
    const invalid = render();
    assert.equal(invalid.strings.join(''), '', `${tool}: no selected or cursor-fallback path`);
    assert.equal(invalid.values.length, 0);
    assert.equal(receiver.wallThickSelectionCache, null, 'old selected geometry is retired');
    assert.equal(host._wallDialog, target, 'the renderer guard does not rely on toolbar cleanup');
  }
  host._tool = 'wallthick';
  render();
  host._markup = false;
  assert.equal(render().strings.join(''), '');
  assert.equal(receiver.wallThickSelectionCache, null);
  assert.deepEqual({ space, target, walls }, before, 'rendering never mutates plan data');
});
