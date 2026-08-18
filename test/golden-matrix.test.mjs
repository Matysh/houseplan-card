import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { prepareGoldenFixture } from '../demo/golden/harness.mjs';
import { GOLDEN_MATRIX_VERSION, GOLDEN_SCENARIOS } from '../demo/golden/matrix.mjs';
import { fixtureWallKey } from '../demo/fixtures/visual-matrix.mjs';

test('golden matrix has stable unique ids and bounded comparison thresholds', () => {
  assert.equal(Number.isInteger(GOLDEN_MATRIX_VERSION) && GOLDEN_MATRIX_VERSION > 0, true);
  assert.equal(new Set(GOLDEN_SCENARIOS.map((scenario) => scenario.id)).size, GOLDEN_SCENARIOS.length);
  for (const scenario of GOLDEN_SCENARIOS) {
    assert.match(scenario.id, /^[a-z0-9-]+$/);
    assert.equal(['visual', 'large'].includes(scenario.fixture), true, scenario.id);
    assert.equal(['page', 'stage', 'sun-window'].includes(scenario.capture), true, scenario.id);
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
    if (scenario.labs) {
      assert.deepEqual(scenario.labs, ['iso'], scenario.id);
      assert.equal(scenario.projection, 'iso', scenario.id);
      assert.equal(scenario.mode, 'view', scenario.id);
      assert.equal(scenario.testOnlyLabsSnapshot, true, scenario.id);
    }
    if (scenario.sunRayPixels) {
      assert.equal(Number.isInteger(scenario.sunRayPixels.minPixels)
        && scenario.sunRayPixels.minPixels > 0, true, scenario.id);
      assert.equal(Number.isInteger(scenario.sunRayPixels.minChannelDelta)
        && scenario.sunRayPixels.minChannelDelta > 0
        && scenario.sunRayPixels.minChannelDelta <= 32, true, scenario.id);
    }
    if (typeof scenario.northDeg === 'number') {
      assert.equal(Number.isInteger(scenario.northDeg)
        && scenario.northDeg >= 0 && scenario.northDeg < 360, true, scenario.id);
    }
    if (scenario.openingPreviewPixels) {
      assert.ok(scenario.openingPreview, scenario.id);
      assert.equal(Number.isInteger(scenario.openingPreviewPixels.minPixels)
        && scenario.openingPreviewPixels.minPixels > 0, true, scenario.id);
      assert.equal(Number.isInteger(scenario.openingPreviewPixels.minChannelDelta)
        && scenario.openingPreviewPixels.minChannelDelta > 0
        && scenario.openingPreviewPixels.minChannelDelta <= 32, true, scenario.id);
    }
    if (scenario.openingGeometry) {
      assert.match(scenario.openingGeometry.id, /^[a-z0-9-]+$/, scenario.id);
      assert.equal(['door', 'window', 'gate'].includes(scenario.openingGeometry.type), true, scenario.id);
      assert.equal(Number.isFinite(scenario.openingGeometry.angle), true, scenario.id);
    }
    if (scenario.tunnelContinuity) {
      assert.match(scenario.tunnelContinuity.openingId, /^[a-z0-9-]+$/, scenario.id);
      assert.equal(Number.isInteger(scenario.tunnelContinuity.insetPx)
        && scenario.tunnelContinuity.insetPx >= 1, true, scenario.id);
      assert.equal(scenario.tunnelContinuity.maxChannelJump >= 0
        && scenario.tunnelContinuity.maxChannelJump <= 32, true, scenario.id);
      assert.equal(typeof scenario.tunnelContinuity.dpr2, 'boolean', scenario.id);
    }
    if (scenario.helpTextRegion) {
      assert.match(scenario.helpTextRegion.key, /^[a-z0-9_.-]+\.help$/, scenario.id);
      assert.equal(Number.isInteger(scenario.helpTextRegion.minPixels)
        && scenario.helpTextRegion.minPixels > 0, true, scenario.id);
      assert.equal(scenario.openHelp, scenario.helpTextRegion.key, scenario.id);
    }
    if (scenario.planSnap) {
      assert.equal(['draw', 'partition'].includes(scenario.planSnap.tool), true, scenario.id);
      assert.equal(['endpoint', 'line'].includes(scenario.planSnap.expectedKind), true, scenario.id);
      assert.equal(scenario.mode, 'plan', scenario.id);
      assert.equal(scenario.capture, 'page', scenario.id);
    }
    if (scenario.wallJunctionPreview) {
      assert.equal(scenario.wallJunctions, true, scenario.id);
      assert.equal(scenario.mode, 'plan', scenario.id);
      assert.equal(scenario.capture, 'page', scenario.id);
      assert.ok(scenario.wallJunctionPreview.path.length >= 1, scenario.id);
    }
  }
});

