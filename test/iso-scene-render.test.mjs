import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ISO_RAISED_FOOTPRINT,
  buildIsoWallDepthQueue,
  buildIsoOverlayRenderScene,
  createIsoStructuralSource,
  isoOpeningLockPlacement,
  isoFixedLightTransform,
  isoOverlaySceneBounds,
  isoOverlayRooms,
  isoRaisedOverlayHalfSize,
  isoSourceOpenings,
  isoStructuralOpeningHost,
  isoStructuralRoomGeometry,
  resolveIsoDecorationLayers,
  resolveIsoFramePresentation,
  resolveIsoOverlayFitEnvelope,
  resolveIsoScene,
} from '../test-build/iso-scene-render.js';
import {
  ISO_OPENING_GEOMETRY_POLICY,
  buildIsoOpeningBasis,
  projectIsoOpening,
  projectIsoOpeningStructure,
} from '../test-build/iso-openings.js';
import { buildIsoWallGeometry } from '../test-build/iso-walls.js';
import { wallKey } from '../test-build/wall-thickness.js';
import {
  buildIsoFootprintPolygon,
  resolveIsoOverlayOwner,
} from '../test-build/iso-overlays.js';
import {
  ISO_WALL_HEIGHT,
  projectPlanPoint,
} from '../test-build/iso-projection.js';

/**
 * #724: the overlay caches are keyed by the structural wall geometry. Every
 * fixture gets its own object, as a structural scene of its own would.
 */
const structureOf = (walls = []) => buildIsoWallGeometry(walls);
const wallRect = (x0, y0, x1, y1) => [[[[x0, y0], [x1, y0], [x1, y1], [x0, y1]]]];

/**
 * #732: an overlay fixture names only fields of the production input type; the
 * values stay as partial as each test needs. test/iso-overlay-fixture-types.test.mjs
 * typechecks this file: a field nothing reads — a zoom view, a stage size,
 * decoration layers, a selection, a ground radius — fails there instead of
 * pretending to be an input. Every scene fixture reaches the builder through
 * `overlayScene` or a declaration of this type.
 *
 * @typedef {{ [K in keyof import('../src/iso-scene-render.js').IsoOverlaySceneInput]?: unknown }} OverlaySceneFixture
 * @typedef {{ [K in keyof import('../src/iso-scene-render.js').IsoOverlayRenderEntry]?: unknown }} OverlayEntryFixture
 */

/** @param {OverlaySceneFixture} input */
const overlayScene = (input) => buildIsoOverlayRenderScene(input);

const room = (id, x0, y0, x1, y1) => ({
  id,
  poly: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]],
});

test('every Stage 4 shadow plane uses the same scale-aware fixed-light vector', () => {
  assert.equal(isoFixedLightTransform(5), 'translate(4 8)');
  assert.equal(isoFixedLightTransform(1), 'translate(20 40)');
});

test('device footprint contains value capsule, bottom badge and displaced LQI row', () => {
  const core = 100;
  const presentation = {
    valueText: '12345678',
    valueFullText: '12345678',
    valueBadge: {
      configured: true,
      enabled: true,
      source: null,
      sourceLabel: 'Energy',
      text: '123.4 kWh',
      fullText: '123.4 kWh',
      position: 'bottom',
      availability: 'available',
      isLqi: false,
      tone: 'default',
      failure: null,
    },
    tempText: null,
    humText: null,
    lqiText: '255',
    pulse: {
      kind: 'none', reason: 'none', generation: 1, expiresAt: null,
      color: null, diameterScale: 1.5, animated: false, reducedMotionIndicator: 'none',
    },
  };
  const halfSize = isoRaisedOverlayHalfSize({ kind: 'device', core, presentation });
  const lqiBottom = (ISO_RAISED_FOOTPRINT.deviceLqiBelowBottomBadgeTop
    + ISO_RAISED_FOOTPRINT.deviceLqiFontSize
    + ISO_RAISED_FOOTPRINT.devicePadding) * core;
  assert.equal(halfSize[1], lqiBottom,
    'bottom LQI position, line box and conservative footprint padding are all included');
  assert.ok(halfSize[0] > core * 1.6,
    'the expanding value core is not reduced to the shell diameter');
});

test('room footprint contains a long name and the complete four-metric row', () => {
  const font = 20;
  const labelRoom = {
    ...room('metrics', 0, 0, 100, 100),
    name: 'Long engineering and utility room',
    area: 'utility',
    settings: { name_scale: 1.25, label_scale: 1.5 },
  };
  const halfSize = isoRaisedOverlayHalfSize({
    kind: 'room-label',
    font,
    room: labelRoom,
    display: { labelTemp: true, labelHum: true, labelLqi: true, labelLight: true },
  });
  const oldSymmetricMetricHalfWidth = font * 11.8 / 2;
  const metricsBottom = (ISO_RAISED_FOOTPRINT.roomNameLineHeight * 1.25 / 2
    + ISO_RAISED_FOOTPRINT.roomMetricsTopGap
    + ISO_RAISED_FOOTPRINT.roomMetricFontSize * 1.5
      * ISO_RAISED_FOOTPRINT.roomMetricLineHeight
    + ISO_RAISED_FOOTPRINT.roomPadding) * font;
  assert.ok(halfSize[0] > oldSymmetricMetricHalfWidth * 2,
    'four metric values, their icons and inter-item gaps exceed the legacy 11em guess');
  assert.equal(halfSize[1], metricsBottom,
    'absolute metrics below the centred name are included instead of halving total height');
});

test('room footprint treats wide ASCII glyphs conservatively', () => {
  const footprint = (name) => isoRaisedOverlayHalfSize({
    kind: 'room-label', font: 20,
    room: { ...room('wide', 0, 0, 100, 100), name, settings: {} },
    display: { labelTemp: false, labelHum: false, labelLqi: false, labelLight: false },
  });
  assert.ok(footprint('WWWWWW')[0] > footprint('iiiiii')[0] * 1.25,
    'bold W/M labels must not escape a Latin-average fit estimate');
});

