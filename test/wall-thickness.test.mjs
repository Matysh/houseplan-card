// Wall thickness pure geometry (docs/WALL-THICKNESS.md §10).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  wallKey, lookupWall, thicknessCmAt, degradeWalls, rekeyWallsAfterMove,
  setWallThickness, setWallThicknessForRoom, applyWallThicknessToNewRoom,
  drawWallPreviewD, linearWallBody, linearWallJoinPatches,
  DRAW_WALL_DEFAULT_CM, clampWallCm, cmToField, fieldToCm,
  wallCmToUnits, insetContour, outsetContour, inwardNormal, edgeKinds, wallEdgeBodies,
  wallBodyRings, wallBodiesGeometry, wallBodiesUnionPath, floorFootprintGeometry,
  virtualJunctionPatches, stableJunctionPatch, unionJunctionPatches,
  innerContourForRoom, innerEdgeSpan, ownEdgeOffsets,
  paperRoomShapesWithWalls, WALL_MIN_CM, WALL_MAX_CM, MITRE_LIMIT,
  MULTI_WALL_JOIN_LIMIT, buildMultiWallNodeMap, multiWallBevelTriangles,
  atomicPolyForRoom, insetOffsetsForRoom, wallIntervals, materializeWallIntervals,
  normalizeWallIntervals,
  intervalCmAt, wallBodyNeedsSolid, openingInnerFaceOffset, openingTunnelGeometry,
  openingTunnelGeometries, tunnelFacePath,
  WALL_HATCH_MIN_PX,
  wallHatchStepUnits, wallHatchNeedsSolid,
  HATCH_BASE_STEP_UNITS, HATCH_MIN_STEP_UNITS, HATCH_MAX_STEP_UNITS,
} from '../test-build/wall-thickness.js';
import { polygonArea, paperRoomShapes, splitRoomPath, sharedBoundary } from '../test-build/logic.js';
import { resolveOpenCuts } from '../test-build/open-spans.js';
import { GRID_PITCH, NORM_W } from '../test-build/space-geometry.js';
import { geometryArea } from '../test-build/physical-geometry.js';
import { checkWallRecordsPreserved } from '../scripts/model-invariants.mjs';
import { difference, intersection, union } from 'polyclip-ts';

const closeTo = (got, want, tol = 1e-6) =>
  assert.ok(Math.abs(got - want) <= tol, `expected ${want}, got ${got}`);

const pitch = 1 / 240; // normalised grid step
const cellCm = 5;

const closedGeometry = (poly) => {
  const ring = [...poly, poly[0]].map((point) => [...point]);
  return [[ring]];
};

const geometryBounds = (geom) => {
  const points = geom.flat(2);
  return [
    Math.min(...points.map((point) => point[0])),
    Math.min(...points.map((point) => point[1])),
    Math.max(...points.map((point) => point[0])),
    Math.max(...points.map((point) => point[1])),
  ];
};

test('Stage floor footprint excludes detached independent physical bodies', () => {
  const rooms = [{ id: 'room', poly: [[0, 0], [100, 0], [100, 100], [0, 100]] }];
  const detached = [[[200, 20], [220, 20], [220, 80], [200, 80]]];
  const footprint = floorFootprintGeometry(rooms, [], [], 20, 250, 40, 1);
  const withBody = wallBodiesGeometry(rooms, [], [], [], 20, 250, 40, 1, detached);
  assert.ok(footprint && withBody);
  assert.deepEqual(geometryBounds(footprint), [0, 0, 100, 100]);
  assert.deepEqual(geometryBounds(withBody.paperGeom), [0, 0, 100, 100]);
  assert.deepEqual(geometryBounds(withBody.geom), [200, 20, 220, 80]);
});

const geometryDifferenceArea = (a, b) => geometryArea(difference(a, b));

const geometryProbeCoverage = (geom, [x, y], radius = 0.05) => {
  const probe = closedGeometry([
    [x - radius, y - radius],
    [x + radius, y - radius],
    [x + radius, y + radius],
    [x - radius, y + radius],
  ]);
  return geometryArea(intersection(geom, probe)) / ((radius * 2) ** 2);
};

const assertProbeInside = (geom, point, message) =>
  assert.ok(geometryProbeCoverage(geom, point) > 0.99, message || `missing body at ${point}`);

const assertProbeOutside = (geom, point, message) =>
  assert.ok(geometryProbeCoverage(geom, point) < 1e-7, message || `unexpected body at ${point}`);

const assertBoundedMultiWallBevels = (
  rooms, walls, geometry, cell = cellCm, scale = 1,
) => {
  const map = buildMultiWallNodeMap(
    wallIntervals(rooms, walls, [], pitch, cell, GRID_PITCH, scale),
    pitch * scale * 0.04 * 4,
    scale,
  );
  const triangles = multiWallBevelTriangles(map);
  assert.ok(triangles.length > 0, 'fixture no longer exercises an oversized multi-wall join');
  for (const triangle of triangles) {
    const node = map.nodes.find((candidate) => triangle.slice(0, 2).every((point) =>
      Math.hypot(
        point[0] - candidate.point[0],
        point[1] - candidate.point[1],
      ) <= candidate.limit + 1e-7));
    assert.ok(node, 'bevel endpoints escaped every multi-wall node limit');
    const base = [
      (triangle[0][0] + triangle[1][0]) / 2,
      (triangle[0][1] + triangle[1][1]) / 2,
    ];
    assertProbeOutside(geometry.geom, [
      (base[0] + triangle[2][0]) / 2,
      (base[1] + triangle[2][1]) / 2,
    ], 'an excessive multi-wall wedge remains filled');
  }
  return map;
};

function cornerSplitFixture({
  poly = [[100, 100], [900, 100], [900, 700], [100, 700]],
  path = [[100, 100], [900, 500]],
  outerCm = 15,
  dividerCm = 15,
  outerOverrides = [],
} = {}) {
  const original = { id: 'source', poly: poly.map((point) => [...point]) };
  const split = splitRoomPath(original.poly, path);
  assert.ok(split, 'fixture must be a valid corner split');

  let walls = outerCm > 0
    ? applyWallThicknessToNewRoom([], [original], original.id, outerCm, pitch)
    : [];
  for (const [a, b, cm] of outerOverrides)
    walls = setWallThickness(walls, a, b, cm, pitch);
  const before = walls.length
    ? wallBodiesGeometry([original], walls, [], [], pitch, cellCm, GRID_PITCH)
    : null;

  walls = materializeWallIntervals([original], walls, [], pitch, cellCm, GRID_PITCH);
  const rooms = [
    { id: 'source', poly: split[0] },
    { id: 'fresh', poly: split[1] },
  ];
  const divider = sharedBoundary(rooms[0].poly, rooms[1].poly);
  assert.equal(divider.length, 1);
  walls = setWallThickness(
    walls, divider[0].slice(0, 2), divider[0].slice(2), dividerCm, pitch,
  );
  walls = normalizeWallIntervals(rooms, walls, [], pitch, cellCm, GRID_PITCH);
  const after = wallBodiesGeometry(rooms, walls, [], [], pitch, cellCm, GRID_PITCH);
  assert.ok(after, `wall geometry missing for outer=${outerCm}, divider=${dividerCm}`);
  return { original, rooms, walls, divider, before, after };
}

function splitThicknessTransitionFixture() {
  const scale = 1000;
  const rooms = [
    { id: 'left', poly: [[100, 100], [500, 100], [500, 900], [100, 900]] },
    { id: 'right', poly: [[500, 100], [900, 100], [900, 900], [500, 900]] },
  ];
  const walls = setWallThicknessForRoom([], rooms, 'left', 10, pitch, [], scale);
  const geometry = wallBodiesGeometry(
    rooms, walls, [], [], pitch, cellCm, GRID_PITCH, scale,
  );
  assert.ok(geometry, 'production-scale split fixture must produce wall geometry');
  return { scale, rooms, walls, geometry };
}

// ------------------------------- key ----------------------------------------

test('wallKey is the same from either end of the wall', () => {
  const a = [0.1, 0.2], b = [0.4, 0.2];
  assert.equal(wallKey(a, b, pitch), wallKey(b, a, pitch));
});

test('wallKey changes when the wall moves by one grid step', () => {
  const a = [0.1, 0.2], b = [0.4, 0.2];
  const a2 = [0.1, 0.2 + pitch], b2 = [0.4, 0.2 + pitch];
  assert.notEqual(wallKey(a, b, pitch), wallKey(a2, b2, pitch));
});

test('issue 258 wallKey survives the nine-decimal storage round-trip', () => {
  const cases = [
    [[0.8875, 0.05], [0.8875, 83 / 240], [0.8875, 0.05], [0.8875, 0.345833333]],
    [[235 / 240, 83 / 240], [235 / 240, 0.55], [0.979166667, 0.345833333], [0.979166667, 0.55]],
    [[-83 / 240, -12 / 240], [-83 / 240, -47 / 240], [-0.345833333, -0.05], [-0.345833333, -0.195833333]],
    [[12 / 240, 7 / 240], [48 / 240, 7 / 240], [0.05, 0.029166667], [0.2, 0.029166667]],
  ];
  for (const [exactA, exactB, storedA, storedB] of cases) {
    const exact = wallKey(exactA, exactB, pitch);
    assert.equal(wallKey(storedA, storedB, pitch), exact);
    assert.equal(wallKey(storedB, storedA, pitch), exact);
  }
  assert.notEqual(wallKey([0, 0], [pitch - pitch * 2e-6, 0], pitch),
    wallKey([0, 0], [pitch, 0], pitch), 'coordinates beyond key epsilon are not snapped');
});

test('issue 258 exact-span lookup repairs either persisted key without leaking', () => {
  const a = [0.8875, 0.05], b = [0.8875, 0.345833333];
  const exactA = [213 / 240, 12 / 240], exactB = [213 / 240, 83 / 240];
  const canonical = wallKey(exactA, exactB, pitch);
  const affected = canonical.replace(',0.200000@', ',0.195833@');
  for (const key of [canonical, affected]) {
    const walls = [{ key, cm: 29, a, b }];
    assert.equal(lookupWall(walls, exactA, exactB, pitch)?.cm, 29);
    assert.equal(lookupWall(walls, exactB, exactA, pitch)?.cm, 29);
    assert.equal(thicknessCmAt(walls, exactA, exactB, pitch), 29);
  }

  const unrelated = [
    { key: 'broken-parent', cm: 31, a: [0.8875, 0], b: [0.8875, 0.4] },
    { key: 'broken-child', cm: 32, a: [0.8875, 0.05], b: [0.8875, 0.2] },
    { key: 'broken-neighbour', cm: 33, a: [0.8875 + pitch, 0.05], b: [0.8875 + pitch, 0.345833333] },
    { key: 'broken-parallel', cm: 34, a: [0.05, 0.8875], b: [0.345833333, 0.8875] },
  ];
  assert.equal(lookupWall(unrelated, exactA, exactB, pitch), null);

  const scale = 1000;
  const renderA = exactA.map((v) => v * scale), renderB = exactB.map((v) => v * scale);
  const renderWalls = [{ key: affected, cm: 29, a, b }];
  assert.equal(lookupWall(renderWalls, renderA, renderB, pitch, scale)?.cm, 29);
  assert.equal(thicknessCmAt(renderWalls, renderA, renderB, pitch, scale), 29);
});

test('issue 258 repaired span reaches intervals, junction nodes and masonry', () => {
  const scale = NORM_W;
  const node = [213 / 240 * scale, 83 / 240 * scale];
  const rooms = [
    { id: 'lower', poly: [
      [0.75 * scale, 12 / 240 * scale],
      [213 / 240 * scale, 12 / 240 * scale],
      node,
      [0.75 * scale, 83 / 240 * scale],
    ] },
    { id: 'upper', poly: [
      [0.75 * scale, 83 / 240 * scale],
      [0.95 * scale, 83 / 240 * scale],
      [0.95 * scale, 0.5 * scale],
      [0.75 * scale, 0.5 * scale],
    ] },
  ];
  let walls = setWallThicknessForRoom([], rooms, 'lower', 20, pitch, [], scale);
  walls = setWallThicknessForRoom(walls, rooms, 'upper', 20, pitch, [], scale);
  const a = [0.8875, 0.05], b = [0.8875, 0.345833333];
  const target = walls.findIndex((wall) => (
    wall.a && wall.b
    && Math.abs(wall.a[0] - a[0]) < 1e-9 && Math.abs(wall.b[0] - b[0]) < 1e-9
  ));
  assert.ok(target >= 0, 'fixture must contain the affected vertical wall');
  walls[target] = { key: '0.887500,0.195833@1.5706', cm: 29, a, b };

  const intervals = wallIntervals(rooms, walls, [], pitch, cellCm, GRID_PITCH, scale);
  const affected = intervals.find((interval) => (
    Math.abs(interval.a[0] - node[0]) < 1e-6
    && Math.abs(interval.b[0] - node[0]) < 1e-6
    && Math.min(interval.a[1], interval.b[1]) < node[1] - 1
    && Math.max(interval.a[1], interval.b[1]) >= node[1] - 1e-6
  ));
  assert.equal(affected?.cm, 29);

  const nodes = buildMultiWallNodeMap(intervals, pitch * scale * 0.04 * 4, scale);
  const junction = nodes.nodes.find((candidate) => (
    Math.hypot(candidate.point[0] - node[0], candidate.point[1] - node[1]) < 1e-6
  ));
  assert.ok(junction && junction.rays.length >= 3);
  assert.ok(junction.rays.some((ray) => (
    Math.abs(ray.halfDepth - wallCmToUnits(29, cellCm, GRID_PITCH) / 2) < 1e-9
    && Math.abs(ray.u[0]) < 1e-9 && ray.u[1] < -0.999
  )), `multi-wall node lost the affected incident wall: ${JSON.stringify(junction.rays)}`);

  const geometry = wallBodiesGeometry(
    rooms, walls, [], [], pitch, cellCm, GRID_PITCH, scale,
  );
  assert.ok(geometry);
  assertProbeInside(geometry.geom, node, 'the affected T-node contains a white wedge');
});

