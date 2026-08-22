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
  if (value == null || value === false) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(templateText).join('');
  if (!value.strings) return '';
  return value.strings.reduce((text, part, index) => (
    text + part + (index < value.values.length ? templateText(value.values[index]) : '')
  ), '');
};

test('opening metrics expand hit and outline zones with a thick wall face', () => {
  assert.deepEqual(openingVisibleMetrics(spec()), {
    half: 50, jambHalf: 2, gateDepth: 0, outlineHalf: 8, hitHalf: 10,
  });
  assert.deepEqual(openingVisibleMetrics(spec({ face: { ox: 0, oy: 20, cm: 20, side: 1 } })), {
    half: 50, jambHalf: 20, gateDepth: 0, outlineHalf: 24, hitHalf: 25,
  });
});

test('equivalent grid scales preserve visual padding without double-scaling physical jambs', () => {
  const reference = openingVisibleMetrics(spec({
    length: 100, cellCm: 5, face: { ox: 0, oy: 0, cm: 20, side: 1 },
  }));
  const detailed = openingVisibleMetrics(spec({
    length: 500, cellCm: 1, face: { ox: 0, oy: 0, cm: 20, side: 1 },
  }));
  assert.equal(detailed.jambHalf, reference.jambHalf * 5);
  assert.equal(detailed.outlineHalf, reference.outlineHalf * 5);
  assert.equal(detailed.hitHalf, reference.hitHalf * 5);
});

test('shared renderer emits the expected visible symbol for every opening type', () => {
  const windowText = templateText(renderOpeningVisibleGeometry(spec({
    type: 'window', face: { ox: 0, oy: 20, cm: 20, side: 1 },
  })));
  const doorText = templateText(renderOpeningVisibleGeometry(spec({ type: 'door', amount: 1 })));
  const gateText = templateText(renderOpeningVisibleGeometry(spec({ type: 'gate' })));
  assert.match(windowText, /op-glass/);
  assert.match(doorText, /op-leaf/);
  assert.match(doorText, /op-arc/);
  assert.match(doorText, /A 100 100/);
  assert.match(doorText, /rotate\(-90deg\)/);
  assert.equal((gateText.match(/op-leaf/g) || []).length, 2);
  assert.ok(openingVisibleMetrics(spec({ type: 'gate' })).gateDepth > 0);
});

test('an open passage emits no visible symbol at all', () => {
  const passageText = templateText(renderOpeningVisibleGeometry(spec({
    type: 'passage', amount: 1, flipH: true, flipV: true,
    face: { ox: 0, oy: 20, cm: 20, side: 1 },
  })));
  assert.equal(passageText, '');
});

test('shared renderer centres defaults and preserves explicit door/window edge alignment', () => {
  const centred = templateText(renderOpeningVisibleGeometry(spec({
    type: 'window', amount: 0.5,
    face: { ox: 0, oy: -20, cm: 20, side: -1 },
  })));
  assert.match(centred, /translate\(0 0\)/);

  const flippedPositive = templateText(renderOpeningVisibleGeometry(spec({
    type: 'window', amount: 0.5, flipH: true, flipV: true,
    face: { ox: 0, oy: 20, cm: 20, side: 1 },
  })));
  const flippedNegative = templateText(renderOpeningVisibleGeometry(spec({
    type: 'window', amount: 0.5, flipH: true, flipV: true,
    face: { ox: 0, oy: -20, cm: 20, side: -1 },
  })));
  for (const text of [flippedPositive, flippedNegative]) {
    assert.match(text, /scale\(-1 -1\)/);
    assert.match(text, /translate\(0 -20\)/);
    assert.match(text, /rotate\(45deg\)/);
    assert.match(text, /stroke-dashoffset="39\.269/);
  }

  const gate = templateText(renderOpeningVisibleGeometry(spec({
    type: 'gate', amount: 1, face: { ox: 0, oy: 20, cm: 20, side: 1 },
  })));
  const flippedGate = templateText(renderOpeningVisibleGeometry(spec({
    type: 'gate', amount: 1, flipV: true,
    face: { ox: 0, oy: -20, cm: 20, side: -1 },
  })));
  assert.match(gate, /translate\(0 0\)/);
  assert.match(flippedGate, /translate\(0 0\)/);
  assert.match(gate, /scale\(1 1\)/);
  assert.match(flippedGate, /scale\(1 1\)/);
  assert.match(gate, /rotate\(10deg\)/);
  assert.match(gate, /rotate\(-10deg\)/);
  assert.match(flippedGate, /rotate\(-10deg\)/);
  assert.match(flippedGate, /rotate\(10deg\)/);
  assert.equal(
    gate.indexOf('rotate(10deg)') < gate.indexOf('rotate(-10deg)'), true,
    'default gate turns its first leaf towards the resolved face',
  );
  assert.equal(
    flippedGate.indexOf('rotate(-10deg)') < flippedGate.indexOf('rotate(10deg)'), true,
    'flip_v reverses the first-leaf turn instead of cancelling in scaleY',
  );
});