test('overlay bounds use final screen footprint and canonical owner filtering', () => {
  const placement = (owner, center) => ({
    owner: { id: owner }, floorScene: [center[0] - 5, center[1]],
    visualScene: center,
    footprint: [[center[0] - 2, center[1] - 1], [center[0] + 2, center[1] - 1],
      [center[0] + 2, center[1] + 1], [center[0] - 2, center[1] + 1]],
  });
  /** @type {{ entries: OverlayEntryFixture[] }} */
  const scene = { entries: [
    { id: 'one', kind: 'device', placement: placement('r1', [20, 30]), screenHalfSize: [5, 3] },
    { id: 'two', kind: 'device', placement: placement('r2', [200, 300]), screenHalfSize: [10, 8] },
  ] };
  assert.deepEqual(isoOverlaySceneBounds(scene, 'r1'), { x: 15, y: 27, w: 10, h: 6 });
  assert.deepEqual(isoOverlaySceneBounds(scene), { x: 15, y: 27, w: 195, h: 281 });
});

test('#713 K8: overlay fit is the structure plus visible tiles, no #651 nudge reserve', () => {
  /** @type {OverlayEntryFixture} */
  const entry = {
    id: 'edge', kind: 'device', screenHalfSize: [10, 8],
    placement: {
      owner: { id: 'room' }, floorScene: [95, 50],
      visualScene: [95, 50],
      footprint: [[90, 46], [100, 46], [100, 54], [90, 54]],
    },
  };
  const stageSize = { width: 320, height: 180 };
  const targetView = (bounds) => {
    const aspect = stageSize.width / stageSize.height;
    if (bounds.w / bounds.h > aspect) {
      const h = bounds.w / aspect;
      return { x: bounds.x, y: bounds.y - (h - bounds.h) / 2, w: bounds.w, h };
    }
    const w = bounds.h * aspect;
    return { x: bounds.x - (w - bounds.w) / 2, y: bounds.y, w, h: bounds.h };
  };
  const fitted = resolveIsoOverlayFitEnvelope({
    baseBounds: { x: 0, y: 0, w: 100, h: 100 }, entries: [entry], targetView,
  });
  assert.ok(fitted);
  assert.deepEqual(fitted.bounds, { x: 0, y: 0, w: 105, h: 100 },
    'the tile edge at x=105 is the only growth: no 48 CSS px reserve around it');
  assert.deepEqual(fitted.view, targetView(fitted.bounds));
  const repeated = resolveIsoOverlayFitEnvelope({
    baseBounds: { x: 0, y: 0, w: 100, h: 100 }, entries: [entry], targetView,
  });
  assert.deepEqual(repeated, fitted, 'the canonical envelope is deterministic');
  const otherRoom = resolveIsoOverlayFitEnvelope({
    baseBounds: { x: 0, y: 0, w: 100, h: 100 }, entries: [entry],
    targetView, ownerId: 'other-room',
  });
  assert.deepEqual(otherRoom.bounds, { x: 0, y: 0, w: 100, h: 100 });
});

test('one painter queue paints a nearer wall after an unrelated rear opening', () => {
  const geometry = buildIsoWallGeometry([[[
    [0, 100], [100, 100], [100, 200], [0, 200], [0, 100],
  ]]]);
  const nearWall = geometry.topFaces[0];
  const rearOpening = {
    id: 'rear-door', sourceIndex: 4, type: 'door', leaf: 0,
    kind: 'leaf-front', material: 'matte-leaf', d: 'M 0 0 L 1 0 L 1 1 Z',
    depth: nearWall.depth - 10, cameraDepth: nearWall.depth - 10,
  };
  const queue = buildIsoWallDepthQueue(geometry, [rearOpening]);
  const rearIndex = queue.findIndex((entry) => entry.layer === 'opening');
  const nearIndex = queue.findIndex((entry) => entry.layer === 'wall-top'
    && entry.face === nearWall);
  assert.ok(rearIndex >= 0 && nearIndex > rearIndex,
    'later SVG paint order must let the near wall occlude the rear opening');
  assert.deepEqual(buildIsoWallDepthQueue(geometry, [rearOpening]), queue,
    'the combined wall/opening order is deterministic');
});

test('shared painter queue puts elevated window glass over its rear sill only in window slots', () => {
  const geometry = buildIsoWallGeometry([[[
    [0, 100], [100, 100], [100, 200], [0, 200], [0, 100],
  ]]]);
  const basis = buildIsoOpeningBasis({
    id: 'window-overlap', sourceIndex: 2, type: 'window', x: 50, y: 100,
    angle: 0, length: 60, flipH: false, flipV: false,
    face: { ox: 0, oy: -5, cm: 20, side: -1 },
  });
  const surfaces = [
    ...projectIsoOpeningStructure(basis),
    ...projectIsoOpening(basis, 0).flatMap((panel) => panel.surfaces),
  ].map((surface, index) => ({
    ...surface, id: basis.id, sourceIndex: basis.sourceIndex,
    type: 'window', leaf: index,
  }));
  const queue = buildIsoWallDepthQueue(geometry, surfaces);
  const windowEntries = queue.filter((entry) => entry.layer === 'opening');
  assert.deepEqual(windowEntries.map((entry) => entry.surface.cameraDepth),
    windowEntries.map((entry) => entry.surface.cameraDepth).toSorted((a, b) => a - b),
    'one window reuses its shared queue slots in physical camera-depth order');
  const sillIndex = queue.findIndex((entry) => entry.layer === 'opening'
    && entry.surface.kind === 'window-sill');
  const glassIndices = queue.flatMap((entry, index) => entry.layer === 'opening'
    && entry.surface.material.startsWith('glass') ? [index] : []);
  assert.ok(sillIndex >= 0 && glassIndices.length === 6
    && glassIndices.some((index) => index > sillIndex),
  'elevated glass must paint after the rear sill projection');
  const wallSlots = queue.flatMap((entry, index) => entry.layer === 'opening' ? [] : [index]);
  const reversed = buildIsoWallDepthQueue(geometry, [...surfaces].reverse());
  assert.deepEqual(reversed.flatMap((entry, index) => entry.layer === 'opening' ? [] : [index]),
    wallSlots, 'window-local occlusion cannot move unrelated wall slots');
});

