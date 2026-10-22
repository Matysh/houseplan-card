import test from 'node:test';
import assert from 'node:assert/strict';
import { svgDefaults } from '../test-build/pdf/export-options.js';
import { assertSvgBudget, finishSvgView } from '../test-build/pdf/svg-snapshot.js';

test('SVG defaults exclude devices and keep independent mutable drafts', () => {
  const first = svgDefaults(), second = svgDefaults();
  assert.equal(first.devices, false); assert.equal(first.background, 'transparent');
  assert.deepEqual([first.decor, first.roomNames, first.backdrop], [true, true, true]);
  first.devices = true; first.color = '#123456'; first.opacity = 0;
  assert.equal(second.devices, false); assert.equal(second.opacity, 1); assert.equal(second.color, '#ffffff');
});

test('repeated embedded placements obey the budget even when fetched once', async () => {
  const keys = ['fetch', 'FileReader', 'location', 'XMLSerializer'];
  const descriptors = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  let fetched = 0;
  const values = [async () => {
    fetched++;
    return new Response(new Uint8Array(9 * 1024 * 1024), { headers: { 'content-type': 'image/png' } });
  }, class {
    readAsDataURL() { this.result = 'data:image/png;base64,AA=='; queueMicrotask(() => this.onload()); }
  }, { href: 'http://demo.local/', origin: 'http://demo.local' }, class { serializeToString() { return '<svg/>'; } }];
  try {
    keys.forEach((key, i) => Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: values[i] }));
    const element = href => {
      const attributes = new Map(href ? [['href', href]] : []);
      return { hasAttribute: key => attributes.has(key), getAttribute: key => attributes.get(key),
        setAttribute: (key, value) => attributes.set(key, value) };
    };
    const svg = { ...element(), querySelectorAll: () => Array.from({ length: 3 }, () => element('/image.png')) };
    await assert.rejects(() => finishSvgView(svg), /svg.too_large/);
    assert.equal(fetched, 1);
  } finally {
    keys.forEach((key, i) => { if (descriptors[i]) Object.defineProperty(globalThis, key, descriptors[i]); else delete globalThis[key]; });
  }
});
test('SVG asset budget accepts exact limit and rejects corrupt or excessive totals', () => {
  assertSvgBudget(0); assertSvgBudget(25 * 1024 * 1024);
  for (const n of [NaN, Infinity, -1, 25 * 1024 * 1024 + 1]) {
    assert.throws(() => assertSvgBudget(n), /svg.too_large/);
  }
});
