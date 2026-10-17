import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_FILL_COLORS, fillColorsOf } from '../test-build/logic.js';

test('#943 retired darkness never enters the runtime palette, even with opaque legacy input', () => {
  for (const legacy of [undefined, { c: '#00ff00', a: 1 }, { c: '#000000', a: 1 }, { c: '#ffffff', a: 0 }]) {
    const settings = { fill_colors: { ...(legacy ? { glow_base: legacy } : {}),
      glow_light: { c: '#ffeedd', a: .62 }, light_on: { c: '#aabbcc', a: .37 } } };
    const before = structuredClone(settings);
    const colors = fillColorsOf(settings);
    assert.equal(Object.hasOwn(colors, 'glow_base'), false, 'retired darkness must not be an active role');
    assert.equal(Object.hasOwn(DEFAULT_FILL_COLORS, 'glow_base'), false, 'new settings/Reset must not create it');
    assert.deepEqual(colors.glow_light, { c: '#ffeedd', a: .62 });
    assert.deepEqual(colors.light_on, { c: '#aabbcc', a: .37 });
    assert.deepEqual(settings, before, 'reading legacy settings must not migrate/write the stored input');
  }
});

test('#943 presence of a retired role cannot change any active palette value', () => {
  const settings = { fill_colors: { glow_light: { c: '#123456', a: .4 },
    wall_fill: { c: '#abcdef', a: .7 }, light_off: { c: '#998877', a: 0 } } };
  const expected = fillColorsOf(settings);
  assert.deepEqual(fillColorsOf({ fill_colors: { ...settings.fill_colors, glow_base: { c: '#ff00ff', a: 1 } } }), expected);
  assert.equal(expected.light_off.a, 0, 'transparent active roles remain transparent');
});
