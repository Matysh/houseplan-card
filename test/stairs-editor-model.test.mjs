// #676: the stair editing layer is an oriented box with pure transforms —
// drag-to-draw, resize about the anchor without mirroring, edge magnets that
// never turn a stair more than the tolerance, cursors by world bearing, and a
// properties dialog that keeps untouched numbers bit for bit.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  defaultStair,
  draftLeadingHandle,
  draftStair,
  magnetStairMove,
  magnetStairResize,
  physicalStairSurfaces,
  resizeCursor,
  resizeStair,
  snapEdgeToFaces,
  stairBox,
  stairEdges,
  stairFieldOf,
  stairFieldToCm,
  stairHandles,
  stairMinN,
  stairRotateHandle,
  stairSizeFromField,
  STAIR_MAGNET_ANGLE_DEG,
  STAIR_MAX_CM,
  STAIR_MIN_CM,
} from '../test-build/stairs-editor-model.js';

const CELL = 5;
const SCALE = 1000;
// 1 cell = 1000 / 240 units; 30 cm = 6 cells = 25 units at 5 cm per cell.
const CELL_UNITS = SCALE / 240;
const cmUnits = (cm) => (cm / CELL) * CELL_UNITS;
const close = (actual, expected, tolerance = 1e-6) => assert.ok(
  Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected} (±${tolerance})`,
);

const straight = (extra = {}) => ({
  id: 's', kind: 'straight', x: 0.5, y: 0.5, angle: 0, direction: 'forward',
  length: cmUnits(240) / SCALE, width: cmUnits(100) / SCALE, target_space_id: null, ...extra,
});
const spiral = (extra = {}) => ({
  id: 'r', kind: 'spiral', x: 0.5, y: 0.5, angle: 0, direction: 'clockwise',
  radius: cmUnits(90) / SCALE, target_space_id: null, ...extra,
});

/** A horizontal wall face at y = `y` whose free side looks up (-y) or down (+y). */
const faceAt = (y, x1, x2, looksUp, id = 'face') => ({
  a: [x1, y], b: [x2, y], axisA: [x1, y], axisB: [x2, y],
  normal: looksUp ? [0, -1] : [0, 1], owner: 'physical', stableId: id,
});
const twoSidedFace = (a, b, id = 'body') => ({ a, b, axisA: a, axisB: b, normal: null, owner: 'physical', stableId: id });

test('#676 AC1: a short drag is a click and places the default stair at the press', () => {
  const stair = draftStair('straight', [400, 300], [402, 303], CELL, 'id', CELL_UNITS);
  assert.deepEqual(stair, defaultStair('straight', 400, 300, CELL, 'id'));
  const round = draftStair('spiral', [400, 300], [400, 300], CELL, 'id', CELL_UNITS);
  assert.deepEqual(round, defaultStair('spiral', 400, 300, CELL, 'id'));
});

test('#676 AC1: the dominant drag axis is the rise axis and the ascent points from a to b', () => {
  const east = draftStair('straight', [100, 100], [340, 160], CELL, 'id', CELL_UNITS);
  assert.equal(east.angle, 0);
  assert.equal(east.direction, 'forward');
  close(east.length * SCALE, 240);
  close(east.width * SCALE, 60);
  close(east.x * SCALE, 220);
  close(east.y * SCALE, 130);
  const west = draftStair('straight', [340, 160], [100, 100], CELL, 'id', CELL_UNITS);
  assert.equal(west.angle, 180);
  close(west.length * SCALE, 240);
  const south = draftStair('straight', [100, 100], [160, 340], CELL, 'id', CELL_UNITS);
  assert.equal(south.angle, 90);
  close(south.length * SCALE, 240);
  close(south.width * SCALE, 60);
  const north = draftStair('straight', [160, 340], [100, 100], CELL, 'id', CELL_UNITS);
  assert.equal(north.angle, 270);
  // Equal extents prefer x, deterministically.
  assert.equal(draftStair('straight', [0, 0], [100, 100], CELL, 'id', CELL_UNITS).angle, 0);
  assert.equal(draftStair('straight', [0, 0], [-100, 100], CELL, 'id', CELL_UNITS).angle, 180);
});

test('#676 AC1: drawn sizes never drop below one tread, spiral takes the square from a toward b', () => {
  const thin = draftStair('straight', [100, 100], [300, 104], CELL, 'id', CELL_UNITS);
  close(thin.width * SCALE, cmUnits(STAIR_MIN_CM));
  close(thin.length * SCALE, 200);
  const round = draftStair('spiral', [100, 100], [180, 60], CELL, 'id', CELL_UNITS);
  close(round.radius * SCALE, 40);
  close(round.x * SCALE, 140);
  close(round.y * SCALE, 60);
  assert.equal(round.direction, 'clockwise');
  const tiny = draftStair('spiral', [100, 100], [110, 108], CELL, 'id', CELL_UNITS);
  close(tiny.radius * SCALE, cmUnits(STAIR_MIN_CM) / 2);
  assert.deepEqual(draftLeadingHandle(round, [100, 100], [180, 60]), { sx: 1, sy: -1 });
  assert.deepEqual(draftLeadingHandle(thin, [100, 100], [300, 104]), { sx: 1, sy: 1 });
  const south = draftStair('straight', [100, 100], [160, 340], CELL, 'id', CELL_UNITS);
  assert.deepEqual(draftLeadingHandle(south, [100, 100], [160, 340]), { sx: 1, sy: -1 });
});

test('#676 AC2/AC11: resize keeps the anchor side fixed, the angle, and never mirrors past it', () => {
  const stair = straight({ angle: 30 });
  const min = stairMinN(CELL) * SCALE;
  const before = stairBox(stair);
  const edgeBefore = stairEdges(stair).find((edge) => edge.sx === -1);
  const east = stairHandles(stair).find((handle) => handle.sx === 1 && handle.sy === 0);
  const pulled = resizeStair(stair, east, [east.point[0] + 50 * Math.cos(Math.PI / 6), east.point[1] + 50 * Math.sin(Math.PI / 6)], { minUnits: min });
  assert.equal(pulled.angle, 30);
  close(pulled.length * SCALE, before.w + 50, 1e-6);
  close(pulled.width * SCALE, before.h);
  const edgeAfter = stairEdges(pulled).find((edge) => edge.sx === -1);
  close(edgeAfter.mid[0], edgeBefore.mid[0], 1e-9);
  close(edgeAfter.mid[1], edgeBefore.mid[1], 1e-9);
  // Past the anchor: the size stops at the minimum and the anchor still does not move.
  const west = stairEdges(stair).find((edge) => edge.sx === -1).mid;
  const crossed = resizeStair(stair, east, [west[0] - 300, west[1] - 100], { minUnits: min });
  close(crossed.length * SCALE, min);
  assert.equal(crossed.angle, 30);
  const anchorAfterCross = stairEdges(crossed).find((edge) => edge.sx === -1);
  close(anchorAfterCross.mid[0], edgeBefore.mid[0], 1e-9);
  close(anchorAfterCross.mid[1], edgeBefore.mid[1], 1e-9);
  // Corner with Shift: proportional, following the axis that moved farther.
  const corner = stairHandles(stair).find((handle) => handle.sx === 1 && handle.sy === 1);
  const proportional = resizeStair(stair, corner, [corner.point[0] + 100 * Math.cos(Math.PI / 6), corner.point[1] + 100 * Math.sin(Math.PI / 6)], { minUnits: min, keepAspect: true });
  close(proportional.length / proportional.width, stair.length / stair.width, 1e-9);
  assert.equal(proportional.angle, 30);
});

test('#676 AC2: a spiral handle drags its tangent, the circle stays a circle and the opposite tangent stays', () => {
  const stair = spiral();
  const min = stairMinN(CELL) * SCALE;
  const east = stairHandles(stair).find((handle) => handle.sx === 1);
  const westBefore = stairEdges(stair).find((edge) => edge.sx === -1).mid;
  const grown = resizeStair(stair, east, [east.point[0] + 40, east.point[1] + 7], { minUnits: min });
  close(grown.radius * SCALE, stair.radius * SCALE + 20);
  const westAfter = stairEdges(grown).find((edge) => edge.sx === -1).mid;
  close(westAfter[0], westBefore[0], 1e-9);
  const north = stairHandles(stair).find((handle) => handle.sy === -1);
  const shrunk = resizeStair(stair, north, [north.point[0], north.point[1] + 1000], { minUnits: min });
  close(shrunk.radius * SCALE, min / 2);
});

test('#676 AC4: the resize cursor follows the world bearing of the handle', () => {
  assert.equal(resizeCursor(0), 'ew');
  assert.equal(resizeCursor(180), 'ew');
  assert.equal(resizeCursor(90), 'ns');
  assert.equal(resizeCursor(270), 'ns');
  assert.equal(resizeCursor(45), 'nwse');
  assert.equal(resizeCursor(225), 'nwse');
  assert.equal(resizeCursor(135), 'nesw');
  assert.equal(resizeCursor(315), 'nesw');
  assert.equal(resizeCursor(-20), 'ew');
  assert.equal(resizeCursor(23), 'nwse');
  const rotated = straight({ angle: 90 });
  const byHandle = Object.fromEntries(stairHandles(rotated).map((handle) => [`${handle.sx},${handle.sy}`, resizeCursor(handle.normalDeg)]));
  // Local +x now points down the screen: the "east" side handle wants ns.
  assert.equal(byHandle['1,0'], 'ns');
  assert.equal(byHandle['0,1'], 'ew');
  assert.equal(byHandle['1,1'], 'nesw');
  const tilted = straight({ angle: 30 });
  assert.equal(resizeCursor(stairHandles(tilted).find((handle) => handle.sx === 1 && handle.sy === 0).normalDeg), 'nwse');
  // The top side's normal at 30° tilt is 300°: nearer the NE diagonal than vertical.
  assert.equal(resizeCursor(stairHandles(tilted).find((handle) => handle.sx === 0 && handle.sy === -1).normalDeg), 'nesw');
  const gentle = straight({ angle: 10 });
  assert.equal(resizeCursor(stairHandles(gentle).find((handle) => handle.sx === 0 && handle.sy === -1).normalDeg), 'ns');
  const stem = stairRotateHandle(tilted, 40);
  close(Math.hypot(stem.to[0] - stem.from[0], stem.to[1] - stem.from[1]), 40);
});

test('#676 AC3: a parallel side within reach lands flush; a move may turn the stair by the tolerance only', () => {
  const stair = straight({ angle: 3 });
  const box = stairBox(stair);
  const top = stairEdges(stair).find((edge) => edge.sy === -1);
  const faceY = top.mid[1] - 12;
  const surfaces = [faceAt(faceY, 0, 1000, false)];
  const snapped = magnetStairMove(stair, surfaces, 25);
  assert.equal(snapped.angle, 0, 'turned to exactly parallel within the tolerance');
  const topAfter = stairEdges(snapped).find((edge) => edge.sy === -1);
  close(topAfter.mid[1], faceY, 1e-6);
  close(snapped.length, stair.length, 1e-12);
  // The turn is the only rotation: a 30° stair is not parallel and is left alone.
  const skew = straight({ angle: 30 });
  assert.deepEqual(magnetStairMove(skew, surfaces, 25), skew);
  // Out of reach: untouched.
  assert.deepEqual(magnetStairMove(stair, [faceAt(faceY - 100, 0, 1000, false)], 25), stair);
  // A face that looks away (the other side of a room wall) never pulls through the masonry.
  assert.deepEqual(magnetStairMove(stair, [faceAt(faceY, 0, 1000, true)], 25), stair);
  // A face that misses the side's projection is not a candidate.
  assert.deepEqual(magnetStairMove(stair, [faceAt(faceY, box.cx + 400, box.cx + 800, false)], 25), stair);
  assert.equal(STAIR_MAGNET_ANGLE_DEG, 5);
});

test('#676 AC3: a stair standing end-on to a wall snaps with its end and keeps its angle', () => {
  const stair = straight({ angle: 90 });
  // Local +x points down: the "east" side is the lower end of the flight.
  const end = stairEdges(stair).find((edge) => edge.sx === 1);
  const faceY = end.mid[1] + 8;
  const snapped = magnetStairMove(stair, [twoSidedFace([0, faceY], [1000, faceY])], 25);
  assert.equal(snapped.angle, 90);
  close(stairEdges(snapped).find((edge) => edge.sx === 1).mid[1], faceY, 1e-6);
  close(snapped.x, stair.x, 1e-12);
});

test('#676 AC3: the resize magnet moves only the dragged side and never the angle or the anchor', () => {
  const stair = straight({ angle: 5 });
  const min = stairMinN(CELL) * SCALE;
  const east = stairEdges(stair).find((edge) => edge.sx === 1);
  const west = stairEdges(stair).find((edge) => edge.sx === -1);
  // A vertical face 10 units beyond the east end, parallel to it within 5°.
  const faceX = east.mid[0] + 10;
  const surfaces = [twoSidedFace([faceX, east.mid[1] - 300], [faceX, east.mid[1] + 300])];
  const snapped = magnetStairResize(stair, { sx: 1, sy: 0 }, surfaces, 25, min);
  assert.equal(snapped.angle, 5);
  const eastAfter = stairEdges(snapped).find((edge) => edge.sx === 1);
  const westAfter = stairEdges(snapped).find((edge) => edge.sx === -1);
  close(eastAfter.mid[0], faceX + (eastAfter.mid[1] - east.mid[1]) * 0, 0.5);
  close(westAfter.mid[0], west.mid[0], 1e-9);
  close(westAfter.mid[1], west.mid[1], 1e-9);
  // The side that was not dragged is never magnetised.
  const untouched = magnetStairResize(stair, { sx: -1, sy: 0 }, surfaces, 25, min);
  assert.deepEqual(untouched, stair);
  // A snap that would shrink below the minimum is refused.
  const nearFace = [twoSidedFace([west.mid[0] + 5, -1000], [west.mid[0] + 5, 2000])];
  assert.deepEqual(magnetStairResize(straight({ length: min / SCALE }), { sx: 1, sy: 0 }, nearFace, 25, min), straight({ length: min / SCALE }));
});

test('#676 AC3: the nearest side wins and edge geometry reports outward normals', () => {
  const stair = straight();
  const edges = stairEdges(stair);
  assert.deepEqual(edges.map((edge) => [edge.sx, edge.sy]), [[1, 0], [-1, 0], [0, 1], [0, -1]]);
  assert.deepEqual(edges[0].normal, [1, 0]);
  assert.deepEqual(edges[3].normal, [0, -1]);
  const top = edges[3];
  const near = faceAt(top.mid[1] - 4, 0, 1000, false, 'near');
  const far = faceAt(top.mid[1] - 20, 0, 1000, false, 'far');
  assert.equal(snapEdgeToFaces(top, [far, near], 25).stableId, 'near');
  assert.equal(snapEdgeToFaces(top, [near, far], 25).stableId, 'near');
  const round = spiral();
  const tangents = stairEdges(round);
  close(Math.hypot(tangents[0].mid[0] - round.x * SCALE, tangents[0].mid[1] - round.y * SCALE), round.radius * SCALE);
});

test('#676 AC5: dialog fields round-trip real sizes and reject only the stair bounds', () => {
  assert.equal(stairFieldToCm('424.62', false), 424.62);
  assert.equal(stairFieldToCm('155,38', false), 155.38);
  assert.equal(stairFieldToCm('240', false), 240, '100 cm is not a ceiling');
  assert.equal(stairFieldToCm(String(STAIR_MAX_CM), false), STAIR_MAX_CM);
  assert.equal(stairFieldToCm(String(STAIR_MAX_CM + 1), false), null);
  assert.equal(stairFieldToCm('29.9', false), null);
  assert.equal(stairFieldToCm('30', false), STAIR_MIN_CM);
  assert.equal(stairFieldToCm('', false), null);
  assert.equal(stairFieldToCm('100', true), 254);
  // An untouched field keeps the stored number bit for bit, whatever rounding the field shows.
  const stored = 0.3538461538461537;
  const shown = stairFieldOf(stored, CELL, false);
  assert.equal(shown, '424.62');
  assert.equal(stairSizeFromField(shown, shown, stored, CELL, false), stored);
  close(stairSizeFromField('300', shown, stored, CELL, false) * CELL * 240, 300, 1e-9);
  assert.equal(stairSizeFromField('12', shown, stored, CELL, false), null);
});

test('#676 AC3: physical bodies expose only their outward faces, whatever the polygon winding', () => {
  const clockwise = [[100, 100], [300, 100], [300, 120], [100, 120]];
  const counter = [...clockwise].reverse();
  for (const body of [clockwise, counter]) {
    const faces = physicalStairSurfaces([body]);
    assert.equal(faces.length, 4);
    const top = faces.find((face) => face.a[1] === 100 && face.b[1] === 100);
    const bottom = faces.find((face) => face.a[1] === 120 && face.b[1] === 120);
    assert.deepEqual(top.normal, [0, -1], 'the upper face looks up, away from the body');
    assert.deepEqual(bottom.normal, [0, 1], 'the lower face looks down, away from the body');
    assert.equal(top.owner, 'physical');
  }
  // A stair below the wall snaps its upper side to the exposed lower face,
  // never to the face hidden inside the masonry, even when that one is nearer.
  const stair = straight({ x: 0.2, y: 0.14, width: 0.05 });
  const upper = stairEdges(stair).find((edge) => edge.sy === -1);
  assert.ok(upper.mid[1] < 120 && upper.mid[1] > 100, 'the stair overlaps the body');
  const snapped = magnetStairMove(stair, physicalStairSurfaces([clockwise]), 25);
  close(stairEdges(snapped).find((edge) => edge.sy === -1).mid[1], 120, 1e-6);
  assert.deepEqual(physicalStairSurfaces([[[0, 0], [10, 0]], [[0, 0], [10, 0], [10, 0]]]), [], 'degenerate bodies have no faces');
});
