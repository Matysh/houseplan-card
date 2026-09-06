import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ISO_OVERLAY_MAX_NUDGE_CSS_PX,
  ISO_OVERLAY_SAFETY_GAP_CSS_PX,
  buildIsoPlatePolygon,
  isoOverlayPlane,
  isoRoomSafePoint,
  resolveIsoOverlayOwner,
  resolveIsoOverlayPlacement,
} from '../test-build/iso-overlays.js';
import {
  ISO_RAISED_OVERLAY_HEIGHT,
  ISO_WALL_HEIGHT,
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
  plateHalfSize: [4, 4],
  ...overrides,
});

test('the exact D2 overlay matrix keeps only the three accepted roots raised', () => {
  for (const kind of ['device', 'room-label', 'opening-lock'])
    assert.equal(isoOverlayPlane(kind, true), 'raised', kind);
  for (const kind of [
    'vacuum', 'vacuum-trail', 'glow', 'room-fill', 'room-hover',
    'sunlight', 'decor', 'furniture', 'backdrop',
  ]) assert.equal(isoOverlayPlane(kind, true), 'floor', kind);
  for (const kind of ['device', 'room-label', 'opening-lock'])
    assert.equal(isoOverlayPlane(kind, false), 'floor', `${kind} without borders`);
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
    wallSilhouettes: [{ outer: buildIsoPlatePolygon([50, 50], [10, 10], ISO_WALL_HEIGHT) }],
  });
  assert.equal(result.owner, null);
  assert.equal(result.status, 'degraded');
  assert.equal(result.reason, 'missing-owner');
  assert.equal(result.nudged, false);
});

test('plate corners use the same affine camera on the raised plane', () => {
  const plate = buildIsoPlatePolygon([50, 50], [10, 5], ISO_RAISED_OVERLAY_HEIGHT);
  const logical = [[40, 45], [60, 45], [60, 55], [40, 55]];
  logical.forEach((point, index) => {
    const projected = projectPlanPoint(point, ISO_RAISED_OVERLAY_HEIGHT);
    close(plate[index][0], projected[0]);
    close(plate[index][1], projected[1]);
  });
  assert.notEqual(plate[0][1], plate[1][1], 'the +4° plate is a projected parallelogram');
});

test('free raised overlay separates floor, raised, plate and optional tether geometry', () => {
  const normal = placement();
  assert.equal(normal.plane, 'raised');
  assert.deepEqual(normal.floorAnchor, [50, 50]);
  assert.deepEqual(normal.floorScene, projectPlanPoint([50, 50], 0));
  assert.deepEqual(normal.raisedScene, projectPlanPoint([50, 50], ISO_RAISED_OVERLAY_HEIGHT));
  assert.deepEqual(normal.visualScene, normal.raisedScene);
  assert.equal(normal.plate.length, 4);
  assert.equal(normal.grounding.visible, true);
  assert.equal(normal.tether.visible, false);
  assert.equal(normal.status, 'ok');

  for (const state of ['hovered', 'focused', 'selected'])
    assert.equal(placement({ [state]: true }).tether.visible, true, state);
  assert.equal(placement({ filtersSupported: false }).grounding.visible, false,
    'unsupported filters remove the soft grounding shadow only');
});

test('wall-aware nudge is deterministic, minimal, inward and never changes the floor anchor', () => {
  const wall = {
    outer: buildIsoPlatePolygon([0, 50], [4, 60], ISO_WALL_HEIGHT),
  };
  const input = {
    floorAnchor: [5, 50],
    rooms: [square('room', 0, 0, 100, 100, [50, 50])],
    preferredRoomId: 'room',
    wallSilhouettes: [wall],
  };
  const first = placement(input);
  const second = placement(input);
  assert.deepEqual(second, first, 'identical structural and viewport inputs are stable');
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
  assert.equal(first.tether.visible, true);
});

test('shared-wall and corner fixtures nudge only toward the selected room', () => {
  const verticalWall = { outer: buildIsoPlatePolygon([50, 50], [3, 60], ISO_WALL_HEIGHT) };
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
      { outer: buildIsoPlatePolygon([0, 50], [4, 60], ISO_WALL_HEIGHT) },
      { outer: buildIsoPlatePolygon([50, 0], [60, 4], ISO_WALL_HEIGHT) },
    ],
  });
  assert.equal(corner.nearWallBefore, true);
  assert.ok(corner.nudgeScene[0] > 0 && corner.nudgeScene[1] > 0,
    'corner marker follows the projected inward diagonal');
  assert.equal(corner.tether.visible, true);
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
      plateHalfSize: [1, 1],
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

test('cap and ambiguous ownership fail safe with a visible tether', () => {
  const largeWall = { outer: buildIsoPlatePolygon([25, 50], [30, 30], ISO_WALL_HEIGHT) };
  const capped = placement({
    floorAnchor: [25, 50], wallSilhouettes: [largeWall], maxNudgeCssPx: 2,
  });
  close(capped.nudgeDistanceCss, 2);
  assert.equal(capped.capped, true);
  assert.equal(capped.cleared, false);
  assert.equal(capped.status, 'degraded');
  assert.equal(capped.reason, 'nudge-cap');
  assert.equal(capped.tether.visible, true);

  const ownerless = placement({
    floorAnchor: [150, 50], rooms: [], preferredRoomId: null,
    wallSilhouettes: [{ outer: buildIsoPlatePolygon([150, 50], [10, 10], ISO_WALL_HEIGHT) }],
  });
  assert.equal(ownerless.owner, null);
  assert.equal(ownerless.nudged, false);
  assert.equal(ownerless.status, 'degraded');
  assert.equal(ownerless.reason, 'missing-owner');
  assert.equal(ownerless.tether.visible, true);
});

test('malformed collision input degrades without a guessed move', () => {
  const result = placement({
    wallSilhouettes: [{ outer: [[0, 0], [Number.NaN, 1], [2, 2]] }],
  });
  assert.equal(result.status, 'degraded');
  assert.equal(result.reason, 'invalid-wall-geometry');
  assert.equal(result.nudged, false);
  assert.equal(result.tether.visible, true);
});

test('show_borders:false is exact no-volume: floor anchor, no plate/nudge/cues', () => {
  const result = placement({
    showBorders: false,
    wallSilhouettes: [{ outer: [[0, 0], [Number.NaN, 1], [2, 2]] }],
    hovered: true,
  });
  assert.equal(result.plane, 'floor');
  assert.deepEqual(result.visualScene, result.floorScene);
  assert.deepEqual(result.plate, []);
  assert.equal(result.nudged, false);
  assert.equal(result.grounding.visible, false);
  assert.equal(result.tether.visible, false);
  assert.equal(result.status, 'ok');
  assert.equal(ISO_OVERLAY_SAFETY_GAP_CSS_PX, 4);
});
