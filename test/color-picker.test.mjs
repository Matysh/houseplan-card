import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import {
  hexToRgb, hsvToHex, hsvToRgb, normalizeHexColor, normalizeHue, rgbToHex, rgbToHsv,
} from '../test-build/color-picker.js';

test('hex drafts accept only three or six digits and normalize on commit', () => {
  assert.equal(normalizeHexColor('#AbC'), '#aabbcc');
  assert.equal(normalizeHexColor('12ef90'), '#12ef90');
  assert.deepEqual(hexToRgb('#0a10ff'), { r: 10, g: 16, b: 255 });
  for (const value of ['', '#12', '#1234', '#12345', '#1234567', 'red', '#12xx90', null]) {
    assert.equal(normalizeHexColor(value), null, String(value));
  }
});

test('RGB and HSV round-trip within one channel across the colour cube', () => {
  const channels = [0, 1, 17, 63, 127, 191, 254, 255];
  for (const r of channels) for (const g of channels) for (const b of channels) {
    const source = { r, g, b };
    const roundTrip = hsvToRgb(rgbToHsv(source));
    assert.ok(Math.abs(roundTrip.r - r) <= 1, `${r},${g},${b}: red`);
    assert.ok(Math.abs(roundTrip.g - g) <= 1, `${r},${g},${b}: green`);
    assert.ok(Math.abs(roundTrip.b - b) <= 1, `${r},${g},${b}: blue`);
    assert.equal(hsvToHex(rgbToHsv(source)), rgbToHex(source));
  }
});

test('HSV helpers wrap hue, clamp finite dimensions and keep grayscale achromatic', () => {
  assert.equal(normalizeHue(-30), 330);
  assert.equal(normalizeHue(390), 30);
  assert.equal(normalizeHue(Number.NaN), 0);
  assert.deepEqual(hsvToRgb({ h: 120, s: 100, v: 100 }), { r: 0, g: 255, b: 0 });
  assert.equal(hsvToHex({ h: 999, s: -5, v: 150 }), '#ffffff');
  const gray = rgbToHsv({ r: 128, g: 128, b: 128 });
  assert.equal(gray.s, 0);
  assert.ok(Math.abs(gray.v - (128 / 255) * 100) < 1e-9);
});

test('the shared component keeps its API and contains no nested native color picker', () => {
  const component = readFileSync(new URL('../src/hp-color-opacity.ts', import.meta.url), 'utf8');
  const card = readFileSync(new URL('../src/houseplan-card.ts', import.meta.url), 'utf8');
  const sourceFiles = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    return entry.isDirectory() ? sourceFiles(target) : entry.name.endsWith('.ts') ? [target] : [];
  });
  for (const source of sourceFiles(new URL('../src/', import.meta.url))) {
    assert.doesNotMatch(readFileSync(source, 'utf8'), /type\s*=\s*["']color["']/,
      `native color input remains in ${source.pathname}`);
  }
  for (const token of [
    'public color', 'public opacity', 'public disabled', 'public showOpacity',
    'hp-color-opacity-change', 'detail: { color: normalized, opacity: clamped }',
  ]) assert.match(component, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.equal((card.match(/<hp-color-opacity/g) || []).length, 13);
  assert.equal((card.match(/\.pickerLabels=\$\{this\._colorPickerLabels\}/g) || []).length, 13);
  assert.equal((card.match(/\.showOpacity=\$\{false\}/g) || []).length, 4,
    'Glow, ripple and both background pickers stay color-only');
  assert.equal((card.match(/\.showOpacity=\$\{true\}/g) || []).length, 2,
    'general fill rows and room color explicitly keep their existing opacity');
});

test('the hue range exposes one cyclic spectrum without restyling other ranges', () => {
  const component = readFileSync(new URL('../src/hp-color-opacity.ts', import.meta.url), 'utf8');
  const spectrum = component.match(/\.hue-range\s*\{[\s\S]*?\n\s*\}/)?.[0] || '';
  assert.match(spectrum, /--hp-picker-hue-track:\s*linear-gradient\(to right/);
  for (const stop of ['#f00 0%', '#ff0 16.667%', '#0f0 33.333%', '#0ff 50%',
    '#00f 66.667%', '#f0f 83.333%', '#f00 100%']) assert.ok(spectrum.includes(stop), stop);
  assert.match(component, /\.hue-range::\-webkit-slider-runnable-track\s*\{[\s\S]*?height:\s*10px;[\s\S]*?background:\s*var\(--hp-picker-hue-track\);/);
  assert.match(component, /\.hue-range::\-moz-range-track\s*\{[\s\S]*?height:\s*10px;[\s\S]*?background:\s*var\(--hp-picker-hue-track\);/);
  assert.match(component, /\.hue-range::\-moz-range-progress\s*\{[\s\S]*?background:\s*transparent;/);
  assert.match(component, /\.hue-range::\-webkit-slider-thumb\s*\{[\s\S]*?border-radius:\s*50%;[\s\S]*?box-shadow:\s*var\(--hp-picker-hue-thumb-shadow\);/);
  assert.match(component, /\.hue-range::\-moz-range-thumb\s*\{[\s\S]*?border-radius:\s*50%;[\s\S]*?box-shadow:\s*var\(--hp-picker-hue-thumb-shadow\);/);
  assert.match(spectrum, /--hp-picker-hue-thumb-shadow:[\s\S]*?card-background-color[\s\S]*?primary-text-color/);
  assert.match(component, /@media \(forced-colors:\s*active\)[\s\S]*?background:\s*Canvas;/);
  assert.match(component, /class="hue-range" type="range" min="0" max="359" step="1"/);
  const commonRange = component.match(/input\[type='range'\]\s*\{[\s\S]*?\n\s*\}/)?.[0] || '';
  assert.doesNotMatch(commonRange, /linear-gradient|hp-picker-hue-track/);
});
