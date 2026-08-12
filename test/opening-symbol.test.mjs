import assert from 'node:assert/strict';
import test from 'node:test';
import {
  openingVisibleMetrics,
  renderOpeningVisibleGeometry,
} from '../test-build/render/opening-symbol.js';

const spec = (patch = {}) => ({
  type: 'door', length: 100, angle: 0, amount: 0,
  flipH: false, flipV: false, base: '#000', tone: '#000',
  cellCm: 10, gridPitch: 20,
  face: { ox: 0, oy: 0, cm: 0, side: -1 },
  ...patch,
});

const templateText = (value) => {
  if (!value || !value.strings) return '';
  return value.strings.join('') + value.values.map(templateText).join('');
};

test('opening metrics expand hit and outline zones with a thick wall face', () => {
  assert.deepEqual(openingVisibleMetrics(spec()), {
    half: 50, jambHalf: 4, gateDepth: 0, outlineHalf: 16, hitHalf: 20,
  });
  assert.deepEqual(openingVisibleMetrics(spec({ face: { ox: 0, oy: 20, cm: 20, side: 1 } })), {
    half: 50, jambHalf: 20, gateDepth: 0, outlineHalf: 28, hitHalf: 30,
  });
});

test('shared renderer emits the expected visible symbol for every opening type', () => {
  const windowText = templateText(renderOpeningVisibleGeometry(spec({
    type: 'window', face: { ox: 0, oy: 20, cm: 20, side: 1 },
  })));
  const doorText = templateText(renderOpeningVisibleGeometry(spec({ type: 'door' })));
  const gateText = templateText(renderOpeningVisibleGeometry(spec({ type: 'gate' })));
  assert.match(windowText, /op-glass/);
  assert.match(doorText, /op-leaf/);
  assert.match(doorText, /op-arc/);
  assert.equal((gateText.match(/op-leaf/g) || []).length, 2);
  assert.ok(openingVisibleMetrics(spec({ type: 'gate' })).gateDepth > 0);
});
