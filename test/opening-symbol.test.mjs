import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveOpeningVisual } from '../test-build/opening-features.js';
import {
  openingVisibleBounds,
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

test('#1024 mixed 1–4 leaves use ordered layers, source ink, finite top planes and stable bounds', () => {
  for(const count of [1,2,3,4]) for(const length of [.1,120]) {
    const opening={type:'window',angle:0,opening_features:{version:1,side:'negative',leaves:
      Array.from({length:count},(_,i)=>({id:`leaf-${i}`,hinge:i===0?'top':i%2?'end':'start',
        manual:'open',...(i===0?{contact:'binary_sensor.missing',shade:{enabled:true,manual:'closed'}}:{})}))}};
    const visual=resolveOpeningVisual(opening,()=>null,0),input=spec({type:'window',length,visual,handleSides:[true,true]});
    const text=templateText(renderOpeningVisibleGeometry(input));
    assert.equal((text.match(/data-hinge=/g)||[]).length,count);
    assert.equal((text.match(/class="op-leaf-unknown"/g)||[]).length,1);
    assert.match(text,/mdi:weather-sunny-off/);
    assert.match(text,/var\(--hp-accent, var\(--primary-color/);
    assert.equal(/NaN|Infinity|var\(--hp-open/.test(text),false);
    const layers=['op-window-glass','op-window-planes','op-window-guides','op-window-closed-positions','op-window-leaves'];
    for(let i=1;i<layers.length;i++) assert.ok(text.indexOf(layers[i-1])<text.indexOf(layers[i]));
    const bounds=openingVisibleBounds(input);
    assert.ok(Object.values(bounds).every(Number.isFinite));
    const open={...input,visual:{...visual,leaves:visual.leaves.map(leaf=>({...leaf,amount:1,unknown:false}))}};
    assert.deepEqual(openingVisibleBounds(open),bounds,'source state cannot change full-motion fit');
    const widths=[...text.matchAll(/width=["']?([\d.e+-]+)/g)].map(match=>Number(match[1]));
    assert.ok(widths.every(width=>width>0));
  }
});

test('#1024 slide has one full panel, no swing arcs and one resolved face translation', () => {
  for(const type of ['door','gate']) {
    const visual={mechanism:'slide',direction:'end',side:'negative',unsupported:false};
    const input=spec({type,amount:1,visual,face:{ox:0,oy:20,cm:20,side:1}});
    const text=templateText(renderOpeningVisibleGeometry(input));
    assert.equal((text.match(/class="op-leaf"/g)||[]).length,1);
    assert.equal(text.includes('op-arc'),false);
    assert.match(text,/translate\(0 20\)/);assert.match(text,/translateX\(100px\)/);
    assert.ok(openingVisibleBounds(input).maxX>150);
  }
});

test('#1207/#1024 door guides use the shared HA accent; leaves keep base in all states', () => {
  for (const amount of [0, 1]) for (const sensorActive of [false, true]) {
    const text = templateText(renderOpeningVisibleGeometry(spec({ amount, sensorActive, base: '#abcdef', tone: 'orange' })));
    assert.match(text, /width="100" height="[^"]+" fill="#abcdef"/);
    assert.ok(text.includes(`stroke="${sensorActive ? 'var(--hp-accent, var(--primary-color, #03a9f4))' : '#abcdef'}" stroke-dasharray`));
    assert.ok(!text.includes('orange'));
  }
  for (const type of ['window','gate']) {
    assert.equal(templateText(renderOpeningVisibleGeometry(spec({type,tone:'orange',sensorActive:true}))),
      templateText(renderOpeningVisibleGeometry(spec({type,tone:'orange',sensorActive:false}))));
  }
});

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

test('visible bounds cover complete state-independent opening motion and rotation', () => {
  const closed = openingVisibleBounds(spec({ amount: 0 }), [200, 300]);
  const open = openingVisibleBounds(spec({ amount: 1 }), [200, 300]);
  assert.deepEqual(open, closed, 'live state cannot resize a tight card');
  assert.ok(closed.minX < 150 && closed.maxX > 250);
  assert.ok(closed.minY < 200 && closed.maxY > 300);

  const diagonal = openingVisibleBounds(spec({ type: 'window', angle: 45 }), [0, 0]);
  assert.ok(diagonal.minX < 0 && diagonal.maxX > 0);
  assert.ok(diagonal.minY < 0 && diagonal.maxY > 0);
  for (const value of Object.values(diagonal)) assert.ok(Number.isFinite(value));
});

test('visible bounds include thick jambs, both gate directions and omit passages', () => {
  const thin = openingVisibleBounds(spec({ type: 'gate' }));
  const thick = openingVisibleBounds(spec({
    type: 'gate', face: { ox: 0, oy: 20, cm: 20, side: 1 },
  }));
  const reversed = openingVisibleBounds(spec({
    type: 'gate', face: { ox: 0, oy: -20, cm: 20, side: -1 },
  }));
  assert.ok(thick.minY < thin.minY && thick.maxY > thin.maxY);
  assert.deepEqual(
    [reversed.minX, reversed.maxX, reversed.minY, reversed.maxY],
    [thick.minX, thick.maxX, thick.minY, thick.maxY],
  );
  assert.equal(openingVisibleBounds(spec({ type: 'passage' })), null);
});

test('shared renderer centres every flip while preserving opening direction', () => {
  const centred = templateText(renderOpeningVisibleGeometry(spec({
    type: 'window', amount: 0.5,
    face: { ox: 0, oy: -20, cm: 20, side: -1 },
  })));
  assert.match(centred, /translate\(-50 0\) scale\(1 1\)/);
  assert.match(centred, /translate\(50 0\) scale\(-1 1\)/);

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
    assert.match(text, /translate\(-50 0\) scale\(1 -1\)/);
    assert.match(text, /translate\(50 0\) scale\(-1 -1\)/);
    assert.equal((text.match(/rotate\(-45deg\)/g)||[]).length,2);
    assert.match(text, /stroke-dashoffset=["']?39\.269/);
    assert.match(text, /op-glass/);
  }

  const doorDefault = templateText(renderOpeningVisibleGeometry(spec({
    type: 'door', amount: 1, flipV: false,
    face: { ox: 0, oy: 20, cm: 20, side: 1 },
  })));
  const doorFlipped = templateText(renderOpeningVisibleGeometry(spec({
    type: 'door', amount: 1, flipV: true,
    face: { ox: 0, oy: -20, cm: 20, side: -1 },
  })));
  assert.match(doorDefault, /scale\(1 1\)/);
  assert.match(doorFlipped, /scale\(1 -1\)/);
  assert.match(doorDefault, /translate\(0 0\)/);
  assert.match(doorFlipped, /translate\(0 0\)/);

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