test('lookupWall finds an entry and thicknessCmAt reads it', () => {
  const a = [0.1, 0.2], b = [0.4, 0.2];
  const walls = [{ key: wallKey(a, b, pitch), cm: 20 }];
  assert.equal(lookupWall(walls, a, b, pitch)?.cm, 20);
  assert.equal(lookupWall(walls, b, a, pitch)?.cm, 20);
  assert.equal(thicknessCmAt(walls, a, b, pitch), 20);
  assert.equal(thicknessCmAt(walls, [0, 0], [1, 1], pitch), 0);
});

test('thicknessCmAt inherits the narrowest exact parent that covers an atomic child', () => {
  const parent = setWallThickness([], [0, 0], [10, 0], 20, pitch);
  assert.equal(thicknessCmAt(parent, [0, 0], [4, 0], pitch), 20);
  assert.equal(thicknessCmAt(parent, [10, 0], [4, 0], pitch), 20);

  const production = setWallThickness([], [0, 0], [10000, 0], 20, pitch, 1000);
  assert.equal(thicknessCmAt(production, [0, 0], [4000, 0], pitch, 1000), 20);
  assert.equal(thicknessCmAt(production, [10000, 0], [4000, 0], pitch, 1000), 20);

  const nested = [
    ...parent,
    ...setWallThickness([], [4, 0], [6, 0], 30, pitch),
  ];
  for (const walls of [nested, [...nested].reverse()]) {
    assert.equal(thicknessCmAt(walls, [4, 0], [5, 0], pitch), 30);
  }
});

test('thicknessCmAt exact-parent fallback does not leak from partial or unrelated spans', () => {
  const partial = setWallThickness([], [0, 0], [4, 0], 20, pitch);
  assert.equal(thicknessCmAt(partial, [0, 0], [10, 0], pitch), 0);
  assert.equal(thicknessCmAt(partial, [0, 1], [4, 1], pitch), 0);
  assert.equal(thicknessCmAt(partial, [0, 0], [0, 4], pitch), 0);
  assert.equal(thicknessCmAt([
    { key: wallKey([0, 0], [4, 0], pitch), cm: 20, a: ['bad', 0], b: [4, 0] },
    { key: 'broken', cm: 20, a: [0, 0], b: [0, 0] },
  ], [0, 0], [2, 0], pitch), 0);
});

// ------------------------------- units --------------------------------------

test('cm ↔ field: metric stays cm, imperial is inches', () => {
  assert.equal(cmToField(25.4, false), '25.4');
  assert.equal(cmToField(25.4, true), '10');
  assert.equal(fieldToCm('10', true), 25.4);
  assert.equal(fieldToCm('20', false), 20);
  assert.equal(fieldToCm('', false), null);
  assert.equal(fieldToCm('0', true), null);
  assert.equal(clampWallCm(0.5), WALL_MIN_CM);
  assert.equal(clampWallCm(999), WALL_MAX_CM);
});

test('wallCmToUnits goes through cell_cm like every other length', () => {
  // 5 cm at 5 cm/cell and pitch P → 1 cell = P units
  closeTo(wallCmToUnits(5, 5, GRID_PITCH), GRID_PITCH);
  closeTo(wallCmToUnits(10, 5, GRID_PITCH), 2 * GRID_PITCH);
});

test('thin-on-screen fallback policy is shared by both renderers', () => {
  assert.equal(wallBodyNeedsSolid(2, 1), true);
  assert.equal(wallBodyNeedsSolid(WALL_HATCH_MIN_PX, 1), false);
  assert.equal(wallBodyNeedsSolid(2, 2), false);
  assert.equal(wallBodyNeedsSolid(Number.NaN, 1), false);
  assert.equal(wallBodyNeedsSolid(2, 0), false);
});

// ------------------------------- degrade / rekey ----------------------------

test('degradeWalls drops a key with no matching room edge', () => {
  const rooms = [{ id: 'r1', poly: [[0, 0], [1, 0], [1, 1], [0, 1]] }];
  const live = wallKey([0, 0], [1, 0], pitch);
  const walls = [
    { key: live, cm: 15 },
    { key: '0.00,0.00@9.9999', cm: 10 },
  ];
  const kept = degradeWalls(walls, rooms, pitch);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].key, live);
});

test('degradeWalls keeps an exact maximal run even when another breakpoint subdivides it', () => {
  const rooms = [{ id: 'r1', poly: [[0, 0], [1, 0], [1, 1], [0, 1]] }];
  const walls = setWallThickness([], [0, 0], [0.4, 0], 18, pitch);
  const kept = degradeWalls(walls, rooms, pitch);
  assert.equal(kept.length, 1);
  assert.deepEqual(kept[0].a, [0, 0]);
  assert.deepEqual(kept[0].b, [0.4, 0]);
});

test('rekeyWallsAfterMove rewrites the key when a span shifts by one cell', () => {
  const oldA = [0.1, 0.2], oldB = [0.4, 0.2];
  const newA = [0.1, 0.2 + pitch], newB = [0.4, 0.2 + pitch];
  const walls = [{ key: wallKey(oldA, oldB, pitch), cm: 18 }];
  const next = rekeyWallsAfterMove(walls, [[oldA, oldB]], [[newA, newB]], pitch);
  assert.equal(next.length, 1);
  assert.equal(next[0].key, wallKey(newA, newB, pitch));
  assert.equal(next[0].cm, 18);
});

test('rekeyWallsAfterMove carries atomic remainders of a partially virtual wall', () => {
  const oldA = [0.5, 0.1], oldB = [0.5, 0.7];
  const newA = [0.6, 0.1], newB = [0.6, 0.7];
  const walls = [
    { key: wallKey([0.5, 0.1], [0.5, 0.3], pitch), cm: 20 },
    { key: wallKey([0.5, 0.5], [0.5, 0.7], pitch), cm: 25 },
  ];
  const next = rekeyWallsAfterMove(walls, [[oldA, oldB]], [[newA, newB]], pitch);
  assert.deepEqual(next, [
    { key: wallKey([0.6, 0.1], [0.6, 0.3], pitch), cm: 20 },
    { key: wallKey([0.6, 0.5], [0.6, 0.7], pitch), cm: 25 },
  ]);
});

test('rekeyWallsAfterMove carries exact interval endpoints with the wall', () => {
  const oldA = [0.2, 0.1], oldB = [0.2, 0.4];
  const newA = [0.3, 0.1], newB = [0.3, 0.4];
  const walls = setWallThickness([], oldA, oldB, 22, pitch);
  const next = rekeyWallsAfterMove(walls, [[oldA, oldB]], [[newA, newB]], pitch);
  assert.equal(next[0].key, wallKey(newA, newB, pitch));
  assert.deepEqual(next[0].a, newA);
  assert.deepEqual(next[0].b, newB);
});

const issue253SpanSet = (spans) => spans
  .map(([a, b]) => [a, b].map((point) => point.map((value) => Number(value.toFixed(9)))))
  .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));

test('issue 253 splits a longer exact wall and moves only the covered interval', () => {
  const wallA = [0.070833333, 0.4375], wallB = [0.420833333, 0.4375];
  const oldA = [0.070833333, 0.4375], oldB = [0.204166667, 0.4375];
  const newA = [0.070833333, 0.4625], newB = [0.204166667, 0.4625];
  const walls = setWallThickness([], wallA, wallB, 33, pitch);
  const next = rekeyWallsAfterMove(walls, [[oldA, oldB]], [[newA, newB]], pitch);
  assert.deepEqual(next.map((wall) => wall.cm), [33, 33]);
  assert.deepEqual(issue253SpanSet(next.map((wall) => [wall.a, wall.b])), issue253SpanSet([
    [newA, newB],
    [[0.204166667, 0.4375], wallB],
  ]));
  assert.deepEqual(checkWallRecordsPreserved(walls, next), []);
});

test('issue 253 interval partition is orientation and axis independent', () => {
  const cases = [
    {
      wall: [[1, 0], [0, 0]], old: [[0.2, 0], [0.6, 0]], next: [[0.2, 1], [0.6, 1]],
      want: [[[0, 0], [0.2, 0]], [[0.2, 1], [0.6, 1]], [[0.6, 0], [1, 0]]],
    },
    {
      wall: [[0, 0], [0, 1]], old: [[0, 0.25], [0, 0.75]], next: [[1, 0.25], [1, 0.75]],
      want: [[[0, 0], [0, 0.25]], [[1, 0.25], [1, 0.75]], [[0, 0.75], [0, 1]]],
    },
    {
      wall: [[0, 0], [1, 1]], old: [[0.25, 0.25], [0.75, 0.75]],
      next: [[0.25, 0.5], [0.75, 1]],
      want: [[[0, 0], [0.25, 0.25]], [[0.25, 0.5], [0.75, 1]], [[0.75, 0.75], [1, 1]]],
    },
  ];
  for (const entry of cases) {
    const walls = setWallThickness([], entry.wall[0], entry.wall[1], 18, pitch);
    const next = rekeyWallsAfterMove(walls, [entry.old], [entry.next], pitch);
    assert.deepEqual(issue253SpanSet(next.map((wall) => [wall.a, wall.b])), issue253SpanSet(entry.want));
  }
});

test('issue 253 maps a covered interval through scale and rotation', () => {
  const walls = setWallThickness([], [0.25, 0], [0.75, 0], 24, pitch);
  const next = rekeyWallsAfterMove(
    walls,
    [[[0, 0], [1, 0]]],
    [[[0, 0], [2, 1]]],
    pitch,
  );
  assert.deepEqual(issue253SpanSet(next.map((wall) => [wall.a, wall.b])), issue253SpanSet([
    [[0.5, 0.25], [1.5, 0.75]],
  ]));
  assert.equal(next[0].cm, 24);
});

test('issue 253 unchanged context edges preserve the wall array semantically', () => {
  const walls = [{ key: 'legacy', cm: 19 }, ...setWallThickness([], [1, 0], [0, 0], 21, pitch)];
  const next = rekeyWallsAfterMove(walls, [[[0, 0], [1, 0]]], [[[0, 0], [1, 0]]], pitch);
  assert.deepEqual(next, walls);
  assert.notEqual(next, walls);
});

test('issue 253 equivalent shared-room transforms apply once and conflicts fail closed', () => {
  const wall = setWallThickness([], [0, 0], [1, 0], 20, pitch);
  const old = [[0, 0], [1, 0]];
  const moved = [[0, 1], [1, 1]];
  const equivalent = rekeyWallsAfterMove(wall, [old, old], [moved, moved], pitch);
  assert.equal(equivalent.length, 1);
  assert.deepEqual([equivalent[0].a, equivalent[0].b], moved);

  const conflictA = rekeyWallsAfterMove(wall, [old, old], [moved, [[0, 2], [1, 2]]], pitch);
  const conflictB = rekeyWallsAfterMove(wall, [old, old], [[[0, 2], [1, 2]], moved], pitch);
  assert.deepEqual(conflictA, conflictB, 'array order cannot choose a room transform');
  assert.deepEqual([conflictA[0].a, conflictA[0].b], old);
});

test('issue 253 key collisions never erase different exact or legacy records', () => {
  const exact = [
    { key: wallKey([-1, 0], [1, 0], pitch), cm: 20, a: [-1, 0], b: [1, 0] },
    { key: wallKey([-0.5, 0], [0.5, 0], pitch), cm: 30, a: [-0.5, 0], b: [0.5, 0] },
  ];
  assert.equal(exact[0].key, exact[1].key, 'fixture must exercise one compatibility key');
  const exactNext = rekeyWallsAfterMove(exact, [[[2, 0], [3, 0]]], [[[2, 1], [3, 1]]], pitch);
  assert.equal(exactNext.length, 2);
  assert.deepEqual(exactNext.map((wall) => wall.cm), [20, 30]);

  const legacy = exact.map(({ key, cm }) => ({ key, cm }));
  const legacyNext = rekeyWallsAfterMove(legacy, [[[2, 0], [3, 0]]], [[[2, 1], [3, 1]]], pitch);
  assert.equal(legacyNext.length, 2);
  assert.deepEqual(legacyNext.map((wall) => wall.cm), [20, 30]);
});

test('issue 253 deduplicates only identical exact geometry with identical thickness', () => {
  const a = [0, 0], b = [1, 0];
  const same = [
    { key: wallKey(a, b, pitch), cm: 20, a, b },
    { key: wallKey(b, a, pitch), cm: 20, a: b, b: a },
    { key: wallKey(a, b, pitch), cm: 30, a, b },
  ];
  const next = rekeyWallsAfterMove(same, [[[2, 0], [3, 0]]], [[[2, 1], [3, 1]]], pitch);
  assert.equal(next.length, 2);
  assert.deepEqual(next.map((wall) => wall.cm), [20, 30]);
});

test('issue 253 does not truncate a lossless split at the backend 500-record boundary', () => {
  const walls = Array.from({ length: 500 }, (_, index) => {
    const y = index * 2;
    return { key: wallKey([0, y], [1, y], pitch), cm: 20, a: [0, y], b: [1, y] };
  });
  const next = rekeyWallsAfterMove(
    walls,
    [[[0.25, 0], [0.75, 0]]],
    [[[0.25, 1], [0.75, 1]]],
    pitch,
  );
  assert.equal(next.length, 502, 'frontend must preserve every atom; backend may reject atomically');
  assert.equal(next.filter((wall) => wall.cm === 20).length, 502);
});

