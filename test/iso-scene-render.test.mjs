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
import { ISO_OPENING_GEOMETRY_POLICY } from '../test-build/iso-openings.js';
import { buildIsoWallGeometry } from '../test-build/iso-walls.js';
import { wallKey } from '../test-build/wall-thickness.js';
import {
  buildIsoFootprintPolygon,
  resolveIsoOverlayOwner,
  resolveIsoOverlayPlacement,
} from '../test-build/iso-overlays.js';
import {
  ISO_CAMERA,
  ISO_OVERLAY_VISUAL_OFFSET,
  ISO_RAISED_OVERLAY_HEIGHT,
  ISO_WALL_HEIGHT,
  unprojectFloorPoint,
} from '../test-build/iso-projection.js';

const room = (id, x0, y0, x1, y1) => ({
  id,
  poly: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]],
});

test('every Stage 3 shadow plane uses the same scale-aware fixed-light vector', () => {
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
    raisedScene: [center[0] - 4, center[1]], visualScene: center,
    nudgeScene: [4, 0],
    footprint: [[center[0] - 2, center[1] - 1], [center[0] + 2, center[1] - 1],
      [center[0] + 2, center[1] + 1], [center[0] - 2, center[1] + 1]],
  });
  const scene = { entries: [
    { id: 'one', kind: 'device', placement: placement('r1', [20, 30]),
      groundRadius: 1, screenHalfSize: [5, 3] },
    { id: 'two', kind: 'device', placement: placement('r2', [200, 300]),
      groundRadius: 1, screenHalfSize: [10, 8] },
  ] };
  assert.deepEqual(isoOverlaySceneBounds(scene, 'r1'), { x: 15, y: 27, w: 10, h: 6 });
  assert.deepEqual(isoOverlaySceneBounds(scene), { x: 15, y: 27, w: 195, h: 281 });
});

