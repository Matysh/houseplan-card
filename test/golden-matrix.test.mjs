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
    if (scenario.warmPixelRegion) {
      const region = scenario.warmPixelRegion;
      assert.equal(region.x >= 0 && region.y >= 0 && region.w > 0 && region.h > 0, true, scenario.id);
      assert.equal(region.x + region.w <= 1 && region.y + region.h <= 1, true, scenario.id);
      assert.equal(Number.isInteger(region.minPixels) && region.minPixels > 0, true, scenario.id);
      assert.equal(region.minRedBlueDelta > 0, true, scenario.id);
    }
    if (scenario.tunnelContinuity) {
      assert.match(scenario.tunnelContinuity.openingId, /^[a-z0-9-]+$/, scenario.id);
      assert.equal(Number.isInteger(scenario.tunnelContinuity.insetPx)
        && scenario.tunnelContinuity.insetPx >= 1, true, scenario.id);
      assert.equal(scenario.tunnelContinuity.maxChannelJump >= 0
        && scenario.tunnelContinuity.maxChannelJump <= 32, true, scenario.id);
    }
    if (scenario.helpTextRegion) {
      assert.match(scenario.helpTextRegion.key, /^[a-z0-9_.-]+\.help$/, scenario.id);
      assert.equal(Number.isInteger(scenario.helpTextRegion.minPixels)
        && scenario.helpTextRegion.minPixels > 0, true, scenario.id);
      assert.equal(scenario.openHelp, scenario.helpTextRegion.key, scenario.id);
    }
  }
});

test('golden matrix covers required geometry, rendering and adaptive surfaces', () => {
  const ids = GOLDEN_SCENARIOS.map((scenario) => scenario.id).join(' ');
  for (const token of ['geometry', 'diagonal-45-opening', 'openings', 'openings-hidden',
    'fill-light', 'fill-temp', 'fill-lqi', 'lighting', 'hover', 'zoom-040', 'zoom-250',
    'warm-remount', 'dialog-mobile', 'color-popover', 'tray-wide', 'tray-medium',
    'tray-narrow', 'opaque-glow-two-doorways', 'filled-tunnel', 'backup-full', 'backup-space'])
    assert.equal(ids.includes(token), true, token);
  assert.equal(new Set(GOLDEN_SCENARIOS.map((scenario) => scenario.mode)).has('plan'), true);
  assert.equal(new Set(GOLDEN_SCENARIOS.map((scenario) => scenario.mode)).has('devices'), true);
  assert.equal(new Set(GOLDEN_SCENARIOS.map((scenario) => scenario.mode)).has('decor'), true);
  assert.equal(new Set(GOLDEN_SCENARIOS.map((scenario) => scenario.theme)).has('light'), true);
  assert.equal(new Set(GOLDEN_SCENARIOS.map((scenario) => scenario.theme)).has('dark'), true);
});

test('filled opening golden has a pixel-level seam detector', () => {
  const scenario = GOLDEN_SCENARIOS.find((item) => item.id === 'openings-filled-tunnel-dark');
  assert.ok(scenario);
  assert.equal(scenario.fillMode, 'custom');
  assert.equal(scenario.customFill.a > 0 && scenario.customFill.a < 1, true);
  assert.equal(scenario.glowEnabled, false);
  assert.equal(scenario.hideOpenings, true, 'opening symbols must not mask the sampled tunnel pixels');
  assert.equal(scenario.tunnelContinuity.openingId, 'light-door');
  assert.equal(scenario.tunnelContinuity.maxChannelJump <= 3, true);
  assert.equal(scenario.wallReplacements[0].segments.length, 2);
  assert.notEqual(
    scenario.wallReplacements[0].segments[0].cm,
    scenario.wallReplacements[0].segments[1].cm,
  );
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
    s: 'golden-lighting', x: 0.40, y: 0.48,
  });
  assert.equal(scenario.warmPixelRegion?.minPixels >= 2500, true);
  assert.equal(scenario.warmPixelRegion?.x >= 0.5, true);
});