test('shared painter queue keeps rotating door prism faces in physical camera order', () => {
  const geometry = buildIsoWallGeometry([[[
    [0, 100], [100, 100], [100, 200], [0, 200], [0, 100],
  ]]]);
  const basis = buildIsoOpeningBasis({
    id: 'door-depth', sourceIndex: 3, type: 'door', x: 50, y: 100,
    angle: 0, length: 45, flipH: false, flipV: false,
    face: { ox: 0, oy: -5, cm: 20, side: -1 },
  });
  const surfaces = [
    ...projectIsoOpeningStructure(basis),
    ...projectIsoOpening(basis, 0.5).flatMap((panel) => panel.surfaces),
  ].map((surface, index) => ({
    ...surface, id: basis.id, sourceIndex: basis.sourceIndex,
    type: 'door', leaf: index,
  }));
  const queue = buildIsoWallDepthQueue(geometry, [...surfaces].reverse());
  const doorEntries = queue.filter((entry) => entry.layer === 'opening');
  assert.deepEqual(doorEntries.map((entry) => entry.surface.cameraDepth),
    doorEntries.map((entry) => entry.surface.cameraDepth).toSorted((a, b) => a - b),
    'all faces of one live door reuse its queue slots in physical camera-depth order');
  const wallSlots = queue.flatMap((entry, index) => entry.layer === 'opening' ? [] : [index]);
  const natural = buildIsoWallDepthQueue(geometry, surfaces);
  assert.deepEqual(natural.flatMap((entry, index) => entry.layer === 'opening' ? [] : [index]),
    wallSlots, 'door-local ordering cannot move unrelated wall slots');
});

test('production overlay rooms preserve direct island holes once per room snapshot', () => {
  const outer = room('outer', 0, 0, 100, 100);
  const island = room('island', 40, 40, 60, 60);
  const space = { id: 'floor', rooms: [outer, island] };
  const rows = isoOverlayRooms(space);
  assert.strictEqual(isoOverlayRooms(space), rows, 'one immutable room snapshot is prepared once');
  assert.deepEqual(rows[0].overlayRoom.holes, [island.poly]);
  const owner = resolveIsoOverlayOwner({
    kind: 'device', floorAnchor: [50, 50], rooms: rows.map((row) => row.overlayRoom),
  });
  assert.equal(owner?.id, 'island', 'a marker in the island belongs to the island, not its parent');
});

test('opening-lock placement inherits the selected physical host side', () => {
  const index = {
    adjacencyEps: 0.1,
    edges: [
      {
        roomId: 'north', a: [-50, 0], b: [50, 0], inward: [0, 1],
        cm: 40, half: 20, area: 1000, key: 'north-wall',
      },
      {
        roomId: 'south', a: [-50, 0], b: [50, 0], inward: [0, -1],
        cm: 40, half: 20, area: 1000, key: 'south-wall',
      },
    ],
  };
  const opening = {
    id: 'door', type: 'door', rx: 0, ry: 0, rlen: 40, angle: 0,
    flip_h: false, flip_v: false,
  };
  const positive = isoOpeningLockPlacement(opening, index, 5);
  const negative = isoOpeningLockPlacement({ ...opening, flip_v: true }, index, 5);
  assert.equal(positive.preferredRoomId, 'north');
  assert.equal(negative.preferredRoomId, 'south');
  assert.ok(positive.floorAnchor[1] > 0 && negative.floorAnchor[1] < 0);
});

test('opening-lock scene keeps physical host ownership when spatial fallback points elsewhere', () => {
  const host = room('host', 0, 0, 100, 100);
  const decoy = room('decoy', 45, 60, 55, 75);
  const space = {
    id: 'floor', title: 'Floor', cellCm: 5, vb: [0, 0, 100, 100], bg: null,
    rooms: [host, decoy], wall_segments: [], room_drafts: [], partitions: [], wall_columns: [],
  };
  const openingWallIndex = {
    adjacencyEps: 0.1,
    edges: [{
      roomId: 'host', a: [0, 50], b: [100, 50], inward: [0, 1],
      cm: 40, half: 20, area: 10_000, key: 'host-wall',
    }],
  };
  const opening = {
    id: 'door', type: 'door', rx: 50, ry: 50, rlen: 40, angle: 0,
    flip_h: false, flip_v: false, lock: 'lock.door',
  };
  const roomRows = isoOverlayRooms(space);
  const spatialOwner = resolveIsoOverlayOwner({
    kind: 'device',
    floorAnchor: isoOpeningLockPlacement(opening, openingWallIndex, 5).floorAnchor,
    rooms: roomRows.map((row) => row.overlayRoom),
  });
  assert.equal(spatialOwner?.id, 'decoy', 'fixture proves point containment would pick the wrong room');

  const scene = overlayScene({
    space,
    devices: [],
    openings: [opening],
    display: { showNames: false, cardFontScale: 1 },
    structure: structureOf(),
    iconPct: 100,
    deviceBasePct: 100,
    showLqi: false,
    cellCm: 5,
    kioskIconScale: 1,
    kioskFontScale: 1,
    positionOf: () => ({ x: 0, y: 0 }),
    presentationOf: () => ({ scale: 1 }),
    labelPositionOf: () => ({ x: 0, y: 0 }),
    labelScaleOf: () => 1,
    openingEntityAvailable: () => true,
    openingWallIndex: () => openingWallIndex,
  });
  assert.equal(scene.locks.get('door')?.owner?.id, 'host',
    'render-scene lock ownership comes from the selected physical wall side');
});

