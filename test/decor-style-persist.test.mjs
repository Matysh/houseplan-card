import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_DECOR_STYLE, decorStyleFromSettings, decorStyleToSettings,
} from '../test-build/editors/decor/geometry.js';

// #377 AC2: a stored key merges over the built-in default, per-field.
test('#377 AC2: settings key merges over DEFAULT_DECOR_STYLE', () => {
  const full = decorStyleFromSettings({
    color: '#8b0000', opacity: 0.9, width_cm: 5, fill: true,
    fill_color: '#112233', fill_opacity: 0.5,
  }, DEFAULT_DECOR_STYLE);
  assert.deepEqual(full, {
    color: '#8b0000', opacity: 0.9, widthCm: 5, fill: true,
    fillColor: '#112233', fillOpacity: 0.5,
  }, 'all six fields cross the snake_case boundary');

  const partial = decorStyleFromSettings({ color: '#8b0000' }, DEFAULT_DECOR_STYLE);
  assert.deepEqual(partial, { ...DEFAULT_DECOR_STYLE, color: '#8b0000' },
    'a partial key inherits every other field from the default');
});

test('#377 AC2: garbage fields fall back per-field, never explode', () => {
  const noisy = decorStyleFromSettings({
    color: 42, opacity: 'loud', width_cm: -3, fill: 'yes',
    fill_color: null, fill_opacity: 7, unknown_extra: true,
  }, DEFAULT_DECOR_STYLE);
  assert.equal(noisy.color, DEFAULT_DECOR_STYLE.color);
  assert.equal(noisy.widthCm, DEFAULT_DECOR_STYLE.widthCm, 'non-positive width is rejected');
  assert.equal(noisy.fill, DEFAULT_DECOR_STYLE.fill, 'non-boolean fill is rejected');
  assert.equal(noisy.fillColor, DEFAULT_DECOR_STYLE.fillColor);
  assert.equal(noisy.fillOpacity, 1, 'opacity clamps into 0..1');
  assert.ok(!('unknown_extra' in noisy), 'unknown fields are ignored');
});

// #377 AC3: no key -> the built-in default, untouched legacy behaviour.
test('#377 AC3: absent or non-object key yields the default style', () => {
  for (const raw of [undefined, null, 'x', 7]) {
    assert.deepEqual(decorStyleFromSettings(raw, DEFAULT_DECOR_STYLE), DEFAULT_DECOR_STYLE);
  }
});

// #377: the default is stored as the ABSENCE of the key.
test('#377: toSettings returns null for the default and a snake_case patch otherwise', () => {
  assert.equal(decorStyleToSettings({ ...DEFAULT_DECOR_STYLE }), null);
  const patch = decorStyleToSettings({ ...DEFAULT_DECOR_STYLE, color: '#8b0000' });
  assert.deepEqual(patch, {
    color: '#8b0000', opacity: 1, width_cm: 3.6, fill: false,
    fill_color: '#607d8b', fill_opacity: 0.25,
  });
  // the pair is a lossless round-trip for any persisted style
  const style = decorStyleFromSettings(patch, DEFAULT_DECOR_STYLE);
  assert.deepEqual(decorStyleToSettings(style), patch);
});
