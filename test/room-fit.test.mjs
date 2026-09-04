import test from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptedRoomFitGesture,
  roomFitCameraTarget,
  roomFitClampFrame,
  roomFitGeometryBounds,
  roomFitOwnerFromPath,
  roomFitPointBounds,
  validRoomFitBounds,
} from '../test-build/room-fit.js';
import { projectPlanPoint } from '../test-build/iso-projection.js';

const close = (actual, expected, epsilon = 1e-9) => {
  assert.ok(Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`);
};

test('#152 point bounds include exact wall vertices and reject malformed geometry', () => {
  assert.deepEqual(roomFitPointBounds([[10, 20], [90, 20], [90, 80], [10, 80]], 2),
    { x: 8, y: 18, w: 84, h: 64 });
  assert.deepEqual(roomFitGeometryBounds({
    floor: [[20, 20], [80, 20], [80, 70], [20, 70]],
    wall: [[10, 10], [90, 10], [90, 80], [10, 80]],
    projection: 'flat',
  }), { x: 10, y: 10, w: 80, h: 70 });
  assert.equal(roomFitPointBounds([]), null);
  assert.equal(roomFitPointBounds([[0, 0], [NaN, 1]]), null);
  assert.equal(roomFitPointBounds([[0, 0], [0, 10]]), null);
  assert.equal(validRoomFitBounds({ x: 0, y: 0, w: 0, h: 10 }), false);
});

test('#152 isometric bounds project every floor, floor-depth and wall-height vertex', () => {
  const floor = [[100, 200], [300, 200], [250, 400]];
  const wall = [[90, 190], [310, 190], [260, 410]];
  const wallHeight = 64;
  const floorDepth = 10;
  const expectedPoints = [
    ...floor.flatMap((point) => [projectPlanPoint(point, 0), projectPlanPoint(point, -floorDepth)]),
    ...wall.flatMap((point) => [projectPlanPoint(point, 0), projectPlanPoint(point, wallHeight)]),
  ];
  const expected = roomFitPointBounds(expectedPoints);
  assert.deepEqual(roomFitGeometryBounds({
    floor, wall, projection: 'iso', wallHeight, floorDepth,
  }), expected);
  const withoutHeight = roomFitGeometryBounds({ floor, wall, projection: 'iso' });
  assert.ok(expected.y < withoutHeight.y, 'wall tops must extend the projected room upward');
});

test('#152 camera target gives exact 10% fields for the 2000x1000 square example', () => {
  const target = roomFitCameraTarget({
    bounds: { x: 100, y: 100, w: 400, h: 400 },
    baseFit: { x: 0, y: 0, w: 2000, h: 1000 },
    stageWidth: 2000,
    stageHeight: 1000,
    minZoom: 1 / 3,
    maxZoom: 8,
  });
  assert.ok(target);
  close(target.viewBox.w, 1000);
  close(target.viewBox.h, 500);
  close(target.zoom, 2);
  const screenWidth = 400 / target.viewBox.w * 2000;
  const screenHeight = 400 / target.viewBox.h * 1000;
  close(screenWidth, 800);
  close(screenHeight, 800);
  close(target.viewBox.x + target.viewBox.w / 2, 300);
  close(target.viewBox.y + target.viewBox.h / 2, 300);
});

test('#152 camera target handles width limit, height limit and zoom clamps', () => {
  const base = { x: 0, y: 0, w: 1000, h: 500 };
  const wide = roomFitCameraTarget({
    bounds: { x: 0, y: 0, w: 800, h: 100 }, baseFit: base,
    stageWidth: 1000, stageHeight: 500, minZoom: 1 / 3, maxZoom: 8,
  });
  assert.ok(wide);
  close(wide.viewBox.w, 1000);
  const tall = roomFitCameraTarget({
    bounds: { x: 0, y: 0, w: 100, h: 400 }, baseFit: base,
    stageWidth: 1000, stageHeight: 500, minZoom: 1 / 3, maxZoom: 8,
  });
  assert.ok(tall);
  close(tall.viewBox.h, 500);
  const tiny = roomFitCameraTarget({
    bounds: { x: 0, y: 0, w: 1, h: 1 }, baseFit: base,
    stageWidth: 1000, stageHeight: 500, minZoom: 1 / 3, maxZoom: 8,
  });
  assert.equal(tiny.zoom, 8);
  const huge = roomFitCameraTarget({
    bounds: { x: 0, y: 0, w: 4000, h: 2000 }, baseFit: base,
    stageWidth: 1000, stageHeight: 500, minZoom: 1 / 3, maxZoom: 8,
  });
  assert.equal(huge.zoom, 1 / 3);
});

test('#152 invalid stage and bounds fail without a target', () => {
  const input = {
    bounds: { x: 0, y: 0, w: 100, h: 100 },
    baseFit: { x: 0, y: 0, w: 1000, h: 500 },
    stageWidth: 1000, stageHeight: 500, minZoom: 1 / 3, maxZoom: 8,
  };
  assert.equal(roomFitCameraTarget({ ...input, stageWidth: 0 }), null);
  assert.equal(roomFitCameraTarget({ ...input, bounds: { ...input.bounds, w: NaN } }), null);
  assert.equal(roomFitCameraTarget({ ...input, safeFraction: 0 }), null);
});

test('#152 clamp frame covers the current and detached target cameras', () => {
  const frame = roomFitClampFrame(
    { x: 0, y: 0, w: 1000, h: 500 },
    { x: -500, y: 100, w: 250, h: 125 },
    { x: 1800, y: 700, w: 400, h: 200 },
    { x: 1900, y: 760, w: 120, h: 80 },
  );
  assert.deepEqual(frame, { x: -500, y: 0, w: 2700, h: 900 });
});

const pathNode = (selectors, id = null) => ({
  matches: (selector) => selector.split(',').some((part) => selectors.includes(part.trim())),
  getAttribute: (name) => name === 'data-id' ? id : null,
});

test('#152 browser event path is the room authority and interactive children suppress it', () => {
  const room = pathNode(['[data-hp="room"][data-id]'], 'room-a');
  const label = pathNode(['.roomlabel[data-id]', '[role="button"]'], 'room-a');
  assert.equal(roomFitOwnerFromPath([room]), 'room-a');
  assert.equal(roomFitOwnerFromPath([pathNode(['.rlname']), label]), 'room-a');
  assert.equal(roomFitOwnerFromPath([pathNode(['.rlgo', '[role="link"]']), label]), null);
  assert.equal(roomFitOwnerFromPath([pathNode(['.dev']), room]), null);
  assert.equal(roomFitOwnerFromPath([pathNode(['button']), room]), null);
});

test('#152 release accepts only the same pointer, space and painted room', () => {
  const candidate = { pointerId: 7, spaceId: 'floor-a', roomId: 'room-a' };
  assert.equal(acceptedRoomFitGesture(candidate, 7, 'floor-a', 'room-a', false), 'room-a');
  assert.equal(acceptedRoomFitGesture(candidate, 8, 'floor-a', 'room-a', false), null);
  assert.equal(acceptedRoomFitGesture(candidate, 7, 'floor-b', 'room-a', false), null);
  assert.equal(acceptedRoomFitGesture(candidate, 7, 'floor-a', 'room-b', false), null);
  assert.equal(acceptedRoomFitGesture(candidate, 7, 'floor-a', 'room-a', true), null);
});