test('golden matrix covers required geometry, rendering and adaptive surfaces', () => {
  const ids = GOLDEN_SCENARIOS.map((scenario) => scenario.id).join(' ');
  for (const token of ['geometry', 'diagonal-45-opening', 'openings', 'openings-hidden',
    'fill-light', 'fill-temp', 'fill-lqi', 'lighting', 'hover', 'zoom-040', 'zoom-250',
    'warm-remount', 'dialog-mobile', 'color-popover', 'tray-wide', 'tray-medium', 'sun-window',
    'tray-narrow', 'opaque-glow-two-doorways', 'filled-tunnel', 'opening-placement',
    'backup-full', 'backup-space', 'backup-plan-only', 'value-badge-positions', 'isometric-geometry',
    'isometric-live-layers', 'isometric-no-borders', 'isometric-touch-kiosk',
    'isometric-large-warm-remount', 'split-corner-wall', 'plan-snap-endpoint',
    'plan-snap-line-gaps', 'wall-junctions', 'isometric-wall-junctions',
    'washer-active-cycle', 'washer-idle-cycle'])
    assert.equal(ids.includes(token), true, token);
  assert.equal(new Set(GOLDEN_SCENARIOS.map((scenario) => scenario.mode)).has('plan'), true);
  assert.equal(new Set(GOLDEN_SCENARIOS.map((scenario) => scenario.mode)).has('devices'), true);
  assert.equal(new Set(GOLDEN_SCENARIOS.map((scenario) => scenario.mode)).has('decor'), true);
  assert.equal(new Set(GOLDEN_SCENARIOS.map((scenario) => scenario.theme)).has('light'), true);
  assert.equal(new Set(GOLDEN_SCENARIOS.map((scenario) => scenario.theme)).has('dark'), true);
});

test('washer lifecycle goldens pair active and idle snapshots of one composite fixture', () => {
  const active = GOLDEN_SCENARIOS.find((scenario) => scenario.id === 'washer-active-cycle-dark');
  const idle = GOLDEN_SCENARIOS.find((scenario) => scenario.id === 'washer-idle-cycle-dark');
  assert.ok(active);
  assert.ok(idle);
  assert.equal(active.space, 'golden-appliance');
  assert.equal(idle.space, active.space);
  assert.equal(active.applianceLifecycle, true);
  assert.equal(idle.applianceLifecycle, true);
  assert.equal(active.stateOverrides['sensor.golden_washer_status'].state, 'start');
  assert.equal(idle.stateOverrides['sensor.golden_washer_status'].state, 'done');
  for (const scenario of [active, idle]) {
    const fixture = prepareGoldenFixture(scenario);
    assert.equal(fixture.states['switch.golden_washer_power'].state, 'on');
    assert.equal(fixture.states['switch.golden_washer_child_lock'].state, 'off');
    assert.equal(fixture.entities['sensor.golden_washer_status'].translation_key, 'status');
    assert.equal(fixture.layout['golden-washer'].s, 'golden-appliance');
  }
});

test('wall junction goldens cover live L/T previews plus saved flat and isometric bodies', () => {
  const scenarios = GOLDEN_SCENARIOS.filter((scenario) => scenario.wallJunctions);
  assert.deepEqual(scenarios.map((scenario) => scenario.id), [
    'wall-junctions-plan-preview-light',
    'wall-junctions-plan-t-dark',
    'wall-junctions-view-dark',
    'isometric-wall-junctions-dark',
  ]);
  for (const scenario of scenarios) {
    const fixture = prepareGoldenFixture(scenario);
    const space = fixture.config.spaces.find((item) => item.id === scenario.space);
    assert.equal(space.partitions.length, 7);
    assert.equal(space.room_drafts[0].segments.length, 2);
    assert.ok(space.partitions.some((item) => item.b[1] === 0.94), 'room-wall T fixture');
  }
});

