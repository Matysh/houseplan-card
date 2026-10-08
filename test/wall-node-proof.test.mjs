import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildNodePreview, nodePreviewJunctionGeometry } from '../test-build/wall-node-preview.js';
import { junctionLimitViolations } from '../test-build/junction-limits.js';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';
import { applyNodeMove, prepareNodeMove, structuralWallNodes, structuralNodeWalls } from '../test-build/wall-node-move.js';
import { canonicalizeConfigGeometryInPlace } from '../test-build/coordinate-canonicalization.js';
import { innerContourForRoom, wallBodiesGeometry } from '../test-build/wall-thickness.js';
import { GRID_STEP_N, GRID_PITCH, NORM_W } from '../test-build/space-geometry.js';
import { wallQuadCovered } from '../test-build/wall-quad-coverage.js';
import { geometryArea } from '../test-build/physical-geometry.js';

const connected = JSON.parse(readFileSync(new URL('./fixtures/834-node-connected.json', import.meta.url)));
const distanceToContour = (point, contour) => Math.min(...contour.map((a, i) => {
  const b = contour[(i + 1) % contour.length], dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy);
}));
const compare = space => {
  const preview = buildNodePreview(space), shared = nodePreviewJunctionGeometry(preview);
  assert.ok(shared, 'successful uncut preview has a normalized junction artifact');
  const config = { spaces: [space] }, walls = structuralNodeWalls(space);
  const canonical = junctionLimitViolations(config, space.id, walls);
  const reused = junctionLimitViolations(config, space.id, walls, shared);
  assert.deepEqual(reused.map(({ actual, ...v }) => v), canonical.map(({ actual, ...v }) => v));
  for (let i = 0; i < canonical.length; i++)
    assert.ok(Math.abs(reused[i].actual - canonical[i].actual) < 1e-5, `same physical units for ${canonical[i].rule}`);
  for (const room of preview.model.rooms) {
    const captured = preview.renderRoomContours.get(room.id);
    const original = innerContourForRoom(preview.model.rooms, room.id, preview.input.walls,
      preview.input.openCuts, GRID_STEP_N, preview.input.cellCm, GRID_PITCH, NORM_W,
      preview.geometry.roomGeom, preview.geometry.multiWallNodes);
    assert.equal(!!captured, !!original, 'null/collapsed contours preserve the renderer fallback');
    if (captured && original) {
      assert.ok(captured.every(p => distanceToContour(p, original) < 1e-5), `${room.id}: captured floor stays on original render boundary`);
      assert.ok(original.every(p => distanceToContour(p, captured) < 1e-5), `${room.id}: no original floor boundary is lost`);
    }
  }
  return { preview, shared, canonical };
};

test('834 junction reuse matches the independent normalized no-opening proof on a connected floor', () => {
  const space = connected.spaces[0], nodes = structuralWallNodes(space), point = [-401 / 240, 928 / 240];
  const node = nodes.find(n => n.point.every((v, i) => Math.abs(v - point[i]) < 1e-8));
  const plan = prepareNodeMove(space, node, nodes, {});
  const frozenSource = structuredClone(space);
  compare(space);
  for (const offset of [1, 53, 54, 59, 60, 100]) {
    const result = applyNodeMove(plan, [point[0], point[1] + offset / 240], null);
    assert.equal(result.ok, true);
    canonicalizeConfigGeometryInPlace({ spaces: [result.space] });
    const frozenCandidate = structuredClone(result.space);
    const { preview, shared } = compare(result.space);
    assert.equal(preview.input.openings.length, 14, 'visible opening cuts remain in the production preview');
    assert.ok(shared.roomGeom.flat(3).every(Number.isFinite));
    assert.notStrictEqual(shared.roomGeom, preview.geometry.roomGeom, 'normalize a private artifact, never mutate render coordinates');
    assert.deepEqual(result.space, frozenCandidate, 'preview/proof cannot rewrite the normalized candidate');
  }
  assert.deepEqual(space, frozenSource, 'preview preparation leaves the source config unchanged');
});

const twoRooms = (widthCm = 34) => {
  // 34 cm square behind 30 cm walls has less than 25 cm² of clean floor.
  // Its attached neighbour makes clearance use the canonical masonry path.
  const w = widthCm / 5 / 240;
  const config = commitWallSegmentModel({ spaces: [{ id: 'tight', cell_cm: 5, rooms: [
    { id: 'small', poly: [[0, 0], [w, 0], [w, w], [0, w]] },
    { id: 'large', poly: [[w, 0], [1, 0], [1, 1], [w, 1], [w, w]] },
  ] }], markers: [] }).config;
  for (const wall of config.spaces[0].wall_segments) wall.cm = 30;
  return commitWallSegmentModel(config).config.spaces[0];
};

