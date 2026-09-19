import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ISO_OVERLAY_MAX_NUDGE_CSS_PX,
  ISO_OVERLAY_SAFETY_GAP_CSS_PX,
  buildIsoOverlayBoundaryCandidates,
  buildIsoFootprintPolygon,
  isoOverlayCollisionKey,
  isoOverlayPlane,
  isoRoomSafePoint,
  resolveIsoOverlayCollisions,
  resolveIsoOverlayOwner,
  resolveIsoOverlayPlacement,
} from '../test-build/iso-overlays.js';
import {
  ISO_RAISED_OVERLAY_HEIGHT,
  projectPlanPoint,
} from '../test-build/iso-projection.js';

const close = (actual, expected, epsilon = 1e-7) =>
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);

const square = (id, x0, y0, x1, y1, safePoint) => ({
  id,
  outer: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]],
  safePoint,
});

const identityCamera = {
  rotDeg: 0,
  tiltDeg: 0,
  xyScale: 1,
  zScale: 1,
  origin: [0, 0],
};

const placement = (overrides = {}) => resolveIsoOverlayPlacement({
  kind: 'device',
  floorAnchor: [50, 50],
  rooms: [square('room', 0, 0, 100, 100, [50, 50])],
  preferredRoomId: 'room',
  showBorders: true,
  wallSilhouettes: [],
  footprintHalfSize: [4, 4],
  ...overrides,
});

test('the exact Stage 4 overlay matrix keeps only the three interactive roots on the low plane', () => {
  for (const kind of ['device', 'room-label', 'opening-lock'])
    assert.equal(isoOverlayPlane(kind, true), 'raised', kind);
  for (const kind of [
    'vacuum', 'vacuum-trail', 'glow', 'room-fill', 'room-hover',
    'sunlight', 'decor', 'furniture', 'backdrop',
  ]) assert.equal(isoOverlayPlane(kind, true), 'floor', kind);
  for (const kind of ['device', 'room-label', 'opening-lock'])
    assert.equal(isoOverlayPlane(kind, false), 'floor', `${kind} without borders`);
});

test('group collision separates a solvable dense set independently of input order', () => {
  const make = (id) => ({
    id,
    kind: id === 'lock' ? 'opening-lock' : 'device',
    placement: placement({
      floorAnchor: [100, 100],
      rooms: [square('room', 0, 0, 200, 200, [100, 100])],
      visualOffset: 0,
      camera: identityCamera,
    }),
    screenHalfSize: [8, 8],
  });
  const solve = (items) => resolveIsoOverlayCollisions({
    items,
    rooms: [square('room', 0, 0, 200, 200, [100, 100])],
    wallSilhouettes: [],
    sceneUnitsPerCssPixel: 1,
    visualOffset: 0,
    camera: identityCamera,
  });
  const normal = solve([make('a'), make('b'), make('lock')]);
  const reversed = solve([make('lock'), make('b'), make('a')]);
  assert.deepEqual(normal.residualPairs, []);
  assert.deepEqual(reversed.residualPairs, []);
  const keys = [
    isoOverlayCollisionKey('device', 'a'),
    isoOverlayCollisionKey('device', 'b'),
    isoOverlayCollisionKey('opening-lock', 'lock'),
  ];
  const centers = keys.map((key) => normal.placements.get(key).visualScene);
  for (let index = 0; index < centers.length; index++) {
    assert.deepEqual(reversed.placements.get(keys[index]).visualScene, centers[index]);
    assert.ok(normal.placements.get(keys[index]).nudgeDistanceCss <= 48);
    for (let other = 0; other < index; other++) {
      assert.ok(Math.abs(centers[index][0] - centers[other][0]) >= 20
        || Math.abs(centers[index][1] - centers[other][1]) >= 20,
      `pair ${index}/${other} must clear its complete roots plus the 4px gap`);
    }
  }
  assert.deepEqual(normal.placements.get(keys[0]).visualScene, [100, 100],
    'the stable first item stays at its zero-deviation anchor');
});