test('corner Split golden captures before, thin and thick facade states', () => {
  const scenarios = GOLDEN_SCENARIOS.filter((scenario) => scenario.cornerSplitWall);
  assert.deepEqual(
    scenarios.map((scenario) => scenario.cornerSplitWall),
    ['before', 'thin', 'thick', 'zero-taper'],
  );
  for (const scenario of scenarios) {
    const fixture = prepareGoldenFixture(scenario);
    const space = fixture.config.spaces.find((item) => item.id === scenario.space);
    assert.ok(space);
    assert.equal(space.settings.show_borders, true);
    if (scenario.cornerSplitWall === 'zero-taper') {
      assert.equal(space.rooms.length, 2);
      assert.equal(space.rooms[0].poly.some((point) => point[1] === 0.405), true);
      assert.equal(
        space.walls.some((wall) => (
          wall.key === fixtureWallKey([0.60, 0.40], [0.90, 0.405])
        )),
        false,
      );
      continue;
    }
    assert.equal(space.rooms.length, scenario.cornerSplitWall === 'before' ? 1 : 2);
    if (scenario.cornerSplitWall !== 'before') {
      const divider = space.walls.find((wall) => (
        wall.a?.[0] === 0.10 && wall.a?.[1] === 0.10
        && wall.b?.[0] === 0.90 && wall.b?.[1] === 0.50
      ));
      assert.equal(divider?.cm, scenario.cornerSplitWall === 'thin' ? 15 : 100);
    }
  }
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
  assert.equal(scenario.tunnelContinuity.dpr2, true);
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

test('sun-ray golden requires browser-painted light from a state-only sun entity', () => {
  const scenario = GOLDEN_SCENARIOS.find((item) => item.id === 'lighting-sun-window-state-only-dark');
  assert.ok(scenario);
  const fixture = prepareGoldenFixture(scenario);
  const space = fixture.config.spaces.find((item) => item.id === scenario.space);
  assert.equal(GOLDEN_MATRIX_VERSION, 25);
  assert.equal(space.settings.sun_rays, true);
  assert.equal(scenario.northDeg, 90,
    'the sign-sensitive golden must keep a non-zero north direction');
  assert.equal(space.settings.north_deg, 90);
  assert.equal(fixture.states['sun.sun']?.attributes?.azimuth, 270,
    'north=90 plus azimuth=270 points to the top window; subtraction would point down');
  assert.equal(space.openings.some((opening) => opening.type === 'window'), true);
  assert.equal(fixture.states['sun.sun']?.state, 'above_horizon');
  assert.equal(fixture.entities['sun.sun'], undefined,
    'sun.sun must exercise the real state-only HA path');
  assert.equal(scenario.capture, 'sun-window');
  assert.equal(scenario.glowEnabled, false);
  assert.equal(scenario.allLightsOff, true);
  assert.equal(scenario.sunRayPixels.minPixels >= 500, true);
  assert.equal(scenario.sunRayPixels.minChannelDelta >= 4, true);
});

test('value badge golden covers four positions and bottom badge with separate LQI', () => {
  const scenario = GOLDEN_SCENARIOS.find((item) => item.id === 'device-value-badge-positions-dark');
  assert.ok(scenario);
  assert.deepEqual(
    new Set(scenario.markerOverrides.map((marker) => marker.value_badge.position)),
    new Set(['right', 'bottom', 'left', 'top']),
  );
  const bottom = scenario.markerOverrides.find((marker) => marker.value_badge.position === 'bottom');
  assert.equal(bottom.id, 'golden-climate');
  assert.notEqual(bottom.value_badge.source.kind, 'derived_lqi');
  const fixture = prepareGoldenFixture(scenario);
  assert.equal(fixture.states['climate.golden_climate'].attributes.lqi, 190);
  assert.equal(
    fixture.config.markers.find((marker) => marker.id === 'golden-climate').value_badge.position,
    'bottom',
  );
});

test('opening placement golden requires browser-painted preview pixels', () => {
  const scenario = GOLDEN_SCENARIOS.find(
    (item) => item.id === 'opening-placement-door-thick-wall-dark',
  );
  assert.ok(scenario);
  assert.equal(scenario.mode, 'plan');
  assert.equal(scenario.openingPreview?.type, 'door');
  assert.deepEqual(scenario.openingPreview?.pointer, [0.48, 0.65]);
  assert.equal(scenario.openingPreviewPixels.minPixels >= 150, true);
  assert.equal(scenario.openingPreviewPixels.minChannelDelta >= 4, true);
});

test('diagonal opening golden asserts a real painted 45 degree symbol', () => {
  const scenario = GOLDEN_SCENARIOS.find(
    (item) => item.id === 'geometry-diagonal-45-opening-dark',
  );
  assert.ok(scenario);
  assert.deepEqual(scenario.openingGeometry, {
    id: 'geo-diagonal-window', type: 'window', angle: 45,
  });
  const fixture = prepareGoldenFixture(scenario);
  const space = fixture.config.spaces.find((item) => item.id === scenario.space);
  assert.deepEqual(space.openings.map((opening) => opening.id), ['geo-diagonal-window']);
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

test('all destructive editor dialogs use the medium shell and shared responsive footer groups', () => {
  const source = readFileSync(new URL('../src/houseplan-card.ts', import.meta.url), 'utf8');
  for (const method of ['_renderOpeningDialog', '_renderPhysicalDialog', '_renderSpaceDialog']) {
    const start = source.indexOf(`private ${method}`);
    assert.notEqual(start, -1, method);
    const end = source.indexOf('\n  private ', start + 10);
    const body = source.slice(start, end < 0 ? undefined : end);
    const openTag = body.match(/<hp-dialog[\s\S]*?>/)?.[0] || '';
    assert.match(openTag, /\bwide\b/, `${method} must reserve the existing 500 px desktop shell`);
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