test('setWallThickness upserts and removes', () => {
  const a = [0, 0], b = [1, 0];
  let walls = setWallThickness([], a, b, 12, pitch);
  assert.equal(walls.length, 1);
  walls = setWallThickness(walls, a, b, 30, pitch);
  assert.equal(walls[0].cm, 30);
  walls = setWallThickness(walls, a, b, null, pitch);
  assert.equal(walls.length, 0);
});

test('setWallThicknessForRoom skips open cuts', () => {
  const room = { id: 'r', poly: [[0, 0], [1, 0], [1, 1], [0, 1]] };
  const open = [[0, 0, 1, 0]];
  const walls = setWallThicknessForRoom([], [room], 'r', 20, pitch, open);
  // three edges get thickness; the open bottom does not
  assert.equal(walls.length, 3);
  assert.equal(thicknessCmAt(walls, [0, 0], [1, 0], pitch), 0);
  assert.equal(thicknessCmAt(walls, [1, 0], [1, 1], pitch), 20);
});

// ---------------------- atomic intervals (AUD-159B6-01) ---------------------

// A's right edge runs y=0..10, B only touches y=0..4: thickness set on that
// shared stretch used to be reported for the whole 10-long edge, so the outer
// remainder silently grew a wall the user never asked for.
const partialRooms = () => ([
  { id: 'a', poly: [[0, 0], [5, 0], [5, 10], [0, 10]] },
  { id: 'b', poly: [[5, 0], [10, 0], [10, 4], [5, 4]] },
]);

test('partial shared wall: an edge is split at the shared boundary end', () => {
  const at = atomicPolyForRoom(partialRooms(), 'a', [], pitch);
  assert.ok(at);
  assert.equal(at.poly.length, 5, JSON.stringify(at.poly));
  assert.ok(at.poly.some((p) => Math.abs(p[0] - 5) < 1e-9 && Math.abs(p[1] - 4) < 1e-9));
});

test('partial shared wall: thickness stays on its own interval', () => {
  const rooms = partialRooms();
  const walls = [{ key: wallKey([5, 0], [5, 4], pitch), cm: 30 }];
  const kinds = edgeKinds(rooms, 'a', [], pitch);
  const offs = insetOffsetsForRoom(rooms, 'a', walls, [], pitch, cellCm, pitch);
  const ivs = wallIntervals(rooms, walls, [], pitch, cellCm, pitch)
    .filter((iv) => iv.roomId === 'a' && Math.abs(iv.a[0] - 5) < 1e-9 && Math.abs(iv.b[0] - 5) < 1e-9);
  const shared = ivs.find((iv) => iv.kind === 'shared');
  const outer = ivs.find((iv) => iv.kind === 'outer');
  assert.equal(shared?.cm, 30);
  assert.equal(outer?.cm, 0, 'thickness must not leak past the shared stretch');
  assert.equal(kinds.filter((k) => k === 'shared').length, 1);
  assert.equal(offs.filter((o) => o > 0).length, 1);
});

test('partial shared wall: a pre-atomic whole-edge key still covers both pieces', () => {
  const rooms = partialRooms();
  // written before the split: the key names the WHOLE right edge (mid y=5)
  const walls = [{ key: wallKey([5, 0], [5, 10], pitch), cm: 30 }];
  const ivs = wallIntervals(rooms, walls, [], pitch, cellCm, pitch)
    .filter((iv) => iv.roomId === 'a' && Math.abs(iv.a[0] - 5) < 1e-9 && Math.abs(iv.b[0] - 5) < 1e-9);
  assert.equal(ivs.length, 2);
  assert.ok(ivs.every((iv) => iv.cm === 30), 'an existing plan must not lose thickness');
});

test('a compacted exact wall covers a shorter collinear side in another room', () => {
  const rooms = [
    { id: 'guest', poly: [[2, 2], [2, 6], [4, 6], [4, 2]] },
    { id: 'hall', poly: [[4, 2], [8, 2], [8, 11], [4, 11]] },
  ];
  // Production T-junction: a long vertical real wall crosses the guest-room
  // corner while a horizontal virtual wall starts at that same node. The
  // compacted wall midpoint (4, 6.5) lies outside the shorter guest side, but
  // its exact endpoints cover that side completely.
  const walls = setWallThickness([], [4, 2], [4, 11], 15, pitch);
  const open = [[4, 2, 8, 2]];
  const right = wallIntervals(rooms, walls, open, pitch, cellCm, GRID_PITCH)
    .find((iv) => iv.roomId === 'guest'
      && Math.abs(iv.a[0] - 4) < 1e-9 && Math.abs(iv.b[0] - 4) < 1e-9);
  assert.equal(right?.cm, 15);
  assert.ok(right && right.half > 0, 'hover/body profile must use the real inner face');
});

test('equal solid atomic pieces compact back to one whole-wall key', () => {
  const rooms = partialRooms();
  const walls = [
    { key: wallKey([5, 0], [5, 4], pitch), cm: 30 },
    { key: wallKey([5, 4], [5, 10], pitch), cm: 30 },
  ];
  const next = normalizeWallIntervals(rooms, walls, [], pitch, cellCm, GRID_PITCH);
  assert.equal(next.length, 1);
  assert.equal(next[0].key, wallKey([5, 0], [5, 10], pitch));
  assert.equal(next[0].cm, 30);
  assert.deepEqual(next[0].a, [5, 0]);
  assert.deepEqual(next[0].b, [5, 10]);
});

test('different solid thicknesses remain separate atomic keys', () => {
  const rooms = partialRooms();
  const walls = [
    { key: wallKey([5, 0], [5, 4], pitch), cm: 30 },
    { key: wallKey([5, 4], [5, 10], pitch), cm: 20 },
  ];
  const next = normalizeWallIntervals(rooms, walls, [], pitch, cellCm, GRID_PITCH);
  assert.equal(next.length, 2);
  assert.deepEqual(new Set(next.map((w) => w.cm)), new Set([20, 30]));
  assert.ok(!next.some((w) => w.key === wallKey([5, 0], [5, 10], pitch)));
});

test('lossless wall helpers preserve an isolated sub-half-step thickness island outside Optimize', () => {
  const y = 0.2, split = 0.5, length = pitch / 3;
  const rooms = [{ id: 'r1', poly: [[0.2, y], [0.8, y], [0.8, 0.8], [0.2, 0.8]] }];
  const walls = [
    { key: wallKey([0.2, y], [split, y], pitch), a: [0.2, y], b: [split, y], cm: 22 },
    { key: wallKey([split, y], [split + length, y], pitch),
      a: [split, y], b: [split + length, y], cm: 15 },
    { key: wallKey([split + length, y], [0.8, y], pitch),
      a: [split + length, y], b: [0.8, y], cm: 22 },
  ];
  const before = structuredClone(walls);
  const byKey = (entries) => structuredClone(entries)
    .sort((left, right) => left.key.localeCompare(right.key));

  const normalized = normalizeWallIntervals(rooms, walls, [], pitch, cellCm, GRID_PITCH);
  const degraded = degradeWalls(walls, rooms, pitch);
  assert.deepEqual(byKey(normalized), byKey(before), 'runtime/editor normalization remains lossless');
  assert.deepEqual(byKey(degraded), byKey(before), 'runtime/editor degradation must not infer island removal');
  assert.deepEqual(walls, before, 'direct lossless helpers must not mutate persisted input');
});

test('closing the sole geometric split preserves different thicknesses', () => {
  const rooms = [
    { id: 'a', poly: [[0, 0], [5, 0], [5, 10], [0, 10]] },
    { id: 'b', poly: [[5, 0], [10, 0], [10, 10], [5, 10]] },
  ];
  // No neighbour endpoint and no open cut remains at y=4. Exact endpoints in
  // new wall entries are therefore the only record of this intentional break.
  let walls = setWallThickness([], [5, 0], [5, 4], 20, pitch);
  walls = setWallThickness(walls, [5, 4], [5, 10], 30, pitch);
  const next = normalizeWallIntervals(rooms, walls, [], pitch, cellCm, GRID_PITCH);
  assert.equal(next.length, 2);
  assert.deepEqual(new Set(next.map((w) => w.cm)), new Set([20, 30]));
  assert.ok(next.some((w) => w.a?.[1] === 4 || w.b?.[1] === 4));
});

test('exact endpoints do not prevent equal closed pieces from compacting', () => {
  const rooms = [
    { id: 'a', poly: [[0, 0], [5, 0], [5, 10], [0, 10]] },
    { id: 'b', poly: [[5, 0], [10, 0], [10, 10], [5, 10]] },
  ];
  let walls = setWallThickness([], [5, 0], [5, 4], 20, pitch);
  walls = setWallThickness(walls, [5, 4], [5, 10], 20, pitch);
  const next = normalizeWallIntervals(rooms, walls, [], pitch, cellCm, GRID_PITCH);
  assert.equal(next.length, 1);
  assert.equal(next[0].key, wallKey([5, 0], [5, 10], pitch));
});

// An open span that does NOT contain the parent edge's midpoint used to leave
// the key in place, so the wall body stayed solid straight across the passage.
test('open span away from the edge midpoint clears only its own interval', () => {
  const scale = 1000;
  const p = 1 / 240;
  const rooms = [
    { id: 'a', poly: [[100, 140], [300, 140], [300, 460], [100, 460]] },
    { id: 'b', poly: [[300, 140], [500, 140], [500, 460], [300, 460]] },
  ];
  const walls = [{ key: wallKey([300 / scale, 140 / scale], [300 / scale, 460 / scale], p), cm: 30 }];
  const cut = [[300, 150, 300, 220]];
  const full = wallBodiesUnionPath(rooms, walls, [], [], p, cellCm, GRID_PITCH, scale);
  const opened = wallBodiesUnionPath(rooms, walls, cut, [], p, cellCm, GRID_PITCH, scale);
  assert.ok(full && opened);
  assert.notEqual(full.d, opened.d, 'the wall body must open under the span');

  const next = normalizeWallIntervals(rooms, walls, cut, p, cellCm, GRID_PITCH, scale);
  assert.equal(intervalCmAt(rooms, next, cut, [300, 150, 300, 220], p, cellCm, GRID_PITCH, scale), 0);
  assert.equal(intervalCmAt(rooms, next, cut, [300, 220, 300, 460], p, cellCm, GRID_PITCH, scale), 30);
  assert.equal(intervalCmAt(rooms, next, cut, [300, 140, 300, 150], p, cellCm, GRID_PITCH, scale), 30);
});

// ------------------------------- inset --------------------------------------

test('insetContour: rectangle inset by half-thickness on every side', () => {
  const poly = [[0, 0], [10, 0], [10, 6], [0, 6]];
  const inset = insetContour(poly, [1, 1, 1, 1]);
  assert.ok(inset && inset.length >= 4);
  // area of a 10×6 rect inset by 1 → 8×4 = 32
  closeTo(polygonArea(inset), 32, 0.05);
});

test('insetContour: one thick edge among thin ones', () => {
  const poly = [[0, 0], [10, 0], [10, 6], [0, 6]];
  // only bottom edge (i=0) has offset 2
  const inset = insetContour(poly, [2, 0, 0, 0]);
  assert.ok(inset);
  // bottom moves up; area shrinks by roughly 2×10 = 20
  assert.ok(polygonArea(inset) < polygonArea(poly) - 15);
});