test('opening lock without a canonical host owner never guesses from point containment', () => {
  const containing = room('containing', 0, 0, 100, 100);
  const space = {
    id: 'floor', title: 'Floor', cellCm: 5, vb: [0, 0, 100, 100], bg: null,
    rooms: [containing], wall_segments: [], room_drafts: [], partitions: [], wall_columns: [],
  };
  const opening = {
    id: 'partition-door', type: 'door', rx: 50, ry: 50, rlen: 40, angle: 0,
    flip_h: false, flip_v: false, lock: 'lock.door',
    partitionHost: {
      depth: 10,
      axis: { ux: 1, uy: 0 },
      partition: { cm: 10 },
    },
  };
  const scene = overlayScene({
    space,
    devices: [],
    openings: [opening],
    display: { showNames: false, cardFontScale: 1 },
    structure: structureOf(wallRect(0, 45, 100, 55)),
    iconPct: 100,
    deviceBasePct: 100,
    showLqi: false,
    cellCm: 5,
    kioskIconScale: 1,
    kioskFontScale: 1,
    positionOf: () => ({ x: 0, y: 0 }),
    presentationOf: () => ({ scale: 1 }),
    labelPositionOf: () => ({ x: 0, y: 0 }),
    labelScaleOf: () => 1,
    openingEntityAvailable: () => true,
    openingWallIndex: () => ({ adjacencyEps: 0.1, edges: [] }),
  });
  const placement = scene.locks.get('partition-door');
  assert.equal(placement?.owner, null);
  // #713: no placement search runs, so a missing owner is no search failure;
  // the badge simply stands on the wall-top plane above its anchor.
  assert.equal(placement?.plane, 'raised');
  assert.deepEqual(placement?.visualScene, projectPlanPoint(placement.floorAnchor, ISO_WALL_HEIGHT));
});

test('Stage 4 reuses pure overlay placements, and fit and the live frame share one snapshot', () => {
  const owner = room('owner', 0, 0, 100, 100);
  const space = {
    id: 'floor', title: 'Floor', cellCm: 5, vb: [0, 0, 100, 100], bg: null,
    rooms: [owner], wall_segments: [], room_drafts: [], partitions: [], wall_columns: [],
  };
  const structure = structureOf(wallRect(-4, -10, 4, 110));
  /** @type {OverlaySceneFixture} */
  const input = {
    space,
    devices: [{ id: 'device', space: 'floor', marker: { room_id: 'owner' } }],
    openings: [],
    display: { showNames: false, cardFontScale: 1 },
    structure,
    iconPct: 3.4,
    deviceBasePct: 3.4,
    showLqi: false,
    cellCm: 5,
    kioskIconScale: 1,
    kioskFontScale: 1,
    positionOf: () => ({ x: 5, y: 50 }),
    presentationOf: () => ({
      scale: 1, valueText: null, valueFullText: '', valueBadge: null,
      tempText: null, humText: null, lqiText: null,
      pulse: { animated: false, diameterScale: 1 },
    }),
    labelPositionOf: () => ({ x: 0, y: 0 }),
    labelScaleOf: () => 1,
    openingEntityAvailable: () => false,
    openingWallIndex: () => ({ adjacencyEps: 0.1, edges: [] }),
  };
  const live = overlayScene(input);
  const repeated = overlayScene(input);
  assert.strictEqual(repeated, live,
    'an unchanged frame reuses the exact render-scene snapshot for Lit guards');
  assert.strictEqual(repeated.devices.get('device'), live.devices.get('device'),
    'unchanged HA/render passes reuse the exact pure placement result');
  // #713: the tile stands on the wall-top plane right above its anchor even
  // next to a wall; no wall test and no nudge in the live scene.
  assert.deepEqual(live.devices.get('device')?.visualScene, projectPlanPoint([5, 50], ISO_WALL_HEIGHT));

  // #724: the fit envelope and the live frame ask with the same inputs and read
  // one snapshot — there is no search for them to differ by (#713). Zoom, pan
  // and a stage resize are no input of the overlay scene at all (#714, #732):
  // the fixture typecheck rejects such a field, and the production-path zoom is
  // the #724 AC2 test below.
  const fit = overlayScene({ ...input });
  assert.strictEqual(fit, live, 'fit and live share one render-scene snapshot');
});

test('render scene keeps coincident devices coincident, leaves labels alone and caches permutations', () => {
  const owner = {
    ...room('owner', 0, 0, 400, 400),
    name: 'Owner label', area: 'living', settings: {},
  };
  const space = {
    id: 'floor', title: 'Floor', cellCm: 5, vb: [0, 0, 400, 400], bg: null,
    rooms: [owner], wall_segments: [], room_drafts: [], partitions: [], wall_columns: [],
  };
  const devices = ['b', 'a', 'c'].map((id) => ({
    id, space: 'floor', marker: { room_id: 'owner', x: 200, y: 200 },
  }));
  /** @type {OverlaySceneFixture} */
  const input = {
    space, devices, openings: [],
    display: { showNames: true, cardFontScale: 1 },
    structure: structureOf(),
    iconPct: 3.4, deviceBasePct: 3.4, showLqi: false, cellCm: 5,
    kioskIconScale: 1, kioskFontScale: 1,
    positionOf: (device) => ({ x: device.marker.x, y: device.marker.y }),
    presentationOf: () => ({
      scale: 1, valueText: null, valueFullText: '', valueBadge: null,
      tempText: null, humText: null, lqiText: null,
      pulse: { animated: false, diameterScale: 1 },
    }),
    labelPositionOf: () => ({ x: 200, y: 200 }),
    labelScaleOf: () => 1,
    openingEntityAvailable: () => false,
    openingWallIndex: () => ({ adjacencyEps: 0.1, edges: [] }),
  };
  const scene = overlayScene(input);
  const deviceEntries = scene.entries.filter((entry) => entry.kind === 'device');
  for (let index = 0; index < deviceEntries.length; index++) {
    assert.deepEqual(deviceEntries[index].placement.visualScene,
      projectPlanPoint([200, 200], ISO_WALL_HEIGHT), 'every device only rises to the wall top');
    for (let other = 0; other < index; other++) {
      const a = deviceEntries[index], b = deviceEntries[other];
      assert.deepEqual(a.placement.visualScene, b.placement.visualScene,
        `device roots ${a.id}/${b.id} keep their canonical coincident relationship`);
    }
  }
  const label = scene.entries.find((entry) => entry.kind === 'room-label');
  assert.ok(label, 'fixture includes a room label at the same floor anchor');
  assert.deepEqual(label.placement.visualScene, [200, 200],
    'coincident devices do not push the room label');

  const permuted = overlayScene({ ...input, devices: [...devices].reverse() });
  assert.strictEqual(permuted, scene,
    'HA registry permutations reuse the same immutable group layout snapshot');
  const fit = overlayScene({ ...input });
  assert.strictEqual(fit.devices.get('a'), scene.devices.get('a'),
    'fit probing and the live scene read the same placement');
});