test('834 reused proof still refuses tight clearance in centimetres and keeps pre-opening masonry', () => {
  const space = twoRooms(), { canonical, preview } = compare(space);
  assert.ok(canonical.some(v => v.rule === 'clearance' && v.subject === 'small' && v.actual < 25));
  const withOpening = structuredClone(space);
  withOpening.openings = [{ id: 'door', type: 'door', x: .3, y: 0, length: .1, angle: 0 }];
  const cut = buildNodePreview(withOpening), shared = nodePreviewJunctionGeometry(cut);
  assert.ok(shared);
  assert.deepEqual(shared.roomGeom, nodePreviewJunctionGeometry(preview).roomGeom,
    'opening slots affect visible masonry, not the clearance artifact');
  assert.notDeepEqual(cut.geometry.geom, cut.geometry.roomGeom, 'negative control: visible geometry is actually cut');
  compare(withOpening);
  for (const width of [34.999, 35, 35.001]) compare(twoRooms(width));
});

test('834 open-spans, failed geometry and mismatched units cannot reuse the room proof', () => {
  const space = twoRooms();
  space.open_spans = [{ a: space.rooms[0].poly[1], b: space.rooms[0].poly[2] }];
  const preview = buildNodePreview(space);
  assert.ok(preview.input.openCuts.length, 'the fixture has a real structural open-span');
  assert.equal(nodePreviewJunctionGeometry(preview), undefined);
  const good = buildNodePreview(twoRooms());
  for (const status of ['degraded-extra', 'failed-core', 'not-applicable'])
    assert.equal(nodePreviewJunctionGeometry({ ...good, geometry: { ...good.geometry, status } }), undefined);
  assert.equal(nodePreviewJunctionGeometry({ ...good, input: { ...good.input, coordScale: 1 } }), undefined);
});

test('834 scene contour capture is observation only and observer errors remain fail closed', () => {
  const space = twoRooms(), preview = buildNodePreview(space), shared = nodePreviewJunctionGeometry(preview);
  assert.ok(shared);
  assert.equal(preview.renderRoomContours.size, 0, 'no scene result exists before the guard judges it');
  preview.renderRoomContours.set('small', [[0, 0], [1e9, 0], [1e9, 1e9], [0, 1e9]]);
  const config = { spaces: [space] }, walls = structuralNodeWalls(space);
  const violations = junctionLimitViolations(config, space.id, walls, shared);
  assert.ok(violations.some(v => v.rule === 'clearance' && v.subject === 'small' && v.actual < 25),
    'poisoning the render-only cache cannot authorize a collapsed room');
  assert.ok(preview.renderRoomContours.get('small').every(p => p.every(v => Math.abs(v) < 100)), 'guard overwrites the private scene copy');
  assert.equal(nodePreviewJunctionGeometry(preview, false).onRoomInnerContour, undefined,
    'baseline inheritance comparison never invokes a scene observer');
  assert.throws(() => junctionLimitViolations(config, space.id, walls, { ...shared,
    onRoomInnerContour: () => { throw new Error('injected scene observer failure'); },
  }), /injected scene observer failure/, 'candidate integration converts this exception to check_failed, never an empty successful proof');
});

test('834 captured floors retain nested room holes while physical door cuts stay rendering-only', () => {
  let config = commitWallSegmentModel({ spaces: [{ id: 'nested', cell_cm: 5, rooms: [
    { id: 'outer', poly: [[0, 0], [2, 0], [2, 2], [0, 2]] },
    { id: 'island', poly: [[.5, .5], [1, .5], [1, 1], [.5, 1]] },
  ] }], markers: [] }).config;
  for (const wall of config.spaces[0].wall_segments) wall.cm = 30;
  config = commitWallSegmentModel(config).config;
  const space = config.spaces[0];
  space.openings = [{ id: 'door', type: 'door', x: .3, y: 0, length: .1, angle: 0 }];
  const { preview } = compare(space);
  assert.ok(preview.geometry.roomGeom.some(polygon => polygon.length > 1), 'the fixture contains actual masonry holes');
  assert.notDeepEqual(preview.geometry.geom, preview.geometry.roomGeom, 'the door still cuts visible masonry');
});

test('834 Select-only covered-quad optimization preserves the ordinary View boolean material', () => {
  const { model, input } = buildNodePreview(connected.spaces[0]);
  const args = [model.rooms, input.walls, input.openCuts, input.roomOpenings,
    GRID_STEP_N, input.cellCm, GRID_PITCH, NORM_W, input.physicalBodies];
  const canonical = wallBodiesGeometry(...args);
  let calls = 0, skipped = 0;
  const optimized = wallBodiesGeometry(...args, { coveredQuad: (quad, body) => {
    calls++; const covered = wallQuadCovered(quad, body); skipped += Number(covered); return covered;
  } });
  assert.ok(calls > 0 && skipped > 0, 'Select really skips proved redundant strips');
  assert.equal(canonical.status, 'ok'); assert.equal(optimized.status, 'ok');
  for (const key of ['geom', 'roomGeom', 'paperGeom']) {
    const a = canonical[key], b = optimized[key];
    assert.deepEqual(a.map(p => p.length).sort((x, y) => x - y), b.map(p => p.length).sort((x, y) => x - y));
    assert.ok(Math.abs(geometryArea(a) - geometryArea(b)) <= Math.max(1, geometryArea(a)) * 1e-9, `${key}: material unchanged`);
  }
});
