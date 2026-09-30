import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildIsoFootprintPolygon,
  isoOverlayPlane,
  resolveIsoOverlayOwner,
  resolveIsoOverlayPlacement,
} from '../test-build/iso-overlays.js';
import {
  ISO_RAISED_OVERLAY_HEIGHT,
  projectPlanPoint,
} from '../test-build/iso-projection.js';

const close = (actual, expected, epsilon = 1e-7) =>
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);

const square = (id, x0, y0, x1, y1) => ({
  id,
  outer: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]],
});

const placement = (overrides = {}) => resolveIsoOverlayPlacement({
  kind: 'device',
  floorAnchor: [50, 50],
  rooms: [square('room', 0, 0, 100, 100)],
  preferredRoomId: 'room',
  showBorders: true,
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

test('owner resolution honours bindings, then canonical minimum area and stable id', () => {
  const rooms = [
    square('wide', 0, 0, 100, 100),
    square('z-small', 25, 25, 75, 75),
    square('a-small', 25, 25, 75, 75),
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
    ...square('ring', 0, 0, 100, 100),
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

test('a degenerate or missing owner room still raises the overlay straight up', () => {
  const degenerate = { id: 'line', outer: [[0, 0], [50, 0], [100, 0]] };
  for (const [name, overrides] of [
    ['degenerate room', { rooms: [degenerate], preferredRoomId: degenerate.id }],
    ['no room at all', { floorAnchor: [150, 50], rooms: [], preferredRoomId: null }],
  ]) {
    const result = placement(overrides);
    assert.equal(result.owner, null, name);
    assert.equal(result.plane, 'raised', name);
    assert.deepEqual(result.visualScene,
      projectPlanPoint(result.floorAnchor, ISO_RAISED_OVERLAY_HEIGHT), `${name}: no move without an owner`);
  }
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

// #724: what a placement carries is what someone reads — no invisible tether or
// grounding, no second raised point equal to the visual one, no owner area.
const PLACEMENT_FIELDS = ['floorAnchor', 'floorScene', 'footprint', 'owner', 'plane', 'visualScene'];

test('free low overlay separates the immutable floor anchor from its invisible footprint', () => {
  const normal = placement();
  assert.deepEqual(Object.keys(normal).sort(), PLACEMENT_FIELDS);
  assert.equal(normal.plane, 'raised');
  assert.deepEqual(normal.owner, { id: 'room' });
  assert.deepEqual(normal.floorAnchor, [50, 50]);
  assert.deepEqual(normal.floorScene, projectPlanPoint([50, 50], 0));
  assert.deepEqual(normal.visualScene, projectPlanPoint([50, 50], ISO_RAISED_OVERLAY_HEIGHT));
  assert.deepEqual(normal.footprint,
    buildIsoFootprintPolygon([50, 50], [4, 4], ISO_RAISED_OVERLAY_HEIGHT));
  assert.deepEqual(placement({ visualOffset: 0 }).visualScene, normal.floorScene,
    'a zero offset keeps the root on its floor point (#713 room names)');
});

test('show_borders:false is exact no-volume: floor anchor, no footprint/cues', () => {
  const result = placement({ showBorders: false });
  assert.deepEqual(Object.keys(result).sort(), PLACEMENT_FIELDS);
  assert.equal(result.plane, 'floor');
  assert.equal(result.owner, null);
  assert.deepEqual(result.visualScene, result.floorScene);
  assert.deepEqual(result.footprint, []);
});