test('#711 состояние устройства не двигает значки: раскладка не пересчитывается, границы видят бейдж', () => {
  const owner = { ...room('owner', 0, 0, 400, 400), name: '', settings: {} };
  const space = {
    id: 'floor-710', title: 'Floor', cellCm: 5, vb: [0, 0, 400, 400], bg: null,
    rooms: [owner], wall_segments: [], room_drafts: [], partitions: [], wall_columns: [],
  };
  const structure = structureOf(wallRect(146, 140, 154, 260));
  const devices = ['lamp', 'plug', 'sensor'].map((id, index) => ({
    id, space: 'floor-710', marker: { room_id: 'owner', x: 160 + index * 4, y: 200 },
  }));
  let lampOn = false;
  const presentationOf = (device) => ({
    scale: 1, valueText: null, valueFullText: '', tempText: null, humText: null, lqiText: null,
    valueBadge: device.id === 'lamp' && lampOn
      ? { configured: true, enabled: true, text: '100 %', fullText: '100 %', position: 'right', tone: 'default' }
      : null,
    pulse: { animated: false, diameterScale: 1 },
  });
  /** @type {OverlaySceneFixture} */
  const input = {
    space, devices, openings: [],
    display: { showNames: false, cardFontScale: 1 },
    structure,
    iconPct: 3.4, deviceBasePct: 3.4, showLqi: false, cellCm: 5,
    kioskIconScale: 1, kioskFontScale: 1,
    positionOf: (device) => ({ x: device.marker.x, y: device.marker.y }),
    presentationOf,
    labelPositionOf: () => ({ x: 0, y: 0 }),
    labelScaleOf: () => 1,
    openingEntityAvailable: () => false,
    openingWallIndex: () => ({ adjacencyEps: 0.1, edges: [] }),
  };
  const off = overlayScene(input);
  lampOn = true;
  const on = overlayScene(input);
  for (const id of ['lamp', 'plug', 'sensor']) {
    assert.strictEqual(on.devices.get(id), off.devices.get(id), `${id}: включение лампы не пересчитывает раскладку`);
  }
  const lampOff = off.entries.find((entry) => entry.id === 'lamp');
  const lampOnEntry = on.entries.find((entry) => entry.id === 'lamp');
  assert.ok(lampOnEntry.screenHalfSize[0] > lampOff.screenHalfSize[0], 'видимая ширина с бейджем больше');
  assert.deepEqual(lampOnEntry.layoutHalfSize, lampOff.layoutHalfSize, 'раскладка видит плитку без состояния');
  assert.ok(isoOverlaySceneBounds(on).w >= isoOverlaySceneBounds(off).w, 'границы сцены учитывают бейдж');
  lampOn = false;
  const offAgain = overlayScene(input);
  for (const id of ['lamp', 'plug', 'sensor']) {
    assert.deepEqual(offAgain.devices.get(id).visualScene, off.devices.get(id).visualScene, `${id}: выключение возвращает то же место`);
  }
});

test('orphan hosted openings never become phantom Stage 4 volumes', () => {
  const base = {
    type: 'door', rx: 20, ry: 30, rlen: 40, angle: 0,
    flip_h: false, flip_v: false,
  };
  const result = isoSourceOpenings([
    { ...base, id: 'orphan', orphanReason: 'missing-partition' },
    { ...base, id: 'valid' },
  ], 1000);
  assert.deepEqual(result.map((opening) => [opening.id, opening.sourceIndex]), [['valid', 1]]);
});

const cacheRoom = (overrides = {}) => ({
  id: 'cache-room',
  name: 'Structural cache room',
  area: 'living_room',
  poly: [[0, 0], [100, 0], [100, 100], [0, 100]],
  wall_ids: ['north', 'east', 'south', 'west'],
  settings: { fill_mode: 'temp', glow: true, name_scale: 1.25, label_scale: 1.1 },
  ...overrides,
});

const structuralInput = ({
  room = cacheRoom(), walls = [], openings = [], onBuild = () => {},
  coordinateScale = 1000, wallKeyPitch = 1,
} = {}) => ({
  space: {
    id: 'cache-space', title: 'Cache space', cellCm: 5, vb: [0, 0, 100, 100], bg: null,
    rooms: [room], wall_segments: [], room_drafts: [], partitions: [], wall_columns: [],
  },
  walls, openCuts: [], openings,
  partitionCuts: () => [], roomOpenings: () => [],
  cellCm: 5, gridPitch: 5, wallKeyPitch, coordinateScale, onBuild,
});

test('presentation-only room changes reuse the structural scene but geometry changes rebuild it', () => {
  assert.deepEqual(isoStructuralRoomGeometry(cacheRoom()), {
    id: 'cache-room', x: undefined, y: undefined, w: undefined, h: undefined,
    poly: [[0, 0], [100, 0], [100, 100], [0, 100]],
    wall_ids: ['north', 'east', 'south', 'west'],
  });
  let builds = 0;
  const cache = new Map();
  const resolve = (room) => {
    const source = createIsoStructuralSource(structuralInput({
      room, onBuild: () => { builds += 1; },
    }));
    return { source, scene: resolveIsoScene({
      source, cache, cellCm: 5, liveFrame: { x: 0, y: 0, w: 100, h: 100 },
    }) };
  };
  const original = resolve(cacheRoom());
  const presentation = resolve(cacheRoom({
    name: 'Renamed room', area: 'private_area',
    settings: { fill_mode: 'custom', custom_fill: { c: '#123456', a: 0.4 }, glow: false,
      temp_source: 'sensor.private', hum_source: 'sensor.private_humidity',
      name_scale: 2, label_scale: 0.75 },
  }));
  assert.equal(presentation.source.key, original.source.key);
  assert.strictEqual(presentation.scene.geometry, original.scene.geometry);
  assert.equal(builds, 1, 'presentation changes must hit the existing structural LRU entry');

  const geometry = resolve(cacheRoom({
    poly: [[0, 0], [120, 0], [100, 100], [0, 100]],
  }));
  assert.notEqual(geometry.source.key, original.source.key);
  assert.notStrictEqual(geometry.scene.geometry, original.scene.geometry);
  assert.equal(builds, 2, 'room geometry must invalidate and rebuild the structural scene');
});

