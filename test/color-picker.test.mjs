import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import {
  hexToRgb, hsvToHex, hsvToRgb, normalizeHexColor, normalizeHue, rgbToHex, rgbToHsv,
} from '../test-build/color-picker.js';
import { readHouseplanProductionSource } from './houseplan-source.mjs';

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
  const card = readHouseplanProductionSource();
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
    'hp-color-opacity-change', 'detail: { color: normalized, opacity: clamped, ...(this.allowNoFill ? { noFill: this.noFill } : {}) }',
    'confirm: string', "confirm: 'OK'",
  ]) assert.match(component, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(component, /<button class="confirm" type="button"[^>]*@click=/);
  assert.match(component, /\.confirm\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-height:\s*40px;/);
  assert.match(component, /@media \(forced-colors:\s*active\)[\s\S]*?\.confirm\s*\{[\s\S]*?background:\s*Highlight;/);
  assert.ok(component.indexOf('<button class="confirm"') > component.indexOf('this.showOpacity ? html`<div class="row">'),
    'the confirmation remains the final picker control after the optional opacity row');
  assert.match(component, /private _hexNeedsValidInput = false/);
  assert.match(component, /this\._hexInvalid = this\._hexNeedsValidInput/);
  assert.match(component, /if \(this\._hexInvalid \|\| this\._hexNeedsValidInput\)/);
  const pickerCount = (card.match(/<hp-color-opacity/g) || []).length;
  assert.ok(pickerCount > 0);
  assert.equal((card.match(/\.pickerLabels=\$\{this\._colorPickerLabels\}/g) || []).length, pickerCount,
    'every production picker uses the shared localized labels without a brittle call-site count');
  const defaultPickerStart = card.indexOf('<hp-color-opacity class="decor-default-color"');
  const defaultPickerEnd = card.indexOf('</hp-color-opacity>', defaultPickerStart);
  assert.ok(defaultPickerStart >= 0 && defaultPickerEnd > defaultPickerStart);
  const defaultPicker = card.slice(defaultPickerStart, defaultPickerEnd);
  assert.match(defaultPicker, /\.color=\$\{this\._decorStyle\.color\}/);
  assert.match(defaultPicker, /\.opacity=\$\{this\._decorStyle\.opacity\}/);
  // #377: the default-style picker routes through the persisting updater
  assert.match(defaultPicker, /this\._updateDecorStyle\(\{ \.\.\.this\._decorStyle, \.\.\.e\.detail \}\)/);
  assert.equal((card.match(/\.showOpacity=\$\{false\}/g) || []).length, 4,
    'Glow, ripple and both background pickers stay color-only');
  // #948 separates the default light plate from the room-fill tiles.
  assert.equal((card.match(/\.showOpacity=\$\{true\}/g) || []).length, 3,
    'general fill tiles, wall fill and default light explicitly retain opacity');
  const space = readFileSync(new URL('../src/editors/space-form.ts', import.meta.url), 'utf8');
  assert.match(space, /\.opacity=\$\{kind === 'border' \? d.roomOpacity : fill.a\}/, 'space colour helper retains alpha for room colours');
  assert.match(card, /confirm:\s*this\._t\('color_picker\.confirm'\)/);
  for (const locale of ['en', 'ru', 'de', 'fr']) {
    const messages = JSON.parse(readFileSync(new URL(`../src/i18n/${locale}.json`, import.meta.url), 'utf8'));
    assert.equal(messages['color_picker.confirm'], locale === 'ru' ? 'ОК' : 'OK');
  }
});

// #1008: the real spectrum, thumb contrast and alpha isolation are checked in
// smoke_color_picker_presentation; stylesheet spelling is not a paint oracle.

/**
 * #600: цвет и размер пульса — два поля набора друг под другом (плашка цвета
 * `colorField` и строка `rangeLine`), а не две flex-строки с общим CSS. Порядок
 * прежний: сначала цвет, потом размер; ширину плашки держит лист набора.
 */
test('activity color and ripple size keep independent readable rows', () => {
  const card = readHouseplanProductionSource();
  const kit = readFileSync(new URL('../src/styles/form-kit.styles.ts', import.meta.url), 'utf8');
  const start = card.indexOf("d.display === 'icon_ripple'");
  const end = card.indexOf("marker.activity_alarm_note", start);
  const ripple = card.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(ripple, /class="ripple-colorrow"/);
  assert.match(ripple, /class="hpf-field ripple-sizerow"/);
  assert.ok(ripple.indexOf('marker.activity_color') < ripple.indexOf('ripple-sizerow'));
  assert.ok(ripple.indexOf('ripple-sizerow') < ripple.indexOf('marker.ripple_size'));
  assert.match(kit, /-colorfield \{[^}]*display:\s*flex/);
  assert.match(kit, /-range \{[^}]*display:\s*grid/);
});