test('insetContour: L-shape stays a simple polygon', () => {
  const poly = [[0, 0], [6, 0], [6, 2], [2, 2], [2, 6], [0, 6]];
  const inset = insetContour(poly, [0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
  assert.ok(inset && inset.length >= 6);
  assert.ok(polygonArea(inset) < polygonArea(poly));
  assert.ok(polygonArea(inset) > 0);
});

test('insetContour: acute corner falls back to a bevel (no infinite spike)', () => {
  // very sharp tip at the origin
  const poly = [[0, 0], [10, 0.3], [10, 0], [0, 0]];
  // degenerate — use a proper acute triangle
  const sharp = [[0, 0], [10, 1], [10, -1]];
  const offsets = [1, 1, 1];
  const inset = insetContour(sharp, offsets);
  assert.ok(inset);
  for (const p of inset) {
    const dist = Math.hypot(p[0], p[1]);
    // no vertex may fly farther than MITRE_LIMIT × thickness from origin-ish
    assert.ok(dist < 10 + MITRE_LIMIT * 1 + 1, `spike at ${p}`);
  }
});

test('variable-offset contours keep a local cap at angled positive-to-zero joins', () => {
  const poly = [[0, 0], [10, 0], [20, 0.1], [20, 10], [0, 10]];
  const vertex = poly[1];
  const hasPoint = (contour, point) => contour.some((candidate) => (
    Math.hypot(candidate[0] - point[0], candidate[1] - point[1]) <= 1e-9
  ));

  for (const offsets of [[2, 0, 0, 0, 0], [0, 2, 0, 0, 0]]) {
    const inset = insetContour(poly, offsets);
    const outset = outsetContour(poly, offsets);
    assert.ok(inset && outset);
    assert.ok(hasPoint(inset, vertex), `inset lost the zero-edge vertex: ${JSON.stringify(offsets)}`);
    assert.ok(hasPoint(outset, vertex), `outset lost the zero-edge vertex: ${JSON.stringify(offsets)}`);
    assert.ok(
      inset.some((point) => {
        const distance = Math.hypot(point[0] - vertex[0], point[1] - vertex[1]);
        return distance > 1 && distance < 3;
      }),
      'inset must also retain the physical edge offset point',
    );
    assert.ok(
      outset.some((point) => {
        const distance = Math.hypot(point[0] - vertex[0], point[1] - vertex[1]);
        return distance > 1 && distance < 3;
      }),
      'outset must also retain the physical edge offset point',
    );
  }
});

test('issue #249 bounds the exported three-wall junction with straight bevels', () => {
  const fixture = JSON.parse(readFileSync(
    new URL('./fixtures/249-multiwall-junction.json', import.meta.url), 'utf8',
  ));
  const rooms = fixture.rooms.map((room) => ({
    ...room,
    poly: room.poly.map(([x, y]) => [x * NORM_W, y * NORM_W]),
  }));
  const walls = structuredClone(fixture.walls);
  const nodePoint = fixture.node.map((value) => value * NORM_W);
  const before = JSON.stringify({ rooms, walls });
  const intervals = wallIntervals(
    rooms, walls, [], pitch, fixture.cell_cm, GRID_PITCH, NORM_W,
  );
  const nodes = buildMultiWallNodeMap(
    intervals, pitch * NORM_W * 0.04 * 4,
    NORM_W,
  );
  const node = nodes.nodes.find((candidate) =>
    Math.hypot(
      candidate.point[0] - nodePoint[0],
      candidate.point[1] - nodePoint[1],
    ) < 1e-6);
  assert.ok(node);
  assert.equal(node.rays.length, 3);
  closeTo(node.halfDepth, 4.861111111111112, 1e-9);
  closeTo(node.limit, MULTI_WALL_JOIN_LIMIT * node.halfDepth, 1e-9);

  const localTriangles = multiWallBevelTriangles(nodes).filter((triangle) =>
    Math.hypot(
      triangle[0][0] - nodePoint[0],
      triangle[0][1] - nodePoint[1],
    ) < node.limit + 1e-6);
  assert.equal(localTriangles.length, 2, 'fixture must exercise both oversized wedges');
  for (const triangle of localTriangles) {
    for (const point of triangle.slice(0, 2)) {
      assert.ok(
        Math.hypot(point[0] - nodePoint[0], point[1] - nodePoint[1])
          <= node.limit + 1e-7,
        `bevel endpoint escaped the approved radius: ${point}`,
      );
    }
    assert.ok(
      Math.hypot(
        triangle[2][0] - nodePoint[0],
        triangle[2][1] - nodePoint[1],
      ) > node.limit,
      'fixture no longer contains the excessive mitre being removed',
    );
  }

  const geometry = wallBodiesGeometry(
    rooms, walls, [], [], pitch, fixture.cell_cm, GRID_PITCH, NORM_W,
  );
  assert.ok(geometry);
  assert.equal(geometry.geom.length, 1, 'the three wall arms became disconnected');
  assertProbeInside(geometry.geom, nodePoint, 'the bevel punched a hole at the node');
  for (const ray of node.rays) {
    assertProbeInside(geometry.geom, [
      nodePoint[0] + ray.u[0] * node.halfDepth * 2,
      nodePoint[1] + ray.u[1] * node.halfDepth * 2,
    ], 'an incident wall arm no longer touches the junction');
  }
  for (const triangle of localTriangles) {
    const base = [
      (triangle[0][0] + triangle[1][0]) / 2,
      (triangle[0][1] + triangle[1][1]) / 2,
    ];
    assertProbeOutside(geometry.geom, [
      (base[0] + triangle[2][0]) / 2,
      (base[1] + triangle[2][1]) / 2,
    ], 'the discarded mitre wedge is still filled');
  }
  const repeated = wallBodiesGeometry(
    rooms, walls, [], [], pitch, fixture.cell_cm, GRID_PITCH, NORM_W,
  );
  assert.ok(repeated);
  closeTo(geometryDifferenceArea(geometry.geom, repeated.geom), 0, 1e-7);
  closeTo(geometryDifferenceArea(repeated.geom, geometry.geom), 0, 1e-7);
  assert.equal(JSON.stringify({ rooms, walls }), before, 'geometry mutated saved data');
});

test('issue #249 node classification is order, direction and scale independent', () => {
  const cases = [
    { angles: [0, 30, 200], halves: [5, 5, 5], bevel: true },
    { angles: [45, 102, 230], halves: [7, 5, 5], bevel: true },
    { angles: [45, 102, 230], halves: [1.5, 5, 7], bevel: true },
    { angles: [0, 90, 180, 270], halves: [5, 5, 5, 5], bevel: true },
    { angles: [0, 90, 180, 270], halves: [2, 5, 3, 7], bevel: false },
  ];
  const make = ({ angles, halves }, scale = 1) => angles.map((degrees, index) => {
    const radians = degrees * Math.PI / 180;
    return {
      roomId: `r${index}`,
      a: [0, 0],
      b: [Math.cos(radians) * 100 * scale, Math.sin(radians) * 100 * scale],
      key: `ray-${index}`,
      kind: 'outer',
      cm: halves[index] * 2,
      open: false,
      half: halves[index] * scale,
    };
  });
  const signature = (map, scale) => map.nodes.map((node) => ({
    point: node.point.map((value) => value / scale),
    halfDepth: node.halfDepth / scale,
    limit: node.limit / scale,
    rays: node.rays.map((ray) => [
      Math.round(ray.u[0] * 1e9) / 1e9,
      Math.round(ray.u[1] * 1e9) / 1e9,
      ray.halfDepth / scale,
    ]),
  }));
  const makeFanGeometry = (fixture, permuted = false) => {
    const scale = NORM_W;
    const node = [0.5 * scale, 0.5 * scale];
    const points = fixture.angles.map((degrees) => {
      const radians = degrees * Math.PI / 180;
      return [
        node[0] + Math.cos(radians) * 0.3 * scale,
        node[1] + Math.sin(radians) * 0.3 * scale,
      ];
    });
    let rooms = points.map((point, index) => ({
      id: `fan-${index}`,
      poly: [node, point, points[(index + 1) % points.length]].map((p) => [...p]),
    }));
    let walls = [];
    for (let index = 0; index < points.length; index++) {
      walls = setWallThickness(
        walls, node, points[index], fixture.halves[index] * 10, pitch, scale,
      );
    }
    if (permuted) {
      rooms = rooms.reverse().map((room) => ({
        ...room, poly: [...room.poly].reverse(),
      }));
      walls = walls.reverse();
    }
    const geometry = wallBodiesGeometry(
      rooms, walls, [], [], pitch, cellCm, GRID_PITCH, scale,
    );
    assert.ok(geometry, 'multi-wall fan geometry failed');
    return { rooms, walls, geometry, node, scale };
  };

  for (const fixture of cases) {
    const source = make(fixture);
    const baseline = buildMultiWallNodeMap(source, 1e-6);
    assert.equal(baseline.nodes.length, 1);
    assert.equal(baseline.nodes[0].rays.length, fixture.angles.length);
    closeTo(
      baseline.nodes[0].limit,
      MULTI_WALL_JOIN_LIMIT * Math.max(...fixture.halves),
      1e-9,
    );
    const permuted = buildMultiWallNodeMap(
      [...source].reverse().map((interval) => ({
        ...interval,
        a: [...interval.b],
        b: [...interval.a],
      })),
      1e-6,
    );
    assert.deepEqual(signature(permuted, 1), signature(baseline, 1));

    const production = buildMultiWallNodeMap(make(fixture, 1000), 1e-3, 1000);
    assert.deepEqual(signature(production, 1000), signature(baseline, 1));
    assert.equal(multiWallBevelTriangles(baseline).length > 0, fixture.bevel);

    const fan = makeFanGeometry(fixture);
    const fanMap = buildMultiWallNodeMap(
      wallIntervals(
        fan.rooms, fan.walls, [], pitch, cellCm, GRID_PITCH, fan.scale,
      ),
      pitch * fan.scale * 0.04 * 4,
      fan.scale,
    );
    assert.equal(fanMap.nodes.length, 1);
    assert.equal(fanMap.nodes[0].rays.length, fixture.angles.length);
    assert.equal(
      fan.geometry.geom.length,
      1,
      `fan ${fixture.angles.join('/')} halves ${fixture.halves.join('/')} wall arms are disconnected`,
    );
    assertProbeInside(fan.geometry.geom, fan.node, 'fan bevel punched a node hole');
    for (const [rayIndex, ray] of fanMap.nodes[0].rays.entries()) {
      const armPoint = [
        fan.node[0] + ray.u[0] * fanMap.nodes[0].halfDepth * 2,
        fan.node[1] + ray.u[1] * fanMap.nodes[0].halfDepth * 2,
      ];
      const coverage = geometryProbeCoverage(fan.geometry.geom, armPoint);
      // A straight bevel may legitimately remove the sector-side half of an
      // acute arm close to the node; positive masonry on the centreline plus
      // the single-component assertion is the required connectivity contract.
      assert.ok(coverage > 0.1,
        `fan ${fixture.angles.join('/')} ray ${rayIndex} at ${armPoint} coverage=${coverage}`);
    }
    if (multiWallBevelTriangles(fanMap).length) {
      assertBoundedMultiWallBevels(
        fan.rooms, fan.walls, fan.geometry, cellCm, fan.scale,
      );
    }
    const permutedFan = makeFanGeometry(fixture, true);
    closeTo(geometryDifferenceArea(fan.geometry.geom, permutedFan.geometry.geom), 0, 1e-6);
    closeTo(geometryDifferenceArea(permutedFan.geometry.geom, fan.geometry.geom), 0, 1e-6);
  }

  const twoRay = make({ angles: [0, 55], halves: [5, 7] });
  const twoRayMap = buildMultiWallNodeMap(twoRay, 1e-6);
  assert.equal(twoRayMap.nodes.length, 0);
  const poly = [[0, 0], [10, 0], [8, 9], [0, 8]];
  const offsets = [2, 2, 2, 2];
  assert.deepEqual(insetContour(poly, offsets, twoRayMap), insetContour(poly, offsets));
  assert.deepEqual(outsetContour(poly, offsets, twoRayMap), outsetContour(poly, offsets));
});

test('inwardNormal points into the rectangle', () => {
  const poly = [[0, 0], [10, 0], [10, 6], [0, 6]];
  const [nx, ny] = inwardNormal(poly, 0); // bottom edge → should point +y
  assert.ok(ny > 0.5, `expected +y inward, got ${nx},${ny}`);
});

test('opening face side is known without wall thickness and can be inverted for an outward gate', () => {
  const rooms = [{ id: 'r', poly: [[0, 0], [10, 0], [10, 6], [0, 6]] }];
  const topInner = openingInnerFaceOffset(
    rooms, { x: 5, y: 0, angle: 0, length: 3 }, [], 1, cellCm, pitch,
  );
  assert.equal(topInner.cm, 0);
  assert.equal(topInner.side, 1, 'the top wall room side is +Y');
  const topOuter = openingInnerFaceOffset(
    rooms, { x: 5, y: 0, angle: 0, length: 3, flip_v: true }, [], 1, cellCm, pitch,
  );
  assert.equal(topOuter.side, -1, 'inverting the selected face points outside the room');
  const bottomInner = openingInnerFaceOffset(
    rooms, { x: 5, y: 6, angle: 0, length: 3 }, [], 1, cellCm, pitch,
  );
  assert.equal(bottomInner.side, -1, 'the bottom wall room side is -Y');
});

test('opening face is independent of room order on an ambiguous shared wall', () => {
  const rooms = [
    { id: 'large-first', poly: [[0, 0], [10, 0], [10, 8], [0, 8]] },
    { id: 'small-second', poly: [[3, 8], [7, 8], [7, 11], [3, 11]] },
  ];
  const opening = { x: 5, y: 8, angle: 0, length: 2 };
  const natural = openingInnerFaceOffset(rooms, opening, [], pitch, cellCm, pitch);
  const flipped = openingInnerFaceOffset(rooms, { ...opening, flip_v: true }, [], pitch, cellCm, pitch);
  const reversed = openingInnerFaceOffset([...rooms].reverse(), opening, [], pitch, cellCm, pitch);
  const reversedFlip = openingInnerFaceOffset(
    [...rooms].reverse(), { ...opening, flip_v: true }, [], pitch, cellCm, pitch,
  );
  assert.equal(natural.side, -1, 'shared walls use the canonical local negative side');
  assert.equal(flipped.side, 1, 'flip_v selects the opposite canonical side');
  assert.deepEqual(reversed, natural);
  assert.deepEqual(reversedFlip, flipped);
});

test('openingTunnelGeometry: an outer thick wall gives the one room both tunnel halves', () => {
  const rooms = [{ id: 'r', poly: [[0, 0], [10, 0], [10, 6], [0, 6]] }];
  const walls = [{ key: wallKey([0, 0], [10, 0], pitch), cm: 20 }];
  const g = openingTunnelGeometry(
    rooms, { x: 5, y: 0, angle: 0, length: 2 }, walls, [], pitch, 5, 1,
  );
  assert.ok(g);
  assert.deepEqual(g.faces.map((f) => [f.side, f.roomId]), [[-1, 'r'], [1, 'r']]);
  closeTo(g.minY, -2);
  closeTo(g.maxY, 2);
  assert.match(g.faces[0].d, / 0\.5\b/, 'the negative face overlaps the axis by a raster-safe amount');
  assert.match(g.faces[1].d, / -0\.5\b/, 'the positive face overlaps the axis symmetrically');
});

test('openingTunnelGeometry: a 45° wall keeps the opening-local width and physical depth', () => {
  const rooms = [{ id: 'diagonal', poly: [[0, 0], [10, 10], [0, 20]] }];
  const walls = [{ key: wallKey([0, 0], [10, 10], pitch), cm: 20 }];
  const g = openingTunnelGeometry(
    rooms, { x: 5, y: 5, angle: 45, length: 4 }, walls, [], pitch, 5, 1,
  );
  assert.ok(g);
  closeTo(g.minY, -2);
  closeTo(g.maxY, 2);
  const positive = g.faces.find((face) => face.side === 1);
  assert.match(positive.d, /M -2(?:\.\d+)? /);
  assert.match(positive.d, /L 2(?:\.\d+)? /);
});

test('openingTunnelGeometry: a shared wall is owned by the room on each local side', () => {
  const rooms = [
    { id: 'south', poly: [[0, 0], [10, 0], [10, 5], [0, 5]] },
    { id: 'north', poly: [[0, -5], [10, -5], [10, 0], [0, 0]] },
  ];
  const walls = [{ key: wallKey([0, 0], [10, 0], pitch), cm: 15 }];
  const g = openingTunnelGeometry(
    rooms, { x: 5, y: 0, angle: 0, length: 2 }, walls, [], pitch, 5, 1,
  );
  assert.ok(g);
  assert.equal(g.faces.find((f) => f.side === -1).roomId, 'north');
  assert.equal(g.faces.find((f) => f.side === 1).roomId, 'south');
  const reversed = openingTunnelGeometry(
    [...rooms].reverse(), { x: 5, y: 0, angle: 0, length: 2 }, walls, [], pitch, 5, 1,
  );
  assert.deepEqual(reversed, g, 'config order must not change the selected rooms or paths');
});

test('openingTunnelGeometry: mixed atomic thickness clips each piece to its real depth', () => {
  const rooms = [{ id: 'r', poly: [[0, 0], [10, 0], [10, 6], [0, 6]] }];
  const walls = [
    { key: wallKey([0, 0], [5, 0], pitch), a: [0, 0], b: [5, 0], cm: 10 },
    { key: wallKey([5, 0], [10, 0], pitch), a: [5, 0], b: [10, 0], cm: 20 },
  ];
  const g = openingTunnelGeometry(
    rooms, { x: 5, y: 0, angle: 0, length: 4 }, walls, [], pitch, 5, 1,
  );
  assert.ok(g);
  assert.match(g.faces[0].d, /-1(?:\.0+)?\b/, '10 cm half-depth is present');
  assert.match(g.faces[0].d, /-2(?:\.0+)?\b/, '20 cm half-depth is present');
  for (const face of g.faces) {
    assert.equal((face.d.match(/\bM /g) || []).length, 1,
      'a thickness step is part of one outer contour, not two touching rectangles');
    assert.doesNotMatch(face.d, /-2\.02|2\.02/,
      'the contour does not overpaint past either physical jamb');
  }
  closeTo(g.maxY, 2);
});

test('openingTunnelGeometry: overlapping wall pieces use their physical union depth', () => {
  const path = tunnelFacePath(1, [
    { x0: -3, x1: 3, half: 1, cm: 10, key: 'shallow', axis: [1, 0] },
    { x0: -1, x1: 1, half: 2, cm: 20, key: 'deep', axis: [1, 0] },
  ]);
  assert.match(path, /L 1 2 L -1 2/,
    'the overlap must reach the deeper body instead of taking the minimum depth');
  assert.match(path, /L 3 1 L 1 1/,
    'the shallow shoulders remain part of the same non-overlapping contour');
});

test('openingTunnelGeometry: three stepped atomic strips form one non-overlapping contour', () => {
  const rooms = [{ id: 'r', poly: [[0, 0], [10, 0], [10, 6], [0, 6]] }];
  const walls = [
    { key: wallKey([0, 0], [3, 0], pitch), a: [0, 0], b: [3, 0], cm: 10 },
    { key: wallKey([3, 0], [5, 0], pitch), a: [3, 0], b: [5, 0], cm: 20 },
    { key: wallKey([5, 0], [7, 0], pitch), a: [5, 0], b: [7, 0], cm: 15 },
    { key: wallKey([7, 0], [10, 0], pitch), a: [7, 0], b: [10, 0], cm: 15 },
  ];
  const g = openingTunnelGeometry(
    rooms, { x: 5, y: 0, angle: 0, length: 6 }, walls, [], pitch, 5, 1,
  );
  assert.ok(g);
  const negative = g.faces.find((face) => face.side === -1);
  const positive = g.faces.find((face) => face.side === 1);
  assert.equal((negative.d.match(/\bM /g) || []).length, 1);
  assert.equal((positive.d.match(/\bM /g) || []).length, 1);
  assert.match(negative.d, /^M 3 0\.25 L -3 0\.25 /,
    'negative and positive faces use matching nonzero winding around the wall axis');
  assert.match(positive.d, /^M -3 -0\.25 L 3 -0\.25 /);
  assert.match(positive.d, /L -2 1 L -3 1 Z$/,
    'the one contour follows every real thickness step back to the first jamb');
});

test('openingTunnelGeometry: equal atomic strips collapse into one path without hairlines', () => {
  const rooms = [{ id: 'r', poly: [[0, 0], [10, 0], [10, 6], [0, 6]] }];
  const walls = [[0, 3], [3, 5], [5, 7], [7, 10]].map(([x0, x1]) => ({
    key: wallKey([x0, 0], [x1, 0], pitch), a: [x0, 0], b: [x1, 0], cm: 15,
  }));
  const g = openingTunnelGeometry(
    rooms, { x: 5, y: 0, angle: 0, length: 6 }, walls, [], pitch, 5, 1,
  );
  assert.ok(g);
  for (const face of g.faces) {
    assert.equal((face.d.match(/\bM /g) || []).length, 1,
      'one continuous wall face must not expose the three internal SVG strip edges');
  }
});

test('openingTunnelGeometry: virtual, zero-thickness, orphan and draft-only walls do not paint', () => {
  const rooms = [{ id: 'r', poly: [[0, 0], [10, 0], [10, 6], [0, 6]] }];
  const opening = { x: 5, y: 0, angle: 0, length: 2 };
  const walls = [{ key: wallKey([0, 0], [10, 0], pitch), cm: 20 }];
  assert.equal(openingTunnelGeometry(rooms, opening, [], [], pitch, 5, 1), null);
  assert.equal(openingTunnelGeometry(rooms, opening, walls, [[0, 0, 10, 0]], pitch, 5, 1), null);
  assert.equal(openingTunnelGeometry(rooms, { ...opening, y: 3 }, walls, [], pitch, 5, 1), null);
  assert.equal(openingTunnelGeometry([], opening, walls, [], pitch, 5, 1), null,
    'a physical room_draft body is not a room fill owner');
});

test('openingTunnelGeometry: angle match beats a perpendicular T-junction receiver', () => {
  const rooms = [
    { id: 'horizontal', poly: [[0, 0], [10, 0], [10, 5], [0, 5]] },
    { id: 'vertical', poly: [[4, -5], [6, -5], [6, 5], [4, 5]] },
  ];
  const walls = [
    { key: wallKey([0, 0], [10, 0], pitch), cm: 20 },
    { key: wallKey([4, -5], [4, 0], pitch), cm: 30 },
  ];
  const g = openingTunnelGeometry(
    rooms, { x: 5, y: 0, angle: 0, length: 2 }, walls, [], pitch, 5, 1,
  );
  assert.ok(g);
  assert.ok(g.faces.every((f) => f.roomId === 'horizontal'));
  closeTo(g.maxY, 2);
});

test('openingTunnelGeometry: a detached parallel room inside one cell cannot own a tunnel side', () => {
  const rooms = [
    { id: 'real', poly: [[0, 0], [10, 0], [10, 5], [0, 5]] },
    { id: 'air-gap', poly: [[0, -5.5], [10, -5.5], [10, -0.5], [0, -0.5]] },
  ];
  const walls = [
    { key: wallKey([0, 0], [10, 0], 1), cm: 20 },
    { key: wallKey([0, -0.5], [10, -0.5], 1), cm: 20 },
  ];
  const g = openingTunnelGeometry(
    rooms, { x: 5, y: 0, angle: 0, length: 2 }, walls, [], 1, 5, 1,
  );
  assert.ok(g);
  assert.ok(g.faces.every((face) => face.roomId === 'real'));
});

test('openingTunnelGeometry: the smaller coincident nested room wins after equal full/face distance', () => {
  const rooms = [
    { id: 'large', poly: [[0, 0], [10, 0], [10, 8], [0, 8]] },
    { id: 'small', poly: [[3, 0], [7, 0], [7, 3], [3, 3]] },
  ];
  const walls = [{ key: wallKey([0, 0], [10, 0], pitch), cm: 20 }];
  const g = openingTunnelGeometry(
    rooms, { x: 5, y: 0, angle: 0, length: 2 }, walls, [], pitch, 5, 1,
  );
  assert.ok(g);
  assert.ok(g.faces.every((face) => face.roomId === 'small'));
  const reversed = openingTunnelGeometry(
    [...rooms].reverse(), { x: 5, y: 0, angle: 0, length: 2 }, walls, [], pitch, 5, 1,
  );
  assert.deepEqual(reversed, g);
});

test('opening association rejects angle drift consistently for face, cut and tunnel', () => {
  const rooms = [{ id: 'r', poly: [[0, 0], [10, 0], [10, 6], [0, 6]] }];
  const walls = [{ key: wallKey([0, 0], [10, 0], pitch), cm: 20 }];
  const opening = { x: 5, y: 0, angle: 12, length: 2 };
  assert.equal(openingInnerFaceOffset(rooms, opening, walls, pitch, 5, 1).cm, 0);
  assert.equal(openingTunnelGeometry(rooms, opening, walls, [], pitch, 5, 1), null);
  const uncut = wallBodiesUnionPath(rooms, walls, [], [], pitch, 5, 1);
  const invalidCut = wallBodiesUnionPath(rooms, walls, [], [opening], pitch, 5, 1);
  assert.deepEqual(invalidCut, uncut);
});

test('openingTunnelGeometry: a legacy opening outside the span is clipped to the real wall body', () => {
  const rooms = [{ id: 'r', poly: [[0, 0], [10, 0], [10, 6], [0, 6]] }];
  const walls = [{ key: wallKey([0, 0], [10, 0], pitch), cm: 20 }];
  const g = openingTunnelGeometry(
    rooms, { x: 10.5, y: 0, angle: 0, length: 4 }, walls, [], pitch, 5, 1,
  );
  assert.ok(g);
  const positive = g.faces.find((face) => face.side === 1);
  assert.match(positive.d, /M -2(?:\.0+)? [^L]+L -0\.5(?:0+)? /);
  assert.doesNotMatch(positive.d, /L 2(?:\.0+)? /, 'the missing wall extension is not painted');
});

test('openingTunnelGeometries removes overlap so translucent fills never composite twice', () => {
  const rooms = [{ id: 'r', poly: [[0, 0], [10, 0], [10, 6], [0, 6]] }];
  const walls = [{ key: wallKey([0, 0], [10, 0], pitch), cm: 20 }];
  const exact = openingTunnelGeometries(
    rooms,
    [{ x: 5, y: 0, angle: 0, length: 4 }, { x: 5, y: 0, angle: 0, length: 4 }],
    walls, [], pitch, 5, 1,
  );
  assert.ok(exact[0]);
  assert.equal(exact[1], null, 'an exact duplicate contributes no second alpha layer');

  const partial = openingTunnelGeometries(
    rooms,
    [{ x: 4, y: 0, angle: 0, length: 4 }, { x: 6, y: 0, angle: 0, length: 4 }],
    walls, [], pitch, 5, 1,
  );
  assert.ok(partial[0] && partial[1]);
  const positive = partial[1].faces.find((face) => face.side === 1);
  assert.match(positive.d, /M 0(?:\.0+)? /, 'only the non-overlapping extension remains');
});

// ------------------------------- bodies / paper -----------------------------

test('wallEdgeBodies: shared and outer both grow ±½ from the centreline', () => {
  const rooms = [
    { id: 'a', poly: [[0, 0], [5, 0], [5, 4], [0, 4]] },
    { id: 'b', poly: [[5, 0], [10, 0], [10, 4], [5, 4]] },
  ];
  // shared vertical at x=5
  const sharedKey = wallKey([5, 0], [5, 4], pitch);
  const outerKey = wallKey([0, 0], [5, 0], pitch);
  const walls = [
    { key: sharedKey, cm: 20 },
    { key: outerKey, cm: 30 },
  ];
  const kindsA = edgeKinds(rooms, 'a', [], pitch);
  assert.ok(kindsA.includes('shared'));
  assert.ok(kindsA.includes('outer'));

  const bodies = wallEdgeBodies(rooms, walls, [], pitch, cellCm, pitch);
  const shared = bodies.find((b) => b.key === sharedKey);
  const outer = bodies.find((b) => b.key === outerKey);
  assert.ok(shared, 'shared body missing');
  assert.ok(outer, 'outer body missing');
  assert.equal(shared.kind, 'shared');
  assert.equal(outer.kind, 'outer');
  // only one body per key even though two rooms see the shared wall
  assert.equal(bodies.filter((b) => b.key === sharedKey).length, 1);
  // outer grows half outward: min y of quad < 0
  const ys = outer.quad.map((p) => p[1]);
  assert.ok(Math.min(...ys) < -1e-9, 'outer must grow outward by half');
});

test('wallBodyRings / union: outset − inset forms a closed ring', () => {
  const rooms = [
    { id: 'a', poly: [[0, 0], [5, 0], [5, 4], [0, 4]] },
    { id: 'b', poly: [[5, 0], [10, 0], [10, 4], [5, 4]] },
  ];
  const walls = [
    { key: wallKey([5, 0], [5, 4], pitch), cm: 20 },
    { key: wallKey([0, 0], [5, 0], pitch), cm: 20 },
  ];
  const rings = wallBodyRings(rooms, walls, [], pitch, cellCm, pitch);
  assert.ok(rings.length >= 1);
  assert.ok(rings[0].d.includes('M'));
  const united = wallBodiesUnionPath(rooms, walls, [], [], pitch, cellCm, pitch);
  assert.ok(united && united.d.includes('M'));
  // Partial-thickness walls may produce a simple strip (one subpath); a fully
  // thick room must keep a floor hole — see the next test.
  const inner = innerContourForRoom(rooms, 'a', walls, [], pitch, cellCm, pitch);
  assert.ok(inner);
  assert.ok(polygonArea(inner) < polygonArea(rooms[0].poly));
});

test('wallBodiesUnionPath mitres real arms owned by different rooms at a virtual T', () => {
  const scale = 1000;
  const rooms = [
    { id: 'a', poly: [[100, 100], [500, 100], [500, 500], [100, 500]] },
    { id: 'b', poly: [[500, 500], [900, 500], [900, 900], [500, 900]] },
    { id: 'c', poly: [[500, 100], [900, 100], [900, 500], [500, 500]] },
  ];
  const open = [[500, 500, 900, 500]];
  const walls = [
    { key: wallKey([0.1, 0.5], [0.5, 0.5], pitch), cm: 20 },
    { key: wallKey([0.5, 0.5], [0.5, 0.9], pitch), cm: 20 },
  ];
  const united = wallBodiesUnionPath(rooms, walls, open, [], pitch, cellCm, GRID_PITCH, scale);
  assert.ok(united);
  const nums = (united.d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  const pts = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  const half = wallCmToUnits(20, cellCm, GRID_PITCH) / 2;
  assert.ok(
    pts.some((p) => Math.abs(p[0] - (500 + half)) < 1e-6
      && Math.abs(p[1] - (500 - half)) < 1e-6),
    `missing outer mitre corner in ${united.d}`,
  );
});

test('issue #197 keeps the full masonry when one virtual-junction patch has ULP noise', () => {
  const fixture = JSON.parse(readFileSync(
    new URL('./fixtures/197-junction-patch.json', import.meta.url), 'utf8',
  ));
  const rooms = fixture.rooms.map((room) => ({
    ...room,
    poly: room.poly.map(([x, y]) => [x * NORM_W, y * NORM_W]),
  }));
  const walls = structuredClone(fixture.walls);
  const cuts = resolveOpenCuts(rooms, fixture.open_spans, NORM_W, GRID_PITCH * 0.02);
  const openings = [];
  const extraBodies = [];
  const before = JSON.stringify({ rooms, walls, cuts, openings, extraBodies });

  assert.deepEqual([rooms.length, walls.length, cuts.length], [8, 25, 3]);
  const intervals = wallIntervals(
    rooms, walls, cuts, pitch, fixture.cell_cm, GRID_PITCH, NORM_W,
  );
  const nodeCms = intervals
    .filter((iv) => Math.abs(iv.a[1] - 550) < 1e-6
      && Math.abs(iv.b[1] - 550) < 1e-6)
    .map((iv) => iv.cm);
  assert.ok(nodeCms.includes(20), `junction lost its 20 cm arm: ${nodeCms}`);

  const patches = virtualJunctionPatches(
    rooms, walls, cuts, pitch, fixture.cell_cm, GRID_PITCH, NORM_W,
  );
  assert.deepEqual(patches, [[
    [620.8333333333334, 550],
    [612.5, 550],
    [612.5000000000001, 541.6666666666665],
    [620.8333333333334, 541.6666666666666],
  ]]);
  const stable = stableJunctionPatch(patches[0], NORM_W);
  assert.ok(stable);
  assert.equal(stable[1][0], stable[2][0], 'equivalent mitre x coordinates stay forked');
  assert.equal(stable[2][1], stable[3][1], 'equivalent mitre y coordinates stay forked');
  const normalizedStable = stableJunctionPatch(
    patches[0].map(([x, y]) => [x / NORM_W, y / NORM_W]), 1,
  );
  assert.ok(normalizedStable);
  assert.equal(normalizedStable[1][0], normalizedStable[2][0]);
  assert.equal(normalizedStable[2][1], normalizedStable[3][1]);
  const bounds = (poly) => [
    Math.min(...poly.map((point) => point[0])), Math.min(...poly.map((point) => point[1])),
    Math.max(...poly.map((point) => point[0])), Math.max(...poly.map((point) => point[1])),
  ];
  bounds(stable).forEach((value, index) => closeTo(
    value, bounds(patches[0])[index], 1e-9,
  ));

  const geometry = wallBodiesGeometry(
    rooms, walls, cuts, openings, pitch, fixture.cell_cm, GRID_PITCH, NORM_W, extraBodies,
  );
  assert.ok(geometry, 'one rejected junction patch must not erase the whole plan');
  assert.ok(geometry.geom.length > 0);
  assert.ok(geometry.paperGeom.length > 0);
  // #249 intentionally bevels degree-3+ nodes in this older fixture too.
  // #249 retains the physical multi-wall overlap up to R instead of reducing
  // right-angle arms to point contacts.
  closeTo(geometryArea(geometry.geom), 124512.89263371378, 1e-6);
  closeTo(geometryArea(geometry.paperGeom), 727248.4374999999, 1e-6);
  assert.equal(
    JSON.stringify({ rooms, walls, cuts, openings, extraBodies }), before,
    'rendering mutated persisted input',
  );

  const permuted = wallBodiesGeometry(
    [...rooms].reverse(), [...walls].reverse(), cuts, openings, pitch,
    fixture.cell_cm, GRID_PITCH, NORM_W, extraBodies,
  );
  assert.ok(permuted);
  closeTo(geometryDifferenceArea(geometry.geom, permuted.geom), 0, 1e-7);
  closeTo(geometryDifferenceArea(permuted.geom, geometry.geom), 0, 1e-7);

  const reversedAndRepeated = wallBodiesGeometry(
    rooms, walls.map((wall) => ({ ...wall, a: [...wall.b], b: [...wall.a] })),
    cuts, openings, pitch, fixture.cell_cm, GRID_PITCH, NORM_W, extraBodies,
  );
  assert.ok(reversedAndRepeated);
  closeTo(geometryDifferenceArea(geometry.geom, reversedAndRepeated.geom), 0, 1e-7);
  closeTo(geometryDifferenceArea(reversedAndRepeated.geom, geometry.geom), 0, 1e-7);
  const repeated = wallBodiesGeometry(
    rooms, walls, cuts, openings, pitch, fixture.cell_cm, GRID_PITCH, NORM_W, extraBodies,
  );
  assert.ok(repeated);
  closeTo(geometryDifferenceArea(geometry.geom, repeated.geom), 0, 1e-7);
  closeTo(geometryDifferenceArea(repeated.geom, geometry.geom), 0, 1e-7);
});

test('junction patch union isolates one failure and continues with later patches', () => {
  const patches = [
    [[0, 0], [2, 0], [2, 2], [0, 2]],
    [[3, 0], [5, 0], [5, 2], [3, 2]],
  ];
  const calls = [];
  const result = unionJunctionPatches('initial-body', patches, 1, (body, piece) => {
    calls.push({ body, piece });
    if (calls.length === 1) throw new Error('controlled first-patch failure');
    return 'body-with-second-patch';
  });
  assert.equal(result, 'body-with-second-patch');
  assert.equal(calls.length, 2, 'a failed patch suppressed the following patch');
  assert.equal(calls[1].body, 'initial-body', 'failure replaced the last valid body');

  let invalidCalls = 0;
  assert.equal(unionJunctionPatches('opaque', [
    [[0, 0], [Infinity, 0], [0, 1]],
    [[0, 0], [1, 0], [2, 0]],
  ], 1, () => { invalidCalls++; }), 'opaque');
  assert.equal(invalidCalls, 0, 'invalid or zero-area patches reached the boolean engine');
});

test('wallBodiesUnionPath: single fully-thick room keeps a floor hole', () => {
  const room = { id: 'n', poly: [[100, 100], [300, 100], [300, 300], [100, 300]] };
  const walls = applyWallThicknessToNewRoom([], [room], 'n', 15, 0.01, [], 1000);
  assert.equal(walls.length, 4);
  const united = wallBodiesUnionPath([room], walls, [], [], 0.01, cellCm, 4.166666666666667, 1000);
  assert.ok(united);
  assert.ok((united.d.match(/M/g) || []).length >= 2, united.d);
});

test('wallBodiesUnionPath: a parent floor never erases a nested room wall', () => {
  const scale = 1000;
  const rooms = [
    { id: 'parent', poly: [[100, 100], [900, 100], [900, 900], [100, 900]] },
    { id: 'nested', poly: [[300, 300], [700, 300], [700, 700], [300, 700]] },
  ];
  let walls = applyWallThicknessToNewRoom([], rooms, 'parent', 15, pitch, [], scale);
  walls = applyWallThicknessToNewRoom(walls, rooms, 'nested', 15, pitch, [], scale);
  const united = wallBodiesUnionPath(
    rooms, walls, [], [], pitch, cellCm, GRID_PITCH, scale,
  );
  assert.ok(united);
  // Parent ring (outer + floor hole) and nested ring (outer + floor hole).
  // The old `(union outsets) - (union insets)` formula returned only two
  // subpaths here because the parent floor swallowed the nested wall entirely.
  assert.ok((united.d.match(/M/g) || []).length >= 4, united.d);
});

test('production-scale Split keeps the 10 → 0 facade transition at the divider', () => {
  const { scale, rooms, walls, geometry } = splitThicknessTransitionFixture();
  const intervals = wallIntervals(
    rooms, walls, [], pitch, cellCm, GRID_PITCH, scale,
  );
  const top = intervals.filter((iv) =>
    iv.kind === 'outer' && Math.abs(iv.a[1] - 100) < 1e-7
      && Math.abs(iv.b[1] - 100) < 1e-7);
  assert.deepEqual(top.map((iv) => [iv.roomId, iv.cm]), [['left', 10], ['right', 0]]);
  const divider = intervals.filter((iv) =>
    iv.kind === 'shared' && Math.abs(iv.a[0] - 500) < 1e-7
      && Math.abs(iv.b[0] - 500) < 1e-7);
  assert.equal(divider.length, 2);
  assert.ok(divider.every((iv) => iv.cm === 10), 'one physical divider keeps 10 cm');

  const half = wallCmToUnits(10, cellCm, GRID_PITCH) / 2;
  assertProbeInside(geometry.geom, [300, 100 - half * 0.75], 'outer half is missing');
  assertProbeInside(geometry.geom, [300, 100 + half * 0.75], 'inner half is missing');
  assertProbeOutside(geometry.geom, [300, 100 - half - 0.2], 'wall exceeds 10 cm');
  assertProbeOutside(geometry.geom, [300, 100 + half + 0.2], 'wall exceeds 10 cm');
  assertProbeOutside(geometry.geom, [700, 96], '10 cm leaked along the zero facade');
  assertProbeOutside(geometry.geom, [700, 104], 'zero facade gained an inward half-wall');
  assertProbeOutside(geometry.paperGeom, [700, 96], 'paper leaked past the zero facade');

  assertProbeInside(geometry.geom, [500 - half * 0.5, 300], 'left divider half is missing');
  assertProbeInside(geometry.geom, [500 + half * 0.5, 300], 'right divider half is missing');
  assertProbeOutside(geometry.geom, [500 + half * 0.5, 96], 'divider protrudes outside');

  const points = geometry.geom.flat(2);
  assert.ok(points.some(([x, y]) =>
    Math.abs(x - 500) < 1e-7 && Math.abs(y - (100 - half)) < 1e-7),
  'the outer transition face must start at the exact divider endpoint');

  const leftFloor = innerContourForRoom(
    rooms, 'left', walls, [], pitch, cellCm, GRID_PITCH, scale,
  );
  const rightFloor = innerContourForRoom(
    rooms, 'right', walls, [], pitch, cellCm, GRID_PITCH, scale,
  );
  assert.ok(leftFloor && rightFloor);
  assertProbeOutside(closedGeometry(leftFloor), [300, 102], 'left floor covers its wall');
  assertProbeInside(closedGeometry(leftFloor), [300, 106], 'left clean floor starts too late');
  assertProbeInside(closedGeometry(rightFloor), [700, 102], 'zero side lost clean floor');

  const before = JSON.stringify({ rooms, walls });
  assert.ok(wallBodiesGeometry(rooms, walls, [], [], pitch, cellCm, GRID_PITCH, scale));
  assert.equal(JSON.stringify({ rooms, walls }), before, 'rendering must not migrate saved config');
});

test('production-scale collinear transitions keep both local depths in either direction', () => {
  const scale = 1000;
  const room = { id: 'room', poly: [[100, 100], [900, 100], [900, 900], [100, 900]] };
  const make = (firstCm, secondCm, poly = room.poly) => {
    let walls = [];
    if (firstCm > 0)
      walls = setWallThickness(walls, [100, 100], [500, 100], firstCm, pitch, scale);
    if (secondCm > 0)
      walls = setWallThickness(walls, [500, 100], [900, 100], secondCm, pitch, scale);
    const geometry = wallBodiesGeometry(
      [{ id: 'room', poly }], walls, [], [], pitch, cellCm, GRID_PITCH, scale,
    );
    assert.ok(geometry, `missing geometry for ${firstCm} → ${secondCm}`);
    return { geometry, walls };
  };
  const assertLocalDepth = (geometry, x, cm, label) => {
    if (cm === 0) {
      assertProbeOutside(geometry.geom, [x, 99], `${label}: zero outer side is solid`);
      assertProbeOutside(geometry.geom, [x, 101], `${label}: zero inner side is solid`);
      return;
    }
    const half = wallCmToUnits(cm, cellCm, GRID_PITCH) / 2;
    assertProbeInside(geometry.geom, [x, 100 - half * 0.75], `${label}: outer half missing`);
    assertProbeInside(geometry.geom, [x, 100 + half * 0.75], `${label}: inner half missing`);
    assertProbeOutside(geometry.geom, [x, 100 - half - 0.2], `${label}: outer depth too large`);
    assertProbeOutside(geometry.geom, [x, 100 + half + 0.2], `${label}: inner depth too large`);
  };

  for (const [firstCm, secondCm] of [
    [0, 10], [10, 0], [10, 20], [20, 10], [1, 100], [100, 1], [10, 10],
  ]) {
    const { geometry } = make(firstCm, secondCm);
    assertLocalDepth(geometry, 300, firstCm, `${firstCm} → ${secondCm}, first`);
    assertLocalDepth(geometry, 700, secondCm, `${firstCm} → ${secondCm}, second`);
    if (firstCm !== secondCm) {
      const points = geometry.geom.flat(2);
      for (const cm of new Set([firstCm, secondCm])) {
        if (!(cm > 0)) continue;
        const half = wallCmToUnits(cm, cellCm, GRID_PITCH) / 2;
        for (const y of [100 - half, 100 + half])
          assert.ok(points.some(([x0, y0]) =>
            Math.abs(x0 - 500) < 1e-7 && Math.abs(y0 - y) < 1e-7),
          `${firstCm} → ${secondCm}: missing exact transition vertex at 500,${y}`);
      }
    }
  }

  const splitEqual = make(10, 10).geometry;
  let wholeWalls = setWallThickness([], [100, 100], [900, 100], 10, pitch, scale);
  const whole = wallBodiesGeometry(
    [room], wholeWalls, [], [], pitch, cellCm, GRID_PITCH, scale,
  );
  assert.ok(whole);
  closeTo(geometryDifferenceArea(splitEqual.geom, whole.geom), 0, 1e-7);
  closeTo(geometryDifferenceArea(whole.geom, splitEqual.geom), 0, 1e-7);

  const ordered = make(10, 20).geometry;
  const reversed = make(10, 20, [...room.poly].reverse()).geometry;
  closeTo(geometryDifferenceArea(ordered.geom, reversed.geom), 0, 1e-7);
  closeTo(geometryDifferenceArea(reversed.geom, ordered.geom), 0, 1e-7);
});

test('production-scale 45° facade keeps an exact unequal-thickness breakpoint', () => {
  const scale = 1000;
  const room = {
    id: 'diagonal',
    poly: [[200, 100], [800, 700], [600, 900], [0, 300]],
  };
  const transition = [500, 400];
  let walls = setWallThickness([], room.poly[0], transition, 10, pitch, scale);
  walls = setWallThickness(walls, transition, room.poly[1], 20, pitch, scale);
  const geometry = wallBodiesGeometry(
    [room], walls, [], [], pitch, cellCm, GRID_PITCH, scale,
  );
  assert.ok(geometry);
  const normal = inwardNormal(room.poly, 0);
  const points = geometry.geom.flat(2);
  for (const cm of [10, 20]) {
    const half = wallCmToUnits(cm, cellCm, GRID_PITCH) / 2;
    for (const side of [-1, 1]) {
      const expected = [
        transition[0] + normal[0] * half * side,
        transition[1] + normal[1] * half * side,
      ];
      assert.ok(points.some(([x, y]) =>
        Math.hypot(x - expected[0], y - expected[1]) < 1e-7),
      `missing 45° transition vertex ${expected}`);
    }
  }
});

test('corner Split bounds the exterior join created by its third ray', () => {
  const { rooms, walls, before, after } = cornerSplitFixture();
  assert.ok(before);
  assert.deepEqual(geometryBounds(after.geom), geometryBounds(before.geom));
  assertBoundedMultiWallBevels(rooms, walls, after);

  const paper = paperRoomShapesWithWalls(
    rooms, walls, [], pitch, cellCm, GRID_PITCH,
  );
  assert.equal(paper.length, 1);
  assert.ok('path' in paper[0]);
  const nums = paper[0].path.match(/-?\d+(?:\.\d+)?/g).map(Number);
  const paperPoints = [];
  for (let i = 0; i < nums.length; i += 2) paperPoints.push([nums[i], nums[i + 1]]);
  assert.deepEqual(geometryBounds([[paperPoints]]), geometryBounds(after.paperGeom));

  const canonical = wallBodiesUnionPath(
    rooms, walls, [], [], pitch, cellCm, GRID_PITCH,
  );
  assert.ok(canonical?.paperD, 'canonical render pass must include its paper path');
  assert.equal(canonical.paperD, paper[0].path);
});

test('corner Split clips every divider thickness when exterior walls are absent', () => {
  for (const dividerCm of [1, 15, 100]) {
    const { original, after } = cornerSplitFixture({ outerCm: 0, dividerCm });
    closeTo(geometryArea(difference(after.geom, closedGeometry(original.poly))), 0, 1e-7);
  }
});

test('corner Split keeps facade bounds and bevels every positive-thickness 3-ray matrix', () => {
  for (const outerCm of [1, 15, 100]) {
    for (const dividerCm of [0, 1, 15, 100]) {
      const { original, rooms, walls, before, after } = cornerSplitFixture({
        outerCm, dividerCm,
      });
      assert.ok(before);
      assert.deepEqual(geometryBounds(after.paperGeom), geometryBounds(before.paperGeom));
      if (dividerCm > 0) {
        assertBoundedMultiWallBevels(rooms, walls, after);
      } else {
        const centre = closedGeometry(original.poly);
        closeTo(geometryDifferenceArea(
          difference(before.geom, centre), difference(after.geom, centre),
        ), 0, 1e-7);
      }
    }
  }
});

test('near-collinear zero-depth Split divider never grows a masonry taper', () => {
  const poly = [[100, 100], [900, 100], [900, 800], [600, 800], [600, 400], [100, 400]];
  const dividerStrip = (segment, halfWidth) => {
    const [x0, y0, x1, y1] = segment;
    const dx = x1 - x0, dy = y1 - y0;
    const length = Math.hypot(dx, dy);
    const nx = -dy / length, ny = dx / length;
    const at = (t, side) => [
      x0 + dx * t + nx * halfWidth * side,
      y0 + dy * t + ny * halfWidth * side,
    ];
    // Endpoint caps are physical. Inspect only the divider interior, far past
    // the maximum 100 cm half-depth used by this matrix.
    return [at(0.2, -1), at(0.8, -1), at(0.8, 1), at(0.2, 1)];
  };

  let reference = null;
  for (const outerCm of [1, 15, 100]) {
    for (const deltaY of [-5, -2.5, 2.5, 5]) {
      const fixture = cornerSplitFixture({
        poly,
        path: [[600, 400], [900, 400 + deltaY]],
        outerCm,
        dividerCm: 0,
      });
      const shared = wallIntervals(
        fixture.rooms, fixture.walls, [], pitch, cellCm, GRID_PITCH,
      ).filter((interval) => interval.kind === 'shared');
      assert.equal(shared.length, 2, `shared interval count at ${outerCm} cm / ${deltaY}`);
      assert.ok(shared.every((interval) => interval.cm === 0));

      const segment = fixture.divider[0];
      const halfDepth = wallCmToUnits(outerCm, cellCm, GRID_PITCH) / 2;
      const strip = dividerStrip(segment, Math.max(0.25, halfDepth * 0.75));
      const overlap = geometryArea(intersection(fixture.after.geom, closedGeometry(strip)));
      closeTo(overlap, 0, 1e-7);

      if (outerCm === 15 && deltaY === 2.5) reference = fixture;
    }
  }

  assert.ok(reference);
  const permutedRooms = reference.rooms
    .map((room, index) => ({ id: `zero-divider-${index}`, poly: [...room.poly].reverse() }))
    .reverse();
  const permuted = wallBodiesGeometry(
    permutedRooms, reference.walls, [], [], pitch, cellCm, GRID_PITCH,
  );
  assert.ok(permuted);
  closeTo(geometryDifferenceArea(reference.after.geom, permuted.geom), 0, 1e-7);
  closeTo(geometryDifferenceArea(permuted.geom, reference.after.geom), 0, 1e-7);
});

test('corner Split keeps unequal exterior arms and is order/id/winding independent', () => {
  const fixture = cornerSplitFixture({
    outerOverrides: [
      [[100, 100], [900, 100], 5],
      [[100, 700], [100, 100], 40],
    ],
    dividerCm: 100,
  });
  const shuffled = fixture.rooms
    .map((room, at) => ({ id: `renamed-${at}`, poly: [...room.poly].reverse() }))
    .reverse();
  const permuted = wallBodiesGeometry(
    shuffled, fixture.walls, [], [], pitch, cellCm, GRID_PITCH,
  );
  assert.ok(permuted);
  closeTo(geometryDifferenceArea(fixture.after.geom, permuted.geom), 0, 1e-7);
  closeTo(geometryDifferenceArea(permuted.geom, fixture.after.geom), 0, 1e-7);
  assertBoundedMultiWallBevels(
    fixture.rooms, fixture.walls, fixture.after,
  );
});

test('Split from a concave vertex does not turn the child mitre into facade', () => {
  const poly = [[100, 100], [900, 100], [900, 800], [600, 800], [600, 400], [100, 400]];
  const fixture = cornerSplitFixture({ poly, path: [[600, 400], [900, 250]], dividerCm: 100 });
  const centre = closedGeometry(poly);
  const beforeExterior = difference(fixture.before.geom, centre);
  const afterExterior = difference(fixture.after.geom, centre);
  closeTo(geometryDifferenceArea(beforeExterior, afterExterior), 0, 1e-7);
  closeTo(geometryDifferenceArea(afterExterior, beforeExterior), 0, 1e-7);
});

test('Split with both endpoints at exterior vertices bevels both new 3-ray corners', () => {
  const fixture = cornerSplitFixture({ path: [[100, 100], [900, 700]], dividerCm: 100 });
  const map = assertBoundedMultiWallBevels(
    fixture.rooms, fixture.walls, fixture.after,
  );
  assert.equal(map.nodes.length, 2);
});

test('corner Split clean floors equal room union minus canonical bounded walls', () => {
  const fixture = cornerSplitFixture({ dividerCm: 100 });
  const floors = fixture.rooms.map((room) => innerContourForRoom(
    fixture.rooms, room.id, fixture.walls, [], pitch, cellCm, GRID_PITCH,
  ));
  assert.ok(floors.every(Boolean));
  const actual = union(...floors.map((floor) => closedGeometry(floor)));
  const expected = difference(closedGeometry(fixture.original.poly), fixture.after.geom);
  const extra = geometryDifferenceArea(actual, expected);
  const missing = geometryDifferenceArea(expected, actual);
  assert.ok(extra <= 1e-7 && missing <= 1e-7,
    `floor mismatch extra=${extra} missing=${missing} floors=${JSON.stringify(floors)}`);
  for (const floor of floors) {
    for (const point of floor) {
      assert.ok(point[0] >= 100 - 1e-7 && point[0] <= 900 + 1e-7
        && point[1] >= 100 - 1e-7 && point[1] <= 700 + 1e-7,
      `clean floor escaped the source building: ${point}`);
    }
  }
});

test('corner Split rendering does not materialize or mutate saved geometry', () => {
  const fixture = cornerSplitFixture({ dividerCm: 100 });
  const rooms = structuredClone(fixture.rooms);
  const walls = structuredClone(fixture.walls);
  const before = JSON.stringify({ rooms, walls });
  assert.ok(wallBodiesGeometry(rooms, walls, [], [], pitch, cellCm, GRID_PITCH));
  assert.ok(paperRoomShapesWithWalls(rooms, walls, [], pitch, cellCm, GRID_PITCH).length);
  assert.equal(JSON.stringify({ rooms, walls }), before);
});

test('paper with walls covers shared centreline; without walls matches paperRoomShapes', () => {
  const rooms = [
    { id: 'a', poly: [[0, 0], [5, 0], [5, 4], [0, 4]] },
    { id: 'b', poly: [[5, 0], [10, 0], [10, 4], [5, 4]] },
  ];
  const plain = paperRoomShapes(rooms);
  const same = paperRoomShapesWithWalls(rooms, [], [], pitch, cellCm, pitch);
  assert.deepEqual(same, plain);

  const walls = [{ key: wallKey([5, 0], [5, 4], pitch), cm: 20 }];
  const grown = paperRoomShapesWithWalls(rooms, walls, [], pitch, cellCm, pitch);
  assert.equal(grown.length, 1);
  assert.ok('path' in grown[0], 'wall-aware paper is one canonical union path');
});

test('area of the room polygon is unchanged by thickness helpers', () => {
  const poly = [[0, 0], [8, 0], [8, 5], [0, 5]];
  const before = polygonArea(poly);
  insetContour(poly, [0.5, 0.5, 0.5, 0.5]);
  assert.equal(polygonArea(poly), before);
});

test('applyWallThicknessToNewRoom skips edges that already have thickness', () => {
  const sharedKey = wallKey([5, 0], [5, 4], pitch);
  const existing = [{ key: sharedKey, cm: 40 }];
  const older = { id: 'a', poly: [[0, 0], [5, 0], [5, 4], [0, 4]] };
  const newRoom = { id: 'b', poly: [[5, 0], [10, 0], [10, 4], [5, 4]] };
  const next = applyWallThicknessToNewRoom(
    existing, [older, newRoom], 'b', DRAW_WALL_DEFAULT_CM, pitch,
  );
  const shared = next.find((w) => w.key === sharedKey);
  assert.equal(shared?.cm, 40, 'neighbour thickness must be kept');
  // other three edges of b get the draw default
  assert.equal(next.filter((w) => w.cm === DRAW_WALL_DEFAULT_CM).length, 3);
  assert.equal(thicknessCmAt(next, [5, 0], [10, 0], pitch), DRAW_WALL_DEFAULT_CM);
});

test('applyWallThicknessToNewRoom with null cm is a no-op', () => {
  const room = { id: 'r', poly: [[0, 0], [1, 0], [1, 1], [0, 1]] };
  assert.deepEqual(applyWallThicknessToNewRoom([], [room], 'r', null, pitch), []);
});

test('split materialisation preserves legacy source walls around a new divider', () => {
  const original = [
    { id: 'source', poly: [[0, 0], [10, 0], [10, 10], [0, 10]] },
  ];
  // Valid profiles saved by older House Plan versions have no exact a/b span.
  const legacy = [
    { key: wallKey([0, 0], [10, 0], pitch), cm: 15 },
    { key: wallKey([10, 0], [10, 10], pitch), cm: 15 },
    { key: wallKey([10, 10], [0, 10], pitch), cm: 15 },
    { key: wallKey([0, 10], [0, 0], pitch), cm: 15 },
  ];
  const preserved = materializeWallIntervals(
    original, legacy, [], pitch, cellCm, GRID_PITCH,
  );
  const split = [
    { id: 'source', poly: [[4, 0], [10, 0], [10, 10], [4, 10]] },
    { id: 'fresh', poly: [[0, 0], [4, 0], [4, 10], [0, 10]] },
  ];
  const changed = setWallThickness(preserved, [4, 0], [4, 10], 22, pitch);
  const next = normalizeWallIntervals(split, changed, [], pitch, cellCm, GRID_PITCH);
  const cmAt = (seg) => intervalCmAt(
    split, next, [], seg, pitch, cellCm, GRID_PITCH,
  );

  assert.equal(cmAt([4, 0, 10, 0]), 15);
  assert.equal(cmAt([0, 0, 4, 0]), 15);
  assert.equal(cmAt([4, 10, 10, 10]), 15);
  assert.equal(cmAt([0, 10, 4, 10]), 15);
  assert.equal(cmAt([4, 0, 4, 10]), 22);
});

test('split materialisation cuts a partial shared interval at the new divider', () => {
  const original = [
    { id: 'source', poly: [[0, 0], [10, 0], [10, 10], [0, 10]] },
    { id: 'neighbour', poly: [[0, -6], [6, -6], [6, 0], [0, 0]] },
  ];
  const walls = [{
    key: wallKey([0, 0], [6, 0], pitch), a: [0, 0], b: [6, 0], cm: 15,
  }];
  const preserved = materializeWallIntervals(
    original, walls, [], pitch, cellCm, GRID_PITCH,
  );
  const split = [
    { id: 'source', poly: [[4, 0], [10, 0], [10, 10], [4, 10]] },
    original[1],
    { id: 'fresh', poly: [[0, 0], [4, 0], [4, 10], [0, 10]] },
  ];
  const next = normalizeWallIntervals(split, preserved, [], pitch, cellCm, GRID_PITCH);
  const cmAt = (seg) => intervalCmAt(split, next, [], seg, pitch, cellCm, GRID_PITCH);
  assert.equal(cmAt([0, 0, 4, 0]), 15);
  assert.equal(cmAt([4, 0, 6, 0]), 15);
  assert.equal(cmAt([6, 0, 10, 0]), 0);
});

test('drawWallPreviewD returns a path for open and closed outlines', () => {
  const single = drawWallPreviewD([[0, 0], [10, 0]], 1, false);
  assert.ok(single.includes('M'), 'one flat-capped segment remains a visible preview');
  const open = drawWallPreviewD([[0, 0], [10, 0], [10, 6]], 1, false);
  assert.ok(open.includes('M'));
  assert.match(open, /11 -1(?:\D|$)/, 'open preview already contains the 90-degree mitre');
  const stepped = drawWallPreviewD(
    [[0, 0], [10, 0], [10, 6]], 1, false, [1, 2],
  );
  assert.match(stepped, /12 -1(?:\D|$)/,
    'the joined preview respects the second segment own half-depth');
  const closed = drawWallPreviewD([[0, 0], [10, 0], [10, 6], [0, 6]], 1, true);
  assert.ok(closed.includes('M'));
  assert.equal(drawWallPreviewD([[0, 0]], 1, false), '');
});

test('linear wall joins bevel an excessive mitre and ignore malformed or near-miss inputs', () => {
  const acute = linearWallJoinPatches([
    { a: [0, 0], b: [10, 0], halfDepth: 1 },
    { a: [0, 0], b: [10, 0.1], halfDepth: 1 },
  ], 1e-6);
  assert.equal(acute.length, 1);
  assert.equal(acute[0].length, 3, 'a mitre beyond the limit becomes a bevel triangle');
  assert.ok(acute[0].every((point) => Math.hypot(point[0], point[1]) <= MITRE_LIMIT));

  const separate = linearWallJoinPatches([
    { a: [-2, 0], b: [0, 0], halfDepth: 1 },
    { a: [0.001, 0], b: [0.001, 2], halfDepth: 1 },
  ], 1e-6);
  assert.deepEqual(separate, [], 'a point outside geometry epsilon remains disconnected');
  assert.equal(linearWallBody({ a: [0, 0], b: [Infinity, 1], halfDepth: 1 }), null);
  assert.deepEqual(linearWallJoinPatches([
    { a: [-2, 0], b: [0, 0], halfDepth: 1 },
    { a: [0, 0], b: [0, 0], halfDepth: 1 },
    { a: [0, 0], b: [Infinity, 1], halfDepth: 1 },
  ]), [], 'invalid neighbours do not alter a valid flat-capped segment');
});

// --- issue #230: hatch density follows the plan's centimetres -----------------

test('issue 230 the reference scale is untouched', () => {
  assert.equal(wallHatchStepUnits(5), 8, 'exactly, not approximately');
  assert.equal(wallHatchStepUnits(5), HATCH_BASE_STEP_UNITS);
});

test('issue 230 one wall carries the same stripes at every grid scale', () => {
  const stripes = (cell) => wallCmToUnits(15, cell, GRID_PITCH) / wallHatchStepUnits(cell);
  const reference = stripes(5);
  for (const cell of [1, 2, 5, 10, 25, 50]) {
    assert.ok(
      Math.abs(stripes(cell) - reference) < 1e-9,
      `cell_cm ${cell}: ${stripes(cell)} stripes vs ${reference}`,
    );
  }
});

test('issue 230 density is physical, so a thicker wall gets more stripes', () => {
  const stripes = (cm, cell) => wallCmToUnits(cm, cell, GRID_PITCH) / wallHatchStepUnits(cell);
  for (const cell of [1, 5, 25]) {
    assert.ok(
      Math.abs(stripes(30, cell) / stripes(15, cell) - 2) < 1e-9,
      `cell_cm ${cell}: ratio ${stripes(30, cell) / stripes(15, cell)}`,
    );
  }
});

test('issue 230 a missing or broken cell_cm falls back to the reference', () => {
  for (const bad of [0, -5, NaN, undefined, null, 'wide', {}]) {
    assert.equal(wallHatchStepUnits(bad), 8, `input ${String(bad)}`);
  }
});

test('issue 230 the step stays inside its limits', () => {
  assert.ok(wallHatchStepUnits(0.1) <= HATCH_MAX_STEP_UNITS, 'a hair-fine grid');
  assert.ok(wallHatchStepUnits(1000) >= HATCH_MIN_STEP_UNITS, 'a hectare-wide grid');
  assert.equal(wallHatchStepUnits(0.5), HATCH_MAX_STEP_UNITS, 'the upper limit is reachable');
  assert.equal(wallHatchStepUnits(80), HATCH_MIN_STEP_UNITS, 'the lower limit is reachable');
});

test('issue 230 stripes too close on screen ask for a solid body', () => {
  assert.equal(wallHatchNeedsSolid(1, 1), true, '1 px step is noise');
  assert.equal(wallHatchNeedsSolid(1, 2), false, 'exactly the threshold is fine');
  assert.equal(wallHatchNeedsSolid(8, 10), false, 'a comfortable step');
  for (const [step, px] of [[0, 5], [-1, 5], [8, 0], [8, -1], [NaN, 5], [8, NaN]]) {
    assert.equal(wallHatchNeedsSolid(step, px), false, `garbage in: ${step}, ${px}`);
  }
});

test('issue 230 a thin wall is not turned into a blot by the new rule', () => {
  // 3 cm on the reference grid is 2.5 units: fewer stripes than one. Whether it
  // is filled or hatched stays the business of the thin-BODY guard, exactly as
  // before — the new step guard must have no opinion about it.
  const thin = wallCmToUnits(3, 5, GRID_PITCH);
  const step = wallHatchStepUnits(5);
  for (const px of [1, 1.2, 2, 5]) {
    assert.equal(wallHatchNeedsSolid(step, px), false, `step guard fired at px=${px}`);
  }
  assert.equal(wallBodyNeedsSolid(thin, 1), true, 'body guard still owns the thin case');
  assert.equal(wallBodyNeedsSolid(thin, 1.2), false, 'and lets it hatch once it is wide enough');
});


// --------------------- #233: внутренние размеры при ресайзе -----------------

const rect = (w, h) => [[0, 0], [w, 0], [w, h], [0, h]];

test('innerEdgeSpan measures between wall faces, not centrelines (#233)', () => {
  // AC1: осевой пролёт 300 и стены 15 см дают 285 — то, что человек измерит
  // рулеткой. В единицах: половинная глубина 7.5 при пролёте 300.
  const poly = rect(300, 400);
  const o = poly.map(() => 7.5);
  assert.equal(innerEdgeSpan(poly, 0, o), 285);
  assert.equal(innerEdgeSpan(poly, 1, o), 385);
  // AC2: разные толщины на концах сокращают по-своему.
  const mixed = [7.5, 15, 7.5, 15];
  assert.equal(innerEdgeSpan(poly, 0, mixed), 300 - 15 - 15);
  assert.equal(innerEdgeSpan(poly, 2, mixed), 300 - 15 - 15);
});

test('innerEdgeSpan keeps the centreline where there is no wall (#233)', () => {
  const poly = rect(300, 400);
  // AC3: нулевые толщины — внутренний размер равен осевому.
  assert.equal(innerEdgeSpan(poly, 0, poly.map(() => 0)), 300);
  // AC4: сосед без толщины не сокращает конец.
  assert.equal(innerEdgeSpan(poly, 0, [7.5, 0, 7.5, 7.5]), 300 - 7.5);
  // AC6a: сама сторона — проём, соседи-стены: полная осевая длина.
  assert.equal(innerEdgeSpan(poly, 0, [0, 7.5, 7.5, 7.5]), 300);
});

test('innerEdgeSpan handles a diagonal edge and degenerate input (#233)', () => {
  // AC5: на диагонали сокращение не равно простому o + o.
  const tri = [[0, 0], [100, 0], [0, 100]];
  const o = [5, 5, 5];
  const diagonal = innerEdgeSpan(tri, 1, o);
  const naive = Math.hypot(100, 100) - 10;
  assert.ok(diagonal > 0 && Math.abs(diagonal - naive) > 1,
    `диагональ ${diagonal} не должна совпадать с наивным ${naive}`);
  // AC6: стены толще комнаты — ноль, а не отрицательное число.
  assert.equal(innerEdgeSpan(rect(20, 20), 0, [30, 30, 30, 30]), 0);
  // Мусор на входе не роняет функцию.
  assert.equal(innerEdgeSpan([[0, 0], [1, 0]], 0, [1, 1]), 0);
  assert.equal(innerEdgeSpan(rect(10, 10), 0, [1, 1, 1]), 0);
});

test('ownEdgeOffsets reads the atomic profile, not a whole-edge lookup (#233)', () => {
  // AC6b, находка H2: толщина записана только на ЧАСТЬ ребра. Именно на таком
  // ребре `thicknessCmAt` по целому ребру возвращает 0 — наивный источник
  // толщин молча перестал бы сокращать подпись, и тест обязан это различать
  // (M1 код-ревью r1: прежняя редакция задавала толщину на всё ребро, где оба
  // источника отвечают одинаково, и наивную реализацию пропускала).
  const rooms = [{ id: 'r', poly: [[0, 0], [1, 0], [1, 1], [0, 1]] }];
  const split = setWallThickness([], [0, 0], [0.6, 0], 20, pitch);
  assert.equal(thicknessCmAt(split, [0, 0], [1, 0], pitch), 0,
    'запрос по целому ребру против частичной толщины даёт 0 — это и есть H2');
  assert.equal(thicknessCmAt(split, [0, 0], [0.6, 0], pitch), 20,
    'а по самому участку толщина находится');
  // Полигон здесь в нормализованных координатах, поэтому coordScale = 1:
  // с NORM_W допуск поиска ключа стал бы больше самой комнаты и толщина
  // «протекла» бы на противоположное ребро — проверено прогоном.
  const halfDepth = wallCmToUnits(20, 5, GRID_PITCH) / 2;
  const viaProfile = ownEdgeOffsets(rooms, 'r', split, [], pitch, 5, GRID_PITCH, 1);
  assert.equal(viaProfile.length, 4, 'по одному числу на ребро своего полигона');
  assert.equal(viaProfile[0], halfDepth,
    'участок под серединой ребра отдаёт половинную глубину, а не 0');
  assert.deepEqual(viaProfile.slice(1), [0, 0, 0], 'рёбра без записи остаются нулевыми');
  // Разница с наивным источником именно здесь: 0 против половинной глубины.
  // Дальше эту разницу видит `innerEdgeSpan` — с нулём сокращения не будет
  // вовсе (AC3), с профилем соседнее ребро сократится (AC1, отдельные тесты
  // выше; смешивать здесь нельзя — полигон нормализован, а профиль в единицах
  // рендера).
  assert.notEqual(viaProfile[0], thicknessCmAt(split, [0, 0], [1, 0], pitch));

  // Неразрезанное ребро: тот же ответ, что у канонического источника профиля.
  const whole = setWallThickness([], [0, 0], [1, 0], 20, pitch);
  assert.deepEqual(
    ownEdgeOffsets(rooms, 'r', whole, [], pitch, 5, GRID_PITCH, 1),
    insetOffsetsForRoom(rooms, 'r', whole, [], pitch, 5, GRID_PITCH, 1),
  );
  // Комната без стен: все нули — вызывающий покажет осевую длину.
  assert.deepEqual(ownEdgeOffsets(rooms, 'r', [], [], pitch, 5, GRID_PITCH, 1), [0, 0, 0, 0]);
  assert.equal(ownEdgeOffsets(rooms, 'missing', whole, [], pitch, 5, GRID_PITCH, 1), null);
});
