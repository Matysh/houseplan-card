import assert from 'node:assert/strict';
import test from 'node:test';
import { GOLDEN_MATRIX_VERSION, GOLDEN_SCENARIOS } from '../demo/golden/matrix.mjs';

test('golden matrix has stable unique ids and bounded comparison thresholds', () => {
  assert.equal(Number.isInteger(GOLDEN_MATRIX_VERSION) && GOLDEN_MATRIX_VERSION > 0, true);
  assert.equal(new Set(GOLDEN_SCENARIOS.map((scenario) => scenario.id)).size, GOLDEN_SCENARIOS.length);
  for (const scenario of GOLDEN_SCENARIOS) {
    assert.match(scenario.id, /^[a-z0-9-]+$/);
    assert.equal(['visual', 'large'].includes(scenario.fixture), true, scenario.id);
    assert.equal(['page', 'stage'].includes(scenario.capture), true, scenario.id);
    assert.equal(scenario.viewport.width > 0 && scenario.viewport.height > 0, true, scenario.id);
    assert.equal(scenario.threshold.maxChannelDelta >= 0 && scenario.threshold.maxChannelDelta <= 32, true, scenario.id);
    assert.equal(scenario.threshold.maxDiffRatio >= 0 && scenario.threshold.maxDiffRatio <= 0.01, true, scenario.id);
  }
});

test('golden matrix covers required geometry, rendering and adaptive surfaces', () => {
  const ids = GOLDEN_SCENARIOS.map((scenario) => scenario.id).join(' ');
  for (const token of ['geometry', 'diagonal-45-opening', 'openings', 'openings-hidden',
    'fill-light', 'fill-temp', 'fill-lqi', 'lighting', 'hover', 'zoom-040', 'zoom-250',
    'warm-remount', 'dialog-mobile', 'color-popover'])
    assert.equal(ids.includes(token), true, token);
  assert.equal(new Set(GOLDEN_SCENARIOS.map((scenario) => scenario.mode)).has('plan'), true);
  assert.equal(new Set(GOLDEN_SCENARIOS.map((scenario) => scenario.mode)).has('devices'), true);
  assert.equal(new Set(GOLDEN_SCENARIOS.map((scenario) => scenario.mode)).has('decor'), true);
  assert.equal(new Set(GOLDEN_SCENARIOS.map((scenario) => scenario.theme)).has('light'), true);
  assert.equal(new Set(GOLDEN_SCENARIOS.map((scenario) => scenario.theme)).has('dark'), true);
});
