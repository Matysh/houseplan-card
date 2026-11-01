import test from 'node:test';
import assert from 'node:assert/strict';

import { capture, driftBetweenRuns, frameHashes, main } from '../scripts/capture-determinism.mjs';

// #422. Гейт сравнивает два прогона съёмки. Его собственная логика должна
// уметь падать не меньше, чем то, что он охраняет: разошедшийся кадр, кадр
// пропавший и кадр появившийся — всё это расхождения, потому что набор обязан
// быть одним и тем же, иначе «совпало» ничего не значит.

const files = { 'a.png': 'AAA', 'b.png': 'BBB', 'notes.txt': 'ignore me' };
const fakeList = () => Object.keys(files);
const fakeRead = (path) => Buffer.from(files[path.split(/[\\/]/).pop()]);

test('хешируются только кадры, посторонние файлы не участвуют', () => {
  const hashes = frameHashes('/nowhere', fakeRead, fakeList);
  assert.deepEqual(Object.keys(hashes), ['a.png', 'b.png']);
  assert.match(hashes['a.png'], /^[0-9a-f]{64}$/);
  assert.notEqual(hashes['a.png'], hashes['b.png']);
});

test('одинаковые прогоны расхождений не дают', () => {
  const first = frameHashes('/nowhere', fakeRead, fakeList);
  assert.deepEqual(driftBetweenRuns(first, { ...first }), []);
});

test('#862 failed capture aborts before reading frames or starting a later run', () => {
  for (const status of [7, null]) {
    const errors = [];
    const code = capture('прогон 1', { run: () => ({ status }), error: line => errors.push(line) });
    assert.equal(code, status || 1);
    assert.deepEqual(errors, [`::error::съёмка (прогон 1) завершилась с кодом ${status}`]);
    let captures = 0, reads = 0;
    assert.equal(main({ runCapture: () => { captures++; return code; }, hashes: () => { reads++; } }), code);
    assert.equal(captures, 1); assert.equal(reads, 0);
  }
  let captures = 0, reads = 0;
  assert.equal(main({ runCapture: () => ++captures === 2 ? 9 : 0, hashes: () => { reads++; return {}; } }), 9);
  assert.equal(captures, 2); assert.equal(reads, 1);
});

test('разошедшийся кадр назван по имени', () => {
  const drift = driftBetweenRuns({ 'a.png': '1', 'b.png': '2' }, { 'a.png': '1', 'b.png': '9' });
  assert.deepEqual(drift.map((item) => item.name), ['b.png']);
  assert.equal(drift[0].first, '2');
  assert.equal(drift[0].second, '9');
});

test('пропавший и появившийся кадр — тоже расхождение', () => {
  const lost = driftBetweenRuns({ 'a.png': '1', 'b.png': '2' }, { 'a.png': '1' });
  assert.deepEqual(lost.map((item) => item.name), ['b.png']);
  assert.equal(lost[0].second, '(нет кадра)');

  const appeared = driftBetweenRuns({ 'a.png': '1' }, { 'a.png': '1', 'c.png': '3' });
  assert.deepEqual(appeared.map((item) => item.name), ['c.png']);
  assert.equal(appeared[0].first, '(нет кадра)');
});

test('расхождения перечисляются в устойчивом порядке', () => {
  const drift = driftBetweenRuns(
    { 'c.png': '1', 'a.png': '1', 'b.png': '1' },
    { 'c.png': '9', 'a.png': '9', 'b.png': '9' },
  );
  assert.deepEqual(drift.map((item) => item.name), ['a.png', 'b.png', 'c.png']);
});
