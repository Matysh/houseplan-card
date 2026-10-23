import test from 'node:test';
import assert from 'node:assert/strict';
import { reorderDecor, copyDecor } from '../test-build/editors/decor/order.js';
import { CANVAS_LIMIT, GRID_PITCH } from '../test-build/canvas-constants.js';
import { SPACE_COPY_LIMITS } from '../test-build/space-copy.js';

const kinds = [
  { id: 'line', kind: 'line', x1: .2, y1: .3, x2: .4, y2: .4, line_style: 'dashed' },
  { id: 'rect', kind: 'rect', x: .2, y: .3, w: .1, h: .2, angle: 25, fill: true },
  { id: 'ellipse', kind: 'ellipse', x: .2, y: .3, w: .1, h: .2, angle: 25 },
  { id: 'text', kind: 'text', x: .2, y: .3, text: 'Room {sensor.temp}', size_cm: 25 },
  { id: 'furniture', kind: 'furniture', x: .2, y: .3, w: .1, h: .2, angle: 25, symbol: 'sofa', flip_h: true },
  { id: 'image', kind: 'image', x: .2, y: .3, w: .1, h: .2, angle: 25, asset_id: 'a'.repeat(64), flip_v: true },
].map(shape => ({ ...shape, color: '#123456', opacity: .7, future: { values: [1, 2] } }));

test('moving any decor kind changes only its place and preserves every sibling reference', () => {
  for (const shape of kinds) {
    const items = [{ ...kinds[0], id: 'first' }, shape, { ...kinds[1], id: 'last' }];
    assert.deepEqual(reorderDecor(items, shape.id, 'front'), [items[0], items[2], shape]);
    assert.deepEqual(reorderDecor(items, shape.id, 'back'), [shape, items[0], items[2]]);
    assert.equal(reorderDecor(items, 'first', 'back'), items);
    assert.equal(reorderDecor(items, 'last', 'front'), items);
    assert.equal(reorderDecor(items, 'missing', 'front'), items);
    assert.equal(reorderDecor([shape], shape.id, 'front')[0], shape);
  }
  const empty = []; assert.equal(reorderDecor(empty, 'missing', 'back'), empty);
});

test('copies preserve all values, share image identity, and deeply own future fields', () => {
  for (const source of kinds) {
    const original = structuredClone(source);
    const result = copyDecor([source], source.id, 'new', GRID_PITCH);
    assert.ok('shape' in result);
    const copy = result.shape;
    const shifted = source.kind === 'line' ? ['x1', 'y1', 'x2', 'y2'] : ['x', 'y'];
    for (const key of Object.keys(source)) {
      if (key === 'id') assert.equal(copy.id, 'new');
      else if (shifted.includes(key)) assert.ok(Math.abs(copy[key] - source[key] - GRID_PITCH / 1000) < 1e-12);
      else assert.deepEqual(copy[key], source[key]);
    }
    copy.future.values.push(3);
    assert.deepEqual(source, original);
  }
});

test('bounds, invalid inputs, duplicate IDs and the actual decor limit fail without writes', () => {
  const edge = { ...kinds[1], angle: 0, x: CANVAS_LIMIT - .1, y: CANVAS_LIMIT - .2 };
  const result = copyDecor([edge], edge.id, 'edge-copy', GRID_PITCH);
  assert.ok('shape' in result);
  assert.ok(result.shape.x < edge.x && result.shape.y < edge.y);
  const full = Array.from({ length: SPACE_COPY_LIMITS.decor }, (_, i) => ({ ...kinds[0], id: String(i) }));
  assert.deepEqual(copyDecor(full, '0', 'new', GRID_PITCH), { error: 'limit' });
  for (const [items, id, next, pitch] of [
    [[], 'missing', 'new', GRID_PITCH], [[edge], edge.id, edge.id, GRID_PITCH],
    [[edge], edge.id, 'new', 0], [[edge], edge.id, 'new', NaN],
    [[{ ...kinds[0], x1: -CANVAS_LIMIT, x2: CANVAS_LIMIT }], 'line', 'new', GRID_PITCH],
  ]) assert.deepEqual(copyDecor(items, id, next, pitch), { error: 'no_space' });
});

test('repeated copies do not stack at an indistinguishable anchor', () => {
  const source = kinds[1], items = [source];
  for (let i = 0; i < 4; i++) {
    const result = copyDecor(items, source.id, `copy-${i}`, GRID_PITCH);
    assert.ok('shape' in result); items.push(result.shape);
  }
  assert.equal(new Set(items.map(item => `${item.x},${item.y}`)).size, 5);
  assert.deepEqual(copyDecor(items, source.id, 'fifth', GRID_PITCH), { error: 'no_space' });
});