test('structural scene cache refreshes a hot hit before evicting the least-recently-used entry', () => {
  const cache = new Map();
  const builds = new Map();
  const resolve = (index) => {
    const id = `lru-room-${index}`;
    const source = createIsoStructuralSource(structuralInput({
      room: cacheRoom({ id, poly: [[0, 0], [100 + index, 0], [100, 100], [0, 100]] }),
      onBuild: () => builds.set(id, (builds.get(id) || 0) + 1),
    }));
    const scene = resolveIsoScene({
      source, cache, cellCm: 5, liveFrame: { x: 0, y: 0, w: 100, h: 100 },
    });
    return { id, key: source.key, scene };
  };

  const initial = Array.from({ length: 8 }, (_, index) => resolve(index));
  const hot = resolve(0);
  assert.strictEqual(hot.scene.geometry, initial[0].scene.geometry);
  const added = resolve(8);

  assert.equal(cache.size, 8);
  assert.equal(cache.has(initial[0].key), true, 'the refreshed hot entry must survive');
  assert.equal(cache.has(initial[1].key), false, 'the coldest entry must be evicted');
  assert.equal(cache.has(added.key), true);
  assert.equal(builds.get(initial[0].id), 1, 'a hot hit must not rebuild structural geometry');
  resolve(1);
  assert.equal(builds.get(initial[1].id), 2, 'the evicted cold entry must rebuild on its next use');
});

test('throwing decoration capability probes keep Iso structural geometry on the solid path', () => {
  const previousCss = globalThis.CSS;
  const previousMatchMedia = globalThis.matchMedia;
  try {
    globalThis.CSS = { supports: () => { throw new Error('capability probe failure'); } };
    globalThis.matchMedia = () => { throw new Error('forced-colors probe failure'); };
    const layers = resolveIsoDecorationLayers({ showBorders: true, hideOpenings: false });
    assert.deepEqual(layers, {
      structural: true, panels: true, shadows: false, materialNuance: false,
      floorSymbols: false,
    });
  } finally {
    if (previousCss === undefined) delete globalThis.CSS;
    else globalThis.CSS = previousCss;
    if (previousMatchMedia === undefined) delete globalThis.matchMedia;
    else globalThis.matchMedia = previousMatchMedia;
  }
});

test('removed contact shadows are never read while ambient shadow capability remains enabled', () => {
  const previousCss = globalThis.CSS;
  const previousMatchMedia = globalThis.matchMedia;
  try {
    globalThis.CSS = { supports: () => true };
    globalThis.matchMedia = () => ({ matches: false });
    let contactReads = 0;
    const geometry = {
      topPath: '', topFaces: [], sides: [], edgeCount: 0,
      get contactPath() {
        contactReads += 1;
        throw new Error('decorative shadow failure');
      },
    };
    const frame = resolveIsoFramePresentation({
      projection: 'iso',
      display: { showBorders: true, hideOpenings: false },
      scene: {
        key: 'solid-retry', geometry,
        floor: { footprintPath: '', sides: [] },
        openings: [], openingSurfaces: [], frame: { x: 0, y: 0, w: 100, h: 100 },
      },
      openings: [], amountOf: () => 0, overlays: () => null, cellCm: 5,
    });
    assert.equal(contactReads, 0,
      'the deprecated contact path must not be touched by presentation rendering');
    assert.equal(frame.layers.structural, true);
    assert.equal(frame.layers.panels, true);
    assert.equal(frame.layers.shadows, true,
      'the remaining building ambient shadow still follows filter capability');
    assert.equal(frame.layers.materialNuance, true);
    assert.equal(frame.overlays, null);
  } finally {
    if (previousCss === undefined) delete globalThis.CSS;
    else globalThis.CSS = previousCss;
    if (previousMatchMedia === undefined) delete globalThis.matchMedia;
    else globalThis.matchMedia = previousMatchMedia;
  }
});

const partitionOpening = (overrides = {}) => {
  const resolved = {
    opening: {},
    host: { kind: 'partition', id: 'partition-a', t: 0.5 },
    partition: { id: 'partition-a', a: [0, 0], b: [100, 0], cm: 15 },
    center: [50, 0], angle: 0, length: 20, depth: 15, t: 0.5,
    axis: { a: [0, 0], b: [100, 0], ux: 1, uy: 0, length: 100 },
    ...overrides,
  };
  return {
    id: 'hosted-door', type: 'door', x: 0.5, y: 0, length: 0.2,
    rx: 50, ry: 0, rlen: 20, angle: 0, flip_h: false, flip_v: false,
    partitionHost: resolved,
  };
};

test('gate flips move structural host face with the reviewed inverse convention', () => {
  const rendered = partitionOpening();
  const source = (type, flipV) => ({
    id: `${type}-${flipV}`, sourceIndex: 0, type,
    x: 0.5, y: 0, length: 0.2, angle: 0, flipH: false, flipV,
  });
  const doorNormal = isoStructuralOpeningHost(rendered, source('door', false));
  const doorFlipped = isoStructuralOpeningHost(rendered, source('door', true));
  const gateNormal = isoStructuralOpeningHost(rendered, source('gate', false));
  const gateFlipped = isoStructuralOpeningHost(rendered, source('gate', true));

  assert.ok(doorNormal && doorFlipped && gateNormal && gateFlipped);
  assert.deepEqual(gateNormal.face, doorFlipped.face,
    'an unflipped gate selects the opposite structural face from an unflipped door');
  assert.deepEqual(gateFlipped.face, doorNormal.face,
    'flipping a gate restores the door-normal structural face');
  assert.notDeepEqual(gateNormal.face, gateFlipped.face,
    'the saved gate flip must change the structural host face');
});