test('golden harness applies doorway, state and layout overrides to a cloned fixture', () => {
  const scenario = GOLDEN_SCENARIOS.find((item) => item.id === 'lighting-opaque-glow-two-doorways-dark');
  const fixture = prepareGoldenFixture(scenario);
  const space = fixture.config.spaces.find((item) => item.id === scenario.space);
  assert.equal(space.openings.filter((opening) => opening.type === 'door').length, 2);
  assert.equal(fixture.states['light.golden_light_one'].state, 'on');
  assert.deepEqual(fixture.layout['golden-light-one'], {
    s: 'golden-lighting', x: 0.40, y: 0.48,
  });
  assert.equal(space.settings.sun_rays, false);
  assert.equal(space.settings.custom_fill.a, 1);
});

test('golden overrides fail closed on misspelled fixture references', () => {
  const base = {
    id: 'invalid', fixture: 'visual', space: 'golden-lighting', mode: 'view',
    theme: 'dark', viewport: { width: 1000, height: 900 }, capture: 'stage',
    threshold: { maxChannelDelta: 10, maxDiffRatio: 0.001 },
  };
  assert.throws(() => prepareGoldenFixture({
    ...base, stateOverrides: { 'light.golden_light_onee': { state: 'on' } },
  }), /missing entity/);
  assert.throws(() => prepareGoldenFixture({
    ...base, layoutOverrides: { 'golden-light-onee': { x: 0.4, y: 0.5 } },
  }), /missing item/);
  assert.throws(() => prepareGoldenFixture({
    ...base, roomGlow: { 'light-rightt': true },
  }), /missing room/);
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
  assert.match(source, /const nextFeather = GLOW_EDGE_FEATHER_PX \/ 2 \/ \(perUnit > 0 \? perUnit : 1\)/);
  assert.match(source, /const featherEnabled = !this\._pinchStart && !this\._panStart[\s\S]*_glowFeatherSuspendUntil/);
  assert.match(source, /filter=\$\{featherEnabled \? 'url\(#hp-glowfeather\)' : nothing\}/,
    'the expensive whole-layer filter must be bypassed during a viewport gesture/transition');
  // Barriers are keyed by their own content: `_cfgEpoch` lags behind geometry
  // edited in place, and a stale barrier set lights straight through a wall.
  assert.doesNotMatch(glow, /_cfgEpoch/);
  assert.match(source, /const fingerprint = hash\.toString\(36\)/);
  assert.match(source, /for \(const point of body\) \{ mix\(point\[0\]\); mix\(point\[1\]\); \}/);
  assert.match(source, /mix\(wall\.b\?\.\[0\] \?\? 0\); mix\(wall\.b\?\.\[1\] \?\? 0\)/);
  assert.match(source, /const cacheKey = `\$\{space\.id\}\|\$\{fingerprint\}`/);
  assert.match(source, /mix\(this\._cellCm\)[\s\S]*mix\(this\._gridPitch\)/);
});

test('all destructive editor dialogs use the shared responsive footer groups', () => {
  const source = readFileSync(new URL('../src/houseplan-card.ts', import.meta.url), 'utf8');
  for (const method of ['_renderOpeningDialog', '_renderPhysicalDialog', '_renderSpaceDialog']) {
    const start = source.indexOf(`private ${method}`);
    assert.notEqual(start, -1, method);
    const end = source.indexOf('\n  private ', start + 10);
    const body = source.slice(start, end < 0 ? undefined : end);
    assert.match(body, /dialog-action-footer/, method);
    assert.match(body, /dialog-action-danger/, method);
    assert.match(body, /dialog-action-commit/, method);
  }
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

test('help affordance golden covers an open text-bearing surface in both themes', () => {
  const help = GOLDEN_SCENARIOS.filter((scenario) => scenario.openHelp);
  assert.equal(help.length >= 2, true);
  assert.deepEqual(new Set(help.map((scenario) => scenario.theme)), new Set(['dark', 'light']));
  for (const scenario of help) {
    assert.equal(scenario.helpTextRegion?.key, scenario.openHelp, scenario.id);
    assert.equal(scenario.helpTextRegion?.minPixels >= 30, true, scenario.id);
  }
});