test('stable overlay fit contains a maximum final nudge without zoom feedback', () => {
  const entry = {
    id: 'edge', kind: 'device', groundRadius: 1, screenHalfSize: [10, 8],
    placement: {
      owner: { id: 'room' }, floorScene: [95, 50], raisedScene: [95, 50],
      visualScene: [95, 50], nudgeScene: [0, 0],
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
    baseBounds: { x: 0, y: 0, w: 100, h: 100 }, entries: [entry], stageSize, targetView,
  });
  assert.ok(fitted);
  const unitsPerPixel = Math.max(
    fitted.view.w / stageSize.width, fitted.view.h / stageSize.height,
  );
  const dx = 48 * unitsPerPixel;
  const actual = { entries: [{ ...entry, placement: {
    ...entry.placement, visualScene: [95 + dx, 50], nudgeScene: [dx, 0],
    footprint: entry.placement.footprint.map((point) => [point[0] + dx, point[1]]),
  } }] };
  const final = isoOverlaySceneBounds(actual);
  assert.ok(final.x >= fitted.bounds.x - 1e-7
    && final.x + final.w <= fitted.bounds.x + fitted.bounds.w + 1e-7);
  const repeated = resolveIsoOverlayFitEnvelope({
    baseBounds: { x: 0, y: 0, w: 100, h: 100 }, entries: [entry], stageSize, targetView,
  });
  assert.deepEqual(repeated, fitted, 'the canonical envelope is deterministic');
  const otherRoom = resolveIsoOverlayFitEnvelope({
    baseBounds: { x: 0, y: 0, w: 100, h: 100 }, entries: [entry], stageSize,
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
    depth: nearWall.depth - 10,
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

test('production overlay rooms preserve direct island holes and cache safe points', () => {
  const outer = room('outer', 0, 0, 100, 100);
  const island = room('island', 40, 40, 60, 60);
  const space = { id: 'floor', rooms: [outer, island] };
  const rows = isoOverlayRooms(space);
  assert.strictEqual(isoOverlayRooms(space), rows, 'one immutable room snapshot is prepared once');
  assert.deepEqual(rows[0].overlayRoom.holes, [island.poly]);
  const safe = rows[0].overlayRoom.safePoint;
  assert.ok(safe, 'outer ring has a proven safe point');
  assert.equal(safe[0] > 40 && safe[0] < 60 && safe[1] > 40 && safe[1] < 60, false,
    'the parent safe point cannot land in the island hole');
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

  const scene = buildIsoOverlayRenderScene({
    space,
    devices: [],
    openings: [opening],
    view: { x: 0, y: 0, w: 100, h: 100 },
    display: { showNames: false, cardFontScale: 1 },
    layers: { shadows: true },
    wallSilhouettes: [],
    iconPct: 100,
    deviceBasePct: 100,
    showLqi: false,
    cellCm: 5,
    kioskIconScale: 1,
    kioskFontScale: 1,
    stageSize: { width: 100, height: 100 },
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
  const scene = buildIsoOverlayRenderScene({
    space,
    devices: [],
    openings: [opening],
    view: { x: 0, y: 0, w: 100, h: 100 },
    display: { showNames: false, cardFontScale: 1 },
    layers: { shadows: true },
    wallSilhouettes: [{ outer: [[0, 45], [100, 45], [100, 55], [0, 55]] }],
    iconPct: 100,
    deviceBasePct: 100,
    showLqi: false,
    cellCm: 5,
    kioskIconScale: 1,
    kioskFontScale: 1,
    stageSize: { width: 100, height: 100 },
    positionOf: () => ({ x: 0, y: 0 }),
    presentationOf: () => ({ scale: 1 }),
    labelPositionOf: () => ({ x: 0, y: 0 }),
    labelScaleOf: () => 1,
    openingEntityAvailable: () => true,
    openingWallIndex: () => ({ adjacencyEps: 0.1, edges: [] }),
  });
  const placement = scene.locks.get('partition-door');
  assert.equal(placement?.owner, null);
  assert.equal(placement?.nudged, false);
  assert.equal(placement?.reason, 'missing-owner');
  assert.equal(placement?.tether.visible, true);
});

test('Stage 3 reuses pure overlay placements and fit probes skip collision search', () => {
  const owner = room('owner', 0, 0, 100, 100);
  const space = {
    id: 'floor', title: 'Floor', cellCm: 5, vb: [0, 0, 100, 100], bg: null,
    rooms: [owner], wall_segments: [], room_drafts: [], partitions: [], wall_columns: [],
  };
  const wallSilhouettes = [{
    outer: buildIsoFootprintPolygon([0, 50], [4, 60], ISO_WALL_HEIGHT),
  }];
  const input = {
    space,
    devices: [{ id: 'device', space: 'floor', marker: { room_id: 'owner' } }],
    openings: [],
    view: { x: 0, y: 0, w: 100, h: 100 },
    display: { showNames: false, cardFontScale: 1 },
    layers: { structural: true, shadows: true },
    wallSilhouettes,
    iconPct: 3.4,
    deviceBasePct: 3.4,
    showLqi: false,
    cellCm: 5,
    kioskIconScale: 1,
    kioskFontScale: 1,
    stageSize: { width: 100, height: 100 },
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
  const live = buildIsoOverlayRenderScene(input);
  const repeated = buildIsoOverlayRenderScene(input);
  assert.strictEqual(repeated, live,
    'an unchanged frame reuses the exact render-scene snapshot for Lit guards');
  assert.strictEqual(repeated.devices.get('device'), live.devices.get('device'),
    'unchanged HA/render passes reuse the exact pure placement result');
  assert.equal(live.devices.get('device')?.nearWallBefore, true);
  assert.equal(live.devices.get('device')?.cleared, true);

  const zoomedIn = buildIsoOverlayRenderScene({
    ...input, view: { x: 0, y: 0, w: 80, h: 80 },
  });
  assert.strictEqual(zoomedIn, live,
    'zooming in reuses a previously proved-safe immutable scene placement');

  const fit = buildIsoOverlayRenderScene({ ...input, resolveCollisions: false });
  assert.equal(fit.devices.get('device')?.nearWallBefore, false,
    'fit envelope uses unnudged bounds without running wall collision search');
  assert.notStrictEqual(fit.devices.get('device'), live.devices.get('device'),
    'fit and live placements use separate bounded cache entries');

  const zoomed = buildIsoOverlayRenderScene({ ...input, view: { x: 0, y: 0, w: 120, h: 120 } });
  assert.notStrictEqual(zoomed, live, 'a changed placement produces a new render-scene snapshot');
  assert.notStrictEqual(zoomed.devices.get('device'), live.devices.get('device'),
    'view scale invalidates the placement signature');
});

test('visible wall side quads participate in overlay collision', () => {
  const walls = [[[[45, 20], [55, 20], [55, 80], [45, 80]]]];
  const scene = resolveIsoScene({
    source: {
      key: 'visible-side-collision',
      build: () => ({ walls, floor: walls, openings: [], openingSurfaces: [] }),
    },
    cache: new Map(),
    cellCm: 5,
    liveFrame: { x: 0, y: 0, w: 100, h: 100 },
  });
  assert.ok(scene.geometry.sides.length > 0, 'fixture exposes visible vertical wall faces');
  assert.equal(scene.wallSilhouettes.length, 1 + scene.geometry.sides.length,
    'collision set contains the top footprint and every visible side');
  scene.geometry.sides.forEach((face, index) => {
    assert.strictEqual(scene.wallSilhouettes[index + 1].outer, face.points,
      `visible side ${index} reuses its exact render quad`);
  });

  const face = scene.geometry.sides.reduce((lowest, candidate) =>
    candidate.depth > lowest.depth ? candidate : lowest);
  const sideCenter = [
    face.points.reduce((sum, point) => sum + point[0], 0) / face.points.length,
    face.points.reduce((sum, point) => sum + point[1], 0) / face.points.length,
  ];
  const raisedFloorScene = [
    sideCenter[0],
    sideCenter[1] + ISO_RAISED_OVERLAY_HEIGHT * ISO_CAMERA.zScale
      * Math.sin(ISO_CAMERA.tiltDeg * Math.PI / 180),
  ];
  const floorAnchor = unprojectFloorPoint(raisedFloorScene);
  const owner = room('owner', -1_000, -1_000, 1_000, 1_000);
  owner.safePoint = [0, 0];
  const collisionInput = {
    kind: 'device',
    floorAnchor,
    rooms: [{ id: owner.id, outer: owner.poly, safePoint: owner.safePoint }],
    preferredRoomId: owner.id,
    showBorders: true,
    footprintHalfSize: [0.05, 0.05],
    wallHeight: ISO_WALL_HEIGHT,
    visualOffset: ISO_OVERLAY_VISUAL_OFFSET,
    sceneUnitsPerCssPixel: 1,
    safetyGapCssPx: 0,
    maxNudgeCssPx: 0,
  };
  const topOnly = resolveIsoOverlayPlacement({
    ...collisionInput, wallSilhouettes: scene.wallSilhouettes.slice(0, 1),
  });
  const complete = resolveIsoOverlayPlacement({
    ...collisionInput, wallSilhouettes: scene.wallSilhouettes,
  });
  assert.equal(topOnly.nearWallBefore, false,
    'raised footprint does not touch the wall-top footprint');
  assert.equal(complete.nearWallBefore, true,
    'the same raised footprint intersects a rendered vertical side');
});

test('orphan hosted openings never become phantom Stage 3 volumes', () => {
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

test('shadow presentation failure retries the same Iso frame as solid geometry', () => {
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
        floor: { footprintPath: '', sides: [] }, wallSilhouettes: [],
        openings: [], openingSurfaces: [], frame: { x: 0, y: 0, w: 100, h: 100 },
      },
      openings: [], amountOf: () => 0, overlays: () => null, cellCm: 5,
    });
    assert.equal(contactReads, 1);
    assert.equal(frame.layers.structural, true);
    assert.equal(frame.layers.panels, true);
    assert.equal(frame.layers.shadows, false);
    assert.equal(frame.layers.materialNuance, false);
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
