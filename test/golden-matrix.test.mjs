import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { prepareGoldenFixture } from '../demo/golden/harness.mjs';
import {
  GOLDEN_MATRIX_VERSION, GOLDEN_SCENARIOS, OPENING_SYMBOL_EXISTING_GOLDEN_IMPACT,
} from '../demo/golden/matrix.mjs';
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
      assert.equal(Number.isInteger(scenario.openingPreviewPixels.minInsideWallPixels)
        && scenario.openingPreviewPixels.minInsideWallPixels > 0, true, scenario.id);
    }
    if (scenario.openingGeometry) {
      assert.match(scenario.openingGeometry.id, /^[a-z0-9-]+$/, scenario.id);
      assert.equal(['door', 'window', 'gate'].includes(scenario.openingGeometry.type), true, scenario.id);
      assert.equal(Number.isFinite(scenario.openingGeometry.angle), true, scenario.id);
    }
    if (scenario.openingSymbolContract) {
      const contract = scenario.openingSymbolContract;
      assert.equal(['room', 'partition'].includes(contract.kind), true, scenario.id);
      assert.equal(['flat', 'iso'].includes(contract.surface), true, scenario.id);
      assert.equal(contract.wallCm > 0, true, scenario.id);
      assert.equal(contract.openings.length >= 3, true, scenario.id);
      assert.equal(new Set(contract.openings.map((opening) => opening.id)).size,
        contract.openings.length, scenario.id);
      for (const opening of contract.openings) {
        assert.match(opening.id, /^[a-z0-9-]+$/, scenario.id);
        assert.equal(['door', 'window', 'gate'].includes(opening.type), true, scenario.id);
        assert.equal(['center', 'edge'].includes(opening.offset), true, scenario.id);
        assert.equal(typeof opening.flipV, 'boolean', scenario.id);
        assert.equal(Number.isFinite(opening.at) && opening.length > 0, true, scenario.id);
        if (opening.type === 'gate') assert.equal(opening.offset, 'center', scenario.id);
      }
      assert.equal(contract.surface === 'iso', scenario.projection === 'iso', scenario.id);
    }
    if (scenario.tunnelContinuity) {
      assert.match(scenario.tunnelContinuity.openingId, /^[a-z0-9-]+$/, scenario.id);
      assert.equal(Number.isInteger(scenario.tunnelContinuity.insetPx)
        && scenario.tunnelContinuity.insetPx >= 1, true, scenario.id);
      assert.equal(scenario.tunnelContinuity.maxChannelJump >= 0
        && scenario.tunnelContinuity.maxChannelJump <= 32, true, scenario.id);
      assert.equal(typeof scenario.tunnelContinuity.dpr2, 'boolean', scenario.id);
    }
    if (scenario.decorPixelProbes) {
      assert.match(scenario.decorPixelProbes.color, /^#[0-9a-f]{6}$/i, scenario.id);
      assert.equal(Number.isInteger(scenario.decorPixelProbes.radius)
        && scenario.decorPixelProbes.radius >= 0, true, scenario.id);
      assert.equal(scenario.decorPixelProbes.minMatchingFraction > 0
        && scenario.decorPixelProbes.minMatchingFraction <= 1, true, scenario.id);
      assert.equal(scenario.decorPixelProbes.points.length >= 1, true, scenario.id);
      for (const point of scenario.decorPixelProbes.points) {
        assert.match(point.id, /^[a-z0-9-]+$/, scenario.id);
        assert.equal(point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1,
          true, scenario.id);
      }
    }
    if (scenario.decorOverride) {
      assert.equal(new Set(scenario.decorOverride.map((shape) => shape.id)).size,
        scenario.decorOverride.length, scenario.id);
      assert.deepEqual(new Set(scenario.decorOverride.map((shape) => shape.kind)),
        new Set(['line', 'rect', 'ellipse', 'text', 'furniture']), scenario.id);
    }
    if (scenario.helpTextRegion) {
      assert.match(scenario.helpTextRegion.key, /^[a-z0-9_.-]+\.help$/, scenario.id);
      assert.equal(Number.isInteger(scenario.helpTextRegion.minPixels)
        && scenario.helpTextRegion.minPixels > 0, true, scenario.id);
      assert.equal(scenario.openHelp, scenario.helpTextRegion.key, scenario.id);
    }
    if (scenario.planSnap) {
      assert.equal(scenario.planSnap.tool, 'draw', scenario.id);
      assert.equal(['endpoint', 'line'].includes(scenario.planSnap.expectedKind), true, scenario.id);
      assert.equal(scenario.mode, 'plan', scenario.id);
      assert.equal(scenario.capture, 'page', scenario.id);
    }
    if (scenario.roomLabelParity) {
      assert.equal(scenario.space, 'golden-lighting', scenario.id);
      assert.equal(['view', 'plan'].includes(scenario.mode), true, scenario.id);
      assert.equal(scenario.capture, 'page', scenario.id);
    }
    if (scenario.wallJunctionPreview) {
      assert.equal(scenario.wallJunctions, true, scenario.id);
      assert.equal(scenario.mode, 'plan', scenario.id);
      assert.equal(scenario.capture, 'page', scenario.id);
      assert.ok(scenario.wallJunctionPreview.path.length >= 1, scenario.id);
    }
    if (scenario.tabDrag) {
      assert.equal(['before', 'after'].includes(scenario.tabDrag), true, scenario.id);
      assert.equal(scenario.applianceLifecycle, true, scenario.id);
      assert.equal(scenario.mode, 'plan', scenario.id);
      assert.equal(scenario.capture, 'page', scenario.id);
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
    'wall-key-roundtrip',
    'washer-active-cycle', 'washer-idle-cycle', 'space-tab-drop-before',
    'space-tab-drop-after', 'decor-over-opaque-hover',
    'decor-over-glow-base'])
    assert.equal(ids.includes(token), true, token);
  assert.equal(new Set(GOLDEN_SCENARIOS.map((scenario) => scenario.mode)).has('plan'), true);
  assert.equal(new Set(GOLDEN_SCENARIOS.map((scenario) => scenario.mode)).has('devices'), true);
  assert.equal(new Set(GOLDEN_SCENARIOS.map((scenario) => scenario.mode)).has('decor'), true);
  assert.equal(new Set(GOLDEN_SCENARIOS.map((scenario) => scenario.theme)).has('light'), true);
  assert.equal(new Set(GOLDEN_SCENARIOS.map((scenario) => scenario.theme)).has('dark'), true);
});