test('group collision finds a legal one-pixel slit between the coarse nodes', () => {
  // The roots need 41 px of separation. Offset 40 still overlaps; offset 44
  // reaches masonry; and the room rejects the next coarse node at 48. The old
  // 4 px pass therefore degraded at 40 even though the exact offset 41 is free.
  const room = square('slit', 99, 99, 147.5, 101, [100, 100]);
  const wall = { outer: [[147.8, 99], [148.2, 99], [148.2, 101], [147.8, 101]] };
  const make = (id) => ({
    id,
    kind: 'device',
    placement: placement({
      floorAnchor: [100, 100], rooms: [room], preferredRoomId: 'slit',
      wallSilhouettes: [wall], footprintHalfSize: [0.1, 0.1],
      wallHeight: 0, visualOffset: 0, sceneUnitsPerCssPixel: 1,
      camera: identityCamera,
    }),
    screenHalfSize: [18.5, 18.5],
  });
  const result = resolveIsoOverlayCollisions({
    items: [make('a'), make('b')], rooms: [room], wallSilhouettes: [wall],
    sceneUnitsPerCssPixel: 1, visualOffset: 0, camera: identityCamera,
  });
  const second = result.placements.get(isoOverlayCollisionKey('device', 'b'));
  assert.deepEqual(result.residualPairs, []);
  assert.deepEqual(second.nudgeCss, [41, 0]);
  assert.equal(second.status, 'ok');
  assert.ok(second.nudgeDistanceCss <= ISO_OVERLAY_MAX_NUDGE_CSS_PX);
});

test('group collision boundary events stay sparse while covering sub-grid positions', () => {
  const candidates = buildIsoOverlayBoundaryCandidates([
    [-41, -41, 41, 41],
    [-13.25, -8.75, 17.25, 22.75],
  ], ISO_OVERLAY_MAX_NUDGE_CSS_PX);
  const fullDiskLatticeSize = 7238;
  assert.ok(candidates.length < fullDiskLatticeSize / 10,
    `${candidates.length} boundary events must stay far below a full disk scan`);
  assert.ok(candidates.some(([x, y]) => x === 41 && y === 0),
    'the one-pixel position between the former 4 px nodes is present');
  assert.ok(candidates.every(([x, y]) => Number.isInteger(x) && Number.isInteger(y)
    && Math.hypot(x, y) <= ISO_OVERLAY_MAX_NUDGE_CSS_PX),
  'every event stays on the integer CSS lattice and inside the absolute cap');
});

test('group collision reports a deterministic residual without exceeding the absolute cap', () => {
  const room = square('tight', 0, 0, 1, 1, [0.5, 0.5]);
  const make = (id) => ({
    id,
    kind: 'device',
    placement: placement({
      floorAnchor: [0.5, 0.5], rooms: [room], preferredRoomId: 'tight',
      visualOffset: 0, camera: identityCamera,
    }),
    screenHalfSize: [30, 30],
  });
  const result = resolveIsoOverlayCollisions({
    items: [make('a'), make('b')], rooms: [room], wallSilhouettes: [],
    sceneUnitsPerCssPixel: 1, visualOffset: 0, camera: identityCamera,
  });
  const second = result.placements.get(isoOverlayCollisionKey('device', 'b'));
  assert.equal(result.residualPairs.length, 1);
  assert.equal(second.status, 'degraded');
  assert.equal(second.reason, 'overlay-collision');
  assert.ok(second.nudgeDistanceCss <= 48,
    'the search radius is total displacement, not a budget added per collision');
});

test('owner resolution honours bindings, then canonical minimum area and stable id', () => {
  const rooms = [
    square('wide', 0, 0, 100, 100, [50, 50]),
    square('z-small', 25, 25, 75, 75, [50, 50]),
    square('a-small', 25, 25, 75, 75, [50, 50]),
  ];
  assert.equal(resolveIsoOverlayOwner({
    kind: 'device', floorAnchor: [50, 50], rooms, preferredRoomId: 'wide',
  })?.id, 'wide', 'a valid explicit device binding wins');
  assert.equal(resolveIsoOverlayOwner({
    kind: 'device', floorAnchor: [50, 50], rooms, preferredRoomId: 'missing',
  })?.id, 'a-small', 'minimum area and then stable id resolve the fallback');
  assert.equal(resolveIsoOverlayOwner({
    kind: 'room-label', floorAnchor: [150, 150], rooms, preferredRoomId: 'wide',
  })?.id, 'wide', 'a saved room label may live outside its owning room');
  assert.equal(resolveIsoOverlayOwner({
    kind: 'opening-lock', floorAnchor: [100, 50], rooms, preferredRoomId: 'wide',
  })?.id, 'wide', 'the opening host supplies lock ownership');
});

