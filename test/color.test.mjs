import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generatedRgbColor, safeRenderColor, safeStoredColor,
} from '../test-build/color.js';

test('persisted colors accept only exact six-digit hex', () => {
  for (const value of ['#000000', '#abcDEF', '#FFFFFF']) {
    assert.equal(safeStoredColor(value, '#112233'), value);
  }
  for (const value of [
    '#fff', ' #123456', '#123456 ', 'red', 'rgb(1, 2, 3)',
    'red;position:fixed', '#123456;inset:0', 'url(https://example.test/x)',
    '#123456/*x*/', '#12345\\36', '#123456\ncolor:red', '{#123456}',
    '#12345678', '', null, 123456, '#'.padEnd(1025, '1'),
  ]) {
    assert.equal(safeStoredColor(value, '#112233'), '#112233', String(value));
  }
});

test('HA rgb is numeric, clamped and emitted in one canonical form', () => {
  assert.equal(generatedRgbColor([12, 140, 250]), 'rgb(12, 140, 250)');
  assert.equal(generatedRgbColor([-4.4, 12.6, 900]), 'rgb(0, 13, 255)');
  assert.equal(generatedRgbColor(['12', 140, 250]), null);
  assert.equal(generatedRgbColor([12, Number.NaN, 250]), null);
  assert.equal(generatedRgbColor([12, 140]), null);
});

test('render colors allow only stored hex and internally generated rgb', () => {
  assert.equal(safeRenderColor('#12aBcD', null), '#12aBcD');
  assert.equal(safeRenderColor('rgb(0, 13, 255)', null), 'rgb(0, 13, 255)');
  for (const value of [
    'rgb(0,13,255)', 'rgb(0 13 255)', 'rgba(0, 13, 255, .5)',
    'rgb(256, 0, 0)', 'red', 'red;position:fixed', 'url(data:text/css,x)',
  ]) assert.equal(safeRenderColor(value, null), null, value);
});