test('gate flips move unhosted structural face with the reviewed inverse convention', () => {
  const square = cacheRoom({ wall_ids: [] });
  const walls = square.poly.map((a, index) => ({
    key: wallKey(a, square.poly[(index + 1) % square.poly.length], 1),
    cm: 20,
  }));
  const gate = (flip_v) => ({
    id: `unhosted-gate-${flip_v}`, type: 'gate',
    rx: 50, ry: 0, rlen: 20, angle: 0, flip_h: false, flip_v,
  });
  const basis = (flip_v) => createIsoStructuralSource(structuralInput({
    room: square, walls, openings: [gate(flip_v)], coordinateScale: 1,
  })).build().openings[0];

  const normal = basis(false);
  const flipped = basis(true);
  assert.equal(normal.face.side, -1,
    'an unflipped gate selects the inverse wall face used by its saved swing convention');
  assert.equal(flipped.face.side, 1,
    'flipping the gate selects the opposite structural wall face');
  assert.deepEqual(normal.face.selectedStart, [40, -10]);
  assert.deepEqual(flipped.face.selectedStart, [40, 10]);
});

test('partition host identity, placement, depth and selected face invalidate opening volumes', () => {
  const keyFor = (opening) => createIsoStructuralSource(structuralInput({
    openings: [opening],
  })).key;
  const original = partitionOpening();
  const base = keyFor(original);
  const mutations = [
    partitionOpening({ host: { kind: 'partition', id: 'partition-b', t: 0.5 } }),
    partitionOpening({ t: 0.75 }),
    partitionOpening({ depth: 25 }),
    partitionOpening({
      axis: { ...original.partitionHost.axis, ux: 0, uy: 1 },
    }),
    partitionOpening({
      partition: { ...original.partitionHost.partition, cm: 25 },
    }),
  ];
  for (const mutation of mutations) assert.notEqual(keyFor(mutation), base);
});

test('opening geometry policy is both fingerprinted and consumed by the structural build', () => {
  const input = structuralInput({ openings: [partitionOpening()] });
  const original = createIsoStructuralSource(input);
  const policy = {
    ...ISO_OPENING_GEOMETRY_POLICY,
    revision: ISO_OPENING_GEOMETRY_POLICY.revision + 1,
    leafThicknessRatio: ISO_OPENING_GEOMETRY_POLICY.leafThicknessRatio * 2,
  };
  const changed = createIsoStructuralSource(input, policy);
  assert.notEqual(changed.key, original.key);
  const basis = changed.build().openings[0];
  assert.equal(basis.leafThickness, basis.wallHeight * policy.leafThicknessRatio);
});

// #473. Перф-дельта #160 (f1b9bbf3..b3ca0ca2) ввела кэш размещений, кэш по
// идентичности силуэтов, повторное использование при зуме внутрь и
// AABB-отсечение — и ушла в бету по §11.4 без ревью и без единого свидетеля.
// Двенадцать мутантов stage3-w* защищают картинку, ни один — эти механизмы.
// Ошибка любого из них даёт УСТАРЕВШЕЕ размещение без единого падения.

const perfFixture = () => {
  const owner = room('owner', 0, 0, 100, 100);
  const space = {
    id: 'floor', title: 'Floor', cellCm: 5, vb: [0, 0, 100, 100], bg: null,
    rooms: [owner], wall_segments: [], room_drafts: [], partitions: [], wall_columns: [],
  };
  const structure = structureOf(wallRect(-4, -10, 4, 110));
  /** @type {OverlaySceneFixture} */
  const input = {
    space,
    devices: [{ id: 'device', space: 'floor', marker: { room_id: 'owner' } }],
    openings: [],
    display: { showNames: false, cardFontScale: 1 },
    structure,
    iconPct: 3.4, deviceBasePct: 3.4, showLqi: false, cellCm: 5,
    kioskIconScale: 1, kioskFontScale: 1,
    positionOf: () => ({ x: 5, y: 50 }),
    presentationOf: () => ({
      scale: 1, valueText: null, valueFullText: '', valueBadge: null,
      tempText: null, humText: null, lqiText: null,
      pulse: { animated: false, diameterScale: 1 },
    }),
    labelPositionOf: () => ({ x: 0, y: 0 }),
    labelScaleOf: () => 1,
    openingEntityAvailable: () => false,
    openingWallIndex: () => ({ adjacencyEps: 0.1, edges: [] }),
  };
  return { input, structure };
};

// #570 superseded #473 W1: selection is presentation-only since Stage 4
// removed the selected/hover tether and ground cue. It is no input of the
// overlay scene at all — the fixture typecheck rejects `selectedDeviceId`
// (test/iso-overlay-fixture-types.test.mjs, #732); a test passing it proved
// nothing the signature does not.

test('#473 W2 after #724: walls never move a tile, the cache follows the structural wall geometry', () => {
  const { input } = perfFixture();
  const withWall = overlayScene(input).devices.get('device');
  const noWalls = overlayScene({ ...input, structure: structureOf() }).devices.get('device');
  assert.notStrictEqual(noWalls, withWall, 'a new wall geometry is a new cache slot');
  assert.deepEqual(noWalls.visualScene, withWall.visualScene,
    'the tile position does not depend on nearby walls');
});

// #724 AC2: the overlay caches follow the wall geometry of the structural scene
// on the production path — createIsoStructuralSource → resolveIsoScene (the
// LRU) → buildIsoOverlayRenderScene({ structure: scene.geometry }).
const unhostedWalls = (poly, cm) => poly.map((a, index) => ({
  key: wallKey(a, poly[(index + 1) % poly.length], 1), cm,
}));
/**
 * @param {OverlaySceneFixture} [overrides]
 * @returns {OverlaySceneFixture}
 */
const overlayInput = (space, structure, overrides = {}) => ({
  space, structure, openings: [],
  devices: [{ id: 'device', space: space.id }],
  display: { showNames: false, cardFontScale: 1 },
  iconPct: 3.4, deviceBasePct: 3.4, showLqi: false, cellCm: 5,
  kioskIconScale: 1, kioskFontScale: 1,
  positionOf: () => ({ x: 50, y: 50 }),
  presentationOf: () => ({
    scale: 1, valueText: null, valueFullText: '', valueBadge: null,
    tempText: null, humText: null, lqiText: null,
    pulse: { animated: false, diameterScale: 1 },
  }),
  labelPositionOf: () => ({ x: 0, y: 0 }),
  labelScaleOf: () => 1,
  openingEntityAvailable: () => false,
  openingWallIndex: () => ({ adjacencyEps: 0.1, edges: [] }),
  ...overrides,
});