test('strict room ownership excludes holes, shared boundaries and outside points', () => {
  const ring = {
    ...square('ring', 0, 0, 100, 100, [20, 20]),
    holes: [[[40, 40], [60, 40], [60, 60], [40, 60]]],
  };
  assert.equal(resolveIsoOverlayOwner({
    kind: 'device', floorAnchor: [20, 20], rooms: [ring],
  })?.id, 'ring');
  assert.equal(resolveIsoOverlayOwner({
    kind: 'device', floorAnchor: [50, 50], rooms: [ring],
  }), null, 'a point in a room hole has no guessed owner');
  assert.equal(resolveIsoOverlayOwner({
    kind: 'device', floorAnchor: [0, 50], rooms: [ring],
  }), null, 'a point on a shared/boundary edge is not strictly contained');
  assert.equal(resolveIsoOverlayOwner({
    kind: 'device', floorAnchor: [150, 50], rooms: [ring],
  }), null, 'an outside saved point stays ownerless');
});

test('safe-point search is deterministic and stays strictly inside concave rooms and holes', () => {
  const rooms = [
    {
      id: 'donut',
      outer: [[0, 0], [100, 0], [100, 100], [0, 100]],
      holes: [[[35, 35], [65, 35], [65, 65], [35, 65]]],
    },
    {
      id: 'concave',
      outer: [
        [0, 0], [100, 0], [100, 100], [60, 100],
        [60, 35], [40, 35], [40, 100], [0, 100],
      ],
    },
  ];
  for (const room of rooms) {
    const first = isoRoomSafePoint(room);
    assert.ok(first, `${room.id}: bounded search finds an inner point`);
    assert.deepEqual(isoRoomSafePoint(room), first, `${room.id}: repeated search is deterministic`);
    assert.equal(resolveIsoOverlayOwner({
      kind: 'device', floorAnchor: first, rooms: [room],
    })?.id, room.id, `${room.id}: result is strictly inside the room and outside every hole`);
  }
});

test('a degenerate room has no safe point and placement degrades without throwing', () => {
  const degenerate = { id: 'line', outer: [[0, 0], [50, 0], [100, 0]] };
  assert.equal(isoRoomSafePoint(degenerate), null);
  const result = placement({
    rooms: [degenerate],
    preferredRoomId: degenerate.id,
    wallSilhouettes: [{ outer: buildIsoFootprintPolygon([50, 50], [10, 10], ISO_RAISED_OVERLAY_HEIGHT) }],
  });
  assert.equal(result.owner, null);
  assert.equal(result.status, 'degraded');
  assert.equal(result.reason, 'missing-owner');
  assert.equal(result.nudged, false);
});

test('footprint corners use the same affine camera on the raised plane', () => {
  const footprint = buildIsoFootprintPolygon([50, 50], [10, 5], ISO_RAISED_OVERLAY_HEIGHT);
  const logical = [[40, 45], [60, 45], [60, 55], [40, 55]];
  logical.forEach((point, index) => {
    const projected = projectPlanPoint(point, ISO_RAISED_OVERLAY_HEIGHT);
    close(footprint[index][0], projected[0]);
    close(footprint[index][1], projected[1]);
  });
  close(footprint[0][1], footprint[1][1]);
  assert.ok(footprint[2][1] > footprint[1][1],
    'zero yaw keeps the screen-facing footprint aligned with the plan axes');
});