test('room-label parity goldens pair View and Plan in light and dark themes', () => {
  const scenarios = GOLDEN_SCENARIOS.filter((scenario) => scenario.roomLabelParity);
  assert.deepEqual(scenarios.map(({ mode, theme }) => `${mode}-${theme}`).sort(), [
    'plan-dark', 'plan-light', 'view-dark', 'view-light',
  ]);
  for (const scenario of scenarios) {
    const fixture = prepareGoldenFixture(scenario);
    const space = fixture.config.spaces.find((item) => item.id === scenario.space);
    assert.equal(space.settings.show_names, true);
    assert.equal(space.settings.label_temp, true);
    assert.equal(space.settings.label_lqi, true);
    assert.equal(space.settings.label_light, true);
    assert.deepEqual(Object.keys(fixture.layout).filter((id) => id.startsWith('rl_')).sort(), [
      'rl_light-left', 'rl_light-right',
    ]);
  }
});

test('space-tab drop goldens hold both insertion sides in light and dark', () => {
  const scenarios = GOLDEN_SCENARIOS.filter((scenario) => scenario.tabDrag);
  assert.equal(scenarios.length, 2);
  assert.deepEqual(new Set(scenarios.map((scenario) => scenario.tabDrag)),
    new Set(['before', 'after']));
  assert.deepEqual(new Set(scenarios.map((scenario) => scenario.theme)),
    new Set(['light', 'dark']));
  for (const scenario of scenarios) {
    assert.equal(prepareGoldenFixture(scenario).config.spaces.length >= 3, true, scenario.id);
  }
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

test('issue 276 golden captures 5 cm offsets and hosted door before/after 10/30/virtual', () => {
  const scenarios = GOLDEN_SCENARIOS.filter((scenario) => (
    scenario.coincidentPartition && !scenario.hiddenWallDiagnostics
  ));
  assert.deepEqual(
    scenarios.map((scenario) => scenario.coincidentPartition),
    ['before', 'thin', 'thick', 'virtual'],
  );
  for (const scenario of scenarios) {
    const fixture = prepareGoldenFixture(scenario);
    const space = fixture.config.spaces.find((item) => item.id === scenario.space);
    assert.ok(space);
    assert.equal(space.cell_cm, 5);
    assert.ok(space.rooms[0].poly.some((point) => point[0] === 0.5
      && point[1] === 0.004166666666666667), 'short 5 cm offset must be visible');
    assert.equal(space.openings.length, 1);
    if (scenario.coincidentPartition === 'before') {
      assert.equal(space.partitions.length, 1);
      assert.equal(space.openings[0].host.id, 'redundant');
      continue;
    }
    assert.equal(space.partitions, undefined);
    assert.equal(space.openings[0].host, undefined);
    assert.equal(space.openings[0].x, 0.504166667);
    if (scenario.coincidentPartition === 'virtual') {
      assert.equal(space.open_spans.length, 1);
    } else {
      assert.equal(space.walls[0].cm, scenario.coincidentPartition === 'thin' ? 10 : 30);
    }
  }
});

test('issue 296 golden shows hidden partition and saved-chain diagnostics in both themes', () => {
  const scenarios = GOLDEN_SCENARIOS.filter((scenario) => scenario.hiddenWallDiagnostics);
  assert.deepEqual(scenarios.map((scenario) => scenario.theme).sort(), ['dark', 'light']);
  for (const scenario of scenarios) {
    assert.equal(scenario.mode, 'plan');
    const fixture = prepareGoldenFixture(scenario);
    const space = fixture.config.spaces.find((item) => item.id === scenario.space);
    assert.equal(space.partitions.length, 1);
    assert.equal(space.room_drafts.length, 1);
    assert.deepEqual(space.room_drafts[0].points, [[0, 0], [0, 1]]);
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

test('decor layer goldens pair opaque hover and Glow base with semantic pixels', () => {
  const scenarios = GOLDEN_SCENARIOS.filter((item) => item.decorPixelProbes);
  assert.deepEqual(scenarios.map((item) => item.id), [
    'decor-over-opaque-hover-light',
    'decor-over-glow-base-dark',
  ]);
  assert.deepEqual(scenarios.map((item) => item.theme), ['light', 'dark']);
  for (const scenario of scenarios) {
    assert.equal(scenario.showBorders, false);
    assert.equal(scenario.showNames, false);
    assert.equal(scenario.hideOpenings, true);
    assert.equal(scenario.sunRays, false);
    assert.equal(scenario.decorPixelProbes.points.some((point) => point.id === 'opening-tunnel'), true);
    const fixture = prepareGoldenFixture(scenario);
    const space = fixture.config.spaces.find((item) => item.id === scenario.space);
    assert.deepEqual(new Set(space.decor.map((shape) => shape.kind)),
      new Set(['line', 'rect', 'ellipse', 'text', 'furniture']));
    assert.equal(space.settings.show_borders, false);
    assert.equal(space.settings.hide_openings, true);
  }
  assert.equal(scenarios[0].fillMode, 'custom');
  assert.equal(scenarios[0].customFill.a, 1);
  assert.equal(scenarios[0].hoverRoom, 'light-left');
  assert.equal(scenarios[1].fillMode, 'glow');
  assert.equal(scenarios[1].glowEnabled, true);
  assert.equal(scenarios[1].allLightsOff, true);
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
  assert.equal(GOLDEN_MATRIX_VERSION, 44);
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

test('issue #277 golden pairs safe/disabled handles and an opening clamp in both themes', () => {
  const scenarios = GOLDEN_SCENARIOS.filter((item) => item.safeResizePreview);
  assert.deepEqual(scenarios.map((item) => item.theme).sort(), ['dark', 'light']);
  for (const scenario of scenarios) {
    assert.equal(scenario.safeResizeFixture, true);
    assert.equal(scenario.mode, 'plan');
    const fixture = prepareGoldenFixture(scenario);
    const space = fixture.config.spaces.find((item) => item.id === scenario.space);
    assert.equal(space.rooms.length, 3);
    assert.equal(space.rooms.some((room) => room.id === 'resize-diagonal'), true);
    assert.equal(space.openings.some((opening) => opening.id === 'resize-side-door'), true);
  }
});

test('issue 252 golden matrix covers owner-aware cleanup in both themes and languages', () => {
  const optimize = GOLDEN_SCENARIOS.filter(
    (item) => item.dialog === 'optimize-orphan-references',
  );
  assert.deepEqual(optimize.map((item) => item.theme).sort(), ['dark', 'light']);
  assert.deepEqual(optimize.map((item) => item.language).sort(), ['en', 'ru']);
  for (const scenario of optimize) {
    const live = scenario.markerOverrides.find((marker) => marker.id === 'golden-light-two');
    const removed = scenario.markerOverrides.find((marker) => marker.id === 'golden-presence');
    assert.equal(live.space, 'removed-floor');
    assert.equal(!!live.name, true);
    assert.equal(removed.removed, true);
    assert.equal(scenario.layoutOverrides['golden-light-one'].s, 'unresolved-floor');
    assert.equal(scenario.layoutOverrides['golden-presence'].s, 'removed-floor');
  }

  // The existing #244 default-floor warning remains paired light/dark as well.
  const editors = GOLDEN_SCENARIOS.filter(
    (item) => item.cardEditorInvalidDefaultFloor === 'removed-floor',
  );
  assert.deepEqual(editors.map((item) => item.theme).sort(), ['dark', 'light']);
  assert.deepEqual(editors.map((item) => item.language).sort(), ['en', 'ru']);
});

test('issue #197 golden keeps the complete junction fixture in Plan and View', () => {
  const scenarios = GOLDEN_SCENARIOS.filter((item) =>
    item.id.startsWith('junction-patch-resilience-'));
  assert.deepEqual(scenarios.map((item) => item.mode).sort(), ['plan', 'view']);
  for (const scenario of scenarios) {
    assert.equal(scenario.theme, 'dark');
    assert.equal(scenario.junctionPatchResilience, true);
    assert.deepEqual(scenario.retainedWedgeProbe, [0.8955, 0.556]);
    assert.deepEqual(
      scenario.absentWallProbes,
      [[0.420833333, 0.37625], [0.92, 0.348]],
    );
    const fixture = prepareGoldenFixture(scenario);
    const space = fixture.config.spaces.find((item) => item.id === scenario.space);
    assert.ok(space);
    assert.deepEqual(
      [space.rooms.length, space.walls.length, space.open_spans.length],
      [8, 25, 3],
    );
  }
});

test('issues #278/#291 golden covers the stored wall-union fixture in both themes', () => {
  const scenarios = GOLDEN_SCENARIOS.filter((item) => item.wallUnionIsolation);
  assert.deepEqual(scenarios.map((item) => item.theme).sort(), ['dark', 'light']);
  for (const scenario of scenarios) {
    assert.equal(scenario.mode, 'view');
    const fixture = prepareGoldenFixture(scenario);
    const space = fixture.config.spaces.find((item) => item.id === scenario.space);
    assert.ok(space);
    assert.deepEqual([space.rooms.length, space.walls.length], [2, 3]);
  }
});

test('issue #249 golden isolates a bounded physical three-ray bevel', () => {
  const scenario = GOLDEN_SCENARIOS.find(
    (item) => item.id === 'multiwall-junction-bevel-view-dark',
  );
  assert.ok(scenario);
  assert.equal(scenario.mode, 'view');
  assert.equal(scenario.theme, 'dark');
  assert.equal(scenario.multiWallJunction.rays, 3);
  assert.equal(scenario.multiWallJunction.node.length, 2);
  assert.equal(scenario.multiWallJunction.discardedWedgeProbe.length, 2);
  assert.equal(scenario.multiWallJunction.enclosedHoles, 0,
    'the product contract must not preserve the temporary two-hole inventory');
  const fixture = prepareGoldenFixture(scenario);
  const space = fixture.config.spaces.find((item) => item.id === scenario.space);
  assert.ok(space);
  assert.deepEqual(space.node, scenario.multiWallJunction.node);
  const endpointRays = space.walls.filter((wall) => [wall.a, wall.b].some((point) => (
    Math.hypot(point[0] - space.node[0], point[1] - space.node[1]) < 1e-8
  )));
  assert.equal(endpointRays.length >= scenario.multiWallJunction.rays, true);
  assert.equal(space.settings.show_borders, true);
});

test('every multi-wall golden scene declares its enclosed-hole inventory (#272)', () => {
  const scenes = GOLDEN_SCENARIOS.filter((item) => item.multiWallJunction);
  assert.ok(scenes.length >= 1, 'multi-wall semantic scenes disappeared');
  for (const scene of scenes) {
    assert.equal(Number.isInteger(scene.multiWallJunction.enclosedHoles), true,
      `${scene.id}: enclosedHoles is missing`);
    assert.ok(scene.multiWallJunction.enclosedHoles >= 0);
  }
});

test('issue #275 golden preflight samples protected strips, not just enclosed holes', () => {
  const scenarios = GOLDEN_SCENARIOS.filter((item) => item.orthogonalStripContainment);
  assert.deepEqual(scenarios.map((item) => item.id), [
    'orthogonal-strip-cell-5-view-dark',
    'orthogonal-strip-cell-1-view-dark',
  ]);
  assert.deepEqual(
    scenarios.map((item) => item.orthogonalStripContainment.caseId),
    ['cell-5-mixed-depth-t', 'cell-1-thick-crossbar-t'],
  );
  for (const scenario of scenarios) {
    assert.equal(scenario.mode, 'view');
    assert.ok(scenario.orthogonalStripContainment.minSamples >= 300);
    const fixture = prepareGoldenFixture(scenario);
    const space = fixture.config.spaces.find((item) => item.id === scenario.space);
    assert.ok(space);
    assert.ok(space.nodes.length >= 1);
    assert.ok(space.walls.length >= 3);
    assert.equal(space.settings.show_borders, true);
  }
});

test('issue #258 golden renders the affected persisted key at its T-junction', () => {
  const scenario = GOLDEN_SCENARIOS.find(
    (item) => item.id === 'wall-key-roundtrip-view-dark',
  );
  assert.ok(scenario);
  assert.equal(scenario.mode, 'view');
  assert.equal(scenario.theme, 'dark');
  assert.equal(scenario.wallKeyRoundtrip.variant, 'affected');
  const fixture = prepareGoldenFixture(scenario);
  const space = fixture.config.spaces.find((item) => item.id === scenario.space);
  assert.ok(space);
  assert.equal(space.walls[0].key, '0.887500,0.195833@1.5706');
  assert.deepEqual(scenario.wallKeyRoundtrip.node, [0.8875, 0.345833333]);
  assert.equal(space.settings.show_borders, true);
});

test('the open color picker golden covers dark mobile and light desktop themes', () => {
  const scenarios = GOLDEN_SCENARIOS.filter((item) => item.dialog === 'decor-color');
  assert.deepEqual(scenarios.map(({ id, language, theme, viewport }) => ({
    id, language, theme, width: viewport.width,
  })), [
    { id: 'decor-color-popover-mobile-ru', language: 'ru', theme: 'dark', width: 390 },
    { id: 'decor-color-popover-desktop-en', language: 'en', theme: 'light', width: 760 },
  ]);
});

test('all newly unified color-picker dialog families have reviewed-golden candidates', () => {
  const scenarios = GOLDEN_SCENARIOS.filter((item) => [
    'general-color', 'device-ripple-color', 'space-room-color',
  ].includes(item.dialog));
  assert.deepEqual(scenarios.map(({ id, dialog, theme, viewport }) => ({
    id, dialog, theme, width: viewport.width,
  })), [
    { id: 'general-color-popover-desktop-en', dialog: 'general-color', theme: 'light', width: 900 },
    { id: 'device-ripple-color-popover-mobile-ru', dialog: 'device-ripple-color', theme: 'dark', width: 390 },
    { id: 'space-room-color-popover-desktop-ru', dialog: 'space-room-color', theme: 'dark', width: 900 },
  ]);
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

test('device icon state-table goldens cover both themes and design facets', () => {
  const scenarios = GOLDEN_SCENARIOS.filter((item) => item.id.startsWith('device-icon-state-table-'));
  assert.deepEqual(new Set(scenarios.map((scenario) => scenario.theme)), new Set(['light', 'dark']));
  for (const scenario of scenarios) {
    assert.equal(scenario.focusDevice, 'golden-climate');
    assert.equal(scenario.hoverDevice, 'golden-presence');
    assert.equal(scenario.hideHoverTooltip, true);
    assert.deepEqual(scenario.deviceClassOverrides['golden-climate'], ['alarm', 'sel']);
    assert.deepEqual(scenario.deviceClassOverrides['golden-presence'], ['virtual']);
    assert.deepEqual(scenario.deviceClassOverrides['golden-light-two'], ['lock-locked']);
    assert.deepEqual(scenario.deviceClassOverrides['golden-light-three'], ['lock-unlocked']);
    assert.deepEqual(scenario.deviceClassOverrides['golden-right-linkquality'], ['open']);
    const fixture = prepareGoldenFixture(scenario);
    assert.equal(fixture.states['light.golden_light_one'].attributes.lqi, 40);
    assert.equal(fixture.states['light.golden_light_two'].attributes.lqi, 41);
    assert.equal(fixture.states['light.golden_light_three'].attributes.lqi, 180);
    assert.equal(fixture.states['light.golden_light_three'].state, 'unavailable');
    const targetAvailabilityController = fixture.config.markers.find(
      (marker) => marker.id === 'golden-left-linkquality',
    );
    assert.equal(targetAvailabilityController.tap_action, 'toggle');
    assert.deepEqual(targetAvailabilityController.controls, ['light.golden_light_three']);
    assert.equal(
      fixture.config.markers.find((marker) => marker.id === 'golden-left-temperature').display,
      'value',
    );
    assert.equal(
      fixture.config.markers.find((marker) => marker.id === 'golden-right-temperature').display,
      'static_icon',
    );
  }
});

test('Text shell regression goldens isolate a large long value in both themes', () => {
  const scenarios = GOLDEN_SCENARIOS.filter((item) => item.id.startsWith('device-text-shell-long-'));
  assert.deepEqual(new Set(scenarios.map((scenario) => scenario.theme)), new Set(['light', 'dark']));
  for (const scenario of scenarios) {
    assert.equal(scenario.deviceOnly, 'golden-left-linkquality');
    const fixture = prepareGoldenFixture(scenario);
    const marker = fixture.config.markers.find((item) => item.id === 'golden-left-linkquality');
    assert.equal(marker.display, 'value');
    assert.equal(marker.size, 3);
    assert.equal(
      fixture.config.spaces.find((item) => item.id === scenario.space).settings.show_names,
      false,
    );
    assert.equal(fixture.states['sensor.golden_left_linkquality'].state, '498');
    assert.equal(
      fixture.states['sensor.golden_left_linkquality'].attributes.unit_of_measurement,
      'ppm',
    );
  }
});

test('opening placement golden requires browser-painted preview pixels', () => {
  const door = GOLDEN_SCENARIOS.find(
    (item) => item.id === 'opening-placement-door-thick-wall-dark',
  );
  assert.ok(door);
  assert.equal(door.mode, 'plan');
  assert.equal(door.openingPreview?.type, 'door');
  assert.deepEqual(door.openingPreview?.pointer, [0.48, 0.65]);
  assert.equal(door.openingPreviewPixels.minPixels >= 150, true);
  assert.equal(door.openingPreviewPixels.minChannelDelta >= 4, true);

  const passages = GOLDEN_SCENARIOS.filter(
    (item) => item.id.startsWith('opening-placement-passage-thick-wall-'),
  );
  assert.deepEqual(passages.map((scenario) => scenario.theme), ['dark', 'light']);
  for (const scenario of passages) {
    assert.equal(scenario.mode, 'plan');
    assert.equal(scenario.openingPreview?.type, 'passage');
    assert.deepEqual(scenario.openingPreview?.pointer, [0.48, 0.65]);
    assert.equal(scenario.openingPreviewPixels.minPixels >= 150, true);
    assert.equal(scenario.openingPreviewPixels.minInsideWallPixels >= 8, true);
    assert.equal(scenario.openingPreviewPixels.minChannelDelta >= 4, true);
  }
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

test('opening symbol goldens lock room, diagonal, flip-pair and hidden Iso contracts', () => {
  const scenarios = GOLDEN_SCENARIOS.filter((item) => item.openingSymbolContract);
  assert.deepEqual(scenarios.map((item) => item.id), [
    'opening-symbol-room-wall-light',
    'opening-symbol-diagonal-partition-dark',
    'opening-symbol-flip-pairs-light',
    'isometric-opening-symbol-parity-dark',
  ]);
  for (const scenario of scenarios) {
    const fixture = prepareGoldenFixture(scenario);
    const space = fixture.config.spaces.find((item) => item.id === scenario.space);
    assert.ok(space, scenario.id);
    assert.equal(space.openings.length, scenario.openingSymbolContract.openings.length, scenario.id);
    assert.equal(space.settings.show_borders, true, scenario.id);
    assert.equal(space.openings.every((opening) => Number.isFinite(opening.x)
      && Number.isFinite(opening.y) && Number.isFinite(opening.angle)), true, scenario.id);
    if (scenario.openingSymbolContract.kind === 'partition') {
      assert.equal(space.partitions.length, 1, scenario.id);
      assert.equal(space.openings.every((opening) => opening.host?.id === space.partitions[0].id),
        true, scenario.id);
    } else {
      assert.equal(space.rooms.length, 2, scenario.id);
      assert.equal(space.walls.some((wall) => wall.cm === scenario.openingSymbolContract.wallCm),
        true, scenario.id);
    }
  }
  const flipPair = scenarios.find((item) => item.id === 'opening-symbol-flip-pairs-light');
  assert.deepEqual(flipPair.openingSymbolContract.openings.map((opening) => [
    opening.type, opening.flipV, opening.offset,
  ]), [
    ['door', false, 'center'], ['door', true, 'center'],
    ['window', false, 'center'], ['window', true, 'center'],
    ['gate', false, 'center'], ['gate', true, 'center'],
  ]);
  assert.equal(OPENING_SYMBOL_EXISTING_GOLDEN_IMPACT.length, 67);
  assert.equal(new Set(OPENING_SYMBOL_EXISTING_GOLDEN_IMPACT).size, 67);
  const scenarioIds = new Set(GOLDEN_SCENARIOS.map((scenario) => scenario.id));
  const testingDoc = readFileSync(new URL('../docs/TESTING.md', import.meta.url), 'utf8');
  for (const id of OPENING_SYMBOL_EXISTING_GOLDEN_IMPACT) {
    assert.equal(scenarioIds.has(id), true, id);
    assert.match(testingDoc, new RegExp(`\\b${id}\\b`), id);
  }
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
  assert.throws(() => prepareGoldenFixture({
    ...base, decorOverride: [{ id: 'bad', kind: 'triangle' }],
  }), /unknown kind/);
});

test('a light source paints exactly one region: the floor it can see', () => {
  const source = readFileSync(new URL('../src/houseplan-card.ts', import.meta.url), 'utf8');
  // One region per source, and it is the visibility polygon clipped to floor.
  assert.match(source, /visibilityPolygon\(\[pos\.x, pos\.y\], R, occluders/);
  assert.match(source,
    /lit: seen\.length >= 3\s*\? intersectionPaths\(\[seen\], floor, \{/);
  assert.match(source, /onBoundsFailure: \(\{ boundIndex, phase \}\) =>/,
    'room-local boolean failures must be observable without restoring an unclipped fan');
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

test('issue #199 golden candidates cover the blocked Optimize dialog in both themes', () => {
  const scenarios = GOLDEN_SCENARIOS.filter((scenario) =>
    scenario.id.startsWith('optimize-preflight-dialog-'));
  assert.equal(scenarios.length, 2);
  assert.deepEqual(new Set(scenarios.map((scenario) => scenario.theme)), new Set(['dark', 'light']));
  assert.deepEqual(new Set(scenarios.map((scenario) => scenario.language)), new Set(['en', 'ru']));
  for (const scenario of scenarios) {
    assert.equal(scenario.dialog, 'optimize-preflight');
    assert.equal(scenario.capture, 'page');
  }
});

test('golden harness neutralizes the shared pointer before every scenario', () => {
  const harness = readFileSync(new URL('../demo/golden/harness.mjs', import.meta.url), 'utf8');
  const reset = harness.indexOf('await page.mouse.move(0, 0);');
  const fixture = harness.indexOf('const fixture = prepareGoldenFixture(scenario);', reset);
  assert.equal(reset >= 0, true, 'the shared Playwright pointer must be reset');
  assert.equal(fixture > reset, true, 'pointer reset must happen before fixture adoption');
});

test('toggle-entity dialog goldens cover selected and stale states across themes and widths', () => {
  const dialogs = GOLDEN_SCENARIOS.filter((scenario) =>
    scenario.id.startsWith('toggle-entity-dialog-'));
  assert.equal(dialogs.length, 2);
  assert.deepEqual(new Set(dialogs.map((scenario) => scenario.deviceToggleEntity)),
    new Set(['selected', 'stale']));
  assert.deepEqual(new Set(dialogs.map((scenario) => scenario.language)), new Set(['en', 'ru']));
  assert.deepEqual(new Set(dialogs.map((scenario) => scenario.theme)), new Set(['light', 'dark']));
  assert.equal(dialogs.some((scenario) => scenario.viewport.width < 600), true);
  assert.equal(dialogs.some((scenario) => scenario.viewport.width >= 1000), true);
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
