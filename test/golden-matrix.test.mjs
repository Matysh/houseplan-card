import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { prepareGoldenFixture } from '../demo/golden/harness.mjs';
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
    'warm-remount', 'dialog-mobile', 'color-popover', 'tray-wide', 'tray-medium',
    'tray-narrow', 'opaque-glow-two-doorways'])
    assert.equal(ids.includes(token), true, token);
  assert.equal(new Set(GOLDEN_SCENARIOS.map((scenario) => scenario.mode)).has('plan'), true);
  assert.equal(new Set(GOLDEN_SCENARIOS.map((scenario) => scenario.mode)).has('devices'), true);
  assert.equal(new Set(GOLDEN_SCENARIOS.map((scenario) => scenario.mode)).has('decor'), true);
  assert.equal(new Set(GOLDEN_SCENARIOS.map((scenario) => scenario.theme)).has('light'), true);
  assert.equal(new Set(GOLDEN_SCENARIOS.map((scenario) => scenario.theme)).has('dark'), true);
});

test('doorway spill golden exposes the opaque-fill failure mode from issue 71', () => {
  const scenario = GOLDEN_SCENARIOS.find((item) => item.id === 'lighting-opaque-glow-two-doorways-dark');
  assert.ok(scenario);
  assert.equal(scenario.theme, 'dark');
  assert.equal(scenario.customFill?.a, 1);
  assert.equal(scenario.glowEnabled, true);
  assert.equal(scenario.sunRays, false);
  assert.equal(scenario.allLightsOff, true);
  assert.equal(scenario.extraOpenings?.filter((opening) => opening.type === 'door').length, 1);
  assert.equal(scenario.stateOverrides?.['light.golden_light_one']?.state, 'on');
  assert.deepEqual(scenario.layoutOverrides?.['golden-light-one'], {
    s: 'golden-lighting', x: 0.22, y: 0.48,
  });
});

test('golden harness applies doorway, state and layout overrides to a cloned fixture', () => {
  const scenario = GOLDEN_SCENARIOS.find((item) => item.id === 'lighting-opaque-glow-two-doorways-dark');
  const fixture = prepareGoldenFixture(scenario);
  const space = fixture.config.spaces.find((item) => item.id === scenario.space);
  assert.equal(space.openings.filter((opening) => opening.type === 'door').length, 2);
  assert.equal(fixture.states['light.golden_light_one'].state, 'on');
  assert.deepEqual(fixture.layout['golden-light-one'], {
    s: 'golden-lighting', x: 0.22, y: 0.48,
  });
  assert.equal(space.settings.sun_rays, false);
  assert.equal(space.settings.custom_fill.a, 1);
});

test('a light source paints exactly one region: the floor it can see', () => {
  const source = readFileSync(new URL('../src/houseplan-card.ts', import.meta.url), 'utf8');
  // One region per source, and it is the visibility polygon clipped to floor.
  assert.match(source, /visibilityPolygon\(\[pos\.x, pos\.y\], R, occluders/);
  assert.match(source, /lit: seen\.length >= 3 \? intersectionPaths\(\[seen\], floor\) : \[\]/);
  assert.match(source, /<circle class="glow-pool"/);
  // No second layer of LIGHT may come back: a spill path or a shadow mask of
  // its own is how the rendered result and the computed geometry got to
  // disagree (#71, #73). The single blur below is the penumbra of the one
  // region, measured in screen pixels and applied in one pass.
  const layer = source.slice(source.indexOf('_renderGlowLayer'));
  const glow = layer.slice(0, layer.indexOf('_renderAlignDialog'));
  assert.doesNotMatch(glow, /glow-spill|glow-shadow|glow-blocker/);
  // Exactly one blur, for the whole layer, sized in screen pixels.
  assert.equal((glow.match(/<feGaussianBlur/g) || []).length, 1);
  assert.doesNotMatch(glow, /<mask /);
  assert.match(source, /GLOW_EDGE_FEATHER_PX \/ 2 \/ \(perUnit > 0 \? perUnit : 1\)/);
  // Barriers are keyed by their own content: `_cfgEpoch` lags behind geometry
  // edited in place, and a stale barrier set lights straight through a wall.
  assert.doesNotMatch(glow, /_cfgEpoch/);
  assert.match(source, /const fingerprint = hash\.toString\(36\)/);
});

test('editor tray golden contract covers every adaptive width in English and Russian', () => {
  const tray = GOLDEN_SCENARIOS.filter((scenario) => scenario.editorTray);
  assert.equal(tray.length, 6);
  const widths = {
    wide: (scenario) => scenario.viewport.width >= 1000,
    medium: (scenario) => scenario.viewport.width >= 600 && scenario.viewport.width < 1000,
    narrow: (scenario) => scenario.viewport.width < 600,
  };
  for (const [name, predicate] of Object.entries(widths)) {
    const languages = new Set(tray.filter(predicate).map((scenario) => scenario.language));
    assert.deepEqual(languages, new Set(['en', 'ru']), name);
  }
  assert.deepEqual(new Set(tray.map((scenario) => scenario.editorTray)), new Set([
    'plan-selection', 'plan-tool', 'group', 'decor-selection',
    'furniture-palette', 'decor-tool',
  ]));
});

test('device dialog goldens expose the complete light-source controls at desktop and mobile widths', () => {
  const dialogs = GOLDEN_SCENARIOS.filter((scenario) => scenario.id.startsWith('device-dialog-'));
  assert.equal(dialogs.length, 2);
  assert.deepEqual(new Set(dialogs.map((scenario) => scenario.language)), new Set(['en', 'ru']));
  for (const scenario of dialogs) {
    assert.equal(scenario.deviceLightControls, true, scenario.id);
    assert.equal(scenario.deviceId, 'golden-light-two', scenario.id);
    assert.equal(scenario.capture, 'page', scenario.id);
    assert.equal(scenario.viewport.height >= 1000, true, scenario.id);
  }
  const harness = readFileSync(new URL('../demo/golden/harness.mjs', import.meta.url), 'utf8');
  assert.match(harness, /if \(scenario\.deviceLightControls\)/,
    'the harness must activate the declared light-controls scenario flag');
});