test('free low overlay separates the immutable floor anchor from invisible collision geometry', () => {
  const normal = placement();
  assert.equal(normal.plane, 'raised');
  assert.deepEqual(normal.floorAnchor, [50, 50]);
  assert.deepEqual(normal.floorScene, projectPlanPoint([50, 50], 0));
  assert.deepEqual(normal.raisedScene, projectPlanPoint([50, 50], ISO_RAISED_OVERLAY_HEIGHT));
  assert.deepEqual(normal.visualScene, normal.raisedScene);
  assert.equal(normal.footprint.length, 4);
  assert.equal(normal.grounding.visible, false);
  assert.equal(normal.tether.visible, false);
  assert.equal(normal.status, 'ok');

  for (const state of ['hovered', 'focused', 'selected'])
    assert.equal(placement({ [state]: true }).tether.visible, false, state);
  assert.equal(placement({ filtersSupported: false }).grounding.visible, false,
    'unsupported filters remove the soft grounding shadow only');
});

test('wall-aware nudge is deterministic, minimal, inward and never changes the floor anchor', () => {
  const wall = {
    outer: buildIsoFootprintPolygon([0, 50], [4, 60], ISO_RAISED_OVERLAY_HEIGHT),
  };
  const input = {
    floorAnchor: [5, 50],
    rooms: [square('room', 0, 0, 100, 100, [50, 50])],
    preferredRoomId: 'room',
    wallSilhouettes: [wall],
  };
  const first = placement(input);
  const second = placement(input);
  const hinted = placement({ ...input, nudgeHintCss: first.nudgeDistanceCss });
  assert.deepEqual(second, first, 'identical structural and viewport inputs are stable');
  assert.deepEqual(hinted, first,
    'a cached CSS-distance hint is accepted only when the exact wall test proves it clear');
  assert.deepEqual(first.floorAnchor, [5, 50]);
  assert.deepEqual(first.floorScene, projectPlanPoint([5, 50], 0));
  assert.equal(first.nearWallBefore, true);
  assert.equal(first.nearWallAfter, false);
  assert.equal(first.cleared, true);
  assert.equal(first.capped, false);
  assert.ok(first.nudgeDistanceCss > 0 && first.nudgeDistanceCss < ISO_OVERLAY_MAX_NUDGE_CSS_PX);
  const towardSafe = projectPlanPoint([50, 50], ISO_RAISED_OVERLAY_HEIGHT);
  const safeVector = [towardSafe[0] - first.raisedScene[0], towardSafe[1] - first.raisedScene[1]];
  assert.ok(first.nudgeScene[0] * safeVector[0] + first.nudgeScene[1] * safeVector[1] > 0);
  assert.equal(first.tether.visible, false);
});

test('shared-wall and corner fixtures nudge only toward the selected room', () => {
  const verticalWall = {
    outer: buildIsoFootprintPolygon([50, 50], [3, 60], ISO_RAISED_OVERLAY_HEIGHT),
  };
  const shared = placement({
    floorAnchor: [49, 50],
    rooms: [
      square('left', 0, 0, 50, 100, [25, 50]),
      square('right', 50, 0, 100, 100, [75, 50]),
    ],
    preferredRoomId: 'left',
    wallSilhouettes: [verticalWall],
  });
  assert.equal(shared.owner?.id, 'left');
  assert.ok(shared.nudgeScene[0] < 0, 'shared-wall marker moves into the left owner');

  const corner = placement({
    floorAnchor: [5, 5],
    rooms: [square('corner', 0, 0, 100, 100, [50, 50])],
    preferredRoomId: 'corner',
    wallSilhouettes: [
      { outer: buildIsoFootprintPolygon([0, 50], [4, 60], ISO_RAISED_OVERLAY_HEIGHT) },
      { outer: buildIsoFootprintPolygon([50, 0], [60, 4], ISO_RAISED_OVERLAY_HEIGHT) },
    ],
  });
  assert.equal(corner.nearWallBefore, true);
  assert.ok(corner.nudgeScene[0] > 0 && corner.nudgeScene[1] > 0,
    'corner marker follows the projected inward diagonal');
  assert.equal(corner.tether.visible, false);
});