test('#724 AC2: the overlay scene survives zoom, resize and HA state, and is rebuilt when a wall changes', () => {
  const square = cacheRoom({ wall_ids: [] });
  const cache = new Map();
  const structural = (cm, liveFrame = { x: 0, y: 0, w: 100, h: 100 }) => {
    const input = structuralInput({ room: square, walls: unhostedWalls(square.poly, cm), coordinateScale: 1 });
    return { space: input.space, scene: resolveIsoScene({
      source: createIsoStructuralSource(input), cache, cellCm: 5, liveFrame,
    }) };
  };
  const thin = structural(20);
  assert.ok(thin.scene.geometry.sides.length > 0, 'fixture has real wall bodies');
  const live = overlayScene(overlayInput(thin.space, thin.scene.geometry));

  // Same walls: the structural LRU hands out the same geometry, and neither
  // zoom, a stage resize nor an HA state change is a layout event. Zoom and
  // resize reach 2.5D only as the live frame of the structural scene (#732:
  // the overlay scene has no view or stage size input).
  const zoomedIn = structural(20, { x: 20, y: 20, w: 40, h: 40 });
  assert.strictEqual(zoomedIn.scene.geometry, thin.scene.geometry);
  assert.notDeepEqual(zoomedIn.scene.frame, thin.scene.frame, 'the fixture really changes the live frame');
  const zoomed = overlayScene(overlayInput(zoomedIn.space, zoomedIn.scene.geometry));
  assert.strictEqual(zoomed, live, 'zoom and resize reuse the render scene');
  const again = structural(20);
  assert.strictEqual(again.scene.geometry, thin.scene.geometry);
  const lit = overlayScene(overlayInput(again.space, again.scene.geometry, {
    presentationOf: () => ({
      scale: 1, valueText: null, valueFullText: '', tempText: null, humText: null, lqiText: null,
      valueBadge: { configured: true, enabled: true, text: '100 %', fullText: '100 %', position: 'right', tone: 'default' },
      pulse: { animated: false, diameterScale: 1 },
    }),
  }));
  assert.strictEqual(lit.devices.get('device'), live.devices.get('device'), 'HA state keeps the placement');

  // A thicker wall with the same room: a new structure, so a new scene. A cache
  // keyed without the walls would serve the placement of the old plan.
  const thick = structural(30);
  assert.notEqual(thick.scene.key, thin.scene.key);
  assert.notStrictEqual(thick.scene.geometry, thin.scene.geometry);
  const rebuilt = overlayScene(overlayInput(thick.space, thick.scene.geometry));
  assert.notStrictEqual(rebuilt, live, 'a wall edit rebuilds the overlay scene');
  assert.notStrictEqual(rebuilt.devices.get('device'), live.devices.get('device'),
    'and its placements');
  assert.deepEqual(rebuilt.devices.get('device').visualScene, live.devices.get('device').visualScene,
    'the tile itself stays where it was: walls never move it');
});

test('#724 AC2: a room edit that changes the owner is a new structure — no owner of a plan that is gone', () => {
  const cache = new Map();
  const structural = (split) => {
    const base = structuralInput();
    const rooms = [
      cacheRoom({ id: 'west', poly: [[0, 0], [split, 0], [split, 100], [0, 100]], wall_ids: [] }),
      cacheRoom({ id: 'east', poly: [[split, 0], [200, 0], [200, 100], [split, 100]], wall_ids: [] }),
    ];
    const space = { ...base.space, vb: [0, 0, 200, 100], rooms };
    return { space, scene: resolveIsoScene({
      source: createIsoStructuralSource({ ...base, space }), cache, cellCm: 5,
      liveFrame: { x: 0, y: 0, w: 200, h: 100 },
    }) };
  };
  const at = { positionOf: () => ({ x: 90, y: 50 }) };
  const before = structural(100);
  const west = overlayScene(overlayInput(before.space, before.scene.geometry, at));
  assert.equal(west.devices.get('device').owner?.id, 'west');
  const after = structural(80);
  assert.notEqual(after.scene.key, before.scene.key, 'room geometry is structural');
  const east = overlayScene(overlayInput(after.space, after.scene.geometry, at));
  assert.equal(east.devices.get('device').owner?.id, 'east',
    'the tile at the same point now belongs to the room that grew over it');
});

test('#713 AC3: every tile gets one straight-up shift from its Flat anchor', () => {
  // Live zoom is no overlay input (#732): the fixture typecheck rejects a view,
  // and the #724 AC2 test zooms the structural scene on the production path.
  const { input } = perfFixture();
  const lift = projectPlanPoint([0, 0], 0)[1] - projectPlanPoint([0, 0], ISO_WALL_HEIGHT)[1];
  for (const position of [{ x: 60, y: 20 }, { x: 5, y: 50 }]) {
    const live = overlayScene({ ...input, positionOf: () => position }).devices.get('device');
    assert.deepEqual(live.floorScene, [position.x, position.y], 'the floor anchor is the Flat point');
    assert.equal(live.visualScene[0], position.x, 'no horizontal displacement');
    assert.ok(Math.abs(live.floorScene[1] - live.visualScene[1] - lift) < 1e-9,
      'the vertical displacement is the wall-top rise for every tile');
  }
});

test('#713 K5: room names stay on the Flat floor point while devices share the wall-top rise', () => {
  const { input } = perfFixture();
  const owner = { ...input.space.rooms[0], name: 'Owner' };
  const scene = overlayScene({
    ...input,
    space: { ...input.space, rooms: [owner] },
    display: { showNames: true, cardFontScale: 1 },
    labelPositionOf: () => ({ x: 30, y: 40 }),
  });
  const label = scene.rooms.get(owner);
  assert.ok(label, 'the room label is placed');
  assert.deepEqual(label.visualScene, [30, 40], 'the name keeps its Flat position');
  const device = scene.devices.get('device');
  assert.deepEqual(device.visualScene, projectPlanPoint([5, 50], ISO_WALL_HEIGHT));
});