test('nudge never crosses an island hole or a concave-room boundary', () => {
  const fixtures = [
    {
      name: 'island hole',
      room: {
        ...square('donut', 0, 0, 100, 100, [80, 50]),
        holes: [[[40, 40], [60, 40], [60, 60], [40, 60]]],
      },
      floorAnchor: [20, 50],
      expectedVisual: [39, 50],
    },
    {
      name: 'concave notch',
      room: {
        id: 'concave',
        outer: [
          [0, 0], [100, 0], [100, 100], [60, 100],
          [60, 40], [40, 40], [40, 100], [0, 100],
        ],
        safePoint: [80, 80],
      },
      floorAnchor: [20, 80],
      expectedVisual: [39, 80],
    },
  ];
  const obstacle = { outer: [[10, 30], [75, 30], [75, 90], [10, 90]] };

  for (const fixture of fixtures) {
    const result = placement({
      floorAnchor: fixture.floorAnchor,
      rooms: [fixture.room],
      preferredRoomId: fixture.room.id,
      wallSilhouettes: [obstacle],
      footprintHalfSize: [1, 1],
      wallHeight: 0,
      visualOffset: 0,
      sceneUnitsPerCssPixel: 1,
      safetyGapCssPx: 0,
      maxNudgeCssPx: 48,
      camera: identityCamera,
    });

    assert.deepEqual(result.floorAnchor, fixture.floorAnchor, `${fixture.name}: model anchor is immutable`);
    assert.deepEqual(result.visualScene, fixture.expectedVisual,
      `${fixture.name}: the last valid point is retained before the boundary`);
    assert.equal(result.nudgeDistanceCss, 19, fixture.name);
    assert.equal(result.status, 'degraded', fixture.name);
    assert.equal(result.reason, 'owner-boundary', fixture.name);
    assert.equal(result.capped, true, fixture.name);
    assert.equal(result.cleared, false, `${fixture.name}: no unsafe jump is used to clear the wall`);
  }
});

test('cap and ambiguous ownership fail safe without bringing back debug cues', () => {
  const largeWall = {
    outer: buildIsoFootprintPolygon([25, 50], [30, 30], ISO_RAISED_OVERLAY_HEIGHT),
  };
  const capped = placement({
    floorAnchor: [25, 50], wallSilhouettes: [largeWall], maxNudgeCssPx: 2,
  });
  close(capped.nudgeDistanceCss, 2);
  assert.equal(capped.capped, true);
  assert.equal(capped.cleared, false);
  assert.equal(capped.status, 'degraded');
  assert.equal(capped.reason, 'nudge-cap');
  assert.equal(capped.tether.visible, false);

  const ownerless = placement({
    floorAnchor: [150, 50], rooms: [], preferredRoomId: null,
    wallSilhouettes: [{
      outer: buildIsoFootprintPolygon([150, 50], [10, 10], ISO_RAISED_OVERLAY_HEIGHT),
    }],
  });
  assert.equal(ownerless.owner, null);
  assert.equal(ownerless.nudged, false);
  assert.equal(ownerless.status, 'degraded');
  assert.equal(ownerless.reason, 'missing-owner');
  assert.equal(ownerless.tether.visible, false);
});

test('malformed collision input degrades without a guessed move', () => {
  const result = placement({
    wallSilhouettes: [{ outer: [[0, 0], [Number.NaN, 1], [2, 2]] }],
  });
  assert.equal(result.status, 'degraded');
  assert.equal(result.reason, 'invalid-wall-geometry');
  assert.equal(result.nudged, false);
  assert.equal(result.tether.visible, false);
});

test('show_borders:false is exact no-volume: floor anchor, no footprint/nudge/cues', () => {
  const result = placement({
    showBorders: false,
    wallSilhouettes: [{ outer: [[0, 0], [Number.NaN, 1], [2, 2]] }],
    hovered: true,
  });
  assert.equal(result.plane, 'floor');
  assert.deepEqual(result.visualScene, result.floorScene);
  assert.deepEqual(result.footprint, []);
  assert.equal(result.nudged, false);
  assert.equal(result.grounding.visible, false);
  assert.equal(result.tether.visible, false);
  assert.equal(result.status, 'ok');
  assert.equal(ISO_OVERLAY_SAFETY_GAP_CSS_PX, 4);
});
